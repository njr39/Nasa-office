// Mutable game world: part registry, interaction (grab / drag / release / snap), history, persistence.
// Lives outside React so hand tracking (own loop) and rendering (R3F loop) never wait on React renders.
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import { PARTS, R, T, type PartSpec } from './spec';
import { get, poke, set, showToast } from './store';
import { sfx, speak } from './voice';
import { kvGet, kvSet } from './persist';

const DYNAMIC = 0;
const KINEMATIC = 2;

export interface PartRT {
  spec: PartSpec;
  body: RapierRigidBody | null;
  mesh: THREE.Mesh | null;
  attached: boolean;
  held: boolean;
  explode: number;
  present: boolean;
}

export const parts = new Map<string, PartRT>();
for (const s of PARTS) {
  parts.set(s.id, { spec: s, body: null, mesh: null, attached: !!s.required && !s.role, held: false, explode: 0, present: !s.unlock });
}
export const root = parts.get('robot_body')!;
export const required = PARTS.filter(p => p.required && !p.role).map(p => p.id);

export const rig = { pos: new THREE.Vector3(0, 0.2, 0), quat: new THREE.Quaternion(), roll: 0, bob: 0 };
export const input = { explodeTarget: 0, keyExplode: 0, hover: null as string | null };
export const ctx = { camera: null as THREE.PerspectiveCamera | null };

interface Holder { part: PartRT; z: number; off: THREE.Vector3; target: THREE.Vector3; cur: THREE.Vector3 }
export const holders = new Map<string, Holder>();

export interface Spark { pos: THREE.Vector3; vel: THREE.Vector3; life: number; color: THREE.Color }
export const sparks: Spark[] = [];
const SPARK_COLORS = ['#9358FF', '#22C7FF', '#FF4FC3', '#4DFFD0', '#FFE65C'].map(c => new THREE.Color(c));
export function celebrate(origin: THREE.Vector3) {
  for (let i = 0; i < 110; i++) {
    sparks.push({
      pos: origin.clone(),
      vel: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 3),
      life: 1.8, color: SPARK_COLORS[i % 5]
    });
  }
}

// ---------- geometry helpers ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpV = new THREE.Vector3();

export function socketWorld(p: PartRT, out = new THREE.Vector3()) {
  const s = p.spec.socket!;
  out.set(s[0], s[1], s[2]).multiplyScalar(1 + p.explode * R.explode_factor);
  return out.applyQuaternion(rig.quat).add(rig.pos);
}
export function bodyPos(p: PartRT, out = new THREE.Vector3()) {
  const t = p.body?.translation();
  return t ? out.set(t.x, t.y, t.z) : out.set(0, 0, 0);
}
function pickAt(x: number, y: number): PartRT | null {
  if (!ctx.camera) return null;
  ndc.set(x, y);
  ray.setFromCamera(ndc, ctx.camera);
  const list: THREE.Object3D[] = [];
  parts.forEach(p => { if (p.mesh && p.present) list.push(p.mesh); });
  const hit = ray.intersectObjects(list, false)[0];
  if (!hit) return null;
  for (const p of parts.values()) if (p.mesh === hit.object) return p;
  return null;
}
function planePoint(x: number, y: number, z: number): THREE.Vector3 | null {
  if (!ctx.camera) return null;
  ndc.set(x, y);
  ray.setFromCamera(ndc, ctx.camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), new THREE.Vector3());
}

// ---------- history (undo / redo) ----------
let hist: string[][] = [required.slice()];
let hi = 0;
function snapshot() { return [...parts.values()].filter(p => p.present && p.attached && !p.spec.role).map(p => p.spec.id); }
function syncHistoryFlags() { set({ canUndo: hi > 0, canRedo: hi < hist.length - 1 }); }
function pushHistory() {
  hist = hist.slice(0, hi + 1);
  hist.push(snapshot());
  hi = hist.length - 1;
  syncHistoryFlags();
  scheduleSave();
}
function applySnapshot(ids: string[]) {
  const want = new Set(ids);
  parts.forEach(p => {
    if (!p.present || p.spec.role) return;
    if (want.has(p.spec.id) && !p.attached) attach(p, false);
    else if (!want.has(p.spec.id) && p.attached) detach(p, false, true);
  });
  checkComplete();
  scheduleSave();
}
export function undo() { if (hi > 0) { hi--; applySnapshot(hist[hi]); syncHistoryFlags(); sfx(300); } }
export function redo() { if (hi < hist.length - 1) { hi++; applySnapshot(hist[hi]); syncHistoryFlags(); sfx(500); } }

