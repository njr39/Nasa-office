// KAST client-tool handlers. Names and parameters match the five existing ElevenLabs tool definitions
// (nasa_get_state, nasa_find_media, nasa_open_media, nasa_control, nasa_tracker) where their schemas fit.
// nasa_view is a REVIEW-ONLY proposal: nothing creates or attaches it. Every handler:
//   1. is bound to ONE voice session and refuses to run once that session has ended,
//   2. strictly validates its arguments (unknown options are rejected, not ignored),
//   3. goes through Workspace.act(), which rechecks session, control lease and state after any await.
import { MEDIA, DOCS, PROJECTS, AGENTS, SECTIONS, WEB_SOURCES, COMMANDS, agentVisibleMedia } from './data.ts';
import type { Workspace } from './store.ts';
import { viewSnapshot, type Action, type Receipt } from './actions.ts';
import { parseOpenMedia, parseControl, parseTracker, parseView, onlyKeys } from './validate.ts';

type Params = Record<string, unknown>;
const json = (o: unknown) => JSON.stringify(o);
const receipt = (r: Receipt) => json({ ok: r.ok, status: r.status, detail: r.detail, error: r.error, revision: r.revision, observed: r.observed, state: r.state });
const refuse = (error: string, detail: string) => json({ ok: false, status: error === 'stale' ? 'stale' : 'rejected', error, detail });

export interface Binding { session: number; readScrollY?: () => number }

/** Page state that may be shown to the voice agent: ids and view state only. Never stored notes. */
export function pageState(ws: Workspace, readScrollY: () => number = () => 0) {
  const s = ws.state;
  return {
    synthetic_data: true, revision: s.revision,
    phase: s.phase, control: s.control, mode: s.mode,
    selected_node: s.selectedNode, open_project: s.openProject, open_document: s.openDocument, open_web: s.openWeb,
    slide: s.openDocument ? { index: s.slideIndex, total: DOCS.find((d) => d.id === s.openDocument)?.slides.length ?? 0 } : null,
    media: { ...ws.liveMedia(), players: s.media.id ? [s.media.id] : [] },
    layout: s.layout, captions: s.captions, gallery: s.gallery,
    scroll_section: s.scrollSection, scroll_y: Math.round(readScrollY()), camera: s.camera, project_view: s.projectView,
    pending_confirmation: s.confirm ? { kind: s.confirm.kind, title: s.confirm.title } : null,
    pending_command: s.command ? { command: s.command.command, status: s.command.status } : null,
    catalog: { projects: PROJECTS.map((p) => p.id), agents: AGENTS.map((a) => a.id), media: agentVisibleMedia().map((m) => m.id), documents: DOCS.map((d) => d.id), web_sources: WEB_SOURCES.map((w) => w.id), sections: SECTIONS, commands: COMMANDS },
  };
}

