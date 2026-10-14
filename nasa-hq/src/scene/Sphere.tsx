import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AGENTS, PROJECTS } from '../core/data.ts';
import type { Origin } from '../core/actions.ts';

export interface SphereProps {
  camera: { yaw: number; pitch: number };
  selected: string | null;
  reducedMotion: boolean;
  level: () => number; // real audio level 0..1 from the SDK; 0 when not connected
  onSelect(id: string, origin: Origin): void;
  onOrbit(dyaw: number, dpitch: number, origin: Origin): void;
  onUnavailable(reason: string): void;
}

const NODES = [
  ...AGENTS.filter((a) => a.id !== 'kast').map((a) => ({ id: a.id as string, label: a.name, kind: 'agent' as const })),
  ...PROJECTS.map((p) => ({ id: p.id as string, label: p.title, kind: 'project' as const })),
];
const R = 1.6;
function fibonacci(i: number, n: number): THREE.Vector3 {
  const y = 1 - (2 * (i + 0.5)) / n; const r = Math.sqrt(1 - y * y); const phi = Math.PI * (3 - Math.sqrt(5)) * i;
  return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(R);
}

export function Sphere(p: SphereProps) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<Record<string, HTMLButtonElement | null>>({});
  const props = useRef(p); props.current = p;
  const dragged = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' }); }
    catch (e) { props.current.onUnavailable(e instanceof Error ? e.message : 'WebGL unavailable'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.prepend(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    // Stand-in environment. The locked HDRI (Poly Haven studio_small_08) replaces this once vendored.
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    const key = new THREE.DirectionalLight(0xffd9a0, 2.2); key.position.set(-3, 4, 3); scene.add(key);
    scene.add(new THREE.AmbientLight(0xffe2b8, 0.5));

    const world = new THREE.Group(); scene.add(world);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), new THREE.MeshPhysicalMaterial({
      color: 0xf2b45a, transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }));
    world.add(glass);
    const grid = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(R, 24, 16)), new THREE.LineBasicMaterial({ color: 0xe9c47a, transparent: true, opacity: 0.22 }));
    world.add(grid);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffe3a6, emissive: 0xffb347, emissiveIntensity: 0.55, roughness: 0.3 }));
    world.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshBasicMaterial({ color: 0x2f6bff, transparent: true, opacity: 0, depthWrite: false }));
    world.add(halo);

    const pos: Record<string, THREE.Vector3> = {};
    const links: Record<string, THREE.Line> = {};
    const dots: Record<string, THREE.Mesh> = {};
    NODES.forEach((n, i) => {
      const v = fibonacci(i, NODES.length); pos[n.id] = v;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(n.kind === 'project' ? 0.085 : 0.065, 20, 16),
        new THREE.MeshStandardMaterial({ color: n.kind === 'project' ? 0xf6d58e : 0xe9c47a, emissive: 0x6b4a14, roughness: 0.25, metalness: 0.4 }));
      dot.position.copy(v); world.add(dot); dots[n.id] = dot;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), v]), new THREE.LineBasicMaterial({ color: 0xe9c47a, transparent: true, opacity: 0.18 }));
      world.add(line); links[n.id] = line;
    });

    let w = 1, h = 1;
    const resize = () => { const r = el.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    // Camera eases toward the shared store state; there is no separate scene-only camera.
    const view = { yaw: props.current.camera.yaw, pitch: props.current.camera.pitch };
    let raf = 0, last = performance.now(), visible = true, running = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(el);
    const v3 = new THREE.Vector3();
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!running || !visible || document.hidden) { last = t; return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const pr = props.current;
      const k = pr.reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
      view.yaw += (pr.camera.yaw - view.yaw) * k; view.pitch += (pr.camera.pitch - view.pitch) * k;
      world.rotation.set(view.pitch, view.yaw, 0);
      cam.position.set(0, 0, 5.4); cam.lookAt(0, 0, 0);
      const lvl = pr.level();
      const s = 1 + lvl * 0.35; core.scale.setScalar(s);
      (halo.material as THREE.MeshBasicMaterial).opacity = Math.min(0.55, lvl * 0.9); halo.scale.setScalar(s);
      NODES.forEach((n) => {
        const sel = pr.selected === n.id;
        (links[n.id].material as THREE.LineBasicMaterial).color.set(sel ? 0x2f6bff : 0xe9c47a);
        (links[n.id].material as THREE.LineBasicMaterial).opacity = sel ? 0.9 : 0.18;
        dots[n.id].scale.setScalar(sel ? 1.5 : 1);
        // Project the node to the screen and place its DOM label (text is never 3D).
        const wp = v3.copy(pos[n.id]).applyEuler(world.rotation);
        const depth = wp.z; // + toward the camera
        wp.project(cam);
        const b = labels.current[n.id];
        if (b) {
          b.style.left = `${Math.min(w - 44, Math.max(44, (wp.x * 0.5 + 0.5) * w))}px`; b.style.top = `${(-wp.y * 0.5 + 0.5) * h}px`;
          b.style.opacity = String(depth > 0 ? 1 : 0.28);
          b.style.pointerEvents = depth > -0.3 ? 'auto' : 'none';
          b.style.zIndex = String(Math.round(depth * 10) + 20);
        }
      });
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(frame);
    setReady(true);

    return () => {
      running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      pm.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  // Pointer drag orbits through the shared action layer; 5 px threshold so rotating never selects.
  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  const origin = (e: React.PointerEvent): Origin => (e.pointerType === 'touch' ? 'touch' : 'mouse');
  return (
    <div ref={host} className="sphere" role="group" aria-label="Agent sphere. Drag to rotate. Arrow keys rotate."
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; dragged.current = false; }}
      onPointerMove={(e) => {
        const d = down.current; if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!dragged.current && Math.hypot(dx, dy) < 5) return;
        if (!dragged.current) { dragged.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
        d.x = e.clientX; d.y = e.clientY;
        props.current.onOrbit(dx * 0.008, dy * 0.008, origin(e));
      }}
      onPointerUp={() => { down.current = null; setTimeout(() => { dragged.current = false; }, 0); }}
      onPointerCancel={() => { down.current = null; dragged.current = false; }}
      onClickCapture={(e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); } }}>
      {NODES.map((n) => (
        <button key={n.id} ref={(b) => { labels.current[n.id] = b; }} className={`node ${n.kind} ${p.selected === n.id ? 'on' : ''}`}
          aria-pressed={p.selected === n.id} onClick={(e) => props.current.onSelect(n.id, e.detail === 0 ? 'keyboard' : (e.nativeEvent as PointerEvent).pointerType === 'touch' ? 'touch' : 'mouse')}>{n.label}</button>
      ))}
      <div className="hub-label" aria-hidden="true">KAST</div>
      {!ready && <div className="sphere-loading">Syncing HQ…</div>}
    </div>
  );
}
