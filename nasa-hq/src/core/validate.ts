// Runtime validation for every value that arrives from outside the app (voice tool calls, URLs, storage).
// TypeScript casts do not validate anything at runtime; these functions do.
import { PROJECTS, MEDIA, DOCS, WEB_SOURCES, SECTIONS, COMMANDS, AGENTS } from './data.ts';

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; detail: string };
const bad = (error: string, detail: string): Checked<never> => ({ ok: false, error, detail });
const good = <T,>(value: T): Checked<T> => ({ ok: true, value });

export const LAYOUTS = ['auto', 'portrait', 'horizontal'] as const;
export const PROJECT_VIEWS = ['board', 'list', 'timeline', 'memory', 'media'] as const;
export const CONTROLS = ['USER_CONTROL', 'AGENT_CONTROL'] as const;
export const MODES = ['normal', 'read_only'] as const;
export const MAX_ORBIT = Math.PI;       // per call, radians
export const MAX_SCROLL_DY = 5000;      // per call, pixels

export const oneOf = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === 'string' && (list as readonly string[]).includes(v);
export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reject keys the tool does not define: silent ignoring is how unsupported options get "accepted". */
export function onlyKeys(p: unknown, allowed: readonly string[]): Checked<Record<string, unknown>> {
  if (p === null || typeof p !== 'object' || Array.isArray(p)) return bad('bad_args', 'Arguments must be an object.');
  const extra = Object.keys(p as object).filter((k) => !allowed.includes(k));
  return extra.length ? bad('unsupported_option', `Unsupported option(s): ${extra.join(', ')}.`) : good(p as Record<string, unknown>);
}
const optString = (p: Record<string, unknown>, k: string, max = 200): Checked<string | undefined> =>
  p[k] === undefined ? good(undefined) : typeof p[k] === 'string' && (p[k] as string).length <= max ? good(p[k] as string) : bad('bad_args', `"${k}" must be a string up to ${max} characters.`);

export const ids = {
  node: [...AGENTS.map((a) => a.id as string), ...PROJECTS.map((p) => p.id as string)],
  project: PROJECTS.map((p) => p.id as string), media: MEDIA.map((m) => m.id), document: DOCS.map((d) => d.id), web: WEB_SOURCES.map((w) => w.id as string),
};

export function parseOpenMedia(raw: unknown): Checked<{ target: string; screen: 'primary' }> {
  const k = onlyKeys(raw, ['target', 'screen']); if (!k.ok) return k;
  const t = optString(k.value, 'target', 300); if (!t.ok) return t; if (!t.value) return bad('bad_args', '"target" is required.');
  const s = optString(k.value, 'screen', 20); if (!s.ok) return s;
  if (s.value !== undefined && s.value !== 'primary') return bad('unsupported_screen', `Screen "${s.value}" is not supported; only "primary".`);
  return good({ target: t.value, screen: 'primary' });
}
export type ControlAction = 'play' | 'pause' | 'next' | 'previous' | 'gallery' | 'portrait' | 'horizontal' | 'auto' | 'captions_on' | 'captions_off';
const CONTROL_ACTIONS = ['play', 'pause', 'next', 'previous', 'gallery', 'portrait', 'horizontal', 'auto', 'captions_on', 'captions_off'] as const;
export function parseControl(raw: unknown, registeredPlayers: string[]): Checked<{ action: ControlAction; target?: string }> {
  const k = onlyKeys(raw, ['action', 'target']); if (!k.ok) return k;
  if (!oneOf(CONTROL_ACTIONS, k.value.action)) return bad('unsupported_action', `Unsupported action "${String(k.value.action)}".`);
  const t = optString(k.value, 'target', 80); if (!t.ok) return t;
  if (t.value !== undefined && !registeredPlayers.includes(t.value)) return bad('unknown_player', `No registered player "${t.value}". Registered: ${registeredPlayers.join(', ') || 'none'}.`);
  return good({ action: k.value.action, target: t.value });
}
const TRACKER_ACTIONS = ['get_state', 'select_project', 'set_view', 'set_filter', 'open_task', 'add_task', 'set_status', 'remember', 'update_task', 'set_control'] as const;
export type TrackerParsed =
  | { action: 'get_state' } | { action: 'select_project'; target: string } | { action: 'set_view'; value: (typeof PROJECT_VIEWS)[number] }
  | { action: 'remember' } | { action: 'set_control'; value: (typeof CONTROLS)[number] } | { action: 'unsupported'; name: string };
