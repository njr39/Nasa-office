import { reduce, initialState, snapshot, type Action, type Origin, type Receipt, type State } from './actions.ts';
import { SyntheticLocalStore, type ContextStore, type SavedContext } from './context.ts';

export interface PlayerAdapter {
  play(): Promise<{ ok: boolean; error?: string }>;
  pause(): void;
  status(): { status: State['media']['status']; positionSec: number };
}
type Listener = () => void;

export class Workspace {
  state: State = initialState();
  receipts: Receipt[] = [];
  sessionId: string | null = null;
  savedContext: SavedContext | null = null;
  private listeners = new Set<Listener>();
  private player: PlayerAdapter | null = null;
  scrollHook: ((to?: string, dy?: number) => number) | null = null;
  contexts: ContextStore;
  constructor(contexts: ContextStore = new SyntheticLocalStore(null)) { this.contexts = contexts; }

  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;
  private emit() { this.listeners.forEach((l) => l()); }
  private set(next: State) { this.state = next; this.emit(); }

  registerPlayer(p: PlayerAdapter | null) { this.player = p; }
  /** Live media state: the player is the source of truth for status and position. */
  liveMedia(): State['media'] { return this.player && this.state.media.id ? { ...this.state.media, ...this.player.status() } : this.state.media; }
  /** Player reports real status (ended, error, buffering) back into state. */
  reportMedia(patch: Partial<State['media']>) {
    if (!this.state.media.id) return;
    this.set({ ...this.state, media: { ...this.state.media, ...patch } });
  }

  async loadLatestContext() { this.savedContext = await this.contexts.latest(); this.emit(); return this.savedContext; }

  private log(a: Action, origin: Origin, r: { ok: boolean; detail: string; error?: string }): Receipt {
    const rc: Receipt = { ok: r.ok, action: a.type, origin, detail: r.detail, error: r.error, at: Date.now(), state: snapshot(this.state) };
    const noisy = a.type === 'orbit' && origin !== 'kast' && origin !== 'test';
    if (!noisy) this.receipts = [rc, ...this.receipts].slice(0, 100);
    return rc;
  }

  /** The only entry point for changing workspace state. */
  async act(a: Action, origin: Origin): Promise<Receipt> {
    const direct = origin === 'mouse' || origin === 'touch' || origin === 'keyboard';
    const r = reduce(this.state, a, origin);
    if (!r.ok) return this.log(a, origin, r);
    let next = r.state;
    // Any successful direct manipulation hands control to the user without ending the KAST session.
    if (direct && next.phase === 'hq' && next.control === 'AGENT_CONTROL' && !['set_control', 'resolve_confirm', 'enter'].includes(a.type)) {
      next = { ...next, control: 'USER_CONTROL' };
    }
    let detail = r.detail;
    let ok = true; let error: string | undefined;

    if (a.type === 'media') {
      if (!this.player) { ok = false; error = 'no_player'; detail = 'The player is not ready.'; }
      else if (a.op === 'play') {
        const res = await this.player.play();
        const st = this.player.status();
        ok = res.ok; error = res.error; next = { ...next, media: { ...next.media, ...st } };
        detail = ok ? `Playing at ${st.positionSec.toFixed(1)}s.` : `Could not play: ${error}`;
      } else {
        this.player.pause();
        const st = this.player.status();
        next = { ...next, media: { ...next.media, ...st } };
        detail = `Paused at ${st.positionSec.toFixed(1)}s.`;
      }
    }
    if (a.type === 'scroll' && this.scrollHook) {
      const y = this.scrollHook(a.to, a.dy);
      detail += ` scrollY=${Math.round(y)}.`;
    }
    if (a.type === 'resolve_confirm' && r.ok && this.state.confirm?.kind === 'save_context' && a.approve) {
      const c = this.state.confirm;
      const res = await this.contexts.save({ text: c.text ?? '', projectId: this.state.openProject, sessionId: this.sessionId,
        expectedVersion: this.savedContext?.version ?? 0 });
      if (res.ok) {
        this.savedContext = await this.contexts.latest();
        next = { ...next, lastSavedContext: this.savedContext ? { version: this.savedContext.version, text: this.savedContext.text } : null };
        detail = `Saved as version ${res.version} (${this.contexts.kind}).`;
      } else {
        ok = false; error = res.error;
        detail = res.error === 'blocked' ? 'Backend not connected: nothing was saved.'
          : res.error === 'version_conflict' ? `Newer context exists (v${res.current}). Nothing overwritten; reload and retry.` : 'Nothing saved.';
        if (res.error === 'version_conflict') this.savedContext = await this.contexts.latest();
      }
    }
    this.set(next);
    return this.log(a, origin, { ok, detail, error });
  }
}
