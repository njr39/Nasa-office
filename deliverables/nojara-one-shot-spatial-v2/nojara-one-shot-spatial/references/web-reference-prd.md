# Web Reference Plugin Product Requirements

Version 1.0 | 11 November 2026 | Product owner Tarek Nojara

## 1 Product decision

Build a portable reference-to-implementation tool, first adapted to HAMZA. The tool turns websites, repositories and media into a searchable visual library of individual ingredients: environments, games, layouts, journeys, typography, tokens, shaders, transitions, objects, galleries, scrolling behaviors, sounds and effects. The user chooses ingredients by looking and listening, describes the intended experience, approves an interactive wireframe, then approves a project-specific implementation plan.

This is an executable product specification, not authorization to alter or deploy HAMZA. Existing research is the starting catalog. The searchable plugin, spatial wireframe composer and controlled implementation flow described here are proposed features, not completed software.

**Core loop:** ask → see and hear references → select ingredients → preview the user journey as a wireframe → approve the journey → preview the styled experience → approve a precise implementation plan → implement in an isolated branch → verify → request deployment approval.

The user should be able to say: “Show me environments with a simple assembly effect and quiet mechanical sound. Use this interaction for my onboarding, but keep my own brand.” The tool must show playable or clearly labeled still references, explain compatibility, and prepare the right implementation for the selected project. It must not respond with a link list or blindly paste a whole website into the project.

## 2 Evidence and current state

### Existing research foundation

The intake contains **52 unique reference URLs** after deduplication. Some entries are award pages and collections rather than implementation sources. The first research package covers 14 sites with 52 files and 18 visual files. The expanded set has not all been verified to the same depth. Import every entry with its actual inspection status; a URL in the corpus is not evidence that its features work or that source code is available.

The existing HAMZA Extractions folder contains research, a proposed JSON catalog and an integration plan. It does not yet constitute an installed plugin, live searchable library or reusable production engine.

The existing Elgenerator library supplies the useful interaction model: category browsing, visual selection and assembling a structured output. Its documented workflow combines image references into a Lovart prompt. Its latest source and interface were not fully inspected for this PRD, so neither complete asset counts nor source reusability are established. Reuse the interaction principle; audit the actual source before proposing code reuse. Lovart generation and the separate image-prompt plugin are outside this release.

### Code evidence for the first adapter

The inspected HAMZA GitHub snapshot is `njr39/CRB_NJR_26`, commit `d97b83ea0b4613b9fd745fbea2fe43bcf0fbe58b`.

- `src/media/types.ts` already describes spatial media identity, source/preview/playback URLs, dimensions, duration, access, rights and verification states.
- `src/media/MediaRegistry.ts` already supports project, collection and media-kind filters and pagination. Full-text reference search, persistent selections and implementation recipes require new work.
- `src/media/MediaGrid3D.ts` contains pooled tiles and selection callbacks, but uses a spherical layout; no application instantiation was found. It is not a working reference picker and should not impose spheres on this tool.
- `src/three/camera/CameraDirector.ts` is the camera owner. The plugin must request its existing freeze/travel states, not create a competing controller.
- `src/styles/hamza.tokens.css` and `src/design/fontAssets.ts` are candidate brand authorities for the inspected snapshot.
- `src/environments/EnvironmentWorkspace.tsx` is a candidate workspace extension point, subject to review of the selected target version.

A separate HAMZA Site v11 is reported at commit `f0941a04d535164474240aad2917fd1d57d5b61b`. It is not proven equivalent to the GitHub snapshot. The implementation gate must identify and inspect the exact target. A recommendation against an old commit is marked stale, not presented as a current patch.

### What can be learned from a website

Public browser inspection can establish rendered composition, observable interactions, accessible DOM/CSS, downloaded client assets and evidence of certain libraries. It cannot reliably reconstruct private server code, original editable design files, unpublished source modules, licensed assets, exact shader source or the author's original design-token intent. Measured or inferred tokens must retain that label.

