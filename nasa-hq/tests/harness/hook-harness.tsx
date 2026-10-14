// Browser harness: the REAL useKast hook in REAL React StrictMode against a FAKE SDK. No provider, no network, no microphone.
import { StrictMode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Workspace } from '../../src/core/store.ts';
import { useKast, type SdkLike, type SdkOptions, type ConvLike } from '../../src/kast/useKast.tsx';

class FakeConv implements ConvLike {
  ended = 0; contextual: string[] = []; sent: string[] = []; endGate: Promise<void> | null = null; endFails = false;
  async endSession() { this.ended++; if (this.endGate) await this.endGate; if (this.endFails) throw new Error('socket stuck'); }
  sendContextualUpdate(t: string) { this.contextual.push(t); }
  sendUserMessage(t: string) { this.sent.push(t); }
  getOutputVolume() { return 0; } getInputVolume() { return 0; }
}
interface Call { opts: SdkOptions; conv: FakeConv; resolve(): void; reject(e: Error): void }
const calls: Call[] = [];
const sdk: SdkLike = { startSession: (opts) => new Promise<ConvLike>((resolve, reject) => { const conv = new FakeConv(); calls.push({ opts, conv, resolve: () => resolve(conv), reject }); }) };

const H: Record<string, unknown> = { calls, links: [] as string[], kast: null, ws: null, renders: 0 };
(window as unknown as { __h: unknown }).__h = H;

function Probe({ ws }: { ws: Workspace }) {
  const k = useKast(ws, { sdk, fetchToken: async () => 'tok' });
  useEffect(() => { H.effects = ((H.effects as number) ?? 0) + 1; return () => { H.cleanups = ((H.cleanups as number) ?? 0) + 1; }; }, []);
  H.kast = k; H.renders = (H.renders as number) + 1; (H.links as string[]).push(k.link);
  return <div id="state" data-link={k.link} data-teardown={k.teardown} data-speaking={String(k.speaking)} data-error={k.error ?? ''} data-lines={k.lines.map((l) => l.text).join('|')} data-reload={String(k.reloadRequired)} data-canstart={String(k.canStart)} />;
}
let root: Root | null = null;
H.mount = async () => {
  const ws = new Workspace(); await ws.act({ type: 'choose_agent', id: 'kast' }, 'mouse'); await ws.act({ type: 'enter', agent: 'kast' }, 'mouse'); H.ws = ws;
  document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById('root')!);
  root.render(<StrictMode><Probe ws={ws} /></StrictMode>);
};
H.unmount = () => { root?.unmount(); root = null; };
