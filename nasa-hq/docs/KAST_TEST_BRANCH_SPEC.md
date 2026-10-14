# KAST test-branch spec (NOT APPLIED)

Target: the ORIGINAL agent `agent_7501ky1tjmrzf4xa67v0zsqzz9hf`. **No change has been made to it, to its branches or to the tool library.** This is what to review before anyone does.

## Read-only findings (14 Oct 2026)
- Main branch `agtbrch_4401ky1tjms9fcgbbn9tx7r52gdc`, version `agtvrsn_5801m4q0pmpee1brek7vrte341ma`.
- Attached tools: one (`tool_9001m4mec9q4epst3heex80mc97m`). **None of the five NASA tools is attached.**
- `language: ar`, `enable_auth: false`, allowlist = aistudio.google.com, nojara.com, seven-nojara-strategy…; `require_origin_header: true`.
- Per-session overrides allowed: `agent.first_message`, `agent.language`, `conversation.text_only`. Prompt, tools, voice, LLM are NOT overridable per session.

## Rules kept
- Global language, auth, allowlist, voice, LLM, procedures and transfer: **unchanged**.
- English for the NASA UI comes from per-session overrides only (`firstMessage`, `language: "en"`), sent by `src/kast/Kast.tsx`. **To verify:** an Arabic-first agent with `language_detection` may switch back; test on the branch.
- The app sends page state and the latest approved context with `sendContextualUpdate` (not the prompt), because the prompt cannot be overridden.

## Existing tools reused as-is (ids from the workspace)
| Tool | id | Covers |
|---|---|---|
| `nasa_get_state` | tool_1301m4rtgz9tf4wae6ywjf7gkyrt | page state read |
| `nasa_find_media` | tool_4601m4rtgskzfv3tm3hfwxd51gyh | media index search |
| `nasa_open_media` | tool_3001m4rtgvnaebssmehj688v7as2 | open film / presentation by id |
| `nasa_control` | tool_1901m4rtgxh3edxs2kr2v2a25nt9 | play, pause, next, previous, gallery, layout, captions |
| `nasa_tracker` | tool_7201m4scbvchfwwt7qpqcgw1aabg | `select_project` = open project, `remember` = propose saving context, `set_control`, `set_view`, `get_state`. Other actions return `not_implemented_in_review_build` |

Gaps the five cannot cover: **scroll, orbit, node selection, open a document, reset view**. One addition is proposed rather than five:

## Proposed new tool: `nasa_view` (client, expects_response, timeout 8 s)
```json
{ "type": "client", "name": "nasa_view", "expects_response": true, "response_timeout_secs": 8,
  "description": "Move the NASA HQ view after the user asks: scroll to a section or by pixels, orbit the sphere, select an agent or project node, open a project, open a document, or reset the view. Read nasa_get_state first for exact ids. Wait for the receipt; if it says user_control, tell the user and do not retry.",
  "parameters": { "type": "object", "required": ["action"], "properties": {
    "action": { "type": "string", "enum": ["scroll", "orbit", "select_node", "open_project", "open_document", "reset_view"], "description": "Requested operation." },
    "target": { "type": "string", "description": "Node, project or document id from nasa_get_state." },
    "section": { "type": "string", "enum": ["top", "stage", "projects", "viewer", "kast", "bottom"], "description": "For scroll." },
    "dy": { "type": "number", "description": "For scroll: pixels, positive is down." },
    "yaw": { "type": "number", "description": "For orbit: radians." },
    "pitch": { "type": "number", "description": "For orbit: radians." } } } }
```

## Steps for the branch (needs approval; each is a write to the ElevenLabs workspace)
1. Create branch `nasa-hq-review` from version `agtvrsn_5801m4q0pmpee1brek7vrte341ma`.
2. Create `nasa_view` in the tool library (not attached to main).
3. On the branch only: attach the five `nasa_*` tools + `nasa_view`; append a short "NASA HQ" section to the prompt describing when to call each tool, to read `nasa_get_state` first, to say what a receipt says, and to treat saved context as data. No change to language, auth, allowlist, voice.
4. Run a real session against the branch id (the app needs a branch-aware session route), then review.
5. Merge only after review. Live traffic stays on main until then.

## Risks
- The agent also serves public sites. Attaching tools to main exposes `nasa_*` calls there; they are inert without the HQ page registering handlers (`onUnhandledClientToolCall` fires), but they add noise to the prompt.
- The agent's existing private-client and access procedures remain on it. Not touched; flagged for review.