// ---------- assemble / disassemble ----------
let helloSpoken = false;
export function detach(p: PartRT, record = true, release = false) {
  if (!p.attached) return;
  p.attached = false;
  p.body?.setBodyType(KINEMATIC, true);
  if (release) {
    // undo/redo: float the part just off its socket and let physics take it
    const s = socketWorld(p);
    const dir = new THREE.Vector3(Math.sign(p.spec.socket![0]) || 0.4, 0.3, 0).normalize().multiplyScalar(1.2);
    p.body?.setTranslation({ x: s.x + dir.x, y: s.y + dir.y, z: THREE.MathUtils.clamp(s.z, -1.2, 1.2) }, true);
    p.body?.setBodyType(DYNAMIC, true);
    p.body?.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
  set({ awake: false });
  if (record) {
    pushHistory();
    sfx(260, 0.16);
    showToast(p.spec.info);
    speak(helloSpoken ? p.spec.info : `${p.spec.info} ${T.hint_detach}`);
    helloSpoken = true;
    poke();
  }
}
export function attach(p: PartRT, record = true) {
  p.attached = true;
  p.held = false;
  p.body?.setBodyType(KINEMATIC, true);
  p.body?.setLinvel({ x: 0, y: 0, z: 0 }, true);
  p.body?.setAngvel({ x: 0, y: 0, z: 0 }, true);
  if (record) {
    pushHistory();
    sfx(880, 0.14);
    showToast(T.snap);
    poke();
    checkComplete();
  }
}
function checkComplete() {
  const all = required.every(id => parts.get(id)!.attached);
  const s = get();
  if (all && !s.awake) {
    set({ awake: true });
    sfx(660, 0.5);
    showToast(T.awake);
    speak(T.awake);
    celebrate(rig.pos.clone());
    if (!s.freeMode) unlockFreeMode();
  } else if (!all && s.awake) set({ awake: false });
}
function unlockFreeMode() {
  set({ freeMode: true });
  parts.forEach(p => { if (p.spec.unlock) p.present = true; });
  setTimeout(() => { showToast(T.unlock); speak(T.unlock); }, 2600);
  scheduleSave();
}

// ---------- pointer / hand input (shared) ----------
export function hoverAt(x: number, y: number) {
  input.hover = pickAt(x, y)?.spec.id ?? null;
}
export function grab(id: string, x: number, y: number): boolean {
  if (holders.has(id)) return true;
  const p = pickAt(x, y);
  if (!p) return false;
  for (const h of holders.values()) if (h.part === p) return true;
  const pos = bodyPos(p);
  const hit = planePoint(x, y, pos.z) ?? pos;
  p.held = true;
  p.body?.setBodyType(KINEMATIC, true);
  holders.set(id, { part: p, z: pos.z, off: pos.clone().sub(hit).setZ(0), target: pos.clone(), cur: pos.clone() });
  sfx(420);
  poke();
  return true;
}
export function drag(id: string, x: number, y: number) {
  const h = holders.get(id);
  if (!h) return;
  const hit = planePoint(x, y, h.z);
  if (!hit) return;
  h.target.copy(hit.add(h.off));
  const p = h.part;
  if (p.attached && !p.spec.role) {
    if (h.target.distanceTo(socketWorld(p, tmpV)) > R.detach_pull_distance) {
      h.cur.copy(bodyPos(p));
      detach(p);
    }
  }
}
export function release(id: string) {
  const h = holders.get(id);
  if (!h) return;
  holders.delete(id);
  const p = h.part;
  p.held = false;
  if (p.spec.role) return;
  if (p.attached) { // pulled a little but not enough: it simply settles back
    return;
  }
  if (bodyPos(p).distanceTo(socketWorld(p, tmpV)) < R.snap_distance) attach(p);
  else {
    p.body?.setBodyType(DYNAMIC, true);
    p.body?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    pushHistory();
  }
}
export function releaseAll() { [...holders.keys()].forEach(release); }

export function resetAll() {
  holders.clear();
  parts.forEach(p => {
    p.held = false;
    if (p.spec.role) return;
    if (p.spec.required) {
      p.attached = true;
      p.body?.setBodyType(KINEMATIC, true);
    } else if (p.present) {
      p.attached = false;
      const s = p.spec.spawn!;
      p.body?.setTranslation({ x: s[0], y: s[1], z: s[2] }, true);
      p.body?.setBodyType(DYNAMIC, true);
    }
  });
  rig.pos.set(0, 0.2, 0);
  rig.roll = 0;
  set({ awake: false });
  hist = [required.slice()];
  hi = 0;
  syncHistoryFlags();
  sfx(350, 0.3);
  scheduleSave();
}

// ---------- per-frame step (called from R3F loop) ----------
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const B = R.bounds;

export function step(dt: number, t: number, reduced: boolean) {
  const awake = get().awake;
  rig.bob = reduced ? 0 : awake ? Math.sin(t * 3) * 0.12 : Math.sin(t * 0.9) * 0.08;
  e.set(0, reduced ? 0 : Math.sin(t * 0.35) * 0.35, rig.roll);
  rig.quat.setFromEuler(e);
  const ex = Math.max(input.explodeTarget, input.keyExplode);

  // root follows its holder, otherwise floats where it was left
  const rh = [...holders.values()].find(h => h.part === root);
  if (rh) {
    rig.pos.x += (THREE.MathUtils.clamp(rh.target.x, -4.5, 4.5) - rig.pos.x) * 0.45;
    rig.pos.y += (THREE.MathUtils.clamp(rh.target.y, -2.2, 3.2) - rig.pos.y) * 0.45;
  }
  root.body?.setNextKinematicTranslation({ x: rig.pos.x, y: rig.pos.y + rig.bob, z: rig.pos.z });
  root.body?.setNextKinematicRotation(rig.quat);

  parts.forEach(p => {
    if (p.spec.role || !p.body || !p.present) return;
    p.explode += (ex - p.explode) * 0.12;
    const held = [...holders.values()].find(h => h.part === p);
    if (p.attached) {
      socketWorld(p, v);
      v.y += rig.bob;
      if (held) v.lerp(held.target, 0.3); // stretchy resistance before it lets go
      p.body.setNextKinematicTranslation(v);
      const r = p.body.rotation();
      q.set(r.x, r.y, r.z, r.w).slerp(rig.quat, 0.25);
      p.body.setNextKinematicRotation(q);
    } else if (held) {
      held.cur.lerp(held.target, 0.55);
      p.body.setNextKinematicTranslation(held.cur);
    } else {
      const tr = p.body.translation(); // keep loose parts in the play space
      if (tr.y < B.floor_y - 2 || Math.abs(tr.x) > B.wall_x + 2 || Math.abs(tr.z) > B.wall_z + 2) {
        p.body.setTranslation({ x: 0, y: 2.5, z: 0 }, true);
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  });

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    s.vel.y -= 5 * dt;
    s.pos.addScaledVector(s.vel, dt);
    if (s.life <= 0) sparks.splice(i, 1);
  }
}

// ---------- persistence ----------
interface Save { attached: string[]; free: boolean; pos: Record<string, number[]>; rig: number[] }
let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), 600);
}
export function collectSave(): Save {
  const pos: Record<string, number[]> = {};
  parts.forEach(p => {
    if (!p.present || p.spec.role || p.attached || !p.body) return;
    const t = p.body.translation();
    pos[p.spec.id] = [t.x, t.y, t.z];
  });
  return { attached: snapshot(), free: get().freeMode, pos, rig: [rig.pos.x, rig.pos.y] };
}
export async function saveNow(name = 'autosave') {
  await kvSet(name, collectSave());
}
export async function restore() {
  const s = await kvGet<Save>('autosave');
  if (!s) return;
  if (s.free) { set({ freeMode: true }); parts.forEach(p => { if (p.spec.unlock) p.present = true; }); }
  rig.pos.set(s.rig[0], s.rig[1], 0);
  // bodies mount a frame or two later
  await new Promise(r => setTimeout(r, 400));
  const want = new Set(s.attached);
  parts.forEach(p => {
    if (!p.present || p.spec.role) return;
    if (want.has(p.spec.id)) { p.attached = true; p.body?.setBodyType(KINEMATIC, true); }
    else {
      p.attached = false;
      const at = s.pos[p.spec.id] ?? p.spec.spawn ?? [0, 2, 0];
      p.body?.setTranslation({ x: at[0], y: at[1], z: at[2] }, true);
      p.body?.setBodyType(DYNAMIC, true);
    }
  });
  hist = [snapshot()];
  hi = 0;
  syncHistoryFlags();
  if (required.every(id => parts.get(id)!.attached)) set({ awake: true });
}
addEventListener('visibilitychange', () => { if (document.hidden) void saveNow(); });