A technique may inspire an original implementation while the original site's assets and code remain unavailable for reuse. Keep those two outcomes separate throughout the product.

## 3 Users and outcomes

**Creative director:** searches visually, auditions sound, selects parts and describes an experience without needing repository names.

**Designer:** translates a brief into an editable journey and spatial wireframe, locks brand choices and validates responsive states.

**Builder or coding agent:** receives versioned recipes, licensed assets, dependency constraints, exact file targets and acceptance tests instead of an ambiguous screenshot.

**Library curator:** verifies evidence, source ownership, licenses, availability and practical reuse status.

Success means a user can select a useful pattern, understand its fit and limitations, preview the complete flow and hand off a reproducible implementation package. Success is not measured by the number of links ingested.

## 4 Scope and release boundaries

### MVP required

1. Import and deduplicate the 52 supplied URLs, retaining provenance and inspection status.
2. Deliver a working searchable visual and audio catalog, ingredient inspector, persistent project selections and export.
3. Support environment, game interaction, layout/journey, media gallery, scrolling, typography/token, shader/material, motion and sound categories.
4. Prepare at least 12 reviewed ingredient records with usable previews across at least six categories, including an environment, a game interaction, a gallery/scroll pattern and sound. Incomplete corpus entries remain visible as incomplete; no fake previews.
5. Provide at least three runnable original or rights-cleared recipes demonstrating the full workflow. Proposed test recipes are an assembly environment, a media gallery and a branched onboarding journey. Each must have an approved source/license review before inclusion.
6. Create editable spatial wireframes using constrained node and transition primitives, not arbitrary new 3D worlds on demand.
7. Support one read-only target-project adapter for HAMZA, plus a generic project manifest so the data model is portable.
8. Export an implementation package and, after separate approval, hand it to a coding agent that works in an isolated branch. No automatic production write or deploy.
9. Include a sound audition panel and a cue timeline linked to interaction events.

### Next releases

Additional framework adapters; richer scene editing; team review and roles; incremental site recapture; broader game recipes; asset conversion workers; advanced spatial timeline editing; authorized pull-request automation; generated original assets with explicit provenance; further audio authoring.

### Explicitly excluded

Cloning arbitrary websites; recovering private source; treating screenshots as production assets; universal one-click integration into any framework; editing production immediately on selection; deployment without approval; manufacturing license grants; automatic sound autoplay; building Lovart or the image-prompt plugin in this release; promising pixel-identical rendering across every device; claiming a 3D simulation is a validated real-world safety system.

## 5 Product architecture

Use a **standalone catalog core with an embeddable panel and project adapters**. “Plugin” here means a host-integrated UI and capability interface, not proof of installation in ChatGPT or an extension marketplace.

The core owns catalog records, evidence, search, selections, wireframes, previews, rights checks and exports. The host adapter supplies project identity, repository revision, design tokens, routing, camera integration, asset conventions and supported capabilities. The implementation adapter receives a validated plan only after approval. Hosting and persistence are implementation decisions to confirm during technical discovery; no production vendor or paid service is assumed.

Proposed services:

- Intake worker: normalize URLs, resolve permitted public pages, track duplicates and capture status.
- Inspection worker: gather evidence and browser previews in an isolated context.
- Asset store: versioned originals and permitted derivatives, checksums, media metadata and access rules.
- Catalog/search service: deterministic filters plus semantic retrieval where useful.
- Recipe registry: versioned original or licensed code packages and their test results.
- Project analyzer: read-only snapshot analysis, compatibility and extension points.
- Wireframe composer: typed journey graph, spatial layout and preview player.
- Approval ledger: immutable decisions tied to exact manifest hashes and revisions.
- Implementation handoff: branch-scoped changes and verification reports, never unrestricted code execution from scraped material.

## 6 Screens and primary journey

### Screen 1 Project and intent

