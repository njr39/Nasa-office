# Minimal example — four-space vertical slice

Status: PROPOSED. Not built, not tested. Values live in `templates/journey.example.json`. It exists to show the level of detail a shooting board needs, and to prove the spatial grammar before a full story is built.

## Overhead plan (metres, north is -Z)

```
                 z=-19 ┌───────────────┐┌───────────┐
                       │   TASK ROOM   ││  RESULT   │
                       │   bench ▣     ├┤  ▣ plinth │
                       │      S3 ●──S4─▶● S5        │
                 z=-11 └──────┤ ├──────┘└───────────┘
                              │ │▌ media wall (x=+1.2, z=-7)
                              │↑│   S2 travels up this corridor
                  z=-3 ┌──────┤ ├──────┐
                       │  ENTRY ROOM   │
                       │  ▌title  ● S1 │   ● = camera hold, eye height 1.5
                  z=+3 └───────────────┘
```

## Shots
| # | Type | What the viewer sees | Camera | User | Honest label |
|---|---|---|---|---|---|
| S1 | Hold | Title on the wall left of an open door; corridor light already visible through it | Static, FOV 48 | Scroll, drag or keys to begin | none |
| S2 | Travel | Door frame passes; corridor; a video on the right wall that the camera slows beside without stopping | Push-through then dolly, 6 s, FOV 48→54→50, no roll | Can stop, reverse or scrub at any point | none |
| S3 | Hold | A workbench with the real task | Settles, FOV 44, frozen while typing | Completes the task; Escape returns control | none |
| S4 | Travel | A 90° turn right through a side door; the plinth appears past the jamb | Arc, 4.5 s, roll ≤ 1.5° | Same as S2 | none |
| S5 | Hold | The result of S3 on a plinth, with the CTA | Static, FOV 42 | CTA, or travel back | none |

## Why this slice
- Two doorways and one turn exercise every join type: straight push-through, speed change beside media, and a curved exit.
- S3 forces the pause → interact → restore → resume path, where most "one-shot" builds break.
- Reverse from S5 to S1 retraces one spline, so drift and state loss show up immediately.

## Test first
Camera-only graybox: log position, tangent and FOV at progress 0.08, 0.42, 0.62 and 0.88, forward and reverse, and compare against tolerance (acceptance 1). Then keyboard-only and reduced-motion completion of the same task (acceptance 7).
