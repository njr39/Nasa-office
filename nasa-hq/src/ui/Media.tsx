import { useEffect, useRef, useState } from 'react';
import { MEDIA, DOCS, removeLocalMedia, addLocalMedia } from '../core/data.ts';
import type { Workspace, PlayerAdapter } from '../core/store.ts';
import type { Action, Origin } from '../core/actions.ts';
import { fmt, useWs } from './hooks.ts';

type Act = (a: Action, o: Origin) => void;
const inOrigin = (e: React.MouseEvent): Origin => (e.detail === 0 ? 'keyboard' : 'mouse');
const MEDIA_ERRORS: Record<number, string> = { 1: 'Loading was aborted.', 2: 'A network error stopped the video.', 3: 'The video could not be decoded.', 4: 'This video format or source is not supported.' };

/**
 * One player surface. If the item has a source it is a REAL <video> element: status, position, ended and error come
 * from the element's own state and events. Without a source (film-02) it is a canvas slate, a control-path test only.
 */
export function MediaStage({ ws, act }: { ws: Workspace; act: Act }) {
  const s = useWs(ws);
  const item = MEDIA.find((m) => m.id === s.media.id)!;
  const real = !!item.src;
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const slate = useRef({ status: 'ready' as 'ready' | 'playing' | 'paused', pos: 0, t0: 0 });
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(item.durationSec);
  const [muted, setMuted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    setProblem(null); setWaiting(false); setPos(0); setDuration(item.durationSec);
    if (real) {
      const v = video.current!; let played = false;
      const adapter: PlayerAdapter = {
        async play() {
          try { await v.play(); played = true; return { ok: true }; }
          catch (e) { return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : 'play_failed' }; }   // autoplay policy, decode error, aborted
        },
        pause() { v.pause(); },
        seek(sec) { v.currentTime = Math.min(Math.max(0, sec), Number.isFinite(v.duration) ? v.duration : sec); },
        status() {
          if (v.error) return { status: 'unavailable', positionSec: v.currentTime };
          if (!v.paused && !v.ended) return { status: 'playing', positionSec: v.currentTime };
          return { status: played || v.currentTime > 0 ? 'paused' : 'ready', positionSec: v.currentTime };
        },
      };
      const onMeta = () => Number.isFinite(v.duration) && setDuration(v.duration);
      const onEnded = () => ws.reportMedia({ status: 'paused', positionSec: v.duration });
      const onError = () => { setProblem(MEDIA_ERRORS[v.error?.code ?? 0] ?? 'The video failed to load.'); ws.reportMedia({ status: 'unavailable' }); };
      const onWait = () => setWaiting(true), onPlay = () => setWaiting(false);
      v.addEventListener('loadedmetadata', onMeta); v.addEventListener('ended', onEnded); v.addEventListener('error', onError);
      v.addEventListener('waiting', onWait); v.addEventListener('playing', onPlay); v.addEventListener('canplay', onPlay);
      onMeta(); ws.registerPlayer(adapter);
      let raf = 0; const tick = () => { raf = requestAnimationFrame(tick); setPos(v.currentTime); }; raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf); ws.registerPlayer(null); v.pause();
        v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('ended', onEnded); v.removeEventListener('error', onError);
        v.removeEventListener('waiting', onWait); v.removeEventListener('playing', onPlay); v.removeEventListener('canplay', onPlay);
      };
    }
    // synthetic slate: a clock that advances only while "playing"
    slate.current = { status: 'ready', pos: 0, t0: 0 };
    const cur = () => (slate.current.status === 'playing' ? Math.min(item.durationSec, slate.current.pos + (performance.now() - slate.current.t0) / 1000) : slate.current.pos);
    const adapter: PlayerAdapter = {
      async play() { if (slate.current.status !== 'playing') { slate.current.status = 'playing'; slate.current.t0 = performance.now(); } return { ok: true }; },
      pause() { if (slate.current.status === 'playing') slate.current.pos = cur(); slate.current.status = 'paused'; },
      seek(sec) { slate.current.pos = Math.min(item.durationSec, Math.max(0, sec)); slate.current.t0 = performance.now(); },
      status: () => ({ status: slate.current.status, positionSec: cur() }),
    };
    ws.registerPlayer(adapter);
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = cur(); setPos(p);
      if (slate.current.status === 'playing' && p >= item.durationSec) { slate.current.pos = item.durationSec; slate.current.status = 'paused'; ws.reportMedia({ status: 'paused', positionSec: item.durationSec }); }
      const c = canvas.current; if (c) draw(c, item.title, p / item.durationSec, slate.current.status === 'playing');
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ws.registerPlayer(null); };
  }, [item.id, real, ws]);

  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted, item.id]);

  const status = s.media.status;
  const playing = status === 'playing';
  return (
    <div className="viewer-body" aria-label={item.title}>
      <div className="stage16x9">
        {real ? <video ref={video} src={item.src!} playsInline preload="metadata" aria-label={item.title} /> : <canvas ref={canvas} width={640} height={360} />}
        <span className="demo-badge" title="Demo data. Not real.">{real ? (item.local ? 'LOCAL FILE' : 'TEST CLIP') : 'SYNTHETIC SLATE'}</span>
        {waiting && <span className="buffering" role="status">Buffering…</span>}
      </div>
      {problem && <p className="note" role="alert">Unavailable. {problem}</p>}
      <div className="transport">
        <button className="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={(e) => act({ type: 'media', op: playing ? 'pause' : 'play' }, inOrigin(e))}>{playing ? '❚❚' : '▶'}</button>
        <input className="seek" type="range" min={0} max={Math.max(duration, 0.1)} step={0.1} value={Math.min(pos, duration || pos)} aria-label="Seek" aria-valuetext={`${fmt(pos)} of ${fmt(duration)}`}
          onChange={(e) => { const sec = Number(e.target.value); setPos(sec); act({ type: 'media_seek', sec }, 'mouse'); }} />
        <span className="mono" data-testid="clock">{fmt(pos)} / {fmt(duration)}</span>
        {real && <button className="icon" aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>{muted ? '🔇' : '🔊'}</button>}
        {real && <button className="icon" aria-label="Fullscreen" onClick={() => { void video.current?.requestFullscreen?.().catch(() => setProblem('The browser refused fullscreen here.')); }}>⛶</button>}
      </div>
      <div className="tabs">
        {MEDIA.filter((m) => !m.local).map((m) => <button key={m.id} className={m.id === item.id ? 'on' : ''} aria-pressed={m.id === item.id} onClick={(e) => act({ type: 'open_media', id: m.id }, inOrigin(e))}>{m.title.split('· ')[1]}</button>)}
        {item.local && <button className="on" aria-pressed>Local file</button>}
      </div>
      <p className="note">{real ? (item.local ? `Your file: ${item.title}. It is played from this browser and is never uploaded or sent to KAST.` : `${item.sourceNote}. A real video element: play, pause and position come from the element itself.`) : `Synthetic slate-control test: no real film or player is involved. ${item.sourceNote}.`}</p>
    </div>
  );
}

