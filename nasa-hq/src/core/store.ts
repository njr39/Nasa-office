import { reduce, initialState, snapshot, viewSnapshot, type Action, type Origin, type Receipt, type State } from './actions.ts';
import { SyntheticLocalStore, type ContextStore, type SavedContext } from './context.ts';

export interface PlayerAdapter {
  play(): Promise<{ ok: boolean; error?: string }>;
  pause(): void;
  status(): { status: State['media']['status']; positionSec: number };
}
export interface ScrollOutcome { y: number; settled: boolean }
export interface ActContext { session: number }
type Listener = () => void;

export class Workspace {
  state: State = initialState();
  receipts: Receipt[] = [];
  savedContext: SavedContext | null = null;
  contexts: ContextStore;
  /** Set by the UI. Resolves when the scroll has stopped (or timed out), with the OBSERVED position. */
  scrollHook: ((to?: string, dy?: number) => Promise<ScrollOutcome>) | null = null;
  cancelScroll: (() => void) | null = null;
  private listeners = new Set<Listener>();
  private player: PlayerAdapter | null = null;
  private lease = 0;            // bumped whenever control changes owner; an agent action is only valid under the lease it started with
  private sessionGen = 0;       // bumped whenever a voice session opens or closes
  private sessionOpen = false;
  private chains = new Map<string, Promise<unknown>>();

  constructor(contexts: ContextStore = new SyntheticLocalStore(null)) { this.contexts = contexts; }

  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;
  get leaseId() { return this.lease; }

  // ----- voice session binding -----
  openSession(): number { this.sessionGen++; this.sessionOpen = true; this.lease++; return this.sessionGen; }
  closeSession(gen: number) { if (gen === this.sessionGen && this.sessionOpen) { this.sessionOpen = false; this.sessionGen++; this.lease++; this.cancelScroll?.(); } }
  sessionLive(gen: number) { return this.sessionOpen && gen === this.sessionGen; }

  registerPlayer(p: PlayerAdapter | null) { this.player = p; }
  liveMedia(): State['media'] { return this.player && this.state.media.id ? { ...this.state.media, ...this.player.status() } : this.state.media; }
  /** Player reports real status (ended, error) back into state. */
  reportMedia(patch: Partial<State['media']>) { if (this.state.media.id) this.commit((s) => ({ ...s, media: { ...s.media, ...patch } })); }

  async loadLatestContext(projectId: string | null) { this.savedContext = await this.contexts.latest(projectId); this.emit(); return this.savedContext; }
  async clearSyntheticContext() { await this.contexts.clear(); this.savedContext = null; this.emit(); }

