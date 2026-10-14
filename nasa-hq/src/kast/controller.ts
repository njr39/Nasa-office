// One-attempt voice controller. One controller instance = ONE start attempt. Once stop() or dispose() has been
// requested, or the attempt has finished, the instance can never start again: a new attempt needs a new instance,
// and only after teardown of the previous one is VERIFIED.
//
// Teardown is verified only by an explicit receipt: end() resolved, or the attempt never reached the provider SDK
// (it was cancelled or failed before startSession was called). A start rejection, a disconnect callback or an error
// callback is an OBSERVATION, not proof that the SDK released its microphone. Those paths leave teardown "unverified":
// the failure is CONTAINED (tools are dead, the UI is idle, nothing will reconnect) and a new attempt is blocked until
// the page is reloaded. The controller owns no microphone stream; the provider SDK opens and releases its own.

export type Phase = 'idle' | 'fetching_token' | 'starting' | 'connected' | 'stopping' | 'closed' | 'failed';
export type Teardown = 'not_started' | 'pending' | 'verified' | 'unverified';
export interface VoiceSession { end(): Promise<void> }
export interface VoiceDeps {
  fetchToken(signal: AbortSignal): Promise<string>;
  startSession(token: string, signal: AbortSignal): Promise<VoiceSession>;
  onPhase?(phase: Phase, info: { error?: string; teardown: Teardown }): void;
  startTimeoutMs?: number;
}

export class VoiceController {
  phase: Phase = 'idle';
  error: string | null = null;
  teardown: Teardown = 'not_started';
  private deps: VoiceDeps;
  private latched = false;
  private stopRequested = false;
  private reachedSdk = false;
  private providerEvent: string | null = null;
  private ac = new AbortController();
  private session: VoiceSession | null = null;
  private running: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;

  constructor(deps: VoiceDeps) { this.deps = deps; }

  private set(phase: Phase, error?: string) {
    this.phase = phase; if (error !== undefined) this.error = error;
    this.deps.onPhase?.(phase, { error: this.error ?? undefined, teardown: this.teardown });
  }

  /** True only when this attempt is finished AND no provider session can still be open. */
  get teardownVerified(): boolean { return this.teardown === 'verified'; }
  /** A new attempt may begin only from a verified teardown. Unverified (contained) teardown requires a page reload. */
  get canStartNew(): boolean { return (this.phase === 'closed' || this.phase === 'failed') && this.teardown === 'verified'; }
  /** Resolves when this attempt is finished (closed or failed), whatever the path. */
  get finished(): Promise<void> { return this.stopping ?? this.running ?? Promise.resolve(); }

  /** Synchronous one-shot latch: the second call, in any phase, returns false and does nothing. */
  start(): boolean {
    if (this.latched) return false;
    this.latched = true;
    this.set('fetching_token');
    this.running = this.run();
    return true;
  }

  private async run() {
    const timeoutMs = this.deps.startTimeoutMs ?? 20_000;
    let token: string;
    try { token = await this.deps.fetchToken(this.ac.signal); }
    catch (e) { this.teardown = 'verified'; return this.set(this.stopRequested ? 'closed' : 'failed', this.stopRequested ? undefined : msg(e)); }   // the SDK was never touched
    if (this.stopRequested) { this.teardown = 'verified'; return this.set('closed'); }

    this.set('starting'); this.reachedSdk = true;
    const pending = this.deps.startSession(token, this.ac.signal);
    let timer: ReturnType<typeof setTimeout> | undefined; let timedOut = false;
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => { timedOut = true; rej(new Error('start_timeout')); }, timeoutMs); });
    let session: VoiceSession;
    try { session = await Promise.race([pending, timeout]); }
    catch (e) {
      // The provider call may still resolve later. Whatever it returns is ended, so nothing is left open.
      pending.then((late) => late.end().catch(() => undefined), () => undefined);
      // A rejected start is an observation, not a cleanup receipt: contained, unverified.
      this.teardown = 'unverified';
      return this.set(this.stopRequested ? 'closed' : 'failed', this.stopRequested ? (timedOut ? 'start_timeout' : undefined) : msg(e));
    } finally { clearTimeout(timer); }

    if (this.stopRequested || this.providerEvent) {                  // late result after Stop, unmount, disconnect or provider error
      this.teardown = 'pending'; this.set('stopping');
      return this.endSession(session, this.providerEvent && !this.stopRequested ? this.providerEvent : undefined);
    }
    this.session = session; this.set('connected');
  }

  private async endSession(s: VoiceSession, failure?: string) {
    this.teardown = 'pending';
    try { await s.end(); this.teardown = 'verified'; this.set(failure ? 'failed' : 'closed', failure); }
    catch (e) { this.teardown = 'unverified'; this.set('failed', `teardown_failed: ${msg(e)}`); }
  }

  /** Idempotent and shared: every caller gets the same promise. Resolves when this attempt is finished. */
  stop(reason?: string): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopRequested = true;
    this.stopping = (async () => {
      if (!this.latched) { this.latched = true; this.teardown = 'verified'; this.set('closed'); return; }   // never started: close the latch for good
      this.ac.abort();
      if (this.running && (this.phase === 'fetching_token' || this.phase === 'starting')) { await this.running; return; }
      if (this.phase === 'connected' && this.session) { const s = this.session; this.session = null; this.set('stopping'); await this.endSession(s, reason); return; }
      if (this.running) await this.running;
    })();
    return this.stopping;
  }

  /** Component unmount. Same as stop(), safe to call repeatedly and during React Strict Mode double effects. */
  dispose(): Promise<void> { return this.stop(); }

  /**
   * The provider says it disconnected. That is an observation. Connected: begin an explicit end() so there is a receipt.
   * Still starting: remember it, so the late session is ended and never reported as connected.
   */
  providerClosed(): Promise<void> {
    if (this.phase === 'connected') return this.stop('provider_disconnected');
    if (this.phase === 'fetching_token' || this.phase === 'starting') { this.providerEvent ??= 'provider_disconnected_during_start'; return this.finished; }
    return this.finished;
  }

  /** The provider reported an error: invalidate at once and begin cleanup, whatever phase the attempt is in. */
  providerError(message: string): Promise<void> {
    this.error = message;
    if (this.phase === 'connected') return this.stop(`provider_error: ${message}`);
    if (this.phase === 'fetching_token' || this.phase === 'starting') { this.providerEvent ??= `provider_error: ${message}`; return this.finished; }
    return this.finished;
  }

  get reachedProvider(): boolean { return this.reachedSdk; }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
