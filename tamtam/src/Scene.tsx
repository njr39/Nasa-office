import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { BallCollider, CuboidCollider, CylinderCollider, Physics, RigidBody } from '@react-three/rapier';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { MAT, PAL, PARTS, R, reducedMotion, spec, type PartSpec } from './spec';
import { set, useStore } from './store';
import { poke } from './store';
import {
  ctx, drag, grab, hoverAt, holders, input, parts, release, releaseAll, redo, resetAll, restore, rig, socketWorld, sparks, step, undo
} from './world';

const EM = 0.4; // emissive scale: keeps colors saturated instead of washed-out under ACES
// ---------- one invention part ----------
function Geo({ s }: { s: PartSpec }) {
  if (s.shape === 'box') return <boxGeometry args={[s.size[0], s.size[1], s.size[2]]} />;
  if (s.shape === 'sphere') return <sphereGeometry args={[s.size[0], 40, 40]} />;
  return <cylinderGeometry args={[s.size[0], s.size[1], s.size[2], 48]} />;
}
function Mat({ s }: { s: PartSpec }) {
  const c = PAL[s.color];
  if (s.material === 'glass')
    return <meshPhysicalMaterial color={c} emissive={c} emissiveIntensity={s.emissive * EM} roughness={MAT.glass.roughness} transmission={0.6} thickness={0.5} ior={MAT.glass.ior} transparent />;
  if (s.material === 'metal')
    return <meshPhysicalMaterial color={c} emissive={c} emissiveIntensity={s.emissive * EM} metalness={MAT.metal.metalness} roughness={MAT.metal.roughness} clearcoat={0.6} />;
  return <meshPhysicalMaterial color={c} emissive={c} emissiveIntensity={s.emissive * EM} metalness={MAT.plastic.metalness} roughness={MAT.plastic.roughness} clearcoat={0.4} />;
}
function Collider({ s }: { s: PartSpec }) {
  const rot = (s.meshRotation ?? [0, 0, 0]) as [number, number, number];
  if (s.shape === 'box') return <CuboidCollider args={[s.size[0] / 2, s.size[1] / 2, s.size[2] / 2]} />;
  if (s.shape === 'sphere') return <BallCollider args={[s.size[0]]} />;
  return <CylinderCollider args={[s.size[2] / 2, s.size[0]]} rotation={rot} />;
}

function PartView({ s, index }: { s: PartSpec; index: number }) {
  const rt = parts.get(s.id)!;
  const revealed = useStore(st => st.phase !== 'idle');
  const type = useMemo(() => (rt.attached ? 'kinematicPosition' : 'dynamic') as 'kinematicPosition' | 'dynamic', [rt]);
  const start = (s.position ?? s.spawn ?? s.socket ?? [0, 0, 0]) as [number, number, number];
  useLayoutEffect(() => { rt.mesh?.scale.setScalar(0.001); }, [rt]);
  useEffect(() => {
    if (!revealed || !rt.mesh) return;
    gsap.to(rt.mesh.scale, { x: 1, y: 1, z: 1, duration: reducedMotion ? 0.01 : 0.8, delay: reducedMotion ? 0 : 0.15 * index, ease: 'back.out(1.7)' });
  }, [revealed, rt, index]);
  return (
    <RigidBody
      ref={b => { rt.body = b; }}
      type={type}
      position={start}
      colliders={false}
      linearDamping={0.9}
      angularDamping={1.4}
      canSleep={false}
    >
      <Collider s={s} />
      <mesh ref={m => { rt.mesh = m; }} rotation={(s.meshRotation ?? [0, 0, 0]) as [number, number, number]} castShadow>
        <Geo s={s} />
        <Mat s={s} />
      </mesh>
    </RigidBody>
  );
}

function Parts() {
  const free = useStore(s => s.freeMode);
  return <>{PARTS.map((s, i) => (!s.unlock || free) && <PartView key={s.id} s={s} index={i} />)}</>;
}

// ---------- invisible play space (soft walls, nothing can be lost) ----------
function Bounds() {
  const B = R.bounds;
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[B.wall_x + 1, 0.5, B.wall_z + 1]} position={[0, B.floor_y - 0.5, 0]} />
      <CuboidCollider args={[0.5, 8, B.wall_z + 1]} position={[B.wall_x + 0.5, 2, 0]} />
      <CuboidCollider args={[0.5, 8, B.wall_z + 1]} position={[-B.wall_x - 0.5, 2, 0]} />
      <CuboidCollider args={[B.wall_x + 1, 8, 0.5]} position={[0, 2, B.wall_z + 0.5]} />
      <CuboidCollider args={[B.wall_x + 1, 8, 0.5]} position={[0, 2, -B.wall_z - 0.5]} />
    </RigidBody>
  );
}

// ---------- snap preview ghost (mint) ----------
function Ghosts() {
  const refs = useRef<Record<string, THREE.Mesh | null>>({});
  useFrame(() => {
    for (const s of PARTS) {
      const m = refs.current[s.id];
      const rt = parts.get(s.id)!;
      if (!m) continue;
      const h = [...holders.values()].find(x => x.part === rt);
      const show = !!h && !rt.attached && !s.role && h.cur.distanceTo(socketWorld(rt)) < R.snap_distance * 2.2;
      m.visible = show;
      if (show) {
        socketWorld(rt, m.position);
        m.quaternion.copy(rig.quat);
        const near = h!.cur.distanceTo(socketWorld(rt)) < R.snap_distance;
        (m.material as THREE.MeshBasicMaterial).opacity = near ? 0.55 : 0.22;
      }
    }
  });
  return (
    <>
      {PARTS.filter(s => !s.role).map(s => (
        <mesh key={s.id} ref={m => { refs.current[s.id] = m; }} visible={false} rotation={(s.meshRotation ?? [0, 0, 0]) as [number, number, number]}>
          <Geo s={s} />
          <meshBasicMaterial color={PAL.mint} transparent opacity={0.3} depthWrite={false} wireframe={false} />
        </mesh>
      ))}
    </>
  );
}

