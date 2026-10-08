// Copies the MediaPipe WASM runtime into public/ and (best effort) downloads the hand model,
// so the game can run fully self-hosted. Never fails the install.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = resolve(root, 'public/mediapipe/wasm');
try {
  if (existsSync(src)) { mkdirSync(dst, { recursive: true }); cpSync(src, dst, { recursive: true }); console.log('[tamtam] copied MediaPipe wasm'); }
} catch (e) { console.warn('[tamtam] wasm copy skipped:', e.message); }

const model = resolve(root, 'public/models/hand_landmarker.task');
if (!existsSync(model)) {
  try {
    const url = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    mkdirSync(dirname(model), { recursive: true });
    writeFileSync(model, Buffer.from(await r.arrayBuffer()));
    console.log('[tamtam] downloaded hand model');
  } catch (e) { console.warn('[tamtam] model download skipped (will load from Google at runtime):', e.message); }
}
