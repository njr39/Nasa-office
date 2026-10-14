// Synthetic-only demo context. RELEASE GATE: nothing private is stored, loaded or sent to a provider while
// authentication, retention and export permissions are unresolved. What is saved here is an app-generated
// view summary (ids and a slide index), never free text from a person or an agent, and it is never sent to KAST.
import { describeSnapshot, type ViewSnapshot } from './actions.ts';
import { PROJECTS, MEDIA, DOCS } from './data.ts';

export const PRIVATE_CONTEXT_ENABLED = false as const;
export const SYNTHETIC_TTL_MS = 24 * 60 * 60 * 1000;
const KEY = 'nasa_hq.synthetic.context.v2';
const SCOPE_GLOBAL = '__none__';

export interface SavedContext { version: number; view: ViewSnapshot; summary: string; projectId: string | null; savedAt: string; expiresAt: string; synthetic: true }
export type SaveResult = { ok: true; version: number } | { ok: false; error: 'version_conflict' | 'invalid' | 'blocked'; current?: number };

export interface ContextStore {
  readonly kind: 'synthetic-local' | 'supabase';
  latest(projectId: string | null): Promise<SavedContext | null>;
  save(input: { view: ViewSnapshot; projectId: string | null; expectedVersion: number }): Promise<SaveResult>;
  clear(): Promise<void>;
}

/** Storage is untrusted input: anything that does not match the exact shape is ignored. */
export function parseStored(raw: unknown, now = Date.now()): SavedContext[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedContext[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>; const v = x.view as Record<string, unknown> | undefined;
    if (x.synthetic !== true || !Number.isInteger(x.version) || (x.version as number) < 1) continue;
    if (typeof x.savedAt !== 'string' || typeof x.expiresAt !== 'string' || !(Date.parse(x.expiresAt) > now)) continue;
    if (!(x.projectId === null || PROJECTS.some((p) => p.id === x.projectId))) continue;
    if (!v || !(v.projectId === null || PROJECTS.some((p) => p.id === v.projectId)) || !(v.documentId === null || DOCS.some((d) => d.id === v.documentId))
        || !(v.mediaId === null || MEDIA.some((m) => m.id === v.mediaId)) || !Number.isInteger(v.slideIndex) || (v.slideIndex as number) < 0 || (v.slideIndex as number) > 50) continue;
    const view = v as unknown as ViewSnapshot;
    out.push({ version: x.version as number, view, summary: describeSnapshot(view), projectId: x.projectId as string | null, savedAt: x.savedAt, expiresAt: x.expiresAt, synthetic: true });
  }
  return out;
}

export class SyntheticLocalStore implements ContextStore {
  readonly kind = 'synthetic-local' as const;
  private mem: SavedContext[] = [];
  private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  private now: () => number;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = null, now: () => number = () => Date.now()) { this.storage = storage; this.now = now; }
  private read(): SavedContext[] {
    try { const raw = this.storage?.getItem(KEY); if (raw) return parseStored(JSON.parse(raw), this.now()); } catch { /* storage may be blocked or corrupt */ }
    return parseStored(this.mem, this.now());
  }
  private write(rows: SavedContext[]) {
    this.mem = rows;
    try { this.storage?.setItem(KEY, JSON.stringify(rows)); } catch { /* keep in memory */ }
  }
  private scope = (p: string | null) => p ?? SCOPE_GLOBAL;
  async latest(projectId: string | null) {
    const rows = this.read().filter((r) => this.scope(r.projectId) === this.scope(projectId));
    return rows.length ? rows.reduce((a, b) => (b.version > a.version ? b : a)) : null;
  }
  async save(i: { view: ViewSnapshot; projectId: string | null; expectedVersion: number }): Promise<SaveResult> {
    if (!Number.isInteger(i.expectedVersion) || i.expectedVersion < 0) return { ok: false, error: 'invalid' };
    if (i.projectId !== null && !PROJECTS.some((p) => p.id === i.projectId)) return { ok: false, error: 'invalid' };
    const rows = this.read();
    const current = rows.filter((r) => this.scope(r.projectId) === this.scope(i.projectId)).reduce((m, r) => Math.max(m, r.version), 0);
    if (i.expectedVersion !== current) return { ok: false, error: 'version_conflict', current };
    const t = this.now();
    const next: SavedContext = { version: current + 1, view: i.view, summary: describeSnapshot(i.view), projectId: i.projectId, savedAt: new Date(t).toISOString(), expiresAt: new Date(t + SYNTHETIC_TTL_MS).toISOString(), synthetic: true };
    // Only the newest version per scope is kept: this is a demo note, not a history.
    this.write([...rows.filter((r) => this.scope(r.projectId) !== this.scope(i.projectId)), next]);
    return { ok: true, version: next.version };
  }
  async clear() { this.mem = []; try { this.storage?.removeItem(KEY); } catch { /* ignore */ } }
}

export class SupabaseBlockedStore implements ContextStore {
  readonly kind = 'supabase' as const;
  async latest(): Promise<SavedContext | null> { return null; }
  async save(): Promise<SaveResult> { return { ok: false, error: 'blocked' }; }
  async clear() {}
}
