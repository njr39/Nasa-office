import { useEffect, useMemo, useState } from 'react';
import { T } from './spec';
import { speak } from './voice';
import { get, set, useStore } from './store';
import { redo, resetAll, undo } from './world';
import { captureStill, deleteAllData, exportGLB, exportProjectJSON, exportSTL, saveInvention, toggleRecording } from './creator';

function useNow(active: boolean) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick(n => n + 1), 300);
    return () => clearInterval(id);
  }, [active]);
}

function Toast() {
  const { toast, toastId } = useStore();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), 2800);
    return () => clearTimeout(id);
  }, [toastId, toast]);
  return <div id="toast" className={on ? 'on' : ''} aria-live="polite">{toast}</div>;
}

/** Floating glass controls: appear on interaction, vanish after 5 seconds of inactivity. */
function Controls() {
  const { controlsUntil, canUndo, canRedo, phase } = useStore();
  const visible = phase === 'play' && Date.now() < controlsUntil;
  useNow(phase === 'play');
  return (
    <div id="bar" className={visible ? 'on' : ''} role="toolbar">
      <button className="btn" aria-label="Undo" disabled={!canUndo} onClick={undo}>↶</button>
      <button className="btn" aria-label="Redo" disabled={!canRedo} onClick={redo}>↷</button>
      <button className="btn" aria-label="Reset" onClick={() => set({ modal: 'reset' })}>↺</button>
      <button className="btn" aria-label="Help" onClick={() => speak(T.hint_start)}>💡</button>
      <button className="btn" aria-label="Save and share (grown-ups)" onClick={() => set({ modal: get().gatePassed ? 'creator' : 'gate' })}>💾</button>
      <button className="btn" aria-label="Exit" onClick={() => window.dispatchEvent(new Event('tamtam-exit'))}>✕</button>
    </div>
  );
}

function ResetDialog() {
  return (
    <div className="modal">
      <div className="card">
        <h2>{T.reset_q}</h2>
        <div className="row">
          <button className="btn opt" aria-label="Yes" onClick={() => { resetAll(); set({ modal: null }); }}>✔️</button>
          <button className="btn opt" aria-label="No" onClick={() => set({ modal: null })}>✖️</button>
        </div>
      </div>
    </div>
  );
}

function Gate() {
  const q = useMemo(() => {
    const a = 3 + Math.floor(Math.random() * 6), b = 3 + Math.floor(Math.random() * 6);
    const right = a + b;
    const opts = [...new Set([right, right + 2, right - 3, right + 5])].slice(0, 3).sort(() => Math.random() - 0.5);
    if (!opts.includes(right)) opts[0] = right;
    return { a, b, right, opts };
  }, []);
  return (
    <div className="modal">
      <div className="card">
        <h2>{T.gate_q}</h2>
        <h2 dir="ltr">{q.a} + {q.b} = ?</h2>
        <div className="row">
          {q.opts.map(o => (
            <button key={o} className="btn opt" onClick={() => set(o === q.right ? { modal: 'creator', gatePassed: true } : { modal: null })}>{o}</button>
          ))}
        </div>
        <div className="small"><button className="btn" style={{ minWidth: 56, minHeight: 56, fontSize: 22 }} aria-label="Close" onClick={() => set({ modal: null })}>✕</button></div>
      </div>
    </div>
  );
}

function Creator() {
  const recording = useStore(s => s.recording);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="modal">
      <div className="card">
        <h2>💾</h2>
        <div className="row">
          <button className="btn opt" aria-label="Save invention" onClick={() => void saveInvention()}>⭐</button>
          <button className="btn opt" aria-label="Picture (PNG)" onClick={captureStill}>📸</button>
          <button className={'btn opt' + (recording ? ' rec' : '')} aria-label="Record clean feed" onClick={toggleRecording}>{recording ? '⏹' : '⏺'}</button>
          <button className="btn opt" aria-label="Project file (JSON)" onClick={exportProjectJSON}>📄</button>
          <button className="btn opt" aria-label="3D model (GLB)" onClick={() => void exportGLB()}>📦</button>
          <button className="btn opt" aria-label="3D print (STL)" onClick={exportSTL}>🖨️</button>
          <button className="btn opt" aria-label="Delete saved data" onClick={() => (confirmDelete ? void deleteAllData().then(() => setConfirmDelete(false)) : setConfirmDelete(true))}>
            {confirmDelete ? '❗🗑️' : '🗑️'}
          </button>
        </div>
        <div className="small"><button className="btn" style={{ minWidth: 56, minHeight: 56, fontSize: 22 }} aria-label="Close" onClick={() => set({ modal: null })}>✕</button></div>
      </div>
    </div>
  );
}

export default function Overlay({ onBegin, videoRef }: { onBegin: () => void; videoRef: React.RefObject<HTMLVideoElement> }) {
  const { phase, modal, calib, camera } = useStore();
  return (
    <>
      <video id="cam" ref={videoRef} className={phase === 'calibrating' && camera === 'on' ? 'on' : ''} playsInline muted />
      <div className="cur" id="cur0" />
      <div className="cur" id="cur1" />
      {camera === 'on' && <div id="dot" title="Camera on. Processed on this device only." />}
      {phase === 'calibrating' && calib.text && (
        <div id="calib">
          <div className="big">{calib.icon}</div>
          <div className="txt">{calib.text}</div>
          <div className="sub">{T.calib_skip}</div>
        </div>
      )}
      <Toast />
      <Controls />
      {modal === 'reset' && <ResetDialog />}
      {modal === 'gate' && <Gate />}
      {modal === 'creator' && <Creator />}
      <div id="core" className={phase === 'idle' ? '' : 'gone'} onPointerDown={onBegin} role="button" aria-label="Start">
        <div id="orb" />
        <div id="corehint">{T.begin}</div>
      </div>
    </>
  );
}
