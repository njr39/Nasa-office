// One validated action layer. Mouse, touch, keyboard and KAST client tools all go through Workspace.act(),
// which calls reduce() below. Nothing else mutates workspace state.
import { AGENTS, PROJECTS, MEDIA, DOCS, WEB_SOURCES, SECTIONS, COMMANDS, type Section, type CommandId } from './data.ts';
import { LAYOUTS, PROJECT_VIEWS, CONTROLS, MODES, MAX_ORBIT, MAX_SCROLL_DY, oneOf, isFiniteNumber, ids } from './validate.ts';

export type Origin = 'mouse' | 'touch' | 'keyboard' | 'kast' | 'test';
export type Layout = (typeof LAYOUTS)[number];
export type Control = (typeof CONTROLS)[number];
export type ProjectView = (typeof PROJECT_VIEWS)[number];
export type Mode = (typeof MODES)[number];

export type Action =
  | { type: 'choose_agent'; id: string }
  | { type: 'enter'; agent: string }
  | { type: 'select_node'; id: string | null }
  | { type: 'open_project'; id: string }
  | { type: 'close_project' }
  | { type: 'open_document'; id: string }
  | { type: 'open_media'; id: string }
  | { type: 'open_web'; id: string }
  | { type: 'media'; op: 'play' | 'pause' }
  | { type: 'slide'; op: 'next' | 'previous' }
  | { type: 'gallery'; open?: boolean }
  | { type: 'set_layout'; layout: Layout }
  | { type: 'captions'; on: boolean }
  | { type: 'scroll'; to?: Section; dy?: number }
  | { type: 'orbit'; dyaw: number; dpitch: number }
  | { type: 'reset_view' }
  | { type: 'set_view'; view: ProjectView }
  | { type: 'set_mode'; mode: Mode }
  | { type: 'set_list'; on: boolean }
  | { type: 'set_control'; owner: Control }
  | { type: 'propose_command'; command: CommandId }
  | { type: 'resolve_command'; id: string; run: boolean }
  | { type: 'propose_save_context' }
  | { type: 'resolve_confirm'; id: string; approve: boolean };

export interface Confirm { id: string; kind: 'save_context' | 'take_control'; title: string; detail: string; busy: boolean }
/** A proposal is bound to the target it DISPLAYS. It never re-resolves its target at Run time. */
export interface CommandCard { id: string; command: CommandId; label: string; targetLabel: string; projectId: string | null; docId: string | null; status: 'ready' | 'running' | 'done' | 'blocked' | 'stale'; note: string }
export type ViewKind = 'none' | 'media' | 'document' | 'web';

/** What a saved synthetic context contains: app-generated view state only. Never free text from a person or an agent. */
export interface ViewSnapshot { projectId: string | null; documentId: string | null; mediaId: string | null; slideIndex: number }

export interface State {
  revision: number;
  phase: 'gate' | 'hq';
  entryAgent: string | null;
  mode: Mode;
  selectedNode: string | null;
  openProject: string | null;
  openDocument: string | null;
  openWeb: string | null;
  slideIndex: number;
  media: { id: string | null; status: 'idle' | 'ready' | 'playing' | 'paused' | 'unavailable'; positionSec: number };
  gallery: boolean;
  listView: boolean;
  layout: Layout;
  captions: boolean;
  control: Control;
  scrollSection: Section;
  camera: { yaw: number; pitch: number };
  projectView: ProjectView;
  confirm: Confirm | null;
  command: CommandCard | null;
}

export interface Receipt {
  ok: boolean;
  /** applied: state changed as reported. rejected: validation/permission refused. stale: control, session or state changed while the action was in flight; it was not committed (side effects were undone). */
  status: 'applied' | 'rejected' | 'stale';
  action: string;
  origin: Origin;
  detail: string;
  error?: string;
  at: number;
  revision: number;
  state: { phase: State['phase']; selectedNode: string | null; openProject: string | null; openDocument: string | null; control: Control; mode: Mode; media: State['media'] };
  observed?: Record<string, unknown>;
}

export const HOME_CAMERA = { yaw: 0.35, pitch: 0.18 };
const MAX_PITCH = 1.2;

export function initialState(): State {
  return {
    revision: 0, phase: 'gate', entryAgent: null, mode: 'normal', selectedNode: null, openProject: null, openDocument: null, openWeb: null, slideIndex: 0,
    media: { id: null, status: 'idle', positionSec: 0 }, gallery: false, listView: false, layout: 'auto', captions: false, control: 'AGENT_CONTROL',
    scrollSection: 'top', camera: { ...HOME_CAMERA }, projectView: 'board', confirm: null, command: null,
  };
}

