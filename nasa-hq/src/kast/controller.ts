// One-attempt voice controller. One controller instance = ONE start attempt. Once stop() or dispose() has been
// requested, or the attempt has finished, the instance can never start again: a new attempt needs a new instance,
// and only after teardown of the previous one is verified. It owns no microphone: the provider SDK opens and releases
// its own stream, and this controller guarantees the SDK's session is ended exactly once, even when the start
// finishes late, fails late or the component unmounts mid-flight.

export type Phase = 'idle' | 'fetching_token' | 'starting' | 'connected' | 'stopping' | 'closed' | 'failed';
export interface VoiceSession { end(): Promise<void> }
export interface VoiceDeps {
  fetchToken(signal: AbortSignal): Promise<string>;
  startSession(token: string, signal: AbortSignal): Promise<VoiceSession>;
  onPhase?(phase: Phase, info: { error?: string; teardownVerified: boolean }): void;
  startTimeoutMs?: number;
}

export class VoiceController {
  phase: Phase = 'idle';
  error: string | null = null;
  /** True only when no provider session can still be open: ended successfully, never opened, or closed by the provider. */
  teardownVerified = false;
  private deps: VoiceDeps;
  private latched = false;
  private stopRequested = false;
  private ac = new AbortController();
  private session: VoiceSession | null = null;
  private running: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;

  constructor(deps: VoiceDeps) { this.deps = deps; }

  private set(phase: Phase, error?: string) {
    this.phase = phase; if (error !== undefined) this.error = error;
    this.deps.onPhase?.(phase, { error: this.error ?? undefined, teardownVerified: this.teardownVerified });
  }

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
    catch (e) { return this.finishWithoutSession(e); }
    if (this.stopRequested) { this.teardownVerified = true; return this.set('closed'); }          // cancelled while fetching: nothing was opened

    this.set('starting');
    const pending = this.deps.startSession(token, this.ac.signal);
    let timer: ReturnType<typeof setTimeout> | undefined; let timedOut = false;
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => { timedOut = true; rej(new Error('start_timeout')); }, timeoutMs); });
    let session: VoiceSession;
    try { session = await Promise.race([pending, timeout]); }
    catch (e) {
      // If the provider call is still pending (timeout), end whatever it eventually returns. Never leave a late session open.
      pending.then((late) => late.end().catch(() => undefined), () => undefined);
      return this.finishWithoutSession(e, timedOut);
    } finally { clearTimeout(timer); }

    if (this.stopRequested) {                                                                      // late result after Stop or unmount
      this.set('stopping');
      return this.endSession(session);
    }
    this.session = session; this.set('connected');
  }

  private finishWithoutSession(e: unknown, unverified = false) {
    if (this.stopRequested) { this.teardownVerified = !unverified; return this.set('closed'); }
    this.teardownVerified = !unverified;                                                           // a rejected start opened nothing the SDK did not clean up itself
    this.set('failed', e instanceof Error ? e.message : String(e));
  }

  private async endSession(s: VoiceSession) {
    try { await s.end(); this.teardownVerified = true; this.set('closed'); }
    catch (e) { this.teardownVerified = false; this.set('failed', `teardown_failed: ${e instanceof Error ? e.message : String(e)}`); }
  }

  /** Idempotent and shared: every caller gets the same promise. Resolves when this attempt is torn down (or teardown failed). */
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopRequested = true;
    this.stopping = (async () => {
      if (!this.latched) { this.latched = true; this.teardownVerified = true; this.set('closed'); return; }   // never started: close the latch for good
      this.ac.abort();
      if (this.running && (this.phase === 'fetching_token' || this.phase === 'starting')) { await this.running; return; }
      if (this.phase === 'connected' && this.session) { const s = this.session; this.session = null; this.set('stopping'); await this.endSession(s); return; }
      if (this.running) await this.running;
    })();
    return this.stopping;
  }

  /** Component unmount. Same as stop(), safe to call repeatedly and during React Strict Mode double effects. */
  dispose(): Promise<void> { return this.stop(); }

  /** The provider closed the session itself (network drop, agent ended). */
  providerClosed() {
    if (this.phase === 'connected') { this.session = null; this.stopRequested = true; this.teardownVerified = true; this.set('closed'); }
  }

  /** A new attempt may begin only from a verified teardown. */
  get canStartNew(): boolean { return (this.phase === 'closed' || this.phase === 'failed') && this.teardownVerified; }
}
