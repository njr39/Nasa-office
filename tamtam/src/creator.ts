// Creator tools (behind the parental gate): still capture, project JSON, GLB, STL (watertight parts only), clean-feed recording.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { T, spec } from './spec';
import { collectSave, parts, saveNow } from './world';
import { set, showToast } from './store';
import { kvClear, kvSet } from './persist';

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const canvas = () => document.querySelector('canvas') as HTMLCanvasElement;

export function captureStill() {
  canvas().toBlob(b => { if (b) { download(b, `tamtam-${stamp()}.png`); showToast(T.saved); } }, 'image/png');
}

export async function saveInvention() {
  const thumb = await new Promise<Blob | null>(res => canvas().toBlob(res, 'image/jpeg', 0.7));
  await kvSet('invention-' + Date.now(), { data: collectSave(), thumb });
  await saveNow();
  showToast(T.saved);
}

export function exportProjectJSON() {
  const names = [...parts.values()].filter(p => p.present).map(p => ({ id: p.spec.id, name: p.spec.name, attached: p.attached }));
  const doc = {
    game: spec.project.name,
    saved: new Date().toISOString(),
    scene: collectSave(),
    parts: names,
    episode_template: Object.fromEntries((spec.creator_mode.content_template as string[]).map(k => [k, '']))
  };
  download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `tamtam-project-${stamp()}.json`);
}

function worldClones(only?: (id: string) => boolean) {
  const g = new THREE.Group();
  parts.forEach(p => {
    if (!p.mesh || !p.present || (only && !only(p.spec.id))) return;
    p.mesh.updateWorldMatrix(true, false);
    const c = new THREE.Mesh(p.mesh.geometry, p.mesh.material);
    c.name = p.spec.name;
    p.mesh.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    g.add(c);
  });
  return g;
}

export async function exportGLB() {
  const buf = await new GLTFExporter().parseAsync(worldClones(), { binary: true });
  download(new Blob([buf as ArrayBuffer], { type: 'model/gltf-binary' }), `tamtam-invention-${stamp()}.glb`);
}

/** Every edge must be shared by exactly two triangles (positions compared, not indices). */
export function isWatertight(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const key = (i: number) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  const edges = new Map<string, number>();
  const n = idx ? idx.count : pos.count;
  for (let t = 0; t < n; t += 3) {
    const ids = [0, 1, 2].map(k => (idx ? idx.getX(t + k) : t + k));
    const ks = ids.map(key);
    if (ks[0] === ks[1] || ks[1] === ks[2] || ks[0] === ks[2]) continue; // degenerate (sphere poles)
    for (let e = 0; e < 3; e++) {
      const a = ks[e], b = ks[(e + 1) % 3];
      const k = a < b ? a + '|' + b : b + '|' + a;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const c of edges.values()) if (c !== 2) return false;
  return edges.size > 0;
}

export function exportSTL() {
  const ok: string[] = [];
  const bad: string[] = [];
  parts.forEach(p => {
    if (!p.mesh || !p.present) return;
    (isWatertight(p.mesh.geometry) ? ok : bad).push(p.spec.id);
  });
  if (!ok.length) { showToast('No printable parts'); return; }
  const g = worldClones(id => ok.includes(id));
  g.updateMatrixWorld(true);
  const out = new STLExporter().parse(g, { binary: true }) as unknown as DataView;
  download(new Blob([out.buffer as ArrayBuffer], { type: 'model/stl' }), `tamtam-invention-${stamp()}.stl`);
  if (bad.length) showToast(`Not printable: ${bad.join(', ')}`);
}

// Clean feed: records the 3D canvas only (no UI, no camera preview), after the adult agrees.
let rec: MediaRecorder | null = null;
export function toggleRecording() {
  if (rec && rec.state !== 'inactive') { rec.stop(); return; }
  const stream = canvas().captureStream(60);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { showToast('Recording not supported here'); return; }
  const chunks: Blob[] = [];
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    download(new Blob(chunks, { type: mime }), `tamtam-clean-feed-${stamp()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`);
    set({ recording: false });
  };
  rec.start(500);
  set({ recording: true });
}

export async function deleteAllData() {
  await kvClear();
  showToast(T.saved);
}