export const NODE_IDS = ids.node;
const isAgentOrigin = (o: Origin) => o === 'kast';
const IDLE_MEDIA = { id: null, status: 'idle', positionSec: 0 } as const;
export const MUTATING = new Set<Action['type']>(['select_node', 'open_project', 'close_project', 'open_document', 'open_media', 'open_web', 'media',
  'slide', 'gallery', 'set_list', 'set_layout', 'captions', 'scroll', 'orbit', 'reset_view', 'set_view', 'propose_command', 'propose_save_context']);

export type Result = { state: State; ok: boolean; detail: string; error?: string };
const fail = (s: State, error: string, detail: string): Result => ({ state: s, ok: false, error, detail });
const done = (s: State, detail: string): Result => ({ state: s, ok: true, detail });
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
let seq = 0; const nextId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function viewSnapshot(s: State): ViewSnapshot {
  return { projectId: s.openProject, documentId: s.openDocument, mediaId: s.media.id, slideIndex: s.slideIndex };
}
export function describeSnapshot(v: ViewSnapshot): string {
  const p = PROJECTS.find((x) => x.id === v.projectId)?.title ?? 'no project';
  const d = DOCS.find((x) => x.id === v.documentId); const m = MEDIA.find((x) => x.id === v.mediaId);
  return `${p}${d ? `, ${d.title} slide ${v.slideIndex + 1}` : ''}${m ? `, ${m.title}` : ''}`;
}

