# PRD v1.2 state and module matrix

Mapped against **NASA HQ PRD v1.2 (14 October 2026, 03:23 UTC)** as supplied in the conversation: §3 (S01–S15), §3.1, §4, §6, §7.5, Appendix D. Statuses are the author's reading of the source; nothing is live-verified.

Legend: **built** = in the build and covered by a reported test. **partial** = part of the state. **not built** = absent.

## §3 The 15 mandatory states
| State | v1.2 requirement (summary) | Status | Notes |
|---|---|---|---|
| S01 Entry | Eight tiles in source order; selection highlight; Enter; unbound entries visibly unavailable; selecting grants no rights; keyboard select and enter; English heading | **partial** | Selection gates Enter (radio group, nothing preselected, tested). **Not built:** unavailable/unbound state for agents with no provider binding. Choosing KAST then Enter starts one voice attempt (server gate off by default). |
| S02 Desk | KAST hub + seven nodes; project chips; character slot; inspector (starts "No selection"); conversation panel; dock | **partial** | Real Three.js sphere, DOM labels, list fallback (shared state). Character slot is a labelled placeholder. Dock items scroll to sections. |
| S03 Viewer Media | Player, Film 01/02 selectors, thumbnail rail, timeline, volume, fullscreen, source inspector | **partial** | A synthetic canvas slate with play/pause, clock and film tabs only. No thumbnail rail, volume, fullscreen. Labelled "slate-control test". |
| S04 Viewer Web | Framed website viewer, exact URL, history, Open in browser | **not built** | Embedding deliberately absent. |
| S05 Viewer Blocked | Same frame, "Preview unavailable", Open in browser | **built** | Static allowlisted source, no iframe, `rel="noopener noreferrer"`. v1.2: do not bypass CSP/X-Frame-Options (not attempted). |
| S06 Viewer HTML | Brief or slides, fit/fullscreen, previous/next, rail, index, sandboxed HTML | **partial** | Previous/next and counter on synthetic slides. No fit, fullscreen, rail, HTML sandbox. |
| S07 Read Only | Read-only pill, contextual answer, "No changes made"; no mutation dispatched; server-side effective | **partial** | Mode is user-only; every agent mutation refused; receipt line; typed questions stay available. Enforcement is in the client action layer; **no server exists** to enforce it. |
| S08 Command | Proposal card with exact target, Ready, Run/Cancel; proposed ≠ completed | **built** | Two allowlisted commands. The card names the exact target it displays, becomes stale when the project changes, and only the user can Run. |
| S09 Confirm | Compact sheet, target/source, no auto-confirm, focus trap and restoration, changed-target invalidation | **built** | Save-this-view and take-control. Focus moves in, is trapped, restored on close. While it is open nothing else can change. |
| S10 Pacing | Thread, waiting state, one active line, Switch line / New conversation | **not built** | |
| S11 Speaking | Provider-driven speaking indicator, real transcript, visible Stop, control toggle | **partial** | Indicator and bars read SDK mode/volume only (fake-SDK tested). Final messages only; no interim transcript. |
| S12 Stopped | Quiet ended state, selection retained, Start conversation | **partial** | Stop works through the controller; selection retained. No map panel. |
| S13 User Control | Selected agent, rotate/zoom/reset, explicit control state; KAST stays connected | **built** | Control lease; direct input (including media) takes control synchronously; KAST must ask. |
| S14 Default | Entry grid with no selection; Enter disabled until a valid selection; no silent mic resume; restored context only for an authorized session | **built** | No automatic microphone start; saved context is local synthetic only. |
| S15 Horizontal HQ | Four zones; no duplicated voice panel; usable at 1280×800 and 200% zoom | **partial** | Layout switching works; 1280×800 and 200% zoom **not run**. No project tracker cards, media strip or inspector tabs. |

## §3.1 Additional states
| State | Status |
|---|---|
| Login / session expiry, sign-out | **not built** (token route has an identity-adapter interface; the default denies everyone) |
| Permission denied | **partial**: tool refusals and "not permitted" voice message |
| Empty project / no results | **partial** ("Nothing here yet" copy) |
| Stale data, offline/retry, conflicting edits, missing asset, source deleted/moved, ingest progress, failed handoff, awaiting review | **not built** |
| Provider outage | **partial**: honest "not connected" with reason, contained failure, reload path |
| Rate limiting | **partial**: server returns 429; client shows a message |

## §4 Modules and routes
Single-page build; none of `/projects`, `/agents`, `/media`, `/documents`, `/handoffs`, `/updates`, `/memory`, `/sessions`, `/settings` exists as a route. Handoffs: a read-only synthetic list. Project views (board, list, timeline, memory, media): render from synthetic data. Canonical project IDs (SEVEN, MHE, YAH, BSOCIAL): **not mapped**; `yah`, `seven`, `alahram` are demo ids taken from reference art.

## §6 KAST
| Requirement | Status |
|---|---|
| HQ-KAST-01 original KAST, React/WebRTC, server-issued token | **partial**: token route and `@elevenlabs/client` adapter built and tested with fakes; no live session. SDK choice documented in `STACK_DEVIATIONS.md`. |
| HQ-KAST-02 immediate accessible text greeting; audio only with consent | **not built**: no local text greeting; the provider first message is a per-session override. No silent microphone request: voice starts only from an explicit click. |
| HQ-KAST-03 transcript from provider events | **partial**: final messages only |
| HQ-KAST-04 sanitized snapshot only | **built**: ids and view state; saved context never included (tested) |
| HQ-KAST-05 read-only answers cannot mutate; receipts from real handlers | **built** |
| HQ-KAST-06 one connection, bounded backoff, generation-bound events | **built** with no automatic reconnect at all; old callbacks cannot update a new attempt (hook-tested) |
| HQ-KAST-07 distinct Stop and interrupt | **partial**: Stop only |
| HQ-KAST-08/09 one store; revoke control without ending the call | **built** |
| HQ-KAST-10 external-agent chat | **not built** (unconnected adapters would show "Not connected") |
| §6.5 private-launch gate | **honoured**: synthetic only, token route off by default, no private context to a provider |
| §6.6 shared production agent | **no live change made**; `docs/KAST_TEST_BRANCH_SPEC.md` is review-only and on hold |

## Tool contracts (§6.3)
Existing `nasa_get_state`, `nasa_find_media`, `nasa_open_media`, `nasa_control`, `nasa_tracker` are reused; `nasa_view` is a review-only proposal. The names in the PRD's proposed table are not used. Every handler validates arguments at runtime, binds to its session and rechecks control after any await.

## Acceptance matrix gaps
Not run: 15-state visual comparison, tablet, 360 px, 430 px, 1280 px, 200% zoom, screen reader, real media, real microphone, physical devices. Run: 390×844 overflow, two desktop screenshots, keyboard checks listed in `docs/e2e-receipts.json`.

## Update for the real-video / Settings revision
S06 media: Film 01 is now a real `<video>` element playing a generated test clip (reported, headless Chromium); Film 02 stays a labelled synthetic slate; no approved NOJARA film is wired. Settings (background selector, motion preference, background formats, build commit) is implemented and e2e-tested. Voice, Supabase and Drive rows are unchanged: not live-verified. See `REVIEW_WALKTHROUGH.md` section 4.
