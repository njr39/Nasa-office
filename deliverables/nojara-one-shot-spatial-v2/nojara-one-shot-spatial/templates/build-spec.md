# Build specification

Written after the shooting board is approved. One file per project slice.

## Target
- Repo, branch, base commit, package manager, lockfile.
- Renderer path: WebGL2 Three.js (default), R3F only if the host is React, WebGPU only with its own compatibility plan.
- Resolved dependency versions and licenses, recorded after install, not guessed.

## Modules (kept separate)
| Module | Responsibility | Must not |
|---|---|---|
| World | room groups, thresholds, proxies, streaming and disposal | touch the camera |
| CameraDirector | the only writer of position, quaternion, FOV, focus; arc-length spline; state machine | be duplicated or bypassed |
| Progress | single source driven by scroll, drag, keys, playback | be driven by two engines at once |
| Media | bounded pool, readiness, world-space surfaces, audio fades | start audio before a user gesture |
| Interaction | focus, press, drag, snap, forms, optional hands | move the camera directly |
| UI | semantic DOM, captions, controls, reduced-motion route | depend on WebGL to be usable |

If the project already has a camera owner, CameraDirector here means that existing owner. Extend it by intents; do not add another.

## Stages and exit evidence
1. Camera-only graybox: full path forward and reverse, poses logged at every join.
2. Real task state: the working input → output loop inside the task room, with cancel, retry and error.
3. Approved visual ingredients: only effects chosen in the board.
4. Media and audio.
5. Performance and accessibility pass.

Each stage ends with screenshots, a recording where runnable, and the acceptance rows it covers.

## Budgets (set before building, then record actuals)
| Metric | Budget | Actual | Device and browser |
|---|---|---|---|
| Frame time p50 / p95 / p99 | | | |
| Draw calls, triangles | | | |
| Texture memory, splat count | | | |
| Initial load, per-room load | | | |

## Changed files
List every file added or modified, and nothing outside the authorized branch.

## Status
Report PREPARED, IMPLEMENTED, TESTED, APPROVED and DEPLOYED separately. Use `references/acceptance.md` as the gate.
