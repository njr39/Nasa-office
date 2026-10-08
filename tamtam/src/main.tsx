import { createRoot } from 'react-dom/client';
import App from './App';

// Prevent iOS pinch-zoom and rubber-banding: the 3D world must never scroll or zoom.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend'] as const) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
