# PRD state and module matrix (S01–S15)

**Source caveat.** The English-only PRD v1.2 was not available to this author. This maps the build against the v1.0 draft's screen inventory plus the requirements restated in the review (English-only header, agent selection, single-attempt voice, authenticated token route, synthetic-only context). Where v1.2 says something different, v1.2 wins and this table needs a pass.

Legend: **built** = in the build and covered by a reported test. **partial** = some of the state. **not built** = absent. Nothing is live-verified.

| Screen | State | Status | Notes |
|---|---|---|---|
| S01 Entry / S14 Default | Select an agent, then Enter | **built** | Radio group, nothing preselected, Enter disabled until a choice. Choosing KAST and pressing Enter starts one voice attempt (server gate is off by default). Copy conflict open: "Enter workspace" (screens) vs "Enter HQ" (deck). |
| S02 Desk | Network, key projects, character slot, inspector, KAST bar, dock | **partial** | Real Three.js sphere. Character slot is an empty placeholder. Dock destinations are scroll targets, not separate modules. |
| S03 Viewer media | Film player | **partial** | A synthetic canvas slate only: no film, no `<video>`/`<audio>`, no thumbnails strip, volume, fullscreen or overflow menu. Named "slate-control test" everywhere. |
| S04 Viewer web (embeddable) | In-panel browser | **not built** | Embedding is deliberately absent. |
| S05 Viewer blocked | Preview unavailable + Open in browser | **built** | Static: allowlisted source, no iframe, `rel="noopener noreferrer"`. |
| S06 Viewer slides | Presentation | **partial** | Prev/next and counter. No fit dropdown, fullscreen, thumbnail rail. |
| S07 Read only | Lock badge, "No changes made" | **built** | Mode is user-only. KAST mutations are refused; the receipt line shows. Conversation log is partial. |
| S08 Command | Proposed action, Run / Cancel | **built** | Two allowlisted commands (`open_viewer`, `reset_view`). Only the user can Run. Blocked state is real (no project open). |
| S09 Confirm | Sheet waits for the user | **built** | Save-this-view and take-control. Focus moves in, is trapped, restored on close. "Open project note" and the Now Playing audio card are **not built**. |
| S10 Pacing | Selected agent + conversation lines, Switch line / New conversation | **not built** | Lines list exists; line switching and independent conversations do not. |
| S11 Speaking | Speaking, caption, Stop, Project Overview card | **partial** | Speaking chip and level bars read only SDK signals (not exercised live). Project Overview with progress is not built. |
| S12 Stopped / map | Conversation ended, satellite map 2D/3D/Satellite | **partial** | Stop works through the controller (unit-tested). No map. |
| S13 User control | Give me control / Take control | **built** | Control lease; any direct input takes control; KAST must ask. |
| S15 Horizontal HQ | Rails, project tracker, media strip, inspector tabs | **partial** | Layout switching (auto/portrait/horizontal) works. Tracker cards, media strip, inspector tabs not built. |

## Workspace modules
| Module | Status |
|---|---|
| Sign-in, sign-out, session expiry | **not built.** The token route has an identity adapter interface and a deny-all default. No identity provider is connected. |
| Backend-authorized projects, source and document navigation | **not built.** Catalogue is synthetic and hard-coded. |
| Canonical project mapping (SEVEN / MHE / YAH / BSOCIAL) | **not done.** `yah`, `seven`, `alahram` are demo ids taken from reference art. |
| Handoff registry | **partial**: read-only synthetic rows. |
| Project views (board, list, timeline, memory, media) | **partial**: render from synthetic data; timeline has no dates. |
| Updates feed, conversation history, external-agent adapters | **not built** |
| Agent availability / provider binding | **not shown.** Agents are routing labels. |

## Acceptance matrix gaps (from the review)
Not run: the 15-screen visual comparison, tablet, 360 px, 430 px, 1280 px desktop, 200% zoom, screen reader. Run: 390×844 overflow check and two desktop screenshots only.
