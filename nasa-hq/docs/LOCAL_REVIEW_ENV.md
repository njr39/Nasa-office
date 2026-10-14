# Private authenticated review environment (live KAST path)

The Claude Artifact host serves one static page. It cannot run a server, hold an API key, or authenticate against HQ, so it can show the frontend but can never connect KAST. Live voice needs a server that holds the ElevenLabs key. This environment runs on **your** machine, binds to loopback, and serves the app only to a signed-in browser. Nothing private is published.

```bash
git fetch origin claude/nasa-hq-frontend && git checkout claude/nasa-hq-frontend
cd nasa-hq && npm ci && npm run build            # Node >= 22.18
export REVIEW_PASSCODE='<12+ characters you choose>'
export ELEVENLABS_API_KEY='<your key, server side only>'
export NASA_HQ_KAST_ENABLED=true                  # default OFF
npm run review                                    # http://127.0.0.1:4530, sign-in required
```

The startup line states whether the gate is ON and whether the key is present (never its value). The commit is shown in the banner and in Settings.

What the sign-in is: a review passcode, an HttpOnly SameSite=Strict cookie, a per-session CSRF token injected into the page, a single-user allow-list, and a lockout after 5 wrong attempts. **It is not HQ identity.** There are no Supabase Auth users and no per-project permissions in it, so tests 5-8 (backend retrieval, persistence, access boundaries) cannot pass on this environment.

The token route still applies: gate, key, exact Origin, CSRF, permission, rate limit, concurrency cap, bounded upstream. The key never reaches the browser (asserted in `tests/review.test.mjs`).

Other devices (phone): use an authenticated tunnel you control that terminates TLS and keeps the Origin the server was started with (`NASA_HQ_ALLOWED_ORIGINS`, `NASA_HQ_ALLOW_NON_LOOPBACK=true` only behind that proxy). Microphone access needs HTTPS or localhost.

What this does **not** change: the shared KAST agent, its tools, branches, language or auth. The original agent has no `nasa_*` tools attached, so a spoken "open Young & Human" will be understood but cannot act until the tools are attached on a reviewed test branch (`docs/KAST_TEST_BRANCH_SPEC.md`), which needs your approval.