Choose a project or create an unbound exploration session. Show the target revision and whether its source has been inspected. Input accepts plain language such as “an environment,” “a game,” “infinite scrolling,” or a complete user journey. Offer suggestions without forcing a long questionnaire. Unknown preferences receive visible, editable assumptions.

### Screen 2 Visual library

Show visual-first cards, with optional sound audition controls. Categories, search and filters include technique, intent, mobile support, rendering engine, language direction, evidence strength, license status, runnable status, complexity and source date. Every result states why it matches. Keep an ordinary accessible grid/list option even if the host is spatial.

Cards show: preview, ingredient name, parent site, evidence badge, rights badge and compatibility status. A static screenshot must not look like playable video. Do not autoplay audio or load all WebGL demos together.

### Screen 3 Ingredient inspector

Separate tabs or clear sections expose visual/motion preview; interaction breakdown; tokens; assets; code and dependencies; sound; wireframe pattern; evidence; and target-project fit. Each property is labeled observed, code-verified, publisher-described, measured, inferred or proposed. Users select an ingredient, not implicitly the whole site's branding.

A token comparison shows source values, current project values and proposed mappings. Source colors must not silently replace HAMZA colors. Unknown fonts or shaders remain unknown.

### Screen 4 Selection board

Group selected items by role: layout, camera, components, materials, transitions, sound and assets. Show conflicts such as two camera controllers or incompatible renderer versions. Resolve by proposing a compatible alternative or an original recreation of the behavior. Save selection state centrally for the signed-in user; do not rely solely on browser-local storage.

### Screen 5 Journey composer

Convert the brief into a graph of screens/scenes, states, transitions, decisions, input, output and errors. Use editable placeholders before visual styling. A user can reorder nodes, change routes, edit questions and set entry/exit conditions. The system explains how selected reference patterns inform each node.

### Screen 6 Interactive spatial wireframe

Play the complete journey with simple geometry, actual navigation and sample content. Demonstrate camera routes, focus/read states, object selection, touch/keyboard alternatives, branching, loading and final output. Sound cues can be auditioned in sync after a user gesture. Include a 2D route-map view. Spatial means arranged depth and continuous camera logic, not a compulsory spaceship or spherical interior.

Approve or revise the **journey revision**. Approval covers the demonstrated flow, not production deployment or automatic reuse of restricted source assets.

### Screen 7 Styled preview and implementation plan

Apply approved project branding and selected, permitted ingredients to a sandbox preview. Present original reference and proposed adaptation side by side. Show exact component/file changes, dependencies, assets, rights, estimated complexity, fallbacks, tests and remaining gaps. Mark previews that are concepts rather than running code.

Approve the **implementation plan revision** explicitly. If project HEAD, rights, dependency scope or requested behavior changes materially, invalidate the prior implementation approval and present the revised plan.

### Screen 8 Verification and export

Show changed files, test outcomes, viewport captures, unresolved issues and rollback instructions. Export structured JSON, recipe packages, assets, wireframe specification, implementation notes, citations and a verification report. The deploy control is separate and unavailable without explicit deployment authorization.

## 7 Functional requirements

**FR01 Intake and evidence.** Preserve supplied URL, canonical URL, redirects, acquisition time, source date where known, creator and capture context. Normalize fragments/tracking parameters carefully; distinct paths remain distinct sources. Duplicate submissions link to one canonical record without losing history.

**FR02 Ingredient extraction.** A site may produce many independently selectable ingredients. Record interaction trigger, states, visual result, camera behavior, input methods, layout rules, measurable token values, media and evidence anchors. Every extraction failure is visible and retryable without duplicating items.

**FR03 Search.** Support semantic intent and exact filters. “Environments” must return environment previews; “sound for assembly” returns auditionable sound records and cue recipes. Rank compatible and rights-cleared items first while allowing inspiration-only results with warnings. Empty results propose neighboring techniques, never fabricated matches.

