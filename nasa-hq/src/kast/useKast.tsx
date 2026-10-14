// KAST = the ORIGINAL agent (agent_7501ky1tjmrzf4xa67v0zsqzz9hf). Voice state comes only from the SDK and the
// one-attempt controller. No timers fake speaking or connection, and no microphone is opened by this file:
// the SDK opens and releases its own stream, and the controller guarantees the session is ended.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Conversation } from '@elevenlabs/client';
import { buildTools, buildContextUpdate } from '../core/tools.ts';
import { COPY } from '../core/copy.ts';
import type { Workspace } from '../core/store.ts';
import { VoiceController, type Phase } from './controller.ts';

export const KAST_AGENT_ID = 'agent_7501ky1tjmrzf4xa67v0zsqzz9hf'; // original KAST. Public identifier, not a secret.
export type Line = { id: string; who: 'you' | 'kast'; text: string; at: number };
export type Link = 'idle' | 'connecting' | 'connected' | 'stopping' | 'failed';

export interface Kast {
  link: Link; phase: Phase; speaking: boolean; error: string | null; lines: Line[]; canStart: boolean;
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

export function useKast(ws: Workspace): Kast {
  const [phase, setPhase] = useState<Phase>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const ctrl = useRef<VoiceController | null>(null);
  const conv = useRef<Conversation | null>(null);
  const gen = useRef<number>(-1);
  const alive = useRef(false);
  const readScroll = useCallback(() => (typeof window === 'undefined' ? 0 : window.scrollY), []);

  // Unmount (and the Strict Mode simulated unmount): end the session, invalidate the tools, never set state afterwards.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; ws.closeSession(gen.current); void ctrl.current?.dispose(); };
  }, [ws]);

  const start = useCallback(() => {
    const prev = ctrl.current;
    if (prev && !prev.canStartNew) { if (prev.phase === 'failed') setError('The previous voice session could not be closed cleanly. Reload the page before trying again.'); return; }
    setError(null); setLines([]); setSpeaking(false);
    const g = ws.openSession(); gen.current = g;
    const tools = buildTools(ws, { session: g, readScrollY: readScroll });
    const c: VoiceController = new VoiceController({
      fetchToken: (signal) => fetchSessionToken(signal),
      startSession: async (token) => {
        const s = await Conversation.startSession({
          conversationToken: token, connectionType: 'webrtc', clientTools: tools as never,
          // Per-session overrides only; the original agent's global language, auth and prompt are not touched.
          overrides: { agent: { firstMessage: COPY.kastGreeting, language: 'en' } },
          onMessage: (m) => { if (alive.current) setLines((l) => [...l, { id: `${m.event_id}-${l.length}`, who: (m.source === 'user' ? 'you' : 'kast') as Line['who'], text: m.message, at: Date.now() }].slice(-60)); },
          onModeChange: ({ mode }) => { if (alive.current) setSpeaking(mode === 'speaking'); },
          onError: (m) => { if (alive.current) setError(String(m)); },
          onDisconnect: () => { c.providerClosed(); },
          onUnhandledClientToolCall: (call) => { if (alive.current) setError(`KAST called a tool this page has not registered: ${JSON.stringify(call).slice(0, 200)}`); },
        });
        conv.current = s;
        return { end: () => s.endSession() };
      },
      onPhase: (p, info) => {
        if (p === 'stopping' || p === 'closed' || p === 'failed') { ws.closeSession(g); conv.current = null; }   // tools die the moment teardown begins
        if (!alive.current) return;
        setPhase(p); if (info.error) setError(info.error); if (p !== 'connected') setSpeaking(false);
      },
    });
    ctrl.current = c; c.start();
  }, [ws, readScroll]);

  const stop = useCallback(() => { ws.closeSession(gen.current); void ctrl.current?.stop(); }, [ws]);

  // After connect, and when the user changes the view: structural page state only. Saved context is never sent.
  useEffect(() => {
    if (phase !== 'connected') return;
    conv.current?.sendContextualUpdate(buildContextUpdate(ws, readScroll));
    let last = '';
    return ws.subscribe(() => {
      const s = ws.state; const sig = `${s.openProject}|${s.openDocument}|${s.openWeb}|${s.media.id}|${s.media.status}|${s.control}|${s.mode}|${s.slideIndex}`;
      if (sig === last || !ws.sessionLive(gen.current)) return; last = sig;
      conv.current?.sendContextualUpdate(buildContextUpdate(ws, readScroll));
    });
  }, [phase, ws, readScroll]);

  return {
    phase, link: linkOf(phase), speaking: phase === 'connected' && speaking, error, lines,
    canStart: !ctrl.current || ctrl.current.canStartNew,
    start, stop,
    sendText: (t) => { if (phase === 'connected' && ws.state.mode === 'normal') { conv.current?.sendUserMessage(t); setLines((l) => [...l, { id: `u${Date.now()}`, who: 'you', text: t, at: Date.now() }]); } },
    outputLevel: () => (phase === 'connected' ? conv.current?.getOutputVolume() ?? 0 : 0),
    inputLevel: () => (phase === 'connected' ? conv.current?.getInputVolume() ?? 0 : 0),
  };
}
