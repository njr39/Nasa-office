// One validated action layer. Mouse, touch, keyboard and KAST client tools all
// go through act(). Nothing else mutates workspace state.
import { AGENTS, PROJECTS, MEDIA, DOCS, SECTIONS, type Section } from './data.ts';

export type Origin = 'mouse' | 'touch' | 'keyboard' | 'kast' | 'test';
export type Layout = 'auto' | 'portrait' | 'horizontal';
export type Control = 'USER_CONTROL' | 'AGENT_CONTROL';
export type ProjectView = 'board' | 'list' | 'timeline' | 'memory' | 'media';

export type Action =
  | { type: 'enter' }
  | { type: 'select_node'; id: string | null }
  | { type: 'open_project'; id: string }
  | { type: 'close_project' }
  | { type: 'open_document'; id: string }
  | { type: 'open_media'; id: string }
  | { type: 'media'; op: 'play' | 'pause' }
  | { type: 'slide'; op: 'next' | 'previous' }
  | { type: 'gallery'; open?: boolean }
  | { type: 'set_layout'; layout: Layout }
  | { type: 'captions'; on: boolean }
  | { type: 'scroll'; to?: Section; dy?: number }
  | { type: 'orbit'; dyaw: number; dpitch: number }
  | { type: 'reset_view' }
  | { type: 'set_view'; view: ProjectView }
  | { type: 'set_control'; owner: Control }
  | { type: 'propose_save_context'; text: string }
  | { type: 'resolve_confirm'; id: string; approve: boolean };

export interface Confirm { id: string; kind: 'save_context' | 'take_control'; title: string; detail: string; text?: string }

export interface State {
  phase: 'gate' | 'hq';
  selectedNode: string | null;
  openProject: string | null;
  openDocument: string | null;
  slideIndex: number;
  media: { id: string | null; status: 'idle' | 'ready' | 'playing' | 'paused' | 'unavailable'; positionSec: number };
  gallery: boolean;
  layout: Layout;
  captions: boolean;
  control: Control;
  scrollSection: Section;
  camera: { yaw: number; pitch: number };
  projectView: ProjectView;
  confirm: Confirm | null;
  lastSavedContext: { version: number; text: string } | null;
}

export interface Receipt {
  ok: boolean;
  action: string;
  origin: Origin;
  detail: string;
  error?: string;
  at: number;
  state: Pick<State, 'phase' | 'selectedNode' | 'openProject' | 'openDocument' | 'control'> & { media: State['media'] };
}

export const HOME_CAMERA = { yaw: 0.35, pitch: 0.18 };
const MAX_PITCH = 1.2;

export function initialState(): State {
  return {
    phase: 'gate', selectedNode: null, openProject: null, openDocument: null, slideIndex: 0,
    media: { id: null, status: 'idle', positionSec: 0 }, gallery: false, layout: 'auto', captions: false,
    control: 'AGENT_CONTROL', scrollSection: 'top', camera: { ...HOME_CAMERA }, projectView: 'board',
    confirm: null, lastSavedContext: null,
  };
}

export const NODE_IDS = [...AGENTS.map((a) => a.id as string), ...PROJECTS.map((p) => p.id as string)];
const isAgentOrigin = (o: Origin) => o === 'kast';
const MUTATING = new Set<Action['type']>(['select_node', 'open_project', 'close_project', 'open_document', 'open_media', 'media',
  'slide', 'gallery', 'set_layout', 'captions', 'scroll', 'orbit', 'reset_view', 'set_view', 'propose_save_context']);

