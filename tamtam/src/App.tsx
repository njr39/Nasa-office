import { useCallback, useEffect, useRef } from 'react';
import Scene from './Scene';
import Overlay from './Overlay';
import { T } from './spec';
import { get, set, showToast, useStore } from './store';
import { abortCalibration, calibrate, startTracking, stopTracking } from './tracking';
import { unlockAudio, sfx, speak } from './voice';
import { releaseAll, saveNow } from './world';

async function goFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try { await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.()); } catch { /* iOS Safari: use "Add to Home Screen" for true fullscreen */ }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const phase = useStore(s => s.phase);

  const begin = useCallback(async () => {
    if (get().phase !== 'idle') return;
    unlockAudio();
    sfx(520, 0.4);
    void goFullscreen();
    set({ phase: 'calibrating', camera: 'starting' });
    speak(T.welcome);
    try {
      await startTracking(videoRef.current!);
      set({ camera: 'on' });
      void calibrate();
    } catch (err) {
      console.warn('Hand tracking unavailable, touch/mouse mode:', err);
      set({ camera: 'denied', phase: 'play' });
      showToast(T.camera_denied);
    }
  }, []);

  const exit = useCallback(() => {
    abortCalibration();
    releaseAll();
    void saveNow();
    stopTracking(); // camera is off whenever the game is not active
    set({ phase: 'idle', camera: 'off', modal: null });
    if (document.fullscreenElement) void document.exitFullscreen();
  }, []);

  // touching the screen during calibration skips it (touch controls are always available)
  useEffect(() => {
    if (phase !== 'calibrating') return;
    const skip = () => { abortCalibration(); };
    addEventListener('pointerdown', skip, { once: true });
    return () => removeEventListener('pointerdown', skip);
  }, [phase]);

  useEffect(() => {
    addEventListener('tamtam-exit', exit);
    return () => removeEventListener('tamtam-exit', exit);
  }, [exit]);

  // pause the camera when the page is hidden, resume when visible again
  useEffect(() => {
    const vis = async () => {
      if (document.hidden) { stopTracking(); return; }
      const s = get();
      if (s.phase !== 'idle' && s.camera === 'on' && videoRef.current) {
        try { await startTracking(videoRef.current); } catch { set({ camera: 'denied' }); }
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  return (
    <>
      <Scene />
      <Overlay onBegin={() => void begin()} videoRef={videoRef} />
    </>
  );
}
