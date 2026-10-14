# Appendix D §5 single-attempt contract: where each requirement lives and what tests it

Reported by the author. Real SDK 1.28.0, WebRTC and microphone behaviour is **not** tested; the harness uses a fake SDK and a fake microphone.

| # | PRD v1.2 requirement | Code | Test |
|---|---|---|---|
| 1 | One-shot state machine ready → starting → active → stopping → closed; no return to ready in the same instance | `VoiceController.phase`, `latched` | `controller.test.ts` "repeated clicks…", hook "STRICT MODE…" |
| 2 | Synchronous latch consumed before any fetch or SDK call; repeated clicks do nothing | `start()` | same |
| 3 | Token held in memory only; generation checked before `startSession`; no microphone preflight | `run()`; no `getUserMedia` anywhere in `src` | unit scan + browser run asserts `getUserMedia` count 0 |
| 4 | Cancellation synchronously invalidates generation and lease, aborts the token fetch, enters stopping; a disconnected callback is not completion | `stop()`, `ws.closeSession()` in `useKast.stop` | "cancel while the token request is pending", hook "DELAYED cleanup…" |
| 5 | Serialized cleanup; a late-resolving start is rejected and its session ended before cleanup completes | `run()` late-result branch, `endSession()`, the `pending.then(end)` guard | "cancel while start is pending, then start resolves late", hook "UNMOUNT while the start is pending" |
| 6 | Callbacks bound to the single attempt's controller; `onConnect` after cancel triggers only that instance's cleanup; stale callbacks cannot reach a replacement | `Attempt` record, `isCurrent()` identity check in `useKast` | hook "LATE CALLBACKS…", mutants `late_message…`, `late_mode…` |
| 7 | Instance-local session/controller references; unmount invalidates and begins the same cleanup; replacement blocked until closed | `att.conv`, effect cleanup | hook "UNMOUNT…" |
| 8 | Permission denial: English explanation, retry only after closure; if cleanup cannot be proven, stay blocked and explain reload | `teardown` = `verified` only after `end()` resolves or the SDK was never reached; otherwise `unverified` → `canStartNew=false` → "Reload to try again" | "microphone denied…", "PARTIAL ACQUISITION…", hook "START REJECTED…" |
| 9 | Never log or persist tokens, transcripts, audio or raw provider errors | no `console` use; token stays in the closure | hook runs assert no console output |

Additions beyond the contract: a provider `error` invalidates the tools at once and begins cleanup; a disconnect before the start resolves can never be followed by "connected"; a start that never settles times out as unverified.

Tool contract: every handler is bound to the attempt's session, rechecks session, control lease and mode after any await and before returning a result, validates arguments at runtime, and rejects unsupported options. See `tests/core.test.ts`.

**Honest limit.** "Contained" means: tools are dead, the UI is idle, nothing reconnects, and a new attempt is blocked. It does not mean the microphone was released. Whether the pinned SDK releases a stream when its own start fails is code inside the SDK's platform setup strategy; reading `VoiceConversation.startSession` shows a try/catch that ends the conversation or detaches the setup, but the strategy internals were not audited and no real session was run.