/** "Open a local video": plays a file the user chooses, entirely in this browser. */
export function LocalVideoPicker({ act }: { act: Act }) {
  const input = useRef<HTMLInputElement>(null);
  const url = useRef<string | null>(null); const id = useRef<string | null>(null);
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); if (id.current) removeLocalMedia(id.current); }, []);
  return (
    <div className="local-video">
      <input ref={input} id="local-video-input" type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*" hidden
        onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
          if (url.current) URL.revokeObjectURL(url.current); if (id.current) removeLocalMedia(id.current);
          url.current = URL.createObjectURL(f); const item = addLocalMedia(f.name, url.current); id.current = item.id;
          act({ type: 'open_media', id: item.id }, 'mouse');
        }} />
      <button onClick={() => input.current?.click()}>Open a local video…</button>
      <span className="note"> Plays in this browser only. Not uploaded, not sent to KAST.</span>
    </div>
  );
}

function draw(c: HTMLCanvasElement, title: string, progress: number, playing: boolean) {
  const g = c.getContext('2d'); if (!g) return;
  const { width: w, height: h } = c;
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#5a3a14'); bg.addColorStop(1, '#c58a2e');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,246,229,.9)'; g.font = '600 26px "IBM Plex Sans", sans-serif'; g.fillText(title, 28, 56);
  g.font = '14px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(255,246,229,.7)'; g.fillText('SYNTHETIC SLATE · CONTROL TEST', 28, 84);
  const t = progress * 180;
  for (let i = 0; i < 48; i++) {
    const a = playing ? 0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 0.7)) : 0.18;
    g.fillStyle = 'rgba(255,246,229,.55)'; g.fillRect(28 + i * 12, h - 70 - a * 90, 7, a * 90);
  }
  g.fillStyle = '#3b6bff'; g.fillRect(0, h - 6, w * progress, 6);
}

export function SlideViewer({ ws, act }: { ws: Workspace; act: Act }) {
  const s = useWs(ws);
  const d = DOCS.find((x) => x.id === s.openDocument)!;
  return (
    <div className="viewer-body" aria-label={d.title}>
      <div className="stage16x9 slide">
        <h4>{d.slides[s.slideIndex]}</h4>
        <p className="mono">{d.title}</p>
        <span className="demo-badge" title="Demo data. Not real.">ILLUSTRATIVE</span>
      </div>
      <div className="transport">
        <button className="icon" aria-label="Previous slide" disabled={s.slideIndex === 0} onClick={(e) => act({ type: 'slide', op: 'previous' }, inOrigin(e))}>‹</button>
        <span className="mono">{String(s.slideIndex + 1).padStart(2, '0')} / {String(d.slides.length).padStart(2, '0')}</span>
        <button className="icon" aria-label="Next slide" disabled={s.slideIndex === d.slides.length - 1} onClick={(e) => act({ type: 'slide', op: 'next' }, inOrigin(e))}>›</button>
      </div>
    </div>
  );
}
