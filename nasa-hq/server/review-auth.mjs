// REVIEW-ONLY identity for a private local review run. It proves "a person with the passcode is at this browser" and nothing else.
// It is NOT the HQ identity layer: no Supabase Auth, no per-project permissions. The token route still requires session + CSRF + permission.
import { randomBytes, timingSafeEqual } from 'node:crypto';

const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export function createReviewAuth({ passcode, ttlMs = 8 * 3600_000, now = () => Date.now(), maxFailures = 5, lockMs = 60_000 }) {
  if (!passcode || passcode.length < 12) throw new Error('A review passcode of at least 12 characters is required.');
  const sessions = new Map(); let failures = 0, lockedUntil = 0;
  const cookieOf = (req) => /(?:^|;\s*)nasa_review=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie ?? '')?.[1] ?? null;
  const find = (req) => { const id = cookieOf(req); const s = id && sessions.get(id); if (!s) return null; if (s.expiresAt <= now()) { sessions.delete(id); return null; } return s; };
  return {
    // token-route adapter
    authenticate: async (req) => find(req),
    can: async (userId, permission) => userId === 'reviewer' && permission === 'hq:kast:token',
    login(code) {
      if (now() < lockedUntil) return { ok: false, status: 429 };
      if (!eq(code ?? '', passcode)) { if (++failures >= maxFailures) { lockedUntil = now() + lockMs; failures = 0; } return { ok: false, status: 401 }; }
      failures = 0; const id = randomBytes(24).toString('base64url');
      const s = { userId: 'reviewer', csrfToken: randomBytes(16).toString('base64url'), expiresAt: now() + ttlMs }; sessions.set(id, s);
      return { ok: true, id, session: s };
    },
    logout(req) { const id = cookieOf(req); if (id) sessions.delete(id); },
    session: find,
  };
}
