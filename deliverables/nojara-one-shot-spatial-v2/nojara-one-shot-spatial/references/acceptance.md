# Acceptance and evidence

Each check: PASS / FAIL / NOT_TESTED / NOT_APPLICABLE, with evidence. Do not claim 60 FPS from a single screenshot or from an unrun test template.

1. Camera: one writer, no remounts/teleports; record poses at all boundaries; positional/tangent continuity checked against declared world-scale tolerances. Forward/reverse/seek/repeated input do not drift. Pause/inspect/resume retains progress. Doorways have consistent scale and no geometry intersection.
2. Workflow: genuine input → validation → processing → review → output, plus cancel, retry, missing source, empty state, offline/error and duplicate-submit behavior. No fabricated completion.
3. Media: correct asset, crop, ratio, captions and rights; image/video dimensions verified; no visible unloaded texture; no unwanted sound. Audio fades and pause/cancel tested.
4. Viewports: desktop 1440×900 and mobile 390×844 at minimum; browser/device/GPU/DPR recorded. Text legible in motion and focus; no back-face text, clipping or HUD overlap; real touch and keyboard tested.
5. Performance: target 60 FPS desktop, stable adaptive mobile quality. Measure p50/p95/p99 frame time, slow frames, shader-compilation stalls, load time, draw calls, texture/splat counts and observable memory. Start with a budget, record actuals, then adjust. No universal device promise. Repeat journey five times and check memory trend, event/texture disposal and video pool bounds.
6. Loading: adjacent-zone prefetch, explicit missing-assets fallback, bounded retries. Test slow network, browser background/resume, resize, WebGL context loss if testable, rejected autoplay and permissions denied.
7. Accessibility: reduced-motion journey, semantic reading order, keyboard focus/escape, labels, captions, contrast and non-hand/non-haptic equivalents. Stable content during input.
8. Splat-specific: sorting, transparency, camera near plane, mesh occlusion, holes, viewpoint limits, format compatibility and fallback tested. Dataset license and exact scene rights documented.
9. Reproducibility: commit, package versions, lockfile, commands, artifacts, screenshots/recording and test logs included. Source availability != integration. Local success != deployed success.
