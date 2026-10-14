// KAST = the ORIGINAL agent (agent_7501ky1tjmrzf4xa67v0zsqzz9hf). Voice state comes only from the SDK and the one-attempt
// controller. No timers fake speaking or connection, and no microphone is opened by this file: the SDK opens and releases
// its own stream, and the controller guarantees the session is ended or the failure is contained.
//
// Every SDK callback, conversation reference and tool set belongs to ONE attempt (an immutable record). A late callback
// from a finished attempt cannot touch the UI or the references of a newer one.
//
// Stack note: this uses @elevenlabs/client directly because its startSession/endSession are awaitable, which the
// single-attempt controller needs. @elevenlabs/react 1.18's startSession returns void and cannot be awaited.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Conversation } from '@elevenlabs/client';
import { buildTools, buildContextUpdate } from '../core/tools.ts';
import { COPY } from '../core/copy.ts';
import type { Workspace } from '../core/store.ts';
import { VoiceController, type Phase, type Teardown } from './controller.ts';

export const KAST_AGENT_ID = 'agent_7501ky1tjmrzf4xa67v0zsqzz9hf'; // original KAST. Public identifier, not a secret.
export type Line = { id: string; who: 'you' | 'kast'; text: string; at: number };
export type Link = 'idle' | 'connecting' | 'connected' | 'stopping' | 'failed';

/** The slice of the SDK this hook uses. Injectable so the lifecycle can be tested without a provider. */
export interface ConvLike {
  endSession(): Promise<void>;
  sendContextualUpdate(text: string): void;
  sendUserMessage(text: string): void;
  getOutputVolume(): number;
  getInputVolume(): number;
}
export interface SdkOptions {
  conversationToken: string; connectionType: 'webrtc'; clientTools: Record<string, (p: Record<string, unknown>) => Promise<string>>;
  overrides: { agent: { firstMessage: string; language: 'en' } };
  onMessage(m: { message: string; event_id: number; source: string }): void;
  onModeChange(m: { mode: string }): void;
  onError(message: string): void;
  onDisconnect(): void;
  onUnhandledClientToolCall(call: unknown): void;
}
export interface SdkLike { startSession(o: SdkOptions): Promise<ConvLike> }
export interface KastDeps { sdk?: SdkLike; fetchToken?: (signal: AbortSignal) => Promise<string> }

export interface Kast {
  link: Link; phase: Phase; teardown: Teardown; speaking: boolean; error: string | null; lines: Line[]; canStart: boolean; reloadRequired: boolean;
  start(): void; stop(): void; sendText(t: string): void; outputLevel(): number; inputLevel(): number;
}

const REASONS: Record<number, string> = { 401: 'Sign in is required.', 403: 'This account is not permitted to use voice.', 404: 'Voice is switched off for this workspace.', 429: 'Too many attempts. Try again shortly.' };
export class TokenError extends Error {}

/** The token route needs an application session and a CSRF token. Without one nothing is sent. */
export async function fetchSessionToken(signal: AbortSignal, doc: Pick<Document, 'querySelector'> = document, fetchImpl: typeof fetch = fetch): Promise<string> {
  const csrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!csrf) throw new TokenError('Sign in is required. No application session is present in this build.');
  const res = await fetchImpl('/api/elevenlabs/session', { method: 'POST', credentials: 'same-origin', signal, headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: '{}' });
  if (!res.ok) throw new TokenError(REASONS[res.status] ?? 'Voice is unavailable right now.');
  const j = (await res.json()) as { conversationToken?: unknown };
  if (typeof j.conversationToken !== 'string' || !j.conversationToken) throw new TokenError('Voice is unavailable right now.');
  return j.conversationToken;
}

const linkOf = (p: Phase): Link => (p === 'fetching_token' || p === 'starting' ? 'connecting' : p === 'connected' ? 'connected' : p === 'stopping' ? 'stopping' : p === 'failed' ? 'failed' : 'idle');

/** Everything that belongs to one voice attempt. Never mutated into another attempt's record. */
interface Attempt { readonly id: number; readonly gen: number; readonly ctrl: VoiceController; conv: ConvLike | null }