export function buildTools(ws: Workspace, b: Binding) {
  const scrollY = b.readScrollY ?? (() => 0);
  const inflight = new Map<string, Promise<string>>();
  const act = async (a: Action) => receipt(await ws.act(a, 'kast', { session: b.session }));

  /**
   * Every call: refuse when the session is gone; collapse an identical in-flight duplicate into one execution; capture what the
   * call was entitled to (session, control lease, mode) and recheck it BEFORE the result is returned. A result that was fetched
   * under authority that has since been withdrawn is discarded and replaced with a generic receipt.
   * The agent handing control to the user (set_control USER_CONTROL) changes the lease on purpose, so its own result is not rechecked.
   */
  const guarded = (name: string, fn: (p: Params) => Promise<string>, ownLeaseChange: (p: Params) => boolean = () => false) => async (p: Params): Promise<string> => {
    if (!ws.sessionLive(b.session)) return refuse('session_ended', 'The voice session has ended.');
    if (ws.state.phase !== 'hq') return refuse('not_entered', 'Select an agent and enter the workspace first.');
    const key = `${name}:${JSON.stringify(p ?? null)}`;
    const existing = inflight.get(key); if (existing) return existing;
    const cap = ws.capability(b.session);
    const run = fn(p).then((out) => {
      if (!ws.sessionLive(b.session)) return refuse('session_ended', 'The voice session ended before this finished.');
      if (!ownLeaseChange(p) && !ws.capabilityValid(cap)) return refuse('stale', 'Control or the mode changed while this was running. The result was discarded.');
      return out;
    });
    inflight.set(key, run); try { return await run; } finally { inflight.delete(key); }
  };

  return {
    nasa_get_state: guarded('nasa_get_state', async (p) => { const k = onlyKeys(p ?? {}, []); return k.ok ? json(pageState(ws, scrollY)) : refuse(k.error, k.detail); }),

    nasa_find_media: guarded('nasa_find_media', async (p) => {
      const k = onlyKeys(p, ['query', 'type']); if (!k.ok) return refuse(k.error, k.detail);
      if (typeof k.value.query !== 'string' || k.value.query.length > 120) return refuse('bad_args', '"query" must be a string up to 120 characters.');
      if (k.value.type !== undefined && !['all', 'video', 'image', 'presentation'].includes(k.value.type as string)) return refuse('bad_args', 'type must be all, video, image or presentation.');
      const q = k.value.query.toLowerCase().trim(); const type = (k.value.type as string | undefined) ?? 'all';
      const hit = (t: string, id: string) => !q || t.toLowerCase().includes(q) || id.includes(q) || q.split(/\s+/).some((w) => w.length > 2 && t.toLowerCase().includes(w));
      const media = agentVisibleMedia().filter((m) => (type === 'all' || m.kind === type) && hit(m.title, m.id)).map((m) => ({ id: m.id, title: m.title, kind: m.kind, duration_sec: m.durationSec, source: m.sourceNote }));
      const docs = type === 'all' || type === 'presentation' ? DOCS.filter((d) => hit(d.title, d.id)).map((d) => ({ id: d.id, title: d.title, kind: 'presentation' })) : [];
      return json({ synthetic_data: true, results: [...media, ...docs] });
    }),

    nasa_open_media: guarded('nasa_open_media', async (p) => {
      const v = parseOpenMedia(p); if (!v.ok) return refuse(v.error, v.detail);
      if (/^[a-z][a-z0-9+.-]*:/i.test(v.value.target)) return refuse('external_url_blocked', 'The review build opens indexed media only; external URLs need the viewer allowlist.');
      if (DOCS.some((d) => d.id === v.value.target)) return act({ type: 'open_document', id: v.value.target });
      return act({ type: 'open_media', id: v.value.target });
    }),

    nasa_control: guarded('nasa_control', async (p) => {
      const players = ws.state.media.id ? [ws.state.media.id] : [];
      const v = parseControl(p, players); if (!v.ok) return refuse(v.error, v.detail);
      switch (v.value.action) {
        case 'play': case 'pause': return act({ type: 'media', op: v.value.action });
        case 'next': case 'previous': return act({ type: 'slide', op: v.value.action });
        case 'gallery': return act({ type: 'gallery', open: true });
        case 'portrait': case 'horizontal': case 'auto': return act({ type: 'set_layout', layout: v.value.action });
        case 'captions_on': return act({ type: 'captions', on: true });
        case 'captions_off': return act({ type: 'captions', on: false });
      }
    }),

    nasa_tracker: guarded('nasa_tracker', async (p) => {
      const v = parseTracker(p); if (!v.ok) return refuse(v.error, v.detail);
      switch (v.value.action) {
        case 'get_state': return json(pageState(ws, scrollY));
        case 'select_project': return act({ type: 'open_project', id: v.value.target });
        case 'set_view': return act({ type: 'set_view', view: v.value.value });
        case 'remember': return act({ type: 'propose_save_context' });
        case 'set_control': return act({ type: 'set_control', owner: v.value.value });
        default: return refuse('not_implemented_in_review_build', `"${v.value.name}" needs the task store, which is not built yet.`);
      }
    }, (p) => (p as { action?: unknown })?.action === 'set_control'),

    // REVIEW-ONLY proposal (docs/KAST_TEST_BRANCH_SPEC.md). Not created or attached anywhere.
    nasa_view: guarded('nasa_view', async (p) => {
      const v = parseView(p); if (!v.ok) return refuse(v.error, v.detail);
      switch (v.value.action) {
        case 'scroll': return act({ type: 'scroll', to: v.value.section, dy: v.value.dy });
        case 'orbit': return act({ type: 'orbit', dyaw: v.value.yaw, dpitch: v.value.pitch });
        case 'select_node': return act({ type: 'select_node', id: v.value.target });
        case 'open_project': return act({ type: 'open_project', id: v.value.target });
        case 'open_document': return act({ type: 'open_document', id: v.value.target });
        case 'open_web': return act({ type: 'open_web', id: v.value.target });
        case 'reset_view': return act({ type: 'reset_view' });
        case 'propose': return act({ type: 'propose_command', command: v.value.command });
      }
    }),
  };
}

/** The ONLY text sent to the provider after connect: structural page state. Saved context is never included. */
export function buildContextUpdate(ws: Workspace, readScrollY?: () => number): string {
  return `NASA HQ page state (English UI, synthetic demo data): ${JSON.stringify(pageState(ws, readScrollY))}`;
}
export { viewSnapshot };
