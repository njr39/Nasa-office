import raw from './spec/tamtam.production.json';

export interface PartSpec {
  id: string;
  name: string;
  role?: 'root';
  required: boolean;
  unlock?: string;
  shape: 'box' | 'cylinder' | 'sphere';
  size: number[];
  color: string;
  material: 'metal' | 'glass' | 'plastic';
  emissive: number;
  position?: number[];
  socket?: number[];
  spawn?: number[];
  meshRotation?: number[];
  spin?: boolean;
  info: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const spec = raw as any;
export const PAL: Record<string, string> = spec.visual_system.colors;
export const PARTS: PartSpec[] = spec.scene.parts;
export const R = spec.runtime_defaults;
export const MAT = spec.visual_system.materials;
export const lang: 'en' | 'ar' = (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
export const T: Record<string, string> = spec.localization.strings[lang];
export const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
if (lang === 'ar') document.documentElement.dir = 'rtl';
