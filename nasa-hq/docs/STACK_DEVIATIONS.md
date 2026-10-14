# Stack deviations from PRD v1.2 (for review; none is a rewrite request)

| PRD v1.2 says | This build | Why | Risk and how it is covered |
|---|---|---|---|
| ElevenLabs React SDK (`@elevenlabs/react`), `ConversationProvider`, `useConversation` | `@elevenlabs/client` 1.28.0 directly, wrapped in the `useKast` hook | The single-attempt controller must **await** `startSession` and `endSession`. In the React SDK 1.18.0 type surface `startSession` returns `void`, so a late start rejection or late resolution cannot be sequenced with Stop, unmount or teardown. `@elevenlabs/react` is a wrapper over this same client package. | Same transport (WebRTC, server-issued token) and the same client-tool contract. Not a security change. If the React SDK later exposes awaitable start/end, the hook can move to it; the controller and its tests do not change. |
| R3F / drei | Plain three.js | Smaller bundle (about 377 KB gzip total) and a simpler lifecycle for one scene | Dispose and pause rules are in `src/scene/Sphere.tsx`. |
| Poly Haven `studio_small_08` HDRI | three.js `RoomEnvironment` stand-in | HDRI not vendored | Visual only. |
| Jaapokki Subtract, licensed Arabic font | Fallback fonts | Licences not cleared; English-only UI removes the Arabic font | Visual only. |
| `get_workspace_context`, `navigate_workspace`, … (PRD §6.3 proposed names) | The five existing `nasa_*` tools plus the review-only `nasa_view` | Reuse existing tool definitions where their schemas fit (owner instruction) | Mapping and gaps in `docs/KAST_TEST_BRANCH_SPEC.md`. |
| Token response `{ token, conversationId }` (Appendix D example) | `{ conversationToken }` | The client consumes one field | Align when the identity layer is real. |

Pinned versions: see `package.json` (exact) and `package-lock.json`. Install with `npm ci`.
