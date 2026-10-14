import { useEffect, useRef, useState } from 'react';
import { MEDIA, DOCS } from '../core/data.ts';
import type { Workspace, PlayerAdapter } from '../core/store.ts';
import type { Origin } from '../core/actions.ts';
import { fmt, useWs } from './hooks.ts';

/** One player surface. Time advances only from the real clock while status is 'playing'. */
export function MediaStage({ ws, act }: { ws: Workspace; act: (a: Parameters<Workspace['act']>[0], o: Origin) => void }) {
  const s = useWs(ws);
  const item = MEDIA.find((m) => m.id === s.media.id)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const st = useRef({ status: 'ready' as 'ready' | 'playing' | 'paused', pos: 0, t0: 0 });
  const [pos, setPos] = useState(0);

  useEffect(() => {
    st.current = { status: 'ready', pos: 0, t0: 0 };
    const adapter: PlayerAdapter = {
      async play() {
        if (video.current && item.src) {
          try { await video.current.play(); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'play_blocked' }; }
          st.current.status = 'playing'; return { ok: true };
        }
        if (st.current.status !== 'playing') { st.current.status = 'playing'; st.current.t0 = performance.now(); }
        return { ok: true };
      },
      pause() { if (video.current && item.src) video.current.pause(); else if (st.current.status === 'playing') { st.current.pos = cur(); } st.current.status = 'paused'; },
      status: () => ({ status: st.current.status, positionSec: cur() }),
    };
    const cur = () => (video.current && item.src ? video.current.currentTime
      : st.current.status === 'playing' ? Math.min(item.durationSec, st.current.pos + (performance.now() - st.current.t0) / 1000) : st.current.pos);
    ws.registerPlayer(adapter);
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = cur(); setPos(p);
      if (st.current.status === 'playing' && !item.src && p >= item.durationSec) { st.current.pos = item.durationSec; st.current.status = 'paused'; ws.reportMedia({ status: 'paused', positionSec: item.durationSec }); }
      const c = canvas.current; if (c) draw(c, item.title, p / item.durationSec, st.current.status === 'playing');
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ws.registerPlayer(null); };
  }, [item.id, ws]);

  const playing = s.media.status === 'playing';
  return (
    <div className="viewer-body" aria-label={item.title}>
      <div className="stage16x9">
        {item.src ? <video ref={video} src={item.src} playsInline /> : <canvas ref={canvas} width={640} height={360} />}
        <span className="demo-badge" title="Demo data. Not real.">DEMO</span>
      </div>
      <div className="transport">
        <button className="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={(e) => act({ type: 'media', op: playing ? 'pause' : 'play' }, e.detail === 0 ? 'keyboard' : 'mouse')}>{playing ? '❚❚' : '▶'}</button>
        <div className="scrub" role="progressbar" aria-valuemin={0} aria-valuemax={item.durationSec} aria-valuenow={Math.round(pos)}><i style={{ width: `${(pos / item.durationSec) * 100}%` }} /></div>
        <span className="mono">{fmt(pos)} / {fmt(item.durationSec)}</span>
      </div>
      <div className="tabs">
        {MEDIA.map((m) => <button key={m.id} className={m.id === item.id ? 'on' : ''} onClick={(e) => act({ type: 'open_media', id: m.id }, e.detail === 0 ? 'keyboard' : 'mouse')}>{m.title.split('· ')[1]}</button>)}
      </div>
      <p className="note">{item.sourceNote}. Illustrative portfolio preview.</p>
    </div>
  );
}

function draw(c: HTMLCanvasElement, title: string, progress: number, playing: boolean) {
  const g = c.getContext('2d'); if (!g) return;
  const { width: w, height: h } = c;
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#5a3a14'); bg.addColorStop(1, '#c58a2e');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,246,229,.9)'; g.font = '600 26px "IBM Plex Sans", sans-serif'; g.fillText(title, 28, 56);
  g.font = '14px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(255,246,229,.7)'; g.fillText('SYNTHETIC SLATE · NOT A FILM', 28, 84);
  // bars move only while the player really is playing
  const t = progress * 180;
  for (let i = 0; i < 48; i++) {
    const a = playing ? 0.25 + 0.75 * Math.abs(Math.sin(t * 3 + i * 0.7)) : 0.18;
    g.fillStyle = 'rgba(255,246,229,.55)'; g.fillRect(28 + i * 12, h - 70 - a * 90, 7, a * 90);
  }
  g.fillStyle = '#3b6bff'; g.fillRect(0, h - 6, w * progress, 6);
}

export function SlideViewer({ ws, act }: { ws: Workspace; act: (a: Parameters<Workspace['act']>[0], o: Origin) => void }) {
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
        <button className="icon" aria-label="Previous slide" disabled={s.slideIndex === 0} onClick={(e) => act({ type: 'slide', op: 'previous' }, e.detail === 0 ? 'keyboard' : 'mouse')}>‹</button>
        <span className="mono">{String(s.slideIndex + 1).padStart(2, '0')} / {String(d.slides.length).padStart(2, '0')}</span>
        <button className="icon" aria-label="Next slide" disabled={s.slideIndex === d.slides.length - 1} onClick={(e) => act({ type: 'slide', op: 'next' }, e.detail === 0 ? 'keyboard' : 'mouse')}>›</button>
      </div>
    </div>
  );
}
