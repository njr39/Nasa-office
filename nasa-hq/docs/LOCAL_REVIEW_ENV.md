# Private authenticated review environment (live KAST path)

The Claude Artifact host serves one static page. It cannot run a server, hold an API key, or authenticate against HQ, so it can show the frontend but can never connect KAST. Live voice needs a server that holds the ElevenLabs key. This environment runs on **your** machine, binds to loopback, and serves the app only to a signed-in browser. Nothing private is published.

Run each step on its own. Wait for it to finish before the next. Use a shell on a machine you control with Node 22.18 or later.

1. Get the branch:
```bash
git fetch origin claude/nasa-hq-frontend
```
```bash
git checkout claude/nasa-hq-frontend
```
2. Install and build:
```bash
cd nasa-hq
```
```bash
npm ci
```
```bash
npm run build
```
3. Set the secrets in this shell only (replace the placeholders; never paste them into chat or a file in the repo):
```bash
export REVIEW_PASSCODE='choose-12-or-more-characters'
```
```bash
export ELEVENLABS_API_KEY='your-elevenlabs-key'
```
```bash
export NASA_HQ_KAST_ENABLED=true
```
4. Start it:
```bash
npm run review
```
The startup line must read `gate ON` and `ELEVENLABS_API_KEY present`. If either is wrong, stop and fix that first.

The startup line states whether the gate is ON and whether the key is present (never its value). The commit is shown in the banner and in Settings.

What the sign-in is: a review passcode, an HttpOnly SameSite=Strict cookie, a per-session CSRF token injected into the page, a single-user allow-list, and a lockout after 5 wrong attempts. **It is not HQ identity.** There are no Supabase Auth users and no per-project permissions in it, so tests 5-8 (backend retrieval, persistence, access boundaries) cannot pass on this environment.

The token route still applies: gate, key, exact Origin, CSRF, permission, rate limit, concurrency cap, bounded upstream. The key never reaches the browser (asserted in `tests/review.test.mjs`).

Other devices (phone): use an authenticated tunnel you control that terminates TLS and keeps the Origin the server was started with (`NASA_HQ_ALLOWED_ORIGINS`, `NASA_HQ_ALLOW_NON_LOOPBACK=true` only behind that proxy). Microphone access needs HTTPS or localhost.

What this does **not** change: the shared KAST agent, its tools, branches, language or auth. The original agent has no `nasa_*` tools attached, so a spoken "open Young & Human" will be understood but cannot act until the tools are attached on a reviewed test branch (`docs/KAST_TEST_BRANCH_SPEC.md`), which needs your approval.

## What each failure means (they are separate checks)
| What you see | What it points at | How to confirm |
|---|---|---|
| Startup says gate OFF or key MISSING | Your shell variables | Re-export in the same shell, restart |
| Sign-in page rejects the passcode | Passcode typed differently, or 5-attempt lockout (wait a minute) | Restart the server to clear it |
| After Enter: "Voice is switched off" (404) | Gate off | STATUS dialog, Live connections |
| After Enter: 403 | Origin or CSRF: you opened a different host or port than the server printed | Use exactly the printed address |
| After Enter: 503 or "unavailable" | The provider did not answer the token request (key rejected, network, agent unavailable) | Server log line `kast_token` shows the upstream status |
| Connects, then greeting is in Arabic | Per-session language override ignored by the agent. Not a tool problem, not a connection problem | Compare with the agent's language setting (read-only) |
| Connects and greets, spoken "open a project" does nothing | Tool attachment: the `nasa_*` tools are not on the agent | Read the agent's tool list (read-only); at last inspection they were absent |
| Microphone prompt denied or no prompt | Browser permission or non-secure origin | Use the printed localhost address, check the site permission |