  private emit() { this.listeners.forEach((l) => l()); }
  /** The only place state changes. Applies to the CURRENT state, never a stale snapshot. */
  private commit(fn: (s: State) => State) {
    const before = this.state; const next = fn(before);
    if (next === before) return;
    if (next.control !== before.control) { this.lease++; this.cancelScroll?.(); }
    this.state = { ...next, revision: before.revision + 1 };
    this.emit();
  }
  private serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.chains.set(key, run.catch(() => undefined));
    return run;
  }
  private log(a: Action, origin: Origin, r: { ok: boolean; status: Receipt['status']; detail: string; error?: string; observed?: Record<string, unknown> }): Receipt {
    const rc: Receipt = { ...r, action: a.type, origin, at: Date.now(), revision: this.state.revision, state: snapshot(this.state) };
    const noisy = a.type === 'orbit' && origin !== 'kast' && origin !== 'test';
    if (!noisy) this.receipts = [rc, ...this.receipts].slice(0, 100);
    return rc;
  }
  private reject(a: Action, origin: Origin, error: string, detail: string) { return this.log(a, origin, { ok: false, status: 'rejected', detail, error }); }

  /** The only entry point for changing workspace state. Agent calls must carry the voice session they belong to. */
  async act(a: Action, origin: Origin, ctx?: ActContext): Promise<Receipt> {
    if (origin === 'kast' && (!ctx || !this.sessionLive(ctx.session))) return this.reject(a, origin, 'session_ended', 'The voice session has ended.');
    const lease0 = this.lease; const gen0 = ctx?.session ?? -1; const isAgent = origin === 'kast';
    // An agent action stays valid only while its session is live, control has not changed hands, and the agent still holds control.
    const stillValid = () => !isAgent || (this.sessionLive(gen0) && this.lease === lease0 && this.state.control === 'AGENT_CONTROL');
    const staleReceipt = (detail: string, observed?: Record<string, unknown>) => this.log(a, origin, { ok: false, status: 'stale', error: 'stale', detail, observed });

    const r = reduce(this.state, a, origin);
    if (!r.ok) return this.log(a, origin, { ok: false, status: 'rejected', detail: r.detail, error: r.error });
    const direct = origin === 'mouse' || origin === 'touch' || origin === 'keyboard';
    const takesControl = direct && r.state.phase === 'hq' && r.state.control === 'AGENT_CONTROL' && !['set_control', 'resolve_confirm', 'resolve_command', 'enter', 'choose_agent', 'set_mode'].includes(a.type);
    // No await sits between reduce() and this commit, so r.state is based on the current state.
    const apply = (): State => ({ ...r.state, control: takesControl ? 'USER_CONTROL' : r.state.control });

    // ---- media transport: external async work, then recheck before committing or reporting ----
    if (a.type === 'media') {
      const p = this.player; const mediaId = this.state.media.id;
      if (!p) return this.log(a, origin, { ok: false, status: 'rejected', detail: 'The player is not ready.', error: 'no_player' });
      return this.serial(`media:${mediaId}`, async () => {
        if (!stillValid() || this.state.media.id !== mediaId) return staleReceipt('Control or the open film changed before this ran. Nothing was done.');
        if (a.op === 'pause') { p.pause(); const st = p.status(); this.commit((s) => (s.media.id === mediaId ? { ...s, media: { ...s.media, ...st } } : s)); return this.log(a, origin, { ok: true, status: 'applied', detail: `Paused at ${st.positionSec.toFixed(1)}s.`, observed: { ...st } }); }
        const res = await p.play();
        if (!stillValid() || this.state.media.id !== mediaId) {
          p.pause();                                              // undo the side effect: never leave media playing under someone else's control
          return staleReceipt('Control or the open film changed while playback was starting. Playback was stopped.');
        }
        const st = p.status();
        this.commit((s) => (s.media.id === mediaId ? { ...s, media: { ...s.media, ...st } } : s));
        return this.log(a, origin, res.ok ? { ok: true, status: 'applied', detail: `Playing at ${st.positionSec.toFixed(1)}s.`, observed: { ...st } } : { ok: false, status: 'rejected', error: res.error ?? 'play_failed', detail: `Could not play: ${res.error ?? 'unknown'}` });
      });
    }

    // ---- confirmed save: persistence happens after approval, against the view that was approved ----
    if (a.type === 'resolve_confirm' && this.state.confirm?.kind === 'save_context' && a.approve) {
      const confirmId = this.state.confirm.id; const view = viewSnapshot(this.state); const projectId = view.projectId;
      this.commit(() => r.state);                                  // sheet shows "Saving"; every other action stays blocked
      return this.serial('context', async () => {
        const current = await this.contexts.latest(projectId);
        const res = await this.contexts.save({ view, projectId, expectedVersion: current?.version ?? 0 });
        const latest = await this.contexts.latest(projectId);
        this.savedContext = latest;
        this.commit((s) => (s.confirm?.id === confirmId ? { ...s, confirm: null } : s));
        return res.ok ? this.log(a, origin, { ok: true, status: 'applied', detail: `Saved as synthetic version ${res.version} (${this.contexts.kind}).`, observed: { version: res.version } })
          : this.log(a, origin, { ok: false, status: 'rejected', error: res.error, detail: res.error === 'blocked' ? 'Backend not connected: nothing was saved.' : res.error === 'version_conflict' ? `A newer synthetic context exists (v${res.current}). Nothing was overwritten.` : 'Nothing saved.' });
      });
    }

    // ---- scroll: accepted immediately, but reported from the OBSERVED final position ----
    if (a.type === 'scroll' && this.scrollHook) {
      this.commit(apply);
      const out = await this.scrollHook(a.to, a.dy);
      if (!stillValid()) { this.cancelScroll?.(); return staleReceipt(`Control changed during the scroll; it was cancelled at y=${Math.round(out.y)}.`, { scrollY: Math.round(out.y), settled: out.settled }); }
      return this.log(a, origin, { ok: true, status: 'applied', detail: out.settled ? `Scrolled; stopped at y=${Math.round(out.y)}.` : `Scroll still moving at y=${Math.round(out.y)} when reported.`, observed: { scrollY: Math.round(out.y), settled: out.settled } });
    }

    this.commit(apply);
    return this.log(a, origin, { ok: true, status: 'applied', detail: r.detail });
  }
}