// ---------- ambient particles and celebration sparks ----------
function Stars() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = reducedMotion ? 150 : 520;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const palette = [PAL.violet, PAL.electric_blue, PAL.pink, PAL.mint, PAL.yellow].map(c => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 15, -Math.random() * 16 + 2], i * 3);
      const c = palette[i % 5]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  useFrame(({ clock }) => { if (ref.current && !reducedMotion) ref.current.rotation.y = clock.elapsedTime * 0.01; });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.8} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Sparks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const MAX = 220;
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const n = Math.min(sparks.length, MAX);
    for (let i = 0; i < n; i++) {
      const s = sparks[i];
      dummy.position.copy(s.pos);
      dummy.scale.setScalar(Math.max(0.01, s.life / 1.8) * 0.08);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, s.color);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ---------- controller: camera, pointer input, keyboard, per-frame world step ----------
function Controller() {
  const { gl, camera } = useThree();
  const awake = useStore(s => s.awake);
  const mounted = useRef(false);

  useEffect(() => {
    ctx.camera = camera as THREE.PerspectiveCamera;
    if (!mounted.current) { mounted.current = true; void restore(); }
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;
    const toNdc = (e: PointerEvent) => [(e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1] as const;
    const down = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); grab('p' + e.pointerId, ...toNdc(e)); poke(); };
    const move = (e: PointerEvent) => { const id = 'p' + e.pointerId; if (holders.has(id)) drag(id, ...toNdc(e)); else hoverAt(...toNdc(e)); };
    const up = (e: PointerEvent) => release('p' + e.pointerId);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'e') input.keyExplode = e.type === 'keydown' ? 1 : 0;
      if (e.type !== 'keydown') return;
      if (e.key === 'r') resetAll();
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'u') undo();
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || e.key === 'U') redo();
      if (e.key === 'Escape') { releaseAll(); window.dispatchEvent(new Event('tamtam-exit')); }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    addEventListener('keydown', key);
    addEventListener('keyup', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      removeEventListener('keydown', key);
      removeEventListener('keyup', key);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    step(dt, t, reducedMotion);
    // slow cinematic orbit, kept tiny to avoid motion sickness
    const amp = reducedMotion ? 0 : 0.6;
    const cam = spec.visual_system.camera.default_position as number[];
    camera.position.x += (cam[0] + Math.sin(t * 0.15) * amp - camera.position.x) * 0.05;
    camera.position.y += (cam[1] + Math.sin(t * 0.11) * amp * 0.3 - camera.position.y) * 0.05;
    camera.position.z = cam[2];
    camera.lookAt(0, 0, 0);
    // hover / hold glow
    parts.forEach(p => {
      const m = p.mesh?.material as THREE.MeshPhysicalMaterial | undefined;
      if (!m || !p.present) return;
      const target = (input.hover === p.spec.id || p.held ? 0.8 + p.spec.emissive : p.spec.emissive) * EM;
      m.emissiveIntensity += (target - m.emissiveIntensity) * 0.2;
      if (awake && p.spec.spin && p.attached && p.mesh) p.mesh.rotateY(dt * 8);
    });
  });
  return null;
}

function Lights() {
  const rim = useRef<THREE.PointLight>(null);
  useFrame(() => { if (rim.current) rim.current.intensity = 55 + (useStore.getState().awake ? 25 : 0); });
  return (
    <>
      <hemisphereLight args={['#bfc8ff', '#0C0D15', 0.55]} />
      <directionalLight position={[3, 5, 6]} intensity={1.5} />
      <pointLight ref={rim} position={[-5, 2, -3]} color={PAL.violet} intensity={55} distance={20} />
      <pointLight position={[5, -2, -2]} color={PAL.pink} intensity={50} distance={20} />
      <pointLight position={[0, -4, 5]} color={PAL.electric_blue} intensity={40} distance={20} />
    </>
  );
}

export default function Scene() {
  const low = useStore(s => s.lowQuality);
  const [dpr, setDpr] = useState(Math.min(devicePixelRatio, 2));
  return (
    <Canvas
      flat
      dpr={dpr}
      camera={{ fov: spec.visual_system.camera.fov, position: spec.visual_system.camera.default_position, near: 0.1, far: 80 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={[PAL.void]} />
      <fog attach="fog" args={[PAL.void, 10, 28]} />
      <PerformanceMonitor
        bounds={() => [40, 58]}
        onDecline={() => { set({ lowQuality: true }); setDpr(d => Math.max(0.9, d - 0.3)); }}
        onIncline={() => setDpr(d => Math.min(Math.min(devicePixelRatio, 2), d + 0.2))}
      />
      <Lights />
      <Stars />
      <Physics gravity={spec.assembly_engine.gravity} timeStep="vary">
        <Bounds />
        <Parts />
      </Physics>
      <Ghosts />
      <Sparks />
      <Controller />
      <EffectComposer multisampling={low ? 0 : 4} enableNormalPass={false}>
        <Bloom intensity={low ? 0 : 0.55} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
