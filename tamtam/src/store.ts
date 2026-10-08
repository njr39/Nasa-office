import { create } from 'zustand';

export type Phase = 'idle' | 'calibrating' | 'play';
export type Modal = null | 'reset' | 'gate' | 'creator';

interface State {
  phase: Phase;
  camera: 'off' | 'starting' | 'on' | 'denied';
  toast: string;
  toastId: number;
  calib: { icon: string; text: string };
  controlsUntil: number;
  awake: boolean;
  freeMode: boolean;
  modal: Modal;
  gatePassed: boolean;
  recording: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lowQuality: boolean;
}

export const useStore = create<State>(() => ({
  phase: 'idle',
  camera: 'off',
  toast: '',
  toastId: 0,
  calib: { icon: '', text: '' },
  controlsUntil: 0,
  awake: false,
  freeMode: false,
  modal: null,
  gatePassed: false,
  recording: false,
  canUndo: false,
  canRedo: false,
  lowQuality: false
}));

export const set = useStore.setState;
export const get = useStore.getState;
export const showToast = (toast: string) => set(s => ({ toast, toastId: s.toastId + 1 }));
export const poke = () => set({ controlsUntil: Date.now() + 5000 });
