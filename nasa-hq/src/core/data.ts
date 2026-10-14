// SYNTHETIC catalogue. Every record here is DEMO data until the backend and
// the authorized NOJARA HQ Drive subtree are connected. Nothing is a real status.
export const SYNTHETIC = true;

export type AgentId = 'bilal' | 'katib' | 'musa' | 'grandy' | 'fakir' | 'rasma' | 'nasaq' | 'kast';
export const AGENTS: { id: AgentId; name: string; routing: string }[] = [
  { id: 'bilal', name: 'Bilal', routing: 'Data provenance' },
  { id: 'katib', name: 'Katib', routing: 'Copy' },
  { id: 'musa', name: 'Musa', routing: 'Imagery' },
  { id: 'grandy', name: 'Grandy', routing: 'Build' },
  { id: 'fakir', name: 'Fakir', routing: 'Review' },
  { id: 'rasma', name: 'Rasma', routing: 'Layout' },
  { id: 'nasaq', name: 'NASAQ', routing: 'Brand' },
  { id: 'kast', name: 'KAST', routing: 'Guide' },
];

export type ProjectId = 'yah' | 'seven' | 'alahram';
export const PROJECTS: { id: ProjectId; title: string; scope: string; status: string; docId: string; mediaIds: string[] }[] = [
  { id: 'yah', title: 'Young & Human', scope: 'Youth platform', status: 'Illustrative plan', docId: 'doc-yah', mediaIds: ['film-01'] },
  { id: 'seven', title: 'SEVEN', scope: 'Working scope', status: 'Illustrative plan', docId: 'doc-seven', mediaIds: ['film-02'] },
  { id: 'alahram', title: 'Al-Ahram', scope: 'Working scope', status: 'Illustrative plan', docId: 'doc-alahram', mediaIds: [] },
];

export type MediaItem = { id: string; title: string; kind: 'video' | 'image' | 'presentation'; durationSec: number; src: string | null; sourceNote: string; local?: boolean };
// film-01 gets a REAL video source at startup (a generated test clip, see main.tsx). film-02 stays a synthetic slate.
// Local files chosen by the user are added at runtime, live only in this browser, and are never offered to the voice agent.
export const MEDIA: MediaItem[] = [
  { id: 'film-01', title: 'Showreel · Film 01', kind: 'video', durationSec: 8, src: null, sourceNote: 'Generated test clip, not NOJARA work' },
  { id: 'film-02', title: 'Showreel · Film 02', kind: 'video', durationSec: 179, src: null, sourceNote: 'Synthetic slate, no source linked' },
];
export function setMediaSource(id: string, src: string) { const m = MEDIA.find((x) => x.id === id); if (m) m.src = src; }
let localSeq = 0;
export function addLocalMedia(title: string, src: string): MediaItem {
  const item: MediaItem = { id: `local-${++localSeq}`, title, kind: 'video', durationSec: 0, src, sourceNote: 'Local file, stays in this browser', local: true };
  MEDIA.push(item); return item;
}
export function removeLocalMedia(id: string) { const i = MEDIA.findIndex((m) => m.id === id && m.local); if (i >= 0) MEDIA.splice(i, 1); }
/** What the voice agent may see: never a local file's name or id. */
export const agentVisibleMedia = () => MEDIA.filter((m) => !m.local);

export type DocItem = { id: string; title: string; projectId: ProjectId; slides: string[] };
export const DOCS: DocItem[] = [
  { id: 'doc-yah', title: 'Young & Human / Working notes', projectId: 'yah', slides: ['Platform concept', 'Community program', 'Audience', 'Next step'] },
  { id: 'doc-seven', title: 'SEVEN / Working brief', projectId: 'seven', slides: ['Destination system', 'Content system', 'Experience system', 'Scope and limits'] },
  { id: 'doc-alahram', title: 'Al-Ahram / Working notes', projectId: 'alahram', slides: ['Site analysis', 'Area study', 'Integrated vision', 'Next step'] },
];

export const SECTIONS = ['top', 'stage', 'projects', 'viewer', 'kast', 'bottom'] as const;
export type Section = (typeof SECTIONS)[number];

export const HQ_COORDS = { lat: 24.456, lng: 32.739 };

// Web sources for the viewer. The review build NEVER embeds them: the viewer shows the blocked state (S05) and a link out.
export const WEB_SOURCES = [{ id: 'nojara-site', title: 'NOJARA website', url: 'https://www.nojara.com' }] as const;

// Synthetic handoff registry (read-only demo rows). Real handoffs come from the single backend after reconciliation.
export const HANDOFFS = [
  { id: 'h-1', projectId: 'seven', from: 'Katib', to: 'Musa', title: 'Copy for the SEVEN brief imagery', status: 'open' },
  { id: 'h-2', projectId: 'yah', from: 'Rasma', to: 'Grandy', title: 'Layout notes for the Young & Human plan', status: 'accepted' },
] as const;

export const COMMANDS = ['open_viewer', 'reset_view'] as const;
export type CommandId = (typeof COMMANDS)[number];
