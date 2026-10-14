import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AGENTS, PROJECTS, MEDIA, DOCS, SECTIONS, HQ_COORDS, type Section } from './core/data.ts';
import type { Action, Origin } from './core/actions.ts';
import { COPY } from './core/copy.ts';
import type { Workspace } from './core/store.ts';
import { KastProvider, useKast } from './kast/Kast.tsx';
import { Sphere } from './scene/Sphere.tsx';
import { MediaStage, SlideViewer } from './ui/Media.tsx';
import { useWs, useClock, useReducedMotion } from './ui/hooks.ts';
import { MATRIX } from './integration.ts';

export function App({ ws }: { ws: Workspace }) {
  return <KastProvider ws={ws}><Shell ws={ws} /></KastProvider>;
}

function Shell({ ws }: { ws: Workspace }) {
  const s = useWs(ws);
  const kast = useKast();
  const clock = useClock();
  const reduced = useReducedMotion();
  const [listView, setListView] = useState(false);
  const [noGl, setNoGl] = useState<string | null>(null);
  const [status, setStatus] = useState(false);
  const act = useCallback((a: Action, o: Origin) => ws.act(a, o), [ws]);
  const kastRef = useRef(kast); kastRef.current = kast;

  // Scrolling is a real action: the store calls this hook and records the real scrollY.
  useEffect(() => {
    ws.scrollHook = (to, dy) => {
      if (to) {
        const el = document.getElementById(`sec-${to}`);
        if (to === 'top') window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        else if (to === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
        else el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      } else if (dy) window.scrollBy({ top: dy, behavior: reduced ? 'auto' : 'smooth' });
      return window.scrollY;
    };
    return () => { ws.scrollHook = null; };
  }, [ws, reduced]);

  // Keyboard: same actions as everything else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select') || e.metaKey || e.ctrlKey) return;
      const st = ws.state;
      if (e.key === 'Escape' && st.confirm) { act({ type: 'resolve_confirm', id: st.confirm.id, approve: false }, 'keyboard'); return; }
      if (st.phase !== 'hq') return;
      const step = 0.15;
      if (e.key === 'ArrowLeft') act({ type: 'orbit', dyaw: -step, dpitch: 0 }, 'keyboard');
      else if (e.key === 'ArrowRight') act({ type: 'orbit', dyaw: step, dpitch: 0 }, 'keyboard');
      else if (e.key === 'ArrowUp') act({ type: 'orbit', dyaw: 0, dpitch: -step }, 'keyboard');
      else if (e.key === 'ArrowDown') act({ type: 'orbit', dyaw: 0, dpitch: step }, 'keyboard');
      else if ((e.key === ' ' || e.key.toLowerCase() === 'k') && st.media.id && t.tagName !== 'BUTTON') { e.preventDefault(); act({ type: 'media', op: st.media.status === 'playing' ? 'pause' : 'play' }, 'keyboard'); }
      else return;
      if (e.key.startsWith('Arrow')) e.preventDefault();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [ws, act]);

  useEffect(() => { try { localStorage.setItem('nasa_hq.layout', s.layout); } catch { /* ignore */ } }, [s.layout]);

  // Devtools hook for the browser e2e only: ?devtools=1. Calls the SAME tool handlers KAST uses.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('devtools')) return;
    import('./core/tools.ts').then(({ buildTools }) => {
      (window as unknown as { __nasa: unknown }).__nasa = { ws, tools: buildTools(ws, () => window.scrollY) };
    });
  }, [ws]);

  const enter = async (e: React.MouseEvent) => {
    await act({ type: 'enter' }, e.detail === 0 ? 'keyboard' : 'mouse');
    kastRef.current.connect(); // user gesture: needed for the microphone and audio unlock
  };

  const project = PROJECTS.find((p) => p.id === s.openProject);
  const selAgent = AGENTS.find((a) => a.id === s.selectedNode);
  const level = useMemo(() => () => (kast.speaking ? kast.outputLevel() : kast.listening ? kast.inputLevel() * 0.6 : 0), [kast]);
  const inOrigin = (e: React.MouseEvent): Origin => (e.detail === 0 ? 'keyboard' : 'mouse');

  return (
    <div className="app" data-layout={s.layout} data-phase={s.phase}>
      <Plate />
      <header className="top" id="sec-top">
        <div className="wordmark"><b>{COPY.wordmark[0]}</b><span>/ {COPY.wordmark[1]}</span></div>
        <div className="basmala" lang="ar" dir="rtl">{COPY.basmala}</div>
        <div className="meta">
          <span className="pill mono" aria-label="Cairo and UTC time">Cairo {clock.cairo} · UTC {clock.utc}</span>
          <span className="pill mono">{HQ_COORDS.lat.toFixed(3)} N / {HQ_COORDS.lng.toFixed(3)} E <i aria-hidden="true">◎</i></span>
        </div>
      </header>
      <div className="banner" role="note"><b>SYNTHETIC DATA</b> · review build. Projects, films, progress and clocks-on-screens are illustrative.</div>

      {s.phase === 'gate' ? (
        <main className="gate glass">
          <h1>Select an agent</h1>
          <div className="agent-grid">{AGENTS.map((a) => <div key={a.id} className={`tile ${a.id === 'kast' ? 'on' : ''}`}><b>{a.name}</b><span>{a.routing}</span></div>)}</div>
          <button className="primary" onClick={enter}>{COPY.enter}</button>
          <p className="note">{COPY.enterSub}</p>
        </main>
      ) : (
        <>
          <div className="toolbar">
            <div role="group" aria-label="Layout">{(['auto', 'portrait', 'horizontal'] as const).map((l) => <button key={l} className={s.layout === l ? 'on' : ''} onClick={(e) => act({ type: 'set_layout', layout: l }, inOrigin(e))}>{l[0].toUpperCase() + l.slice(1)}</button>)}</div>
            <button className={listView ? 'on' : ''} onClick={() => setListView((v) => !v)}>LIST</button>
            <button onClick={() => setStatus(true)}>STATUS</button>
          </div>
          <main className="grid">
            <section className="glass agents" aria-label="Agents">
              <h2>Agents</h2>
              <div className="agent-grid">{AGENTS.map((a) => <button key={a.id} className={`tile ${s.selectedNode === a.id ? 'on' : ''}`} onClick={(e) => act({ type: 'select_node', id: a.id }, inOrigin(e))}><b>{a.name}</b><span>{a.routing}</span></button>)}</div>
              <div className="char"><h3>Character asset</h3><div className="box">Character asset pending</div><div className="row"><button disabled>Select</button><button disabled>Orbit</button><button onClick={(e) => act({ type: 'reset_view' }, inOrigin(e))}>Reset</button></div></div>
            </section>

            <section className="glass stage" id="sec-stage" aria-label="Agent network">
              <h2>KAST Agent Network</h2>
              {listView || noGl ? (
                <ul className="listview">{[...AGENTS, ...PROJECTS].map((n) => <li key={n.id}><button onClick={(e) => act({ type: 'select_node', id: n.id }, inOrigin(e))} aria-pressed={s.selectedNode === n.id}>{'name' in n ? n.name : n.title}</button></li>)}{noGl && <li className="note">Light view on. Same HQ, less load. ({noGl})</li>}</ul>
              ) : (
                <Sphere camera={s.camera} selected={s.selectedNode} reducedMotion={reduced} level={level}
                  onSelect={(id, o) => act({ type: 'select_node', id }, o)} onOrbit={(dy, dp, o) => act({ type: 'orbit', dyaw: dy, dpitch: dp }, o)} onUnavailable={setNoGl} />
              )}
            </section>

            <section className="glass projects" id="sec-projects" aria-label="Projects">
              <h2>Key Projects</h2>
              <div className="cards">
                {PROJECTS.map((p) => (
                  <article key={p.id} className={`card ${s.openProject === p.id ? 'on' : ''}`}>
                    <div className="thumb" aria-hidden="true" /><div><h3>{p.title}</h3><p>{p.scope} · {p.status}</p></div>
                    <button onClick={(e) => act({ type: 'open_project', id: p.id }, inOrigin(e))} aria-label={`Open project ${p.title}`}>Open</button>
                  </article>
                ))}
              </div>
              {project && (
                <div className="detail">
                  <h3>{project.title} <span className="demo-badge" title="Demo data. Not real.">DEMO</span></h3>
                  <div className="row">
                    <button onClick={(e) => act({ type: 'open_document', id: project.docId }, inOrigin(e))}>Working brief</button>
                    {project.mediaIds.map((m) => <button key={m} onClick={(e) => act({ type: 'open_media', id: m }, inOrigin(e))}>{MEDIA.find((x) => x.id === m)?.title.split('· ')[1]}</button>)}
                    {project.mediaIds.length === 0 && <span className="note">No film linked.</span>}
                    <button onClick={(e) => act({ type: 'close_project' }, inOrigin(e))}>Close</button>
                  </div>
                </div>
              )}
            </section>

            <section className="glass viewer" id="sec-viewer" aria-label="Viewer">
              <h2>{s.media.id ? 'Portfolio / Showreel' : s.openDocument ? 'Presentation' : 'Viewer'}</h2>
              {s.media.id ? <MediaStage ws={ws} act={act} /> : s.openDocument ? <SlideViewer ws={ws} act={act} /> : <p className="note">Nothing here yet. Open a project, then a brief or film.</p>}
              {s.gallery && <div className="gallery"><h3>Gallery</h3><div className="row">{MEDIA.map((m) => <button key={m.id} onClick={(e) => act({ type: 'open_media', id: m.id }, inOrigin(e))}>{m.title.split('· ')[1]}</button>)}{DOCS.map((d) => <button key={d.id} onClick={(e) => act({ type: 'open_document', id: d.id }, inOrigin(e))}>{d.title.split(' / ')[0]}</button>)}</div></div>}
            </section>

            <aside className="glass inspector" aria-label="Inspector">
              <h2>Inspector</h2>
              <dl>
                <dt>Selection</dt><dd>{selAgent ? selAgent.name : project ? project.title : 'No selection'}</dd>
                <dt>Context</dt><dd>{project ? project.scope : '—'}</dd>
                <dt>Location</dt><dd>{HQ_COORDS.lat} N / {HQ_COORDS.lng} E</dd>
                <dt>Control</dt><dd>{s.control}</dd>
                <dt>Scroll</dt><dd>{s.scrollSection}</dd>
                <dt>Saved context</dt><dd>{ws.savedContext ? `v${ws.savedContext.version} · ${ws.contexts.kind}` : 'None yet'}</dd>
              </dl>
            </aside>

            <KastPanel ws={ws} act={act} />
          </main>
          <nav className="dock glass" aria-label="Dock">
            {([['Agents', 'stage'], ['Projects', 'projects'], ['Media', 'viewer'], ['Memory', 'kast']] as [string, Section][]).map(([l, to]) => <button key={l} onClick={(e) => act({ type: 'scroll', to }, inOrigin(e))}>{l}</button>)}
            <button onClick={(e) => act({ type: 'gallery' }, inOrigin(e))} aria-pressed={s.gallery}>Gallery</button>
            <button onClick={(e) => act({ type: 'scroll', to: 'bottom' }, inOrigin(e))}>Settings</button>
          </nav>
        </>
      )}

      {s.confirm && <ConfirmSheet ws={ws} act={act} />}
      {status && <div className="sheet-wrap" onClick={() => setStatus(false)}><div className="sheet glass wide" role="dialog" aria-modal="true" aria-label="Integration status" onClick={(e) => e.stopPropagation()}>
        <h2>Integration status</h2>
        <ul className="matrix">{MATRIX.map((r) => <li key={r.feature}><span className={`chip ${r.status}`}>{r.status}</span><b>{r.feature}</b><small>{r.evidence}</small></li>)}</ul>
        <button onClick={() => setStatus(false)}>Close</button></div></div>}
      <span hidden>{SECTIONS.length}</span>
    </div>
  );
}

