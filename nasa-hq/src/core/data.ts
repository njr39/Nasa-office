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

export type MediaItem = { id: string; title: string; kind: 'video' | 'image' | 'presentation'; durationSec: number; src: string | null; sourceNote: string };
export const MEDIA: MediaItem[] = [
  { id: 'film-01', title: 'Portfolio / Showreel · Film 01', kind: 'video', durationSec: 179, src: null, sourceNote: 'Source: to be linked (synthetic slate)' },
  { id: 'film-02', title: 'Portfolio / Showreel · Film 02', kind: 'video', durationSec: 179, src: null, sourceNote: 'Source: to be linked (synthetic slate)' },
];

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