**FR04 Asset retrieval.** Store allowed originals and derivatives with checksum, MIME type, dimensions/duration, source, license and retrieval time. Distinguish a viewer URL from a direct media URL. Expiring URLs are not permanent asset identifiers. Download failure leaves an explicit missing state.

**FR05 Code catalog.** Repository packages record owner, repo URL, immutable commit, relevant paths, dependency lockfiles, license files, attribution and security review. Snippets include origin and language and may be exported as text files. Never label minified public bundles as original maintainable source. Import does not execute code.

**FR06 Recipes.** A recipe is a reusable implementation of a defined behavior with parameters, dependency ranges, supported targets, demo, asset requirements, accessible fallback and tests. Recipe source is licensed, user-owned or newly authored. A source website can be linked as inspiration without becoming the code supplier.

**FR07 Target compatibility.** Inspect the approved target snapshot. Detect framework, renderer, versions, routing, tokens, camera owner, media layer, build/test commands and constraints. Return compatible, adaptation required, incompatible or unknown, with evidence. Unknown must not be treated as compatible.

**FR08 Wireframes.** Generate a typed, editable journey graph and playable spatial preview. Validate reachable nodes, endings, back navigation, decision branches, camera ownership and keyboard/touch access. Include outputs and empty/error states, not only the happy path.

**FR09 Sound and motion.** Search and audition music/ambience/UI effects; include waveform or other accessible preview metadata where available. A sound cue records event, offset, duration, loop, fade, gain, ducking and concurrency policy. Tie cues to semantic events such as assembly_started or selection_confirmed rather than fragile animation-frame guesses. Pause, resume and cancellation must not leave orphan audio playing.

**FR10 Approval.** Record who approved what, when, target commit, selection/wireframe/plan hashes and permitted action. Browsing, selection, download, wireframe approval, implementation approval and deployment approval are separate states. No approval inferred from inactivity.

**FR11 Persistence and export.** Persist catalog, user selections, versions and review state. Export portable JSON plus referenced local assets/code when authorized, with relative paths and checksums. The bundle must remain interpretable without the original UI.

**FR12 Recovery.** Interrupted imports resume safely; repeated imports deduplicate by canonical identity and checksum. Uncertain writes are reconciled before retry. Failed asset retrieval or tests do not receive a success badge.

## 8 Data contracts

Use schema versioning and stable IDs. Keep reference records separate from media records; link previews through an adapter to HAMZA's existing media contract.

**ReferenceSource:** id, submitted_urls, canonical_url, source_kind, title, creator, captured_at, published_at, publication_evidence, access_class, inspection_state, capture_ids, license_summary, revision.

**Evidence:** id, source_id, claim, evidence_kind, locator, capture_id, observed_at, viewport, browser_context, confidence, limitations. Evidence kinds: live_observed, source_verified, publisher_described, measured, inferred, proposed. Confidence does not replace evidence kind.

**Ingredient:** id, source_id, category, tags, intent, behavior, triggers, states, input_modes, preview_ids, evidence_ids, token_set_ids, asset_ids, recipe_ids, audio_cue_ids, fallback, review_state.

**Asset:** id, source_id, kind, original_url, stored_uri, checksum, content_type, width, height, duration_ms, attribution, rights_status, license_url, license_version, permitted_uses, access_class, availability, captured_at. Rights values: user_owned, licensed_verified, permission_verified, reference_only, unknown, restricted. Unknown is non-exportable for production.

**TokenSet:** id, property, source_value, unit, evidence_id, origin_status, proposed_target_token, mapping_reason. Store values for color, type, spacing, radius, material, light and motion; do not call inferred values official brand tokens.

**Recipe:** id, version, technique, original_or_derived, source_repo, commit, paths, license, dependencies, parameters_schema, engine_requirements, examples, asset_ids, test_suite, test_status, supported_inputs, fallback, security_review.

