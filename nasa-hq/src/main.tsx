import { createRoot } from 'react-dom/client';
import { Workspace } from './core/store.ts';
import { SyntheticLocalStore } from './core/context.ts';
import { App } from './App.tsx';

let storage: Storage | null = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }
const ws = new Workspace(new SyntheticLocalStore(storage));
try { const l = storage?.getItem('nasa_hq.layout'); if (l === 'portrait' || l === 'horizontal' || l === 'auto') ws.state = { ...ws.state, layout: l }; } catch { /* ignore */ }
ws.loadLatestContext(null);
createRoot(document.getElementById('root')!).render(<App ws={ws} />);