/** Pure reducer. Revision bumping, media transport and persistence are done by Workspace around it. */
export function reduce(s: State, a: Action, origin: Origin): Result {
  if (s.phase === 'gate') {
    if (a.type === 'choose_agent') return AGENTS.some((x) => x.id === a.id) ? done({ ...s, entryAgent: a.id }, `Selected ${a.id}.`) : fail(s, 'unknown_agent', `No agent "${a.id}".`);
    if (a.type === 'enter') {
      if (!AGENTS.some((x) => x.id === a.agent)) return fail(s, 'agent_required', 'Select an agent before entering.');
      return done({ ...s, phase: 'hq', entryAgent: a.agent, selectedNode: a.agent, scrollSection: 'top' }, `Entered with ${a.agent}.`);
    }
    return fail(s, 'not_entered', 'Select an agent and enter the workspace first.');
  }
  if (a.type === 'choose_agent' || a.type === 'enter') return fail(s, 'already_entered', 'Already in the workspace.');
  // A pending confirmation freezes everything except its own resolution (S09 stays pending until the user acts).
  if (s.confirm && a.type !== 'resolve_confirm') return fail(s, 'confirm_pending', `Waiting for the user: ${s.confirm.title}`);
  // Read-only mode (S07): KAST may describe, never change.
  if (isAgentOrigin(origin) && s.mode === 'read_only' && (MUTATING.has(a.type) || a.type === 'set_control')) return fail(s, 'read_only', 'Read only. No changes made.');
  // User control: the agent may read, never change, until the user hands control back.
  if (isAgentOrigin(origin) && s.control === 'USER_CONTROL' && MUTATING.has(a.type)) {
    return fail(s, 'user_control', 'The user has control. Ask them to press Take control, or request control.');
  }
  switch (a.type) {
    case 'select_node': {
      if (a.id !== null && !NODE_IDS.includes(a.id)) return fail(s, 'unknown_node', `No node "${a.id}".`);
      return done({ ...s, selectedNode: a.id }, a.id ? `Selected ${a.id}.` : 'Selection cleared.');
    }
    case 'open_project': {
      const p = PROJECTS.find((x) => x.id === a.id);
      if (!p) return fail(s, 'unknown_project', `No project "${a.id}". Known: ${PROJECTS.map((x) => x.id).join(', ')}.`);
      return done({ ...s, openProject: p.id, selectedNode: p.id, openDocument: null, openWeb: null, slideIndex: 0, scrollSection: 'projects' }, `Opened project ${p.title}.`);
    }
    case 'close_project': return done({ ...s, openProject: null, openDocument: null, openWeb: null, media: { ...IDLE_MEDIA } }, 'Project closed.');
    case 'open_document': {
      const d = DOCS.find((x) => x.id === a.id);
      if (!d) return fail(s, 'unknown_document', `No document "${a.id}".`);
      return done({ ...s, openDocument: d.id, openWeb: null, openProject: d.projectId, selectedNode: d.projectId, slideIndex: 0, media: { ...IDLE_MEDIA }, scrollSection: 'viewer' }, `Opened ${d.title}.`);
    }
    case 'open_media': {
      const m = MEDIA.find((x) => x.id === a.id);
      if (!m) return fail(s, 'unknown_media', `No indexed media "${a.id}".`);
      return done({ ...s, openDocument: null, openWeb: null, media: { id: m.id, status: 'ready', positionSec: 0 }, scrollSection: 'viewer' }, `Opened ${m.title}. Not playing yet.`);
    }
    case 'open_web': {
      const w = WEB_SOURCES.find((x) => x.id === a.id);
      if (!w) return fail(s, 'unknown_web_source', `No web source "${a.id}".`);
      return done({ ...s, openWeb: w.id, openDocument: null, media: { ...IDLE_MEDIA }, scrollSection: 'viewer' }, `Opened ${w.title}. Embedding is not available in this build; open in browser.`);
    }
    case 'media': {
      if (!s.media.id) return fail(s, 'no_media', 'No film is open.');
      if (!oneOf(['play', 'pause'] as const, a.op)) return fail(s, 'bad_args', 'op must be play or pause.');
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
    case 'set_list': return typeof a.on === 'boolean' ? done({ ...s, listView: a.on }, a.on ? 'List view on.' : 'List view off.') : fail(s, 'bad_args', 'on must be true or false.');
    case 'set_layout': return oneOf(LAYOUTS, a.layout) ? done({ ...s, layout: a.layout }, `Layout ${a.layout}.`) : fail(s, 'bad_args', `Layout must be one of ${LAYOUTS.join(', ')}.`);
    case 'captions': return typeof a.on === 'boolean' ? done({ ...s, captions: a.on }, `Captions ${a.on ? 'on' : 'off'}.`) : fail(s, 'bad_args', 'on must be true or false.');
    case 'scroll': {
      if (a.to !== undefined && !oneOf(SECTIONS, a.to)) return fail(s, 'unknown_section', `Sections: ${SECTIONS.join(', ')}.`);
      if (a.dy !== undefined && (!isFiniteNumber(a.dy) || Math.abs(a.dy) > MAX_SCROLL_DY)) return fail(s, 'bad_args', `dy must be finite within ±${MAX_SCROLL_DY}.`);
      if (a.to === undefined && a.dy === undefined) return fail(s, 'bad_args', 'Provide a section or dy.');
      return done(a.to ? { ...s, scrollSection: a.to } : s, a.to ? `Scrolling to ${a.to}.` : `Scrolling by ${a.dy}px.`);
    }
    case 'orbit': {
      if (!isFiniteNumber(a.dyaw) || !isFiniteNumber(a.dpitch) || Math.abs(a.dyaw) > MAX_ORBIT || Math.abs(a.dpitch) > MAX_ORBIT) return fail(s, 'bad_args', 'Orbit needs finite numbers within ±π.');
      const yaw = s.camera.yaw + a.dyaw;
      const pitch = clamp(s.camera.pitch + a.dpitch, -MAX_PITCH, MAX_PITCH);
      return done({ ...s, camera: { yaw, pitch } }, 'Orbited.');
    }
    case 'reset_view': return done({ ...s, camera: { ...HOME_CAMERA }, selectedNode: null }, 'View reset.');
    case 'set_view': return oneOf(PROJECT_VIEWS, a.view) ? done({ ...s, projectView: a.view }, `Project view ${a.view}.`) : fail(s, 'bad_args', `View must be one of ${PROJECT_VIEWS.join(', ')}.`);
    case 'set_mode': {
      if (isAgentOrigin(origin)) return fail(s, 'user_only', 'Only the user can change the mode.');
      return oneOf(MODES, a.mode) ? done({ ...s, mode: a.mode }, a.mode === 'read_only' ? 'Read only on.' : 'Read only off.') : fail(s, 'bad_args', 'Unknown mode.');
    }
    case 'set_control': {
      if (!oneOf(CONTROLS, a.owner)) return fail(s, 'bad_args', 'owner must be USER_CONTROL or AGENT_CONTROL.');
      if (isAgentOrigin(origin) && a.owner === 'AGENT_CONTROL') {
        // The agent cannot grant itself control: the user must approve.
        return done({ ...s, confirm: { id: nextId('c'), kind: 'take_control', title: 'Let KAST take control?', detail: 'KAST will be able to scroll, orbit, open and play. Any touch or click returns control to you.', busy: false } }, 'Asked the user to allow control.');
      }
      return done({ ...s, control: a.owner }, a.owner === 'USER_CONTROL' ? 'You have control.' : 'KAST has control.');
    }
    case 'propose_command': {
      if (!oneOf(COMMANDS, a.command)) return fail(s, 'unknown_command', `Commands: ${COMMANDS.join(', ')}.`);
      if (a.command === 'reset_view') return done({ ...s, command: { id: nextId('k'), command: 'reset_view', label: 'Reset view', targetLabel: 'The sphere view and selection', projectId: null, docId: null, status: 'ready', note: 'Ready. Waiting for you to press Run.' } }, 'Proposed "Reset view". Nothing has run.');
      const doc = DOCS.find((d) => d.projectId === s.openProject);
      if (!s.openProject || !doc) return fail(s, 'no_project', 'Open a project first: the proposal names the exact document it would open.');
      return done({ ...s, command: { id: nextId('k'), command: 'open_viewer', label: 'Open viewer', targetLabel: doc.title, projectId: s.openProject, docId: doc.id, status: 'ready', note: 'Ready. Waiting for you to press Run.' } }, `Proposed "Open viewer: ${doc.title}". Nothing has run.`);
    }
    case 'resolve_command': {
      const c = s.command;
      if (!c || c.id !== a.id || c.status !== 'ready') return fail(s, 'stale_command', 'That proposal is no longer pending.');
      if (isAgentOrigin(origin)) return fail(s, 'user_only', 'Only the user can run or cancel a proposed command.');
      if (!a.run) return done({ ...s, command: null }, 'Cancelled.');
      if (c.command === 'reset_view') return done({ ...s, camera: { ...HOME_CAMERA }, selectedNode: null, command: { ...c, status: 'done', note: 'Done. View reset.' } }, 'Ran reset view.');
      const doc = DOCS.find((d) => d.id === c.docId);
      if (!doc || s.openProject !== c.projectId) return done({ ...s, command: { ...c, status: 'stale', note: 'The project changed after this was proposed. Nothing ran.' } }, 'Stale: the target changed. Nothing ran.');
      return done({ ...s, openDocument: doc.id, openWeb: null, slideIndex: 0, media: { ...IDLE_MEDIA }, scrollSection: 'viewer', command: { ...c, status: 'done', note: `Done. Opened ${doc.title}.` } }, `Ran open viewer: ${doc.title}.`);
    }
    case 'propose_save_context': {
      if (!s.openProject) return fail(s, 'no_project', 'Open a project first; the saved context records what is open.');
      return done({ ...s, confirm: { id: nextId('c'), kind: 'save_context', title: 'Save this view as synthetic context?', detail: 'Saves an app-generated summary of what is open. No free text. Synthetic demo data only; it is never sent to KAST.', busy: false } }, 'Waiting for the user to approve saving.');
    }
    case 'resolve_confirm': {
      if (!s.confirm || s.confirm.id !== a.id) return fail(s, 'stale_confirm', 'That confirmation is no longer pending.');
      if (isAgentOrigin(origin)) return fail(s, 'user_only', 'Only the user can resolve a confirmation.');
      if (s.confirm.busy) return fail(s, 'busy', 'Already saving.');
      const c = s.confirm;
      if (!a.approve) return done({ ...s, confirm: null }, 'Declined.');
      if (c.kind === 'take_control') return done({ ...s, confirm: null, control: 'AGENT_CONTROL' }, 'KAST has control.');
      return done({ ...s, confirm: { ...c, busy: true } }, 'Approved. Saving.'); // Workspace performs the save, then clears the sheet
    }
  }
}

export function snapshot(s: State): Receipt['state'] {
  return { phase: s.phase, selectedNode: s.selectedNode, openProject: s.openProject, openDocument: s.openDocument, control: s.control, mode: s.mode, media: s.media };
}

/** Consistency pass applied to every committed state: a ready proposal whose displayed target is no longer current becomes stale. */
export function settle(s: State): State {
  const c = s.command;
  if (c && c.status === 'ready' && c.projectId !== null && c.projectId !== s.openProject) {
    return { ...s, command: { ...c, status: 'stale', note: 'The project changed after this was proposed. Nothing ran.' } };
  }
  return s;
}