export function parseTracker(raw: unknown): Checked<TrackerParsed> {
  const k = onlyKeys(raw, ['action', 'target', 'value']); if (!k.ok) return k;
  const a = k.value.action; if (!oneOf(TRACKER_ACTIONS, a)) return bad('unsupported_action', `Unsupported action "${String(a)}".`);
  const t = optString(k.value, 'target', 80); if (!t.ok) return t;
  const v = optString(k.value, 'value', 2000); if (!v.ok) return v;
  switch (a) {
    case 'get_state': return good({ action: 'get_state' });
    case 'select_project': return t.value && ids.project.includes(t.value) ? good({ action: 'select_project', target: t.value }) : bad('unknown_project', `Known projects: ${ids.project.join(', ')}.`);
    case 'set_view': return oneOf(PROJECT_VIEWS, v.value) ? good({ action: 'set_view', value: v.value }) : bad('bad_args', `value must be one of ${PROJECT_VIEWS.join(', ')}.`);
    case 'set_control': return oneOf(CONTROLS, v.value) ? good({ action: 'set_control', value: v.value }) : bad('bad_args', `value must be USER_CONTROL or AGENT_CONTROL.`);
    // Synthetic mode stores an app-generated view-state summary only. Free text from the voice session is refused.
    case 'remember': return v.value ? bad('free_text_not_allowed', 'This review build saves an app-generated view summary only, not free text.') : good({ action: 'remember' });
    default: return good({ action: 'unsupported', name: a });
  }
}
export type ViewParsed =
  | { action: 'scroll'; section?: (typeof SECTIONS)[number]; dy?: number } | { action: 'orbit'; yaw: number; pitch: number }
  | { action: 'select_node' | 'open_project' | 'open_document' | 'open_web'; target: string } | { action: 'reset_view' } | { action: 'propose'; command: (typeof COMMANDS)[number] };
export function parseView(raw: unknown): Checked<ViewParsed> {
  const k = onlyKeys(raw, ['action', 'target', 'section', 'dy', 'yaw', 'pitch', 'command']); if (!k.ok) return k;
  const a = k.value.action; const p = k.value;
  const t = optString(p, 'target', 80); if (!t.ok) return t;
  switch (a) {
    case 'scroll': {
      if (p.section !== undefined && !oneOf(SECTIONS, p.section)) return bad('unknown_section', `Sections: ${SECTIONS.join(', ')}.`);
      if (p.dy !== undefined && (!isFiniteNumber(p.dy) || Math.abs(p.dy) > MAX_SCROLL_DY)) return bad('bad_args', `dy must be a finite number within ±${MAX_SCROLL_DY}.`);
      if (p.section === undefined && p.dy === undefined) return bad('bad_args', 'Provide a section or dy.');
      if (p.section !== undefined && p.dy !== undefined) return bad('bad_args', 'Provide a section or dy, not both.');
      return good({ action: 'scroll', section: p.section as never, dy: p.dy as number | undefined });
    }
    case 'orbit': {
      const yaw = p.yaw ?? 0, pitch = p.pitch ?? 0;
      if (!isFiniteNumber(yaw) || !isFiniteNumber(pitch) || Math.abs(yaw) > MAX_ORBIT || Math.abs(pitch) > MAX_ORBIT) return bad('bad_args', `yaw and pitch must be finite numbers within ±π.`);
      return good({ action: 'orbit', yaw, pitch });
    }
    case 'select_node': return t.value && ids.node.includes(t.value) ? good({ action: 'select_node', target: t.value }) : bad('unknown_node', `Known nodes: ${ids.node.join(', ')}.`);
    case 'open_project': return t.value && ids.project.includes(t.value) ? good({ action: 'open_project', target: t.value }) : bad('unknown_project', `Known projects: ${ids.project.join(', ')}.`);
    case 'open_document': return t.value && ids.document.includes(t.value) ? good({ action: 'open_document', target: t.value }) : bad('unknown_document', `Known documents: ${ids.document.join(', ')}.`);
    case 'open_web': return t.value && ids.web.includes(t.value) ? good({ action: 'open_web', target: t.value }) : bad('unknown_web_source', `Known web sources: ${ids.web.join(', ')}.`);
    case 'reset_view': return good({ action: 'reset_view' });
    case 'propose': return oneOf(COMMANDS, p.command) ? good({ action: 'propose', command: p.command }) : bad('unknown_command', `Commands: ${COMMANDS.join(', ')}.`);
    default: return bad('unsupported_action', `Unsupported action "${String(a)}".`);
  }
}
