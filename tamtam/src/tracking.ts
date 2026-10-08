// Live hand tracking: MediaPipe Hand Landmarker (21 landmarks x 2 hands), One-Euro smoothing, pinch hysteresis,
// calibration, gesture state machine. Video is processed on this device only; frames and landmarks are never stored or sent.
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { R, T, spec } from './spec';
import { get, set, showToast } from './store';
import { grab, drag, release, hoverAt, holders, input, rig, resetAll } from './world';

class OneEuro {
  px: number | null = null; dx = 0; pt = 0;
  constructor(private mc: number, private b: number, private dc: number) {}
  private a(c: number, dt: number) { const r = 2 * Math.PI * c * dt; return r / (r + 1); }
  f(x: number, t: number) {
    if (this.px === null) { this.px = x; this.pt = t; return x; }
    const dt = Math.max((t - this.pt) / 1000, 1e-3);
    this.dx += this.a(this.dc, dt) * ((x - this.px) / dt - this.dx);
    this.px += this.a(this.mc + this.b * Math.abs(this.dx), dt) * (x - this.px);
    this.pt = t;
    return this.px;
  }
  reset() { this.px = null; this.dx = 0; }
}

type GState = 'NO_HAND' | 'HAND_DETECTED' | 'HOVER' | 'PINCH_CANDIDATE' | 'GRABBED' | 'DRAGGING';
const E = R.one_euro;
const mk = () => ({
  fx: new OneEuro(E.min_cutoff, E.beta, E.d_cutoff), fy: new OneEuro(E.min_cutoff, E.beta, E.d_cutoff), fr: new OneEuro(E.min_cutoff, E.beta, E.d_cutoff),
  present: false, pinching: false, candSince: 0, lastSeen: 0, palmSince: 0, x: 0, y: 0, open: false, ratio: 1, state: 'NO_HAND' as GState, label: ''
});
export const hands = [mk(), mk()];
export const thresholds = { close: R.pinch_close_ratio as number, open: R.pinch_open_ratio as number };
export const live = { present: false, open: false, ratio: 1 };

let video: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;
let landmarker: HandLandmarker | null = null;
let running = false;
let calibAbort = false;
let skipToggle = false;
let inferMs = 0;
let twoHandPrev: number | null = null;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const openPalm = (l: { x: number; y: number }[]) =>
  [[8, 6], [12, 10], [16, 14], [20, 18]].every(([tip, pip]) => dist(l[tip], l[0]) > dist(l[pip], l[0]) * 1.15);

async function exists(url: string) {
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok && !(r.headers.get('content-type') || '').includes('text/html'); } catch { return false; }
}

export async function startTracking(el: HTMLVideoElement) {
  if (running) return;
  video = el;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera API (needs HTTPS)');
  const pipe = spec.hand_tracking.input;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: pipe.preferred_facing_mode, width: { ideal: pipe.capture_resolution.ideal_width }, height: { ideal: pipe.capture_resolution.ideal_height }, frameRate: { ideal: pipe.capture_fps_ideal } }
  });
  video.srcObject = stream;
  video.muted = true;
  video.setAttribute('playsinline', '');
  await video.play();
  const M = R.mediapipe;
  const fileset = await FilesetResolver.forVisionTasks(M.wasm).catch(() =>
    FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'));
  const modelUrl = (await exists(M.model_local)) ? M.model_local : M.model_remote;
  const make = (delegate: 'GPU' | 'CPU') => HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: M.min_detection_confidence, minHandPresenceConfidence: M.min_detection_confidence, minTrackingConfidence: M.min_tracking_confidence
  });
  landmarker = await make('GPU').catch(() => make('CPU'));
  running = true;
  loop();
}

export function stopTracking() {
  running = false;
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  if (video) video.srcObject = null;
  landmarker?.close();
  landmarker = null;
  hands.forEach((h, i) => { h.present = false; h.pinching = false; h.state = 'NO_HAND'; cursor(i, false); });
  releaseHolders();
}

function releaseHolders() { [...holders.keys()].filter(k => k.startsWith('h')).forEach(release); }

let lastVideoTime = -1;
function loop() {
  if (!running || !video || !landmarker) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    // adaptive inference: if the device is slow, run every other frame to protect render + latency
    skipToggle = !skipToggle;
    if (!(inferMs > 26 && skipToggle)) {
      lastVideoTime = video.currentTime;
      const t0 = performance.now();
      try { process(landmarker.detectForVideo(video, t0), t0); } catch { /* skip bad frame */ }
      inferMs = inferMs * 0.9 + (performance.now() - t0) * 0.1;
    }
  }
  requestAnimationFrame(loop);
}

function cursor(i: number, show: boolean, x = 0, y = 0, cls = '') {
  const el = document.getElementById('cur' + i);
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (!show) return;
  el.style.left = ((x + 1) / 2) * innerWidth + 'px';
  el.style.top = ((1 - y) / 2) * innerHeight + 'px';
  el.className = 'cur ' + cls;
}