export function useKast(ws: Workspace, deps: KastDeps = {}): Kast {
  const sdk = deps.sdk ?? (Conversation as unknown as SdkLike);
  const getToken = deps.fetchToken ?? ((signal: AbortSignal) => fetchSessionToken(signal));
  const [phase, setPhase] = useState<Phase>('idle');
  const [teardown, setTeardown] = useState<Teardown>('not_started');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const current = useRef<Attempt | null>(null);
  const seq = useRef(0);
  const alive = useRef(false);
  const readScroll = useCallback(() => (typeof window === 'undefined' ? 0 : window.scrollY), []);

  // Unmount (and the Strict Mode simulated unmount): invalidate the tools and end the session; never set state afterwards.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const a = current.current; if (a) { ws.closeSession(a.gen); void a.ctrl.dispose(); }
    };
  }, [ws]);

  const start = useCallback(() => {
    const prev = current.current;
    if (prev && !prev.ctrl.canStartNew) { if (prev.ctrl.phase === 'failed' || prev.ctrl.teardown === 'unverified') setError('The previous voice session could not be confirmed closed. Reload the page before trying again.'); return; }
    setError(null); setLines([]); setSpeaking(false); setTeardown('not_started');
    const id = ++seq.current; const gen = ws.openSession();
    const tools = buildTools(ws, { session: gen, readScrollY: readScroll });
    let att!: Attempt;
    const isCurrent = () => alive.current && current.current === att;           // identity, not just "mounted"
    const ctrl: VoiceController = new VoiceController({
      fetchToken: getToken,
      startSession: async (token) => {
        const conv = await sdk.startSession({
          conversationToken: token, connectionType: 'webrtc', clientTools: tools as never,
          // Per-session overrides only; the original agent's global language, auth and prompt are not touched.
          overrides: { agent: { firstMessage: COPY.kastGreeting, language: 'en' } },
          onMessage: (m) => { if (isCurrent()) setLines((l) => [...l, { id: `${m.event_id}-${l.length}`, who: (m.source === 'user' ? 'you' : 'kast') as Line['who'], text: m.message, at: Date.now() }].slice(-60)); },
          onModeChange: ({ mode }) => { if (isCurrent()) setSpeaking(mode === 'speaking'); },
          // Errors and disconnects always reach THEIR OWN controller (cleanup must proceed); the UI only hears from the current attempt.
          onError: (m) => { ws.closeSession(gen); if (isCurrent()) setError(String(m)); void ctrl.providerError(String(m)); },
          onDisconnect: () => { ws.closeSession(gen); void ctrl.providerClosed(); },
          onUnhandledClientToolCall: (call) => { if (isCurrent()) setError(`KAST called a tool this page has not registered: ${JSON.stringify(call).slice(0, 200)}`); },
        });
        att.conv = conv;                                                          // this attempt's record only
        return { end: () => conv.endSession() };
      },
      onPhase: (p, info) => {
        if (p === 'stopping' || p === 'closed' || p === 'failed') ws.closeSession(gen);   // tools die the moment teardown begins
        if (!isCurrent()) return;
        setPhase(p); setTeardown(info.teardown); if (info.error) setError(info.error); if (p !== 'connected') setSpeaking(false);
      },
    });
    att = { id, gen, ctrl, conv: null };
    current.current = att; ctrl.start();
  }, [ws, readScroll, sdk, getToken]);

  const stop = useCallback(() => { const a = current.current; if (a) { ws.closeSession(a.gen); void a.ctrl.stop(); } }, [ws]);

  // After connect, and when the user changes the view: structural page state only. Saved context is never sent.
  useEffect(() => {
    const a = current.current; if (phase !== 'connected' || !a) return;
    a.conv?.sendContextualUpdate(buildContextUpdate(ws, readScroll));
    let last = '';
    return ws.subscribe(() => {
      const s = ws.state; const sig = `${s.openProject}|${s.openDocument}|${s.openWeb}|${s.media.id}|${s.media.status}|${s.control}|${s.mode}|${s.slideIndex}`;
      if (sig === last || !ws.sessionLive(a.gen) || current.current !== a) return; last = sig;
      a.conv?.sendContextualUpdate(buildContextUpdate(ws, readScroll));
    });
  }, [phase, ws, readScroll]);

  const a = current.current;
  return {
    phase, teardown, link: linkOf(phase), speaking: phase === 'connected' && speaking, error, lines,
    canStart: !a || a.ctrl.canStartNew,
    reloadRequired: !!a && (a.ctrl.phase === 'failed' || a.ctrl.phase === 'closed') && a.ctrl.teardown === 'unverified',
    start, stop,
    sendText: (t) => { if (phase === 'connected') { a?.conv?.sendUserMessage(t); setLines((l) => [...l, { id: `u${Date.now()}`, who: 'you', text: t, at: Date.now() }]); } },   // typed questions stay available in read-only mode; tools do not
    outputLevel: () => (phase === 'connected' ? a?.conv?.getOutputVolume() ?? 0 : 0),
    inputLevel: () => (phase === 'connected' ? a?.conv?.getInputVolume() ?? 0 : 0),
  };
}
