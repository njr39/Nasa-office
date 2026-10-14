import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AGENTS, PROJECTS, MEDIA, DOCS, HANDOFFS, WEB_SOURCES, HQ_COORDS, type Section } from './core/data.ts';
import type { Action, Origin } from './core/actions.ts';
import { describeSnapshot, viewSnapshot } from './core/actions.ts';
import { PROJECT_VIEWS } from './core/validate.ts';
import { COPY } from './core/copy.ts';
import type { Workspace, ScrollOutcome } from './core/store.ts';
import { useKast, type Kast } from './kast/useKast.tsx';
import { Sphere } from './scene/Sphere.tsx';
import { MediaStage, SlideViewer } from './ui/Media.tsx';
import { useWs, useClock, useReducedMotion } from './ui/hooks.ts';
import { MATRIX, type Row } from './integration.ts';

type Act = (a: Action, o: Origin) => void;
const inOrigin = (e: React.MouseEvent): Origin => (e.detail === 0 ? 'keyboard' : 'mouse');

export function App({ ws }: { ws: Workspace }) {
  const s = useWs(ws);
  const kast = useKast(ws);
  const clock = useClock();
  const reduced = useReducedMotion();
  const [noGl, setNoGl] = useState<string | null>(null);
  const [status, setStatus] = useState(false);
  const act = useCallback<Act>((a, o) => { void ws.act(a, o); }, [ws]);

  // Scrolling is a real action. The store awaits this and reports the OBSERVED final position, not the request.
  useEffect(() => {
    let cancelled = false;
    ws.cancelScroll = () => { cancelled = true; window.scrollTo({ top: window.scrollY, behavior: 'auto' }); };
    ws.scrollHook = (to, dy) => new Promise<ScrollOutcome>((resolve) => {
      cancelled = false;
      const behavior = reduced ? 'auto' : 'smooth';
      if (to === 'top') window.scrollTo({ top: 0, behavior });
      else if (to === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
      else if (to) document.getElementById(`sec-${to}`)?.scrollIntoView({ behavior, block: 'start' });
      else if (dy) window.scrollBy({ top: dy, behavior });
      const t0 = performance.now(); let last = window.scrollY; let still = t0;
      const tick = () => {
        const y = window.scrollY, now = performance.now();
        if (Math.abs(y - last) > 0.5) { last = y; still = now; }
        if (cancelled) return resolve({ y, settled: false });
        if (now - still > 200) return resolve({ y, settled: true });
        if (now - t0 > 2500) return resolve({ y, settled: false });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return () => { ws.scrollHook = null; ws.cancelScroll = null; };
  }, [ws, reduced]);

  // Keyboard: the same actions as everything else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select') || e.metaKey || e.ctrlKey) return;
      const st = ws.state;
      if (e.key === 'Escape' && st.confirm && !st.confirm.busy) { act({ type: 'resolve_confirm', id: st.confirm.id, approve: false }, 'keyboard'); return; }
      if (st.phase !== 'hq') return;
      const step = 0.15;
      if (e.key === 'ArrowLeft') act({ type: 'orbit', dyaw: -step, dpitch: 0 }, 'keyboard');
      else if (e.key === 'ArrowRight') act({ type: 'orbit', dyaw: step, dpitch: 0 }, 'keyboard');
      else if (e.key === 'ArrowUp') act({ type: 'orbit', dyaw: 0, dpitch: -step }, 'keyboard');
      else if (e.key === 'ArrowDown') act({ type: 'orbit', dyaw: 0, dpitch: step }, 'keyboard');
      else if ((e.key === ' ' || e.key.toLowerCase() === 'k') && st.media.id && t.tagName !== 'BUTTON') { e.preventDefault(); act({ type: 'media', op: ws.liveMedia().status === 'playing' ? 'pause' : 'play' }, 'keyboard'); }
      else return;
      if (e.key.startsWith('Arrow')) e.preventDefault();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [ws, act]);

  useEffect(() => { try { localStorage.setItem('nasa_hq.layout', s.layout); } catch { /* ignore */ } }, [s.layout]);

  // Devtools hook for the browser e2e only (?devtools=1). It opens a test session and calls the SAME handlers KAST uses.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('devtools')) return;
    import('./core/tools.ts').then(({ buildTools }) => {
      const open = () => { const session = ws.openSession(); return { session, tools: buildTools(ws, { session, readScrollY: () => window.scrollY }) }; };
      (window as unknown as { __nasa: unknown }).__nasa = { ws, open };
    });
  }, [ws]);

  const enter = async (e: React.MouseEvent) => {
    const agent = s.entryAgent; if (!agent) return;
    const r = await ws.act({ type: 'enter', agent }, inOrigin(e));
    if (r.ok && agent === 'kast') kast.start();                   // explicit user gesture; still gated by the server (off by default)
  };

  const project = PROJECTS.find((p) => p.id === s.openProject);
  const selAgent = AGENTS.find((a) => a.id === s.selectedNode);
  const level = useMemo(() => () => (kast.speaking ? kast.outputLevel() : 0), [kast]);

  return (
    <div className="app" data-layout={s.layout} data-phase={s.phase}>
      <Plate />
      <header className="top" id="sec-top">
        <div className="wordmark"><b>{COPY.wordmark[0]}</b><span>/ {COPY.wordmark[1]}</span></div>
        <div className="meta">
          <span className="pill mono" aria-label="Cairo and UTC time">Cairo {clock.cairo} · UTC {clock.utc}</span>
          <span className="pill mono">{HQ_COORDS.lat.toFixed(3)} N / {HQ_COORDS.lng.toFixed(3)} E <i aria-hidden="true">◎</i></span>
        </div>
      </header>
      <div className="banner" role="note"><b>SYNTHETIC DATA</b> · review build. Projects, films, progress and notes are illustrative. {COPY.syntheticNote}</div>

      {s.phase === 'gate' ? (
        <main className="gate glass">
          <h1>{COPY.gateTitle}</h1>
          <div className="agent-grid" role="radiogroup" aria-label={COPY.gateTitle}>
            {AGENTS.map((a) => (
              <button key={a.id} role="radio" aria-checked={s.entryAgent === a.id} className={`tile ${s.entryAgent === a.id ? 'on' : ''}`} onClick={(e) => act({ type: 'choose_agent', id: a.id }, inOrigin(e))}><b>{a.name}</b><span>{a.routing}</span></button>
            ))}
          </div>
          <button className="primary" disabled={!s.entryAgent} onClick={enter}>{COPY.enter}</button>
          <p className="note" role="status">{s.entryAgent ? COPY.enterSub : COPY.enterNeedsAgent}</p>
        </main>
      ) : (
        <>
          <div className="toolbar">
            <div role="group" aria-label="Layout">{(['auto', 'portrait', 'horizontal'] as const).map((l) => <button key={l} className={s.layout === l ? 'on' : ''} aria-pressed={s.layout === l} onClick={(e) => act({ type: 'set_layout', layout: l }, inOrigin(e))}>{l[0].toUpperCase() + l.slice(1)}</button>)}</div>
            <button className={s.listView ? 'on' : ''} aria-pressed={s.listView} onClick={(e) => act({ type: 'set_list', on: !s.listView }, inOrigin(e))}>LIST</button>
            <button className={s.mode === 'read_only' ? 'on' : ''} aria-pressed={s.mode === 'read_only'} onClick={(e) => act({ type: 'set_mode', mode: s.mode === 'read_only' ? 'normal' : 'read_only' }, inOrigin(e))}>{s.mode === 'read_only' ? `🔒 ${COPY.readOnly}` : COPY.readOnly}</button>
            <button onClick={() => setStatus(true)}>STATUS</button>
          </div>
          <main className="grid">
            <section className="glass agents" aria-label="Agents">
              <h2>Agents</h2>
              <div className="agent-grid">{AGENTS.map((a) => <button key={a.id} className={`tile ${s.selectedNode === a.id ? 'on' : ''}`} aria-pressed={s.selectedNode === a.id} onClick={(e) => act({ type: 'select_node', id: a.id }, inOrigin(e))}><b>{a.name}</b><span>{a.routing}</span></button>)}</div>
              <p className="note">Roles are routing labels. Availability and provider bindings are not connected.</p>
              <div className="char"><h3>Character asset</h3><div className="box">Character asset pending</div><div className="row"><button disabled>Select</button><button disabled>Orbit</button><button onClick={(e) => act({ type: 'reset_view' }, inOrigin(e))}>Reset</button></div></div>
            </section>

            <section className="glass stage" id="sec-stage" aria-label="Agent network">
              <h2>KAST Agent Network</h2>
              {s.listView || noGl ? (
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
              <p className="note">Project ids are demo labels. Mapping to the canonical project register is not done.</p>
              {project && <ProjectDetail ws={ws} act={act} projectId={project.id} />}
              <Handoffs projectId={s.openProject} />
            </section>

            <section className="glass viewer" id="sec-viewer" aria-label="Viewer">
              <h2>{s.media.id ? 'Slate control (synthetic)' : s.openDocument ? 'Presentation' : s.openWeb ? 'External website' : 'Viewer'}</h2>
              {s.media.id ? <MediaStage ws={ws} act={act} /> : s.openDocument ? <SlideViewer ws={ws} act={act} /> : s.openWeb ? <BlockedWeb id={s.openWeb} /> : <p className="note">Nothing here yet. Open a project, then a brief, film or website.</p>}
              {s.gallery && <div className="gallery"><h3>Gallery</h3><div className="row">{MEDIA.map((m) => <button key={m.id} onClick={(e) => act({ type: 'open_media', id: m.id }, inOrigin(e))}>{m.title.split('· ')[1]}</button>)}{DOCS.map((d) => <button key={d.id} onClick={(e) => act({ type: 'open_document', id: d.id }, inOrigin(e))}>{d.title.split(' / ')[0]}</button>)}</div></div>}
            </section>

            <aside className="glass inspector" aria-label="Inspector">
              <h2>Inspector</h2>
              <dl>
                <dt>Selection</dt><dd>{selAgent ? selAgent.name : project ? project.title : 'No selection'}</dd>
                <dt>Context</dt><dd>{project ? project.scope : '—'}</dd>
                <dt>Location</dt><dd>{HQ_COORDS.lat} N / {HQ_COORDS.lng} E</dd>
                <dt>Control</dt><dd>{s.control}</dd>
                <dt>Mode</dt><dd>{s.mode === 'read_only' ? COPY.readOnly : 'Normal'}</dd>
                <dt>Viewer</dt><dd>{s.openWeb ? 'External website (cannot be embedded here)' : s.openDocument ? 'Presentation' : s.media.id ? 'Synthetic slate' : 'None'}</dd>
              </dl>
            </aside>

            <KastPanel ws={ws} act={act} kast={kast} />
          </main>
          <nav className="dock glass" aria-label="Dock">
            {([['Agents', 'stage'], ['Projects', 'projects'], ['Media', 'viewer'], ['Memory', 'kast']] as [string, Section][]).map(([l, to]) => <button key={l} onClick={(e) => act({ type: 'scroll', to }, inOrigin(e))}>{l}</button>)}
            <button onClick={(e) => act({ type: 'gallery' }, inOrigin(e))} aria-pressed={s.gallery}>Gallery</button>
            <button onClick={(e) => act({ type: 'scroll', to: 'bottom' }, inOrigin(e))}>Settings</button>
          </nav>
        </>
      )}

      {s.confirm && <ConfirmSheet ws={ws} act={act} />}
      {status && <StatusDialog onClose={() => setStatus(false)} />}
    </div>
  );
}

function ProjectDetail({ ws, act, projectId }: { ws: Workspace; act: Act; projectId: string }) {
  const s = useWs(ws);
  const p = PROJECTS.find((x) => x.id === projectId)!;
  const docs = DOCS.filter((d) => d.projectId === p.id); const films = MEDIA.filter((m) => p.mediaIds.includes(m.id));
  return (
    <div className="detail">
      <h3>{p.title} <span className="demo-badge" title="Demo data. Not real.">DEMO</span></h3>
      <div className="row" role="tablist" aria-label="Project view">
        {PROJECT_VIEWS.map((v) => <button key={v} role="tab" aria-selected={s.projectView === v} className={s.projectView === v ? 'on' : ''} onClick={(e) => act({ type: 'set_view', view: v }, inOrigin(e))}>{v[0].toUpperCase() + v.slice(1)}</button>)}
      </div>
      <div className="view-body" role="tabpanel">
        {s.projectView === 'board' && <div className="board">{['Open', 'In review', 'Done'].map((c, i) => <div key={c}><h4>{c}</h4><p className="note">{i === 0 ? docs.map((d) => d.title.split(' / ')[1]).join(', ') || 'Nothing here yet.' : 'Nothing here yet.'}</p></div>)}</div>}
        {s.projectView === 'list' && <ul>{[...docs.map((d) => d.title), ...films.map((f) => f.title)].map((t) => <li key={t}>{t}</li>)}</ul>}
        {s.projectView === 'timeline' && <p className="note">No dates are connected. Timeline needs the project register.</p>}
        {s.projectView === 'memory' && <p className="note">{ws.savedContext ? `Last synthetic context (v${ws.savedContext.version}): ${ws.savedContext.summary}` : 'No synthetic context saved for this project.'}</p>}
        {s.projectView === 'media' && <ul>{films.map((f) => <li key={f.id}>{f.title} · {f.sourceNote}</li>)}{films.length === 0 && <li className="note">No film linked.</li>}</ul>}
      </div>
      <div className="row">
        {docs.map((d) => <button key={d.id} onClick={(e) => act({ type: 'open_document', id: d.id }, inOrigin(e))}>Working brief</button>)}
        {films.map((m) => <button key={m.id} onClick={(e) => act({ type: 'open_media', id: m.id }, inOrigin(e))}>{m.title.split('· ')[1]} (slate)</button>)}
        {WEB_SOURCES.map((w) => <button key={w.id} onClick={(e) => act({ type: 'open_web', id: w.id }, inOrigin(e))}>Website</button>)}
        <button onClick={(e) => act({ type: 'close_project' }, inOrigin(e))}>Close</button>
      </div>
    </div>
  );
}

function Handoffs({ projectId }: { projectId: string | null }) {
  const rows = HANDOFFS.filter((h) => !projectId || h.projectId === projectId);
  return (
    <div className="handoffs"><h3>Handoffs <span className="demo-badge" title="Demo data. Not real.">SYNTHETIC</span></h3>
      {rows.length ? <ul>{rows.map((h) => <li key={h.id}><b>{h.from}</b> → <b>{h.to}</b> · {h.title} <span className="chip">{h.status}</span></li>)}</ul> : <p className="note">Nothing here yet.</p>}
      <p className="note">Read only. The handoff registry comes from the single backend after reconciliation.</p></div>
  );
}

function BlockedWeb({ id }: { id: string }) {
  const w = WEB_SOURCES.find((x) => x.id === id)!;
  return (
    <div className="viewer-body blocked" role="status">
      <div className="stage16x9 slide"><h4>Preview unavailable</h4><p>This build does not embed external websites.</p></div>
      <p className="mono">{w.url}</p>
      <a className="btn" href={w.url} target="_blank" rel="noopener noreferrer">Open in browser</a>
      <p className="note">KAST hint: open the source in a separate tab.</p>
    </div>
  );
}

function KastPanel({ ws, act, kast }: { ws: Workspace; act: Act; kast: Kast }) {
  const s = useWs(ws);
  const [text, setText] = useState('');
  const [bars, setBars] = useState<number[]>(() => Array(24).fill(0));
  useEffect(() => { // bars are a direct read of the SDK's output level, nothing else
    if (!kast.speaking) { setBars(Array(24).fill(0)); return; }
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); setBars((b) => [...b.slice(1), kast.outputLevel()]); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [kast.speaking]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = kast.link === 'connected' ? (kast.speaking ? 'Speaking' : 'Listening') : kast.link === 'connecting' ? 'Connecting' : kast.link === 'stopping' ? 'Stopping' : kast.link === 'failed' ? COPY.kastNotConnected : kast.error ? COPY.kastNotConnected : 'Idle';
  const last = ws.receipts[0];
  const cmd = s.command;
  return (
    <section className="glass kast" id="sec-kast" aria-label="KAST">
      <h2>KAST <span className={`chip ${kast.link}`} aria-live="polite">{label}</span>{s.mode === 'read_only' && <span className="chip"> 🔒 {COPY.readOnly}</span>}</h2>
      <div className="wave" aria-hidden="true">{bars.map((v, i) => <i key={i} style={{ height: `${6 + v * 54}px` }} />)}</div>
      {kast.error && <p className="note" role="status">KAST isn't connected yet. {kast.error}</p>}
      {kast.reloadRequired && <p className="note" role="status">The failure is contained: tools are off and nothing will reconnect. Closing the microphone could not be confirmed, so a new attempt is blocked until you reload.</p>}
      <div className="row">
        {kast.link === 'connected' || kast.link === 'connecting' || kast.link === 'stopping'
          ? <button className="stop" onClick={kast.stop} disabled={kast.link === 'stopping'}>{kast.link === 'connecting' ? 'Cancel' : 'Stop'}</button>
          : kast.reloadRequired
            ? <button onClick={() => location.reload()}>Reload to try again</button>
            : <button onClick={kast.start} disabled={!kast.canStart}>Start conversation</button>}
        <button className={s.captions ? 'on' : ''} aria-pressed={s.captions} onClick={(e) => act({ type: 'captions', on: !s.captions }, inOrigin(e))}>Live captions</button>
      </div>
      <div className="control" role="group" aria-label="Control owner">
        <span className={s.control === 'USER_CONTROL' ? 'on' : ''}>{COPY.userControl}</span><span className={s.control === 'AGENT_CONTROL' ? 'on' : ''}>{COPY.agentControl}</span>
        <button onClick={(e) => act({ type: 'set_control', owner: 'USER_CONTROL' }, inOrigin(e))} disabled={s.control === 'USER_CONTROL'}>{COPY.giveControl}</button>
        <button onClick={(e) => act({ type: 'set_control', owner: 'AGENT_CONTROL' }, inOrigin(e))} disabled={s.control === 'AGENT_CONTROL'}>{COPY.takeControl}</button>
      </div>
      {cmd && (
        <div className="cmd" role="group" aria-label="Proposed command">
          <b>{cmd.label}</b> <span className={`chip ${cmd.status}`}>{cmd.status}</span>
          <p className="note">Target: {cmd.targetLabel}</p><p className="note">{cmd.note}</p>
          {cmd.status === 'ready'
            ? <div className="row"><button className="primary" onClick={(e) => act({ type: 'resolve_command', id: cmd.id, run: true }, inOrigin(e))}>Run</button><button onClick={(e) => act({ type: 'resolve_command', id: cmd.id, run: false }, inOrigin(e))}>Cancel</button></div>
            : <button onClick={(e) => act({ type: 'resolve_command', id: cmd.id, run: false }, inOrigin(e))} disabled>Cancel</button>}
        </div>
      )}
      {s.mode === 'read_only' && last?.origin === 'kast' && last.error === 'read_only' && <p className="note receipt">{COPY.noChanges}</p>}
      <ol className="lines" aria-live="polite">{kast.lines.slice(-6).map((l) => <li key={l.id} className={l.who}><b>{l.who === 'you' ? 'You' : 'KAST'}</b> {l.text}</li>)}{kast.lines.length === 0 && <li className="note">No conversation yet.</li>}</ol>
      {s.captions && <p className="note">Captions show provider transcript events only. None are connected.</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && kast.link === 'connected') { kast.sendText(text.trim()); setText(''); } }}>
        <input id="kast-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask KAST a question…" aria-label="Ask KAST a question" disabled={kast.link !== 'connected'} />
      </form>
      <div className="memory">
        <h3>Memory <span className="demo-badge" title="Demo data. Not real.">SYNTHETIC ONLY</span></h3>
        <p className="note">{COPY.syntheticNote} Saved notes stay in this browser and are never sent to KAST.</p>
        <p className="note">{ws.savedContext ? `Last saved view (v${ws.savedContext.version}): ${ws.savedContext.summary}` : 'No saved view yet.'}</p>
        <div className="row">
          <button onClick={(e) => act({ type: 'propose_save_context' }, inOrigin(e))} disabled={!s.openProject}>Save this view…</button>
          <button onClick={() => void ws.clearSyntheticContext()} disabled={!ws.savedContext}>Clear</button>
        </div>
        {!s.openProject && <p className="note">Open a project to save its view.</p>}
        <p className="note">{s.openProject ? `Will save: ${describeSnapshot(viewSnapshot(s))}.` : ''}</p>
      </div>
    </section>
  );
}

/** Focus management shared by dialogs: remember the opener, trap Tab, restore on close. */
function useDialogFocus(onEscape?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector('button') as HTMLElement | null)?.focus();
    return () => { if (opener && document.contains(opener)) opener.focus(); };
  }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onEscape) { e.stopPropagation(); onEscape(); return; }
    if (e.key !== 'Tab') return;
    const f = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [])]; if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement); e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  };
  return { ref, onKeyDown };
}

