# Spatial shooting board

Deliver this before any build, with `journey.json` and `source-register.json`. Grayscale frames first; styling comes after the journey is approved. Label every frame: GRAYBOX_RENDER, STILL_CONCEPT, or UNTESTED_MOCKUP.

## 1. Overhead plan
One top-down drawing, to scale, in world units. Show rooms, thresholds, doors, the camera spline with direction arrows, numbered shot positions, hold zones, media surfaces and the safe focus zone used when media is missing.

## 2. Shots
One block per shot. A shot is either a HOLD (camera settles) or a TRAVEL (camera moves between holds).

### Shot NN — name
| Field | Value |
|---|---|
| Type | HOLD or TRAVEL |
| Objective | what the viewer understands or does here |
| Location | room or threshold, plan reference |
| Progress range | start–end on the shared 0–1 progress |
| Duration | seconds at authored speed |
| Camera position | x, y, z at start and end |
| Look target | x, y, z, or the named subject |
| FOV | degrees at start and end |
| Movement | dolly, truck, pedestal, push-through, arc; curvature and roll limit |
| Speed and easing | entry speed, exit speed, easing; must match the neighbouring shots at the join |
| Focal subject | what is sharp and front-facing |
| State | LOADING, TRAVEL, FOCUS, INTERACT, RETURN, COMPLETE, ERROR |
| User input | what the user can do here (scroll, drag, keys, tap, form) |
| Output | what changes as a result |
| Media | asset id from source-register, in/out, surface, crop |
| Text | exact copy, language, panel position and facing |
| Light and material | key direction, continuity with previous shot |
| Transition into next | doorway, occlusion, turn; any cut or seam is named as one |
| Audio cue | semantic event, fade, ducking |
| Fallback | reduced-motion equivalent, missing-media behaviour |
| Loading and error | what is on screen while assets arrive or fail |

Frame: (grayscale image or sketch)

## 3. What the viewer sees between rooms
One short paragraph per threshold: what occludes, what is revealed, how light and scale stay continuous.

## 4. Reverse travel
State what happens when the user goes backward from each hold: path, media state, retained answers.

## 5. Honesty notes
List every cut, hidden seam, pre-rendered segment or simulated step. If there are none, write "none".

## 6. Approval
| Item | Version | Approver | Date | Decision |
|---|---|---|---|---|
| Journey | | | | |
| Visual direction | | | | |
| Media selections | | | | |