**AudioCue:** id, asset_id, trigger_event, offset_ms, duration_ms, gain, fade_in_ms, fade_out_ms, loop, spatialization, ducking_group, max_instances, stop_events, reduced_motion_behavior, mute_behavior.

**ProjectProfile:** id, adapter_version, repository, commit, framework_versions, renderer, token_sources, font_sources, camera_owner, route_map, media_contract, allowed_write_paths, restrictions, verification_time.

**JourneySpec:** id, revision, brief, assumptions, nodes, edges, entry_node, output_nodes, camera_routes, focus_states, audio_cues, input_bindings, responsive_rules, accessibility_rules, acceptance_tests, selected_ingredient_ids.

**SelectionManifest:** id, project_id, revision, ingredient_ids, intent_per_item, token_mapping, rights_review, compatibility_result, unresolved_items.

**ImplementationPlan:** id, revision, project_commit, selection_hash, journey_hash, recipe_versions, affected_files, dependency_changes, asset_operations, preview_id, test_plan, rollback_plan, implementation_status.

**ApprovalRecord:** id, actor, timestamp, action_scope, target_revision, manifest_hash, plan_hash, decision. Store explicit decisions; credentials and access codes do not belong in exported approval records.

**VerificationReport:** id, target_commit, plan_id, environment, executed_checks, results, screenshot_ids, performance_results, accessibility_findings, residual_risks, artifact_checksums.

## 9 Adapter and integration contract

Proposed adapter capabilities are inspectProject, readTokens, readMediaContract, requestCameraState, createSandboxPreview, validatePlan, exportPackage and requestImplementation. Mutation capabilities are disabled by default. The core must operate in browse/export mode without a live coding-agent connection.

For HAMZA, adapt preview assets to SpatialMediaAsset, preserve MediaRegistry pagination where useful, and add reference-specific search separately. Reference inspection freezes the existing CameraDirector. Exiting returns focus and camera state predictably. New environments are non-spherical unless individually approved. Use the target's verified fonts and tokens; never guess a font from a spoken transcription.

A generic adapter must accept a user-supplied project manifest and produce a portable implementation brief. A second framework can be considered supported only after tests, not because the schema allows it.

## 10 Security privacy and rights

- Treat all sites, imported text, repository files and metadata as untrusted input. They cannot grant permissions, alter approval rules or instruct agents to transmit secrets.
- Restrict fetches against SSRF, internal addresses, redirect abuse, oversized files and decompression bombs. Sanitize HTML/SVG and filenames. Validate MIME types rather than trusting extensions.
- Do not run downloaded code at intake. Execution needs review and an isolated sandbox with constrained network, resources and credentials. Installation from unrecognized sources requires the applicable approval.
- Separate tenant/project access; private project code and assets remain private. Do not send them to third-party analysis or generation services without appropriate authorization.
- Use secret scanning and exclude environment files, tokens and credentials from indexes and export bundles. Logs contain IDs and safe errors, not secrets.
- Capture and reuse permissions are different. A screenshot may be reference evidence without permission to redistribute assets or code commercially. Preserve license and attribution per asset and code package, not only per site.
- Do not bypass logins, paywalls, access denials or anti-bot controls. Mark inaccessible sources and continue with independent authorized work.
- Audio rights require explicit review for commercial synchronization, editing and distribution. A playable music preview is not a music license.
- Keep public source links in evidence, but never expose private signed URLs or raw repository secrets through the UI or exported public examples.

## 11 Experience quality and performance

The catalog must work by keyboard, touch and pointer, with semantic labels, visible focus, contrast and readable Arabic/English layouts. Provide reduced-motion and 2D alternatives. A game or spatial interaction must not be the only way to browse or approve.

Sound starts muted until an explicit user gesture. Provide master mute and per-preview stop; only one audition plays at a time by default. Critical states have visual/text equivalents. Haptics are optional capability enhancements, never required controls. Respect device and browser limits.