function ConfirmSheet({ ws, act }: { ws: Workspace; act: Act }) {
  const c = useWs(ws).confirm!;
  const { ref, onKeyDown } = useDialogFocus(c.busy ? undefined : () => act({ type: 'resolve_confirm', id: c.id, approve: false }, 'keyboard'));
  return (
    <div className="sheet-wrap"><div ref={ref} onKeyDown={onKeyDown} className="sheet glass" role="dialog" aria-modal="true" aria-labelledby="cs-t">
      <h2 id="cs-t">{c.title}</h2><p>{c.detail}</p>
      <div className="row"><button className="primary" disabled={c.busy} onClick={(e) => act({ type: 'resolve_confirm', id: c.id, approve: true }, inOrigin(e))}>{c.busy ? 'Saving…' : c.kind === 'save_context' ? 'Save' : 'Allow'}</button>
        <button disabled={c.busy} onClick={(e) => act({ type: 'resolve_confirm', id: c.id, approve: false }, inOrigin(e))}>Cancel</button></div>
      <p className="note">Waiting for your choice</p></div></div>
  );
}

function StatusDialog({ onClose }: { onClose: () => void }) {
  const { ref, onKeyDown } = useDialogFocus(onClose);
  return (
    <div className="sheet-wrap" onClick={onClose}><div ref={ref} onKeyDown={onKeyDown} className="sheet glass wide" role="dialog" aria-modal="true" aria-label="Integration status" onClick={(e) => e.stopPropagation()}>
      <h2>Integration status</h2>
      <p className="note">“Reported” means the author ran it in the environment shown. Nothing here has been independently run, and nothing has been verified live.</p>
      <ul className="matrix">{MATRIX.map((r: Row) => <li key={r.feature}><b>{r.feature}</b><span><span className={`chip ${r.reported}`}>reported: {r.reported.replace('_', ' ')}</span> <span className={`chip live-${r.live}`}>live: {r.live.replace(/_/g, ' ')}</span></span><small>{r.evidence}</small></li>)}</ul>
      <button onClick={onClose}>Close</button></div></div>
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
