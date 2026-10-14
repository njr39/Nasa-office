# Review walkthrough, status and acceptance

Build commit: shown in the banner of every screen and in Settings. This document describes the commit that contains it. Screenshots in `docs/screens/` (`desktop-*` 1440x900, `mobile-*` 390x844 @2x) were taken from that build by `node scripts/screens.mjs`.

## 0. Connections: live vs simulated (read before testing)

| Connection | State |
|---|---|
| Frontend, sphere, panels, viewers, Settings | **Live** in the browser; real code |
| Film 01 video | **Real `<video>`** playing a generated 8 s test clip (not NOJARA work, silent, no audio track). Your own approved file can be opened with "Open a local video…" (plays in your browser only) |
| Film 02 | **Simulated**: canvas slate, control-path test only |
| Original KAST `agent_7501ky1tjmrzf4xa67v0zsqzz9hf` | **Not connected** in the hosted preview and in every test run so far. Connects only through the local review environment (`docs/LOCAL_REVIEW_ENV.md`) with your key |
| KAST page actions by voice | **Blocked**: the five `nasa_*` tools are not attached to the original agent |
| Supabase `uczhbodqmsxcxymybonn` | **Not connected.** No credential or tool in this session. Never queried |
| NOJARA HQ Drive | **Not connected** to the app. No ingestion. No file retrieval |
| Saved notes | **Simulated**: browser localStorage, synthetic only, never sent to KAST. This is not Supabase persistence |
| Sign-in | Review passcode only (local environment). No HQ identity |

## 1. Walkthrough (Enter → sphere → project → document → media → KAST → background)

| Step | Where | Status |
|---|---|---|
| Enter: choose an agent, then Enter workspace | `desktop-1-gate` | Implemented. Tested (e2e, unit). English only. No agent preselected |
| Sphere orbit: drag, arrow keys, node click, LIST fallback | `desktop-2-sphere` | Implemented. Tested in headless Chromium with software GL. Not tested on real GPUs or touch hardware |
| Open project (Open button, tool, voice) | `desktop-3-project-open` | Implemented via the shared action layer. Voice path **blocked** (tools not attached) |
| Open document / slides | `desktop-4-document` | Implemented. Slide text is illustrative |
| Media player | `desktop-5-real-video-playing` | **Real video element.** Play, pause, seek (keyboard), ended, mute, fullscreen, local file. Tested: element `currentTime`/`paused`/`ended` asserted. Audio: the test clip is silent, so audible output is **untested** |
| KAST widget | `desktop-6-kast-widget-not-connected` | Implemented. Shows real states. In these shots it reads "not connected" because no session exists. Live states **untested** |
| Background settings | `desktop-7-settings-background` | Implemented. Tested: change preserves navigation, project, film, selection, layout and the session binding |

Mobile equivalents: `mobile-1…7`. The mobile dock previously rendered off-screen (a transform overridden by the entry animation); fixed in this build.

## 2. Feature status

| Feature | Implemented | Tested (author-run) | Simulated | Blocked / needs |
|---|---|---|---|---|
| English-only UI, team tiles kept | yes | yes | | |
| Sphere + LIST fallback | yes | yes | | real-GPU, touch |
| Project / document / viewer | yes | yes | data is synthetic | real HQ records |
| Real video playback | yes | yes (generated clip) | | approved NOJARA film; audio check |
| Background selector | yes | yes | | approved background assets |
| Reduced motion (OS or Settings) | yes | yes | | |
| One-attempt voice controller | yes | yes (fake provider) | provider | live SDK run |
| Token route + review sign-in | yes | yes (fake upstream) | upstream | real key run |
| Live KAST greeting / transcript / speaking states | yes | **no** | | key + local run |
| Spoken page actions | handlers yes | handler calls yes | caller | tools on agent |
| Supabase persistence / recall | contract + candidate SQL | PG 17 local only | | Karsa's single backend |
| Drive retrieval | no | no | | Drive ingestion approval |

## 3. Manual test checklist