export type Result = { state: State; ok: boolean; detail: string; error?: string };
const fail = (s: State, error: string, detail: string): Result => ({ state: s, ok: false, error, detail });
const done = (s: State, detail: string): Result => ({ state: s, ok: true, detail });
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pure reducer. Media transport is applied by the caller after the player confirms. */
export function reduce(s: State, a: Action, origin: Origin): Result {
  if (s.phase === 'gate' && a.type !== 'enter') return fail(s, 'not_entered', 'Workspace not entered yet.');
  // A pending confirmation freezes everything except its own resolution (S09 stays pending).
  if (s.confirm && a.type !== 'resolve_confirm') return fail(s, 'confirm_pending', `Waiting for the user: ${s.confirm.title}`);
  // User control: the agent may read, never change, until the user hands control back.
  if (isAgentOrigin(origin) && s.control === 'USER_CONTROL' && MUTATING.has(a.type)) {
    return fail(s, 'user_control', 'The user has control. Ask them to press Take control, or request control.');
  }
  switch (a.type) {
    case 'enter': return done({ ...s, phase: 'hq' }, 'Entered workspace.');
    case 'select_node': {
      if (a.id !== null && !NODE_IDS.includes(a.id)) return fail(s, 'unknown_node', `No node "${a.id}".`);
      return done({ ...s, selectedNode: a.id }, a.id ? `Selected ${a.id}.` : 'Selection cleared.');
    }
    case 'open_project': {
      const p = PROJECTS.find((x) => x.id === a.id);
      if (!p) return fail(s, 'unknown_project', `No project "${a.id}". Known: ${PROJECTS.map((x) => x.id).join(', ')}.`);
      return done({ ...s, openProject: p.id, selectedNode: p.id, openDocument: null, slideIndex: 0, scrollSection: 'projects' }, `Opened project ${p.title}.`);
    }
    case 'close_project': return done({ ...s, openProject: null, openDocument: null, media: { id: null, status: 'idle', positionSec: 0 } }, 'Project closed.');
    case 'open_document': {
      const d = DOCS.find((x) => x.id === a.id);
      if (!d) return fail(s, 'unknown_document', `No document "${a.id}".`);
      return done({ ...s, openDocument: d.id, openProject: d.projectId, selectedNode: d.projectId, slideIndex: 0, media: { id: null, status: 'idle', positionSec: 0 }, scrollSection: 'viewer' }, `Opened ${d.title}.`);
    }
    case 'open_media': {
      const m = MEDIA.find((x) => x.id === a.id);
      if (!m) return fail(s, 'unknown_media', `No indexed media "${a.id}".`);
      return done({ ...s, openDocument: null, media: { id: m.id, status: 'ready', positionSec: 0 }, scrollSection: 'viewer' }, `Opened ${m.title}. Not playing yet.`);
    }
    case 'media': {
      if (!s.media.id) return fail(s, 'no_media', 'No film is open.');
      return done(s, `Requested ${a.op}.`); // real status comes from the player adapter
    }
    case 'slide': {
      const d = DOCS.find((x) => x.id === s.openDocument);
      if (!d) return fail(s, 'no_document', 'No presentation is open.');
      const next = clamp(s.slideIndex + (a.op === 'next' ? 1 : -1), 0, d.slides.length - 1);
      if (next === s.slideIndex) return fail(s, 'edge', a.op === 'next' ? 'Already on the last slide.' : 'Already on the first slide.');
      return done({ ...s, slideIndex: next }, `Slide ${next + 1} of ${d.slides.length}.`);
    }
    case 'gallery': return done({ ...s, gallery: a.open ?? !s.gallery }, 'Gallery toggled.');
    case 'set_layout': return done({ ...s, layout: a.layout }, `Layout ${a.layout}.`);
    case 'captions': return done({ ...s, captions: a.on }, `Captions ${a.on ? 'on' : 'off'}.`);
    case 'scroll': {
      if (a.to && !SECTIONS.includes(a.to)) return fail(s, 'unknown_section', `Sections: ${SECTIONS.join(', ')}.`);
      if (!a.to && typeof a.dy !== 'number') return fail(s, 'bad_args', 'Provide a section or dy.');
      return done(a.to ? { ...s, scrollSection: a.to } : s, a.to ? `Scrolling to ${a.to}.` : `Scrolling by ${a.dy}px.`);
    }
    case 'orbit': {
      if (!Number.isFinite(a.dyaw) || !Number.isFinite(a.dpitch)) return fail(s, 'bad_args', 'Orbit needs numbers.');
      const yaw = s.camera.yaw + clamp(a.dyaw, -Math.PI, Math.PI);
      const pitch = clamp(s.camera.pitch + clamp(a.dpitch, -Math.PI, Math.PI), -MAX_PITCH, MAX_PITCH);
      return done({ ...s, camera: { yaw, pitch } }, 'Orbited.');
    }
    case 'reset_view': return done({ ...s, camera: { ...HOME_CAMERA }, selectedNode: null }, 'View reset.');
    case 'set_view': return done({ ...s, projectView: a.view }, `Project view ${a.view}.`);
    case 'set_control': {
      if (isAgentOrigin(origin) && a.owner === 'AGENT_CONTROL') {
        // The agent cannot grant itself control: the user must approve.
        return done({ ...s, confirm: { id: `c${Date.now()}`, kind: 'take_control', title: 'Let KAST take control?', detail: 'KAST will be able to scroll, orbit, open and play. Any touch or click returns control to you.' } }, 'Asked the user to allow control.');
      }
      return done({ ...s, control: a.owner }, a.owner === 'USER_CONTROL' ? 'You have control.' : 'KAST has control.');
    }
    case 'propose_save_context': {
      const text = a.text.trim();
      if (!text) return fail(s, 'empty', 'Nothing to save.');
      if (text.length > 1200) return fail(s, 'too_long', 'Context is limited to 1200 characters.');
      return done({ ...s, confirm: { id: `c${Date.now()}`, kind: 'save_context', title: 'Save this context?', detail: 'Saved as the latest approved context for the next session.', text } }, 'Waiting for the user to approve saving.');
    }
    case 'resolve_confirm': {
      if (!s.confirm || s.confirm.id !== a.id) return fail(s, 'stale_confirm', 'That confirmation is no longer pending.');
      if (isAgentOrigin(origin)) return fail(s, 'user_only', 'Only the user can resolve a confirmation.');
      const c = s.confirm;
      if (!a.approve) return done({ ...s, confirm: null }, 'Declined.');
      if (c.kind === 'take_control') return done({ ...s, confirm: null, control: 'AGENT_CONTROL' }, 'KAST has control.');
      return done({ ...s, confirm: null }, 'Approved.'); // persistence is performed by the store after approval
    }
  }
}

export function snapshot(s: State) {
  return { phase: s.phase, selectedNode: s.selectedNode, openProject: s.openProject, openDocument: s.openDocument, control: s.control, media: s.media };
}