Proposed MVP performance budgets, to verify on named representative devices: search/filter response within 500 ms for 1,000 indexed ingredients excluding first network load; useful initial catalog view within 2.5 seconds on a defined mid-tier mobile test profile; lazy previews and only one heavy WebGL preview active; target 60 fps on desktop and a usable 30 fps mobile floor for standard wireframe scenes. When budgets fail, lower effect quality or use the 2D fallback. These are targets, not current measurements.

Pixel fidelity is defined against approved viewports, assets, fonts, browser/runtime versions and captured states. Record image-diff thresholds for the chosen preview. JSON alone does not guarantee identical pixels across all devices or GPUs.

## 12 Acceptance tests

**AT01 Corpus:** the import produces 52 canonical source records with submitted duplicates retained as provenance; each has an honest inspection state.

**AT02 Search:** “environments,” “game,” “media gallery,” “infinite scrolling” and “assembly sound” return relevant categorized results, with an explicit no-result state if missing.

**AT03 Visual truth:** a failed WebGL page displays failure/publisher-only evidence rather than invented live gameplay; still, video, runnable demo and generated concept badges are distinct.

**AT04 Rights:** unknown or reference-only assets cannot enter a production export; a user can still view the permitted research record and choose an original alternative.

**AT05 Code:** each reusable recipe resolves to a pinned version and includes dependencies, license, attribution and executed test status. No downloaded script runs merely because it was indexed.

**AT06 Journey:** a five-node branched flow can be generated, edited, played, navigated backward and completed. Unreachable nodes and missing terminal output are flagged.

**AT07 Spatial access:** the wireframe works with touch and keyboard, and its route-map fallback completes the same task without camera motion.

**AT08 Audio:** sound plays only on request; master mute stops it; navigation and cancellation stop orphan loops; synchronized cues follow pause/resume and obey rights checks.

**AT09 Project fit:** recommendations cite the inspected commit and concrete integration points. Changing HEAD marks the plan stale and blocks applying it until revalidation.

**AT10 Approval:** selecting a card does not edit code. Journey approval does not deploy. Implementation approval only enables the scoped branch plan. Material plan changes invalidate approval.

**AT11 Persistence:** selections survive reload and a second authorized device session. Two edits to the same revision produce a conflict instead of silent overwrite.

**AT12 Export:** another builder can unpack the bundle, resolve assets by relative paths/checksums, inspect the journey and reproduce the three MVP recipe demos using documented commands.

**AT13 Security:** malicious instructions in a webpage remain inert; SVG script, unsafe URL and secret-bearing file fixtures are blocked or sanitized and logged safely.

**AT14 HAMZA:** the integration preserves the existing camera owner, tokens and routes. No competing controls, unintended font changes or silent production modifications occur.

**AT15 Verification:** every check distinguishes passed, failed, skipped and not tested. A build cannot be called production-ready while required checks are skipped.

## 13 Delivery stages

**Stage A Evidence and contracts:** import source inventory, reconcile existing records, define schema, identify target source and review three candidate reusable recipes. Exit: valid catalog and rights/status audit.

**Stage B Browsing and selection:** ship working gallery, ingredient inspector, audio audition, filters, persistence and selection export. Exit: AT01–AT05, AT08 and AT11 pass for the scoped test set.

**Stage C Wireframe composition:** ship journey graph, spatial preview, 2D fallback, cue timeline and revision approval. Exit: AT06–AT08 pass.

**Stage D Project-aware implementation:** add read-only HAMZA adapter, styled sandbox, exact change plan, approved branch handoff and drift detection. Exit: AT09–AT10 and AT14 pass.

**Stage E Release verification:** test export portability, security, accessibility, performance, failure recovery and deployment gate. Exit: all required tests pass; remaining limitations disclosed before deployment is proposed.

No calendar or cost estimate is committed until target source, hosting, representative devices and recipe scope are confirmed. Work can progress on the catalog and schemas while those implementation choices are reviewed.