Desktop, then phone. Start at the gate each time.
1. Gate: nothing preselected; Enter disabled; choose an agent; Enter. Banner shows the build commit.
2. Sphere: drag it (selection must not change); arrow keys orbit; Tab to a node and press Enter; switch LIST and select the same project.
3. Open "Young & Human" (Open). Project tabs switch with the keyboard (Tab, Enter).
4. Working brief opens slides; Previous/Next work.
5. Film 01: press Play. The counter and the picture must advance; press Pause, the picture and the counter must freeze. Drag or arrow the seek bar. Let it reach 00:08, it must stop. Browsers may refuse autoplay without a click: expect an explicit "Could not play" message, never silent failure.
6. "Open a local video…": choose your own approved MP4/WebM. Check picture **and sound**, mute, fullscreen. The filename must never appear in KAST context.
7. Film 02 is labelled SYNTHETIC SLATE. Do not count it as video.
8. Settings (dock): choose Dusk, Solid, then your own image and video. Open project, film position and selection must be unchanged. Escape closes and returns focus to Settings. Open "Background formats".
9. Reduced motion: Settings → Always reduce motion (or set your OS option). Background video pauses, orbit snaps, no scroll animation.
10. Phone width 390: no horizontal scroll; dock reachable; all of 1-9 work by touch.
11. Keyboard only: every step above without a mouse.
12. KAST panel: Start conversation. In the hosted preview and without the local environment it must say not connected and request no microphone.

## 4. Your acceptance checklist: result per test

Evidence classes: **P** provider test (fake SDK/upstream), **F** fake-tool/handler test, **L** live end to end. Nothing has a live (L) result.

| # | Test | Result | P | F | L | Evidence / reason |
|---|---|---|---|---|---|---|
| 1 | Sign in → Enter → mic → KAST greets; live states and transcript | **BLOCKED** | pass (hook tests) | n/a | not run | needs your `ELEVENLABS_API_KEY` on a machine you control (`LOCAL_REVIEW_ENV.md`) |
| 2 | Voice "Open [project]" selects and opens | **BLOCKED** | | pass (tool handler → same `act()`) | not run | tools not on original agent; no authorized real project list |
| 3 | Voice scroll / orbit / open document; manual interrupts | **BLOCKED** (voice) | | pass (revocation, stale, lease tests; e2e scroll receipt) | not run | same as 2 |
| 4 | Real approved video, play/pause by voice, audio | **PARTIAL**: real video element play/pause PASS with generated clip; approved film, audio, voice **BLOCKED** | | pass (tool pause/play on real element) | not run | no approved film supplied; test clip is silent |
| 5 | Retrieve a known HQ file via authenticated backend | **BLOCKED** | | | not run | Drive not connected; no ingestion; no backend |
| 6 | Dictated note → proposal → approval → Supabase receipt | **BLOCKED** | | pass (approval gate, local synthetic store) | not run | Supabase not connected; localStorage is not a receipt |
| 7 | Fresh session recall from Supabase; delete test note | **BLOCKED** | | | not run | as 6 |
| 8 | Access boundaries enforced by backend | **BLOCKED** | | pass for candidate SQL on local PG 17 (26 tests; deny-default, FORCE RLS) | not run | not applied to the real project; no real identities |
| 9 | Disconnect, failed start, reconnect, stop-during-start: no leak, duplicates, stale callbacks | **PASS (fake provider only)** | pass: controller unit tests + 10 browser hook tests | | not run | real microphone release is unverifiable without a live session |
| 10 | Mobile, keyboard, reduced motion, list fallback; background preserves state and session | **PASS (frontend)** | | | n/a | e2e + screenshots; KAST-session preservation proven for the session binding, not for a live SDK session |

Not complete: the live voice → page action → authorized backend → fresh-session recall path has not run.

## 5. Reconciliation with PRD v1.2 and backend v02

* `docs/PRD_STATE_MATRIX.md` maps S01-S15 to this build (updated for Film 01 real video and Settings).
* The prepared backend package is not on this machine. Files I could not find, by exact name: `NASA_HQ_PREPARED_BACKEND_v01/reconciled_nasa_hq.sql` (seen only as referenced), and the v02 package folder `NASA_HQ_PREPARED_BACKEND_v02/` with its migration and ingestion files (names unknown to me; please send the folder or its file list).
* No schema was inspected on Supabase, so I propose **no migration**. The candidate SQL in `db/migrations/` stays unapplied and is to be reconciled by Karsa as the single writer. No ingestion job exists in this repo.

## 6. First blocker

Live KAST cannot be tested without a server-held ElevenLabs key. Everything else on the live path (tools on the agent, Supabase, Drive) is gated behind it or behind separate approvals and will be raised one at a time after this one.

## 7. Receipts and honest caveats
Code commit `ff5a3f2587af` (screens taken at this commit; the next commit adds only docs, screenshots and receipts). Author-run, not independently run: 68 node tests, 10 hook tests, 26 PG 17 tests (rerun on this revision), browser e2e passed 5 of 6 runs on this revision; one run failed once with an error I did not capture and could not reproduce in 5 reruns, so treat the e2e as slightly flaky until diagnosed. The mutation script was not rerun on this revision and its earlier 47/50 result does not cover the new media and server code.
