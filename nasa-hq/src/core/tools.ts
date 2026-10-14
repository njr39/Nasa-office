// KAST client-tool handlers. Names and parameters match the five existing ElevenLabs
// tool definitions (nasa_get_state, nasa_find_media, nasa_open_media, nasa_control,
// nasa_tracker) where their schemas fit. nasa_view is the ONE proposed addition:
// the existing five have no scroll, orbit, node-selection or document-opening action.
// Every handler calls Workspace.act(): the same validated path as mouse/touch/keyboard.
import { MEDIA, DOCS, PROJECTS, AGENTS, SECTIONS } from './data.ts';
import type { Workspace } from './store.ts';
import type { Action, Receipt } from './actions.ts';

type Params = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const json = (o: unknown) => JSON.stringify(o);
const receipt = (r: Receipt) => json({ ok: r.ok, detail: r.detail, error: r.error, state: r.state });

export function pageState(ws: Workspace, readScrollY: () => number = () => 0) {
  const s = ws.state;
  return {
    synthetic_data: true,
    phase: s.phase, control: s.control,
    selected_node: s.selectedNode, open_project: s.openProject, open_document: s.openDocument,
    slide: s.openDocument ? { index: s.slideIndex, total: DOCS.find((d) => d.id === s.openDocument)?.slides.length ?? 0 } : null,
    media: { ...ws.liveMedia(), players: s.media.id ? [s.media.id] : [] },
    layout: s.layout, captions: s.captions, gallery: s.gallery,
    scroll_section: s.scrollSection, scroll_y: Math.round(readScrollY()), camera: s.camera,
    project_view: s.projectView,
    pending_confirmation: s.confirm ? { kind: s.confirm.kind, title: s.confirm.title } : null,
    saved_context_version: ws.savedContext?.version ?? null,
    catalog: { projects: PROJECTS.map((p) => p.id), agents: AGENTS.map((a) => a.id), media: MEDIA.map((m) => m.id), documents: DOCS.map((d) => d.id), sections: SECTIONS },
    context_store: ws.contexts.kind,
  };
}

export function buildTools(ws: Workspace, readScrollY: () => number = () => 0) {
  const run = async (a: Action) => receipt(await ws.act(a, 'kast'));
  return {
    nasa_get_state: async () => json(pageState(ws, readScrollY)),

    nasa_find_media: async (p: Params) => {
      const q = (str(p.query) ?? '').toLowerCase().trim();
      const type = str(p.type) ?? 'all';
      const hits = MEDIA.filter((m) => (type === 'all' || m.kind === type) && (!q || m.title.toLowerCase().includes(q) || m.id.includes(q)
        || q.split(/\s+/).some((w) => w.length > 2 && m.title.toLowerCase().includes(w))));
      const docs = type === 'all' || type === 'presentation'
        ? DOCS.filter((d) => !q || d.title.toLowerCase().includes(q) || d.id.includes(q)).map((d) => ({ id: d.id, title: d.title, kind: 'presentation' })) : [];
      return json({ synthetic_data: true, results: [...hits.map((m) => ({ id: m.id, title: m.title, kind: m.kind, duration_sec: m.durationSec, source: m.sourceNote })), ...docs] });
    },

    nasa_open_media: async (p: Params) => {
      const target = str(p.target) ?? '';
      if (/^https?:\/\//i.test(target)) return json({ ok: false, error: 'external_url_blocked', detail: 'Review build opens indexed media only; external URLs need the viewer allowlist.' });
      if (DOCS.some((d) => d.id === target)) return run({ type: 'open_document', id: target });
      return run({ type: 'open_media', id: target });
    },

    nasa_control: async (p: Params) => {
      const a = str(p.action);
      switch (a) {
        case 'play': case 'pause': return run({ type: 'media', op: a });
        case 'next': case 'previous': return run({ type: 'slide', op: a });
        case 'gallery': return run({ type: 'gallery', open: true });
        case 'portrait': case 'horizontal': case 'auto': return run({ type: 'set_layout', layout: a });
        case 'captions_on': return run({ type: 'captions', on: true });
        case 'captions_off': return run({ type: 'captions', on: false });
        default: return json({ ok: false, error: 'unsupported_action', detail: `Unsupported action "${a}".` });
      }
    },

    nasa_tracker: async (p: Params) => {
      const a = str(p.action); const target = str(p.target); const value = str(p.value);
      switch (a) {
        case 'get_state': return json(pageState(ws, readScrollY));
        case 'select_project': return target ? run({ type: 'open_project', id: target }) : json({ ok: false, error: 'bad_args', detail: 'target required' });
        case 'set_view': return run({ type: 'set_view', view: value as never });
        case 'remember': return run({ type: 'propose_save_context', text: value ?? '' });
        case 'set_control': return run({ type: 'set_control', owner: value === 'USER_CONTROL' ? 'USER_CONTROL' : 'AGENT_CONTROL' });
        default: return json({ ok: false, error: 'not_implemented_in_review_build', detail: `"${a}" needs the task store, which is not built yet.` });
      }
    },

    // PROPOSED new tool (not yet created in ElevenLabs): see docs/KAST_TEST_BRANCH_SPEC.md
    nasa_view: async (p: Params) => {
      const a = str(p.action);
      switch (a) {
        case 'scroll': return run({ type: 'scroll', to: str(p.section) as never, dy: typeof p.dy === 'number' ? p.dy : undefined });
        case 'orbit': return run({ type: 'orbit', dyaw: Number(p.yaw ?? 0), dpitch: Number(p.pitch ?? 0) });
        case 'select_node': return run({ type: 'select_node', id: str(p.target) ?? null });
        case 'open_project': return run({ type: 'open_project', id: str(p.target) ?? '' });
        case 'open_document': return run({ type: 'open_document', id: str(p.target) ?? '' });
        case 'reset_view': return run({ type: 'reset_view' });
        default: return json({ ok: false, error: 'unsupported_action', detail: `Unsupported action "${a}".` });
      }
    },
  };
}