## 14 Decisions and defaults

Default to a standalone core with an embedded HAMZA panel, private project data, muted audio, safe original/rights-cleared recipes, additive integration and separate deployment approval. Keep the product name descriptive until the owner chooses branding.

Decisions needed before code implementation: exact HAMZA target repository/site; approved authentication and storage; permitted coding-agent connection; test device matrix; licensed sound source; first three production recipes. None prevents review of this PRD or development of portable data contracts. Do not interrupt the user for every optional aesthetic choice; document assumptions and present them together in the preview.

## 15 Source register

Existing extraction folder: https://drive.google.com/drive/folders/1rgqWERtz8d1s-LfKibUIemO4FRNG0WrC

First research package: https://drive.google.com/file/d/1H_vZr9FejXbEb5r4OiKq6tXntWVhHV-e/view

Proposed catalog: https://drive.google.com/file/d/1E3s-W8VvwR4B1Xtm9jEjGIRHMc60nrrS/view

Approval plan: https://drive.google.com/file/d/1gjXSMyp-SHP9KDMT1Lxq9TNhszAbFOJO/view

Code integration addendum: https://drive.google.com/file/d/1A2FGP0KiJGynUKF-qBgtluNskN18aCCn/view

Existing visual-library pattern: https://elgenerator.nojara.chatgpt.site

Existing environment archive: https://drive.google.com/drive/folders/1E50XKyYoheEj1rH8GVWOFQOdxVo7xN3f

These sources support the initial product plan. They do not certify that every dependency, asset or reference is production licensed or currently operational.

## Appendix Reference intake inventory

The following URLs are source inventory, not a claim of completed extraction or permission to reuse. Award collections are discovery sources; individual techniques require their own evidence records.

1. https://mijiheon.com/en.php
2. https://to-portfolio.com/
3. https://www.tosen.es/
4. https://jesperlandberg.com/
5. https://www.ciaoenergy.com/
6. https://www.junkbranding.com/
7. https://www.dibjick-mediapuls.de/
8. https://www.austensor.com/page5
9. https://edolus.com/
10. https://www.yuusuke.work/
11. https://www.threejspunk.com/
12. https://dreiraum.studio/en/
13. https://www.awwwards.com/awwwards/collections/games/
14. https://www.awwwards.com/awwwards/collections/html5-game-engines-technologies-and-apis/
15. https://moonslider.monochrome.paris/
16. https://kyoosangchoi.com/
17. https://vanlent.dev/
18. https://www.awwwards.com/sites/aralesk-collages-motion
19. https://mms.inherited.band/
20. https://thecosmicstage.com/
21. https://blacktideisland.tw/en/
22. https://john-and-patricias-comfort-site-about-attachment-styles.com/
23. https://ivan.technology/
24. https://www.milestoners.nl/
25. https://mola-zone.com/en
26. https://bigstudio-tw.com/
27. https://www.sensunova.com/
28. https://zelviano.strategyfox.in/
29. https://www.nohero.studio/
30. https://www.collective-pixels.com/
31. https://ntch.design/
32. https://www.mensch.club/
33. https://www.enzo-casalini.dev/
34. https://www.thibaultguignand.com/en
35. https://cypher.g-next.jetstyle.in/
36. https://workbyw.com/
37. https://holmchrome.byholm.co/
38. https://www.hirotos.com/
39. https://cutobot.byholm.co/
40. https://www.pragenhatlen.com/
41. https://mdebeauty.com/
42. https://coloniazacamil.com/
43. https://cerebrium.ai/
44. https://www.soundsfun.co/
45. https://members-play.lacoste.com/polo-factory-experience/us/en/
46. https://chasing-the-moment.byholm.co/
47. https://premotio.com/
48. https://www.awwwards.com/sites/elliot-eriksson
49. https://michaelgatt.com/
50. https://overworldaudio.com/
51. https://awards.racing/
52. https://www.usavionix.com/