function process(res: HandLandmarkerResult, now: number) {
  const W = R.reach_window;
  const seen = [false, false];
  res.landmarks.forEach((lm, i) => {
    if (i > 1) return;
    const h = hands[i];
    seen[i] = true;
    h.present = true;
    h.lastSeen = now;
    h.label = res.handedness?.[i]?.[0]?.categoryName ?? '';
    const conf = res.handedness?.[i]?.[0]?.score ?? 1;
    const size = dist(lm[0], lm[9]) || 0.1; // wrist -> middle knuckle: adapts to child-sized hands
    h.ratio = h.fr.f(dist(lm[4], lm[8]) / size, now);
    const rx = 1 - (lm[4].x + lm[8].x) / 2; // mirrored like a mirror
    const ry = (lm[4].y + lm[8].y) / 2;
    const mx = clamp01((rx - W.x0) / (W.x1 - W.x0));
    const my = clamp01((ry - W.y0) / (W.y1 - W.y0));
    const x = h.fx.f(mx * 2 - 1, now);
    const y = h.fy.f(-(my * 2 - 1), now);
    const px = Math.max(-1, Math.min(1, x + h.fx.dx * R.prediction_seconds));
    const py = Math.max(-1, Math.min(1, y + h.fy.dx * R.prediction_seconds));
    h.x = px; h.y = py;
    h.open = openPalm(lm);
    if (i === 0 || !seen[0]) { live.present = true; live.open = h.open; live.ratio = h.ratio; }

    const id = 'h' + i;
    // pinch with hysteresis + debounce + confidence gating
    if (!h.pinching) {
      if (h.ratio < thresholds.close && conf >= R.grab_min_confidence) {
        h.candSince ||= now;
        if (now - h.candSince >= R.grab_debounce_ms) {
          h.pinching = true;
          h.candSince = 0;
          if (!grab(id, px, py)) clickUiAt(px, py);
        }
      } else h.candSince = 0;
    } else if (h.ratio > thresholds.open) {
      h.pinching = false;
      release(id);
    }
    if (h.pinching) drag(id, px, py);
    else if (i === 0 || !hands[0].present) hoverAt(px, py);

    h.state = h.pinching ? (holders.has(id) ? 'DRAGGING' : 'GRABBED') : h.candSince ? 'PINCH_CANDIDATE' : input.hover && i === 0 ? 'HOVER' : 'HAND_DETECTED';
    cursor(i, true, px, py, h.pinching ? 'pinch' : h.state === 'PINCH_CANDIDATE' ? 'candidate' : h.state === 'HOVER' ? 'hover' : '');

    // reset: open palm hold -> confirmation dialog
    if (h.open && !h.pinching && !get().modal && get().phase === 'play') {
      h.palmSince ||= now;
      if (now - h.palmSince > R.reset_hold_ms) { h.palmSince = 0; set({ modal: 'reset' }); }
    } else h.palmSince = 0;
  });

  // tracking loss: grace period then freeze + safe release
  hands.forEach((h, i) => {
    if (!seen[i] && h.present && now - h.lastSeen > spec.hand_tracking.processing.occlusion_grace_ms) {
      h.present = false; h.pinching = false; h.candSince = 0; h.state = 'NO_HAND';
      h.fx.reset(); h.fy.reset(); h.fr.reset();
      release('h' + i);
      cursor(i, false);
      if (i === 0) live.present = false;
    }
  });
  if (!hands[0].present && !hands[1].present) live.present = false;

  // two hands: spread = exploded view, both pinching in empty space = rotate assembly
  const both = hands[0].present && hands[1].present;
  if (both && hands[0].open && hands[1].open && !hands[0].pinching && !hands[1].pinching) {
    const d = Math.abs(hands[0].x - hands[1].x) / 2;
    input.explodeTarget = clamp01((d - R.explode_spread_min) / (R.explode_spread_max - R.explode_spread_min));
  } else input.explodeTarget = 0;

  if (both && hands[0].pinching && hands[1].pinching && holders.size === 0) {
    const ang = Math.atan2(hands[1].y - hands[0].y, hands[1].x - hands[0].x);
    if (twoHandPrev !== null) {
      let d = ang - twoHandPrev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      rig.roll += d;
    }
    twoHandPrev = ang;
  } else twoHandPrev = null;
}

// Pinching a button (contextual controls, dialogs) works with hands too.
function clickUiAt(x: number, y: number) {
  const el = document.elementFromPoint(((x + 1) / 2) * innerWidth, ((1 - y) / 2) * innerHeight);
  (el?.closest('button') as HTMLElement | null)?.click();
}

// ---------- calibration (open palm -> pinch -> release) ----------
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function hold(cond: () => boolean, ms: number, timeout: number) {
  let since = 0;
  const t0 = performance.now();
  while (!calibAbort && performance.now() - t0 < timeout) {
    if (cond()) { since ||= performance.now(); if (performance.now() - since >= ms) return true; } else since = 0;
    await wait(50);
  }
  return false;
}
export function abortCalibration() { calibAbort = true; }

export async function calibrate() {
  calibAbort = false;
  set({ calib: { icon: '✋', text: T.calib_open } });
  if (!(await hold(() => live.present && live.open, 800, 30000))) return finish();
  const openRatio = Math.max(live.ratio, 0.5);
  const label = hands.find(h => h.present)?.label;
  set({ calib: { icon: '🤏', text: T.calib_pinch } });
  if (!(await hold(() => live.present && live.ratio < openRatio * 0.5, 500, 20000))) return finish();
  const pinchRatio = Math.min(live.ratio, openRatio * 0.4);
  thresholds.close = Math.max(0.12, pinchRatio + (openRatio - pinchRatio) * 0.32);
  thresholds.open = Math.max(thresholds.close + 0.08, pinchRatio + (openRatio - pinchRatio) * 0.55);
  set({ calib: { icon: '👐', text: T.calib_release } });
  await hold(() => live.present && live.ratio > thresholds.open, 400, 10000);
  void label;
  set({ calib: { icon: '✅', text: T.calib_done } });
  await wait(700);
  finish();
}
function finish() {
  set({ calib: { icon: '', text: '' }, phase: 'play' });
  showToast(T.welcome);
}
