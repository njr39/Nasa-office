// Versioned approved-context store. The synthetic-local implementation is for the
// review preview ONLY (labelled SYNTHETIC in the UI). The Supabase implementation
// is intentionally a stub that reports "blocked" until the backend contract is
// reconciled with the actual schema and Karsa's backend work.
export interface SavedContext { version: number; text: string; status: 'approved' | 'superseded' | 'invalid'; projectId: string | null; savedAt: string; sessionId: string | null }
export type SaveResult = { ok: true; version: number } | { ok: false; error: 'version_conflict' | 'invalid' | 'blocked'; current?: number };

export interface ContextStore {
  readonly kind: 'synthetic-local' | 'supabase';
  latest(): Promise<SavedContext | null>;
  save(input: { text: string; projectId: string | null; sessionId: string | null; expectedVersion: number }): Promise<SaveResult>;
}

const KEY = 'nasa_hq.synthetic.context.v1';
export class SyntheticLocalStore implements ContextStore {
  readonly kind = 'synthetic-local' as const;
  private mem: SavedContext[] = [];
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) { this.storage = storage; }
  private read(): SavedContext[] {
    try { const raw = this.storage?.getItem(KEY); if (raw) return JSON.parse(raw) as SavedContext[]; } catch { /* storage may be blocked */ }
    return this.mem;
  }
  private write(rows: SavedContext[]) {
    this.mem = rows;
    try { this.storage?.setItem(KEY, JSON.stringify(rows)); } catch { /* keep in memory */ }
  }
  async latest() {
    const valid = this.read().filter((r) => r.status !== 'invalid' && r.text.trim().length > 0);
    return valid.length ? valid.reduce((a, b) => (b.version > a.version ? b : a)) : null;
  }
  async save(i: { text: string; projectId: string | null; sessionId: string | null; expectedVersion: number }): Promise<SaveResult> {
    const rows = this.read();
    const current = rows.reduce((m, r) => Math.max(m, r.version), 0);
    if (!i.text.trim()) return { ok: false, error: 'invalid' };
    if (i.expectedVersion !== current) return { ok: false, error: 'version_conflict', current };
    const next: SavedContext = { version: current + 1, text: i.text.trim(), status: 'approved', projectId: i.projectId, savedAt: new Date().toISOString(), sessionId: i.sessionId };
    this.write([...rows.map((r) => (r.status === 'approved' ? { ...r, status: 'superseded' as const } : r)), next]);
    return { ok: true, version: next.version };
  }
}

export class SupabaseBlockedStore implements ContextStore {
  readonly kind = 'supabase' as const;
  async latest(): Promise<SavedContext | null> { return null; }
  async save(): Promise<SaveResult> { return { ok: false, error: 'blocked' }; }
}