function KastPanel({ ws, act }: { ws: Workspace; act: (a: Action, o: Origin) => void }) {
  const s = useWs(ws);
  const kast = useKast();
  const [text, setText] = useState('');
  const [bars, setBars] = useState<number[]>(() => Array(24).fill(0));
  useEffect(() => { // bars are a direct read of the SDK's audio levels, nothing else
    if (!kast.speaking && !kast.listening) { setBars(Array(24).fill(0)); return; }
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); const v = kast.speaking ? kast.outputLevel() : kast.listening ? kast.inputLevel() : 0;
      setBars((b) => [...b.slice(1), v]); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [kast.speaking, kast.listening]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = kast.link === 'connected' ? (kast.speaking ? 'Speaking' : 'Listening') : kast.link === 'connecting' ? 'Connecting' : kast.link === 'unconfigured' || kast.link === 'error' ? COPY.kastNotConnected : 'Idle';
  const summary = `${s.openProject ? `Project ${s.openProject}` : 'No project open'}${s.media.id ? `; film ${s.media.id} ${s.media.status} at ${s.media.positionSec.toFixed(0)}s` : ''}${s.openDocument ? `; brief ${s.openDocument} slide ${s.slideIndex + 1}` : ''}.`;
  return (
    <section className="glass kast" id="sec-kast" aria-label="KAST">
      <h2>KAST <span className={`chip ${kast.link}`} aria-live="polite">{label}</span></h2>
      <div className="wave" aria-hidden="true">{bars.map((v, i) => <i key={i} style={{ height: `${6 + v * 54}px` }} />)}</div>
      {(kast.link === 'unconfigured' || kast.link === 'error') && <p className="note" role="status">{COPY.kastNotConnectedDetail} {kast.error}</p>}
      <div className="row">
        {kast.link === 'connected' ? <button className="stop" onClick={kast.end}>Stop</button> : <button onClick={() => kast.connect()} disabled={kast.link === 'connecting'}>Start conversation</button>}
        <button className={s.captions ? 'on' : ''} aria-pressed={s.captions} onClick={(e) => act({ type: 'captions', on: !s.captions }, e.detail === 0 ? 'keyboard' : 'mouse')}>Live captions</button>
      </div>
      <div className="control" role="group" aria-label="Control owner">
        <span className={s.control === 'USER_CONTROL' ? 'on' : ''}>{COPY.userControl}</span><span className={s.control === 'AGENT_CONTROL' ? 'on' : ''}>{COPY.agentControl}</span>
        <button onClick={(e) => act({ type: 'set_control', owner: 'USER_CONTROL' }, e.detail === 0 ? 'keyboard' : 'mouse')} disabled={s.control === 'USER_CONTROL'}>{COPY.giveControl}</button>
        <button onClick={(e) => act({ type: 'set_control', owner: 'AGENT_CONTROL' }, e.detail === 0 ? 'keyboard' : 'mouse')} disabled={s.control === 'AGENT_CONTROL'}>{COPY.takeControl}</button>
      </div>
      <ol className="lines" aria-live="polite">{(s.captions || kast.lines.length > 0) && kast.lines.slice(-6).map((l) => <li key={l.id} className={l.who}><b>{l.who === 'you' ? 'You' : 'KAST'}</b> {l.text}</li>)}{kast.lines.length === 0 && <li className="note">No conversation yet.</li>}</ol>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && kast.link === 'connected') { kast.sendText(text.trim()); setText(''); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask KAST a question…" aria-label="Ask KAST a question" disabled={kast.link !== 'connected'} />
      </form>
      <div className="memory">
        <h3>Memory</h3>
        <p className="note">{ws.savedContext ? `Latest approved v${ws.savedContext.version}: ${ws.savedContext.text}` : 'No approved context yet.'} <span className="demo-badge" title="Demo data. Not real.">SYNTHETIC STORE</span></p>
        <button onClick={(e) => act({ type: 'propose_save_context', text: summary }, e.detail === 0 ? 'keyboard' : 'mouse')}>Save context…</button>
      </div>
    </section>
  );
}

function ConfirmSheet({ ws, act }: { ws: Workspace; act: (a: Action, o: Origin) => void }) {
  const c = useWs(ws).confirm!;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, [c.id]);
  return (
    <div className="sheet-wrap"><div className="sheet glass" role="dialog" aria-modal="true" aria-labelledby="cs-t"
      onKeyDown={(e) => { if (e.key === 'Tab') { const f = [...(e.currentTarget.querySelectorAll('button'))]; const i = f.indexOf(document.activeElement as HTMLButtonElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } }}>
      <h2 id="cs-t">{c.title}</h2><p>{c.detail}</p>{c.text && <blockquote>{c.text}</blockquote>}
      <div className="row"><button ref={first} className="primary" onClick={(e) => act({ type: 'resolve_confirm', id: c.id, approve: true }, e.detail === 0 ? 'keyboard' : 'mouse')}>{c.kind === 'save_context' ? 'Save' : 'Allow'}</button>
        <button onClick={(e) => act({ type: 'resolve_confirm', id: c.id, approve: false }, e.detail === 0 ? 'keyboard' : 'mouse')}>Cancel</button></div>
      <p className="note">Waiting for your choice</p></div></div>
  );
}

function Plate() {
  return (
    <div className="plate" aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5a1e" /><stop offset=".5" stopColor="#d9a24a" /><stop offset="1" stopColor="#f0c978" /></linearGradient>
          <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".012 .03" numOctaves="4" seed="7" /><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .2  0 0 0 0 .05  0 0 0 .55 0" /></filter>
          <linearGradient id="w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5f7f6a" /><stop offset="1" stopColor="#7fa28a" /></linearGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#g)" /><rect width="1600" height="1000" filter="url(#n)" opacity=".7" />
        <path d="M-50 640 C 250 520, 420 760, 700 600 S 1150 380, 1380 470 S 1650 420, 1700 330" fill="none" stroke="url(#w)" strokeWidth="64" strokeLinecap="round" opacity=".9" />
        <path d="M-50 640 C 250 520, 420 760, 700 600 S 1150 380, 1380 470 S 1650 420, 1700 330" fill="none" stroke="#2f4a3c" strokeWidth="6" opacity=".35" />
      </svg>
      <div className="flare" /><div className="grade" /><span className="plate-tag mono">DEMO PLATE · synthetic, not satellite imagery</span>
    </div>
  );
}
