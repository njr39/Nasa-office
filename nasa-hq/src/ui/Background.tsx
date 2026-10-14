import { useEffect, useRef } from 'react';

export type BgKind = 'plate' | 'dusk' | 'ink' | 'image' | 'video';
export type Motion = 'system' | 'reduce';
export interface Prefs { bg: BgKind; motion: Motion }
/** A file the user chose. It lives only as an object URL in this browser tab: never uploaded, never persisted. */
export interface LocalBg { kind: 'image' | 'video'; url: string; name: string }

export const BG_CHOICES: { id: BgKind; label: string; needs?: string }[] = [
  { id: 'plate', label: 'Demo plate (default)' }, { id: 'dusk', label: 'Dusk gradient' }, { id: 'ink', label: 'Solid ink' },
  { id: 'image', label: 'Your image (this browser only)' }, { id: 'video', label: 'Your video (this browser only)' },
];
/** What is and is not available, shown verbatim in Settings. */
export const BG_FORMATS = {
  supported: ['Built-in demo plate (SVG, illustrative, not satellite imagery)', 'CSS gradient and solid colour', 'Image you choose: PNG, JPEG, WebP, GIF or AVIF, as far as this browser decodes it', 'Video you choose: MP4 (H.264) or WebM, muted, looped, paused under reduced motion'],
  needsAssets: ['An approved NOJARA background film or image set (none supplied yet)', 'Igloo-style shader or WebGL ambient background (not implemented)', 'Equirectangular or 360 panorama and HDR (not implemented)', 'Lottie or animated SVG backgrounds (not implemented)', 'Saving a chosen file for the next visit (needs the backend; today only the choice of kind is remembered)'],
};

const KEY = 'nasa_hq.prefs';
export function loadPrefs(): Prefs {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    const bg: BgKind = j.bg === 'dusk' || j.bg === 'ink' ? j.bg : 'plate';       // image/video need a file this visit, so they never restore
    return { bg, motion: j.motion === 'reduce' ? 'reduce' : 'system' };
  } catch { return { bg: 'plate', motion: 'system' }; }
}
export function savePrefs(p: Prefs) { try { localStorage.setItem(KEY, JSON.stringify(p.bg === 'image' || p.bg === 'video' ? { ...p, bg: 'plate' } : p)); } catch { /* storage unavailable */ } }

export function Background({ bg, local, reduced }: { bg: BgKind; local: LocalBg | null; reduced: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  const kind: BgKind = (bg === 'image' && local?.kind === 'image') || (bg === 'video' && local?.kind === 'video') ? bg : bg === 'image' || bg === 'video' ? 'plate' : bg;
  useEffect(() => { const el = v.current; if (!el) return; if (reduced) el.pause(); else void el.play().catch(() => undefined); }, [reduced, kind, local?.url]);
  return (
    <div className="plate" data-bg={kind} aria-hidden="true">
      {kind === 'plate' && <Plate />}
      {kind === 'dusk' && <div className="fill dusk" />}
      {kind === 'ink' && <div className="fill ink" />}
      {kind === 'image' && local && <img className="fill" src={local.url} alt="" />}
      {kind === 'video' && local && <video ref={v} className="fill" src={local.url} muted loop playsInline autoPlay={!reduced} />}
      {(kind === 'image' || kind === 'video') && <div className="scrim" />}
      <span className="plate-tag mono">{kind === 'plate' ? 'DEMO PLATE · synthetic, not satellite imagery' : kind === 'image' || kind === 'video' ? `YOUR FILE · ${local?.name ?? ''}` : 'BACKGROUND · built-in'}</span>
    </div>
  );
}

function Plate() {
  return (
    <>
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5a1e" /><stop offset=".5" stopColor="#d9a24a" /><stop offset="1" stopColor="#f0c978" /></linearGradient>
          <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".012 .03" numOctaves="4" seed="7" /><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .2  0 0 0 0 .05  0 0 0 .55 0" /></filter>
          <linearGradient id="w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5f7f6a" /><stop offset="1" stopColor="#7fa28a" /></linearGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#g)" /><rect width="1600" height="1000" filter="url(#n)" opacity=".7" />
        <path d="M-50 640 C 250 520, 420 760, 700 600 S 1150 380, 1380 470 S 1650 420, 1700 330" fill="none" stroke="url(#w)" strokeWidth="64" strokeLinecap="round" opacity=".9" />
        <path d="M-50 640 C 250 520, 420 760, 700 600 S 1150 380, 1380 470 S 1650 420, 1700 330" fill="none" stroke="#2f4a3c" strokeWidth="6" opacity=".35" />
      </svg>
      <div className="flare" /><div className="grade" />
    </>
  );
}
