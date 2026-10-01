# Graph Report - Nasa-office  (2026-10-01)

## Corpus Check
- 85 files · ~133,853 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 3, .woff2 1)

## Summary
- 901 nodes · 2006 edges · 47 communities (46 shown, 1 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.84)
- Token cost: 324,860 input · 0 output

## Community Hubs (Navigation)
- Task Board & Approvals UI
- Routines Engine
- Office Scene Data & Main Loop
- Connectors Bar & Hero Tiles
- Brain Graph Overlay
- Server Core & Vault Graph
- MCP Access Control
- Package Manifest
- Agent Poses & Chat Events
- Desk Screen Animations
- Routine API Handlers
- 3D Scene Builders
- Hero Scene Effects
- Department Rail & Focus
- Activity Feed & Demo Data
- Agent Prompt Assembly
- README Screenshots (UI)
- Model & Effort Selection
- Release Notes: UI Features
- View-Image MCP Server
- Roster, Skills & Interview Docs
- Usage Tracking
- Agent Teams Orchestration
- Sales Notes & Numbers Ledger
- Offers, Brand & Delivery Notes
- Emails & Finance Rules
- MCP Logo Baking (Python)
- Lessons from Corrections
- Roster Loader
- Release Script
- Operations & Reporting Notes
- Changelog: Teams, Leads & Licence
- Check Script
- Config & Graph Build
- Shipped Example Skills
- Marketing Notes
- Skills Loader
- Set-up Interview
- Camera & Tweening
- Routines & Calendar Docs
- Business Model & ICP
- Bundle Build
- Connector Config & Privacy
- Dark Mode Dimming
- Pipeline Rules
- Legal Basics

## God Nodes (most connected - your core abstractions)
1. `initTasks()` - 93 edges
2. `server` - 41 edges
3. `Agents Office v3 (Beta)` - 30 edges
4. `initBrain()` - 25 edges
5. `runTeam()` - 23 edges
6. `initCalendar()` - 23 edges
7. `initHero()` - 22 edges
8. `initMcp()` - 21 edges
9. `untilText()` - 21 edges
10. `agentOf()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Task Status panel` --implements--> `Routine`  [INFERRED]
  src/shell.html → CLAUDE.md
- `client-reply skill` --conceptually_related_to--> `needsOk approval gate`  [INFERRED]
  skills/client-reply/SKILL.md → CLAUDE.md
- `Task Status panel` --implements--> `Agent Teams`  [INFERRED]
  src/shell.html → CLAUDE.md
- `Task Status panel` --implements--> `Task bar routing`  [INFERRED]
  src/shell.html → README.md
- `Calendar overlay` --implements--> `The calendar (P)`  [INFERRED]
  src/shell.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Layers that shape an agent's instructions** — claude_agent_brief, claude_skill, claude_feedback_lessons, skills_prompt_assembly_order [EXTRACTED 1.00]
- **Shipped example skills for the sample studio** — skills_client_reply_skill_client_reply, skills_house_style_skill_house_style, skills_proposal_skill_proposal, readme_northgate_studio [INFERRED 0.85]
- **Scheduling: routines, calendar and scheduled tasks** — claude_routine, claude_scheduled_task, readme_calendar, src_shell_calov, claude_routines_json [INFERRED 0.85]
- **Offer ladder tiers** — brain_10_business_offer_ladder_website_build, brain_10_business_offer_ladder_brand_kit, brain_10_business_offer_ladder_growth_retainer [EXTRACTED 1.00]
- **Marketing content system** — brain_40_marketing_content_engine, brain_40_marketing_newsletter, brain_40_marketing_reel_hooks, brain_40_marketing_ad_playbook [EXTRACTED 1.00]
- **Every number traced to the numbers ledger** — brain_claude_numbers_from_ledger_only, brain_70_delivery_qa_checklist_no_ship_without_qa, brain_90_operations_reporting_cadence_monthly_kpi_rollup, brain_60_sales_sales_playbook_objection_handling, brain_00_meta_numbers_ledger [INFERRED 0.85]
- **Owner approval gates** — brain_claude_outbound_needs_owner_approval, brain_80_finance_invoicing_rules_credit_notes_owner_approval, brain_80_finance_payables_rules_contractor_invoice_check [INFERRED 0.75]
- **Delivery lifecycle (kickoff, plan, QA, report)** — brain_70_delivery_moc_delivery_kickoff_call, brain_70_delivery_project_plan_template_project_milestones, brain_70_delivery_qa_checklist, brain_70_delivery_report_template_monthly_client_report [INFERRED 0.85]
- **Calendar scheduling flow (pick day, set task, repeat as routine)** — assets_readme_calendar_month_grid, assets_readme_calendar_schedule_popover, assets_readme_calendar_routines_sidebar [INFERRED 0.85]

## Communities (47 total, 1 thin omitted)

### Community 0 - "Task Board & Approvals UI"
Cohesion: 0.07
Nodes (79): modelName(), agentOf(), initTasks(), addRoutine(), addTask(), addTeamDemo(), apply(), askApproval() (+71 more)

### Community 1 - "Routines Engine"
Cohesion: 0.07
Nodes (64): advance(), ALLOWED, askLine(), due(), file(), LATE_AFTER, listText(), load() (+56 more)

### Community 2 - "Office Scene Data & Main Loop"
Cohesion: 0.04
Nodes (47): APPROVAL_ASKS, APPROVAL_BY_AGENT, BILLBOARDS, DEPTS, LAYOUT, TOKENS, WORKLINES, bubble (+39 more)

### Community 3 - "Connectors Bar & Hero Tiles"
Cohesion: 0.07
Nodes (43): fromSummary(), hue(), INK, inkOf(), loadConnectors(), norm(), tile(), HERO (+35 more)

### Community 4 - "Brain Graph Overlay"
Cohesion: 0.11
Nodes (31): agentOf(), DEPT_FOLDERS, GROUP_COL, GROUP_NAME(), initBrain(), centre(), chips(), close() (+23 more)

### Community 5 - "Server Core & Vault Graph"
Cohesion: 0.07
Nodes (30): layoutGraph(), readOfficeNotes(), readVault(), d3-force, guessNeedsOk(), ask(), cfg, CLI_CWD (+22 more)

### Community 6 - "MCP Access Control"
Cohesion: 0.12
Nodes (29): ALIASES, allowed(), allowedTools(), BROWSER, browserServer(), browserState(), browserUsable(), cfgMcp (+21 more)

### Community 7 - "Package Manifest"
Cohesion: 0.08
Nodes (24): dependencies, d3-force, description, devDependencies, esbuild, playwright-core, three, engines (+16 more)

### Community 8 - "Agent Poses & Chat Events"
Cohesion: 0.11
Nodes (24): posePerson(), poseWork(), applyStandAndFacing(), chatPush(), fireAgentEvent(), getEmoteTex(), mockupFor(), pickWorkMode() (+16 more)

### Community 9 - "Desk Screen Animations"
Cohesion: 0.13
Nodes (23): appPlayer(), draw(), canvas(), CH, CLI, cliPlayer(), draw(), rebuild() (+15 more)

### Community 10 - "Routine API Handlers"
Cohesion: 0.23
Nodes (21): refusal(), agentName(), body(), editRoutine(), enqueue(), fire(), json(), load() (+13 more)

### Community 11 - "3D Scene Builders"
Cohesion: 0.17
Nodes (19): geoCache, makeChair(), makeDesk(), makeDeskScreenTexture(), makeFloorTitle(), makeHolo(), makeMeetingTable(), makePerson() (+11 more)

### Community 12 - "Hero Scene Effects"
Cohesion: 0.20
Nodes (19): initHero(), bubbleOn(), bubblesOff(), bubbleTex(), bubbleTick(), drawLi(), drawLinkedIn(), flash() (+11 more)

### Community 13 - "Department Rail & Focus"
Cohesion: 0.17
Nodes (21): applyRoster(), buildDeptRail(), cascadeRows(), ensureChat(), enterFocus(), esc(), exitFocus(), flyBillboardIntoRail() (+13 more)

### Community 14 - "Activity Feed & Demo Data"
Cohesion: 0.13
Nodes (18): ago(), feedPush(), renderActivity(), setTab(), fill(), freshTask(), pick(), visibleTitles() (+10 more)

### Community 15 - "Agent Prompt Assembly"
Cohesion: 0.29
Nodes (19): namesOf(), agentBrief(), agentSystem(), askX(), businessContext(), chat(), contextText(), modeLineFor() (+11 more)

### Community 16 - "README Screenshots (UI)"
Cohesion: 0.15
Nodes (18): README Calendar Screenshot (month view of scheduled tasks and routines), Department Filter Chips (Emails, Sales, Marketing, Operations, Finance, Delivery, Routines, Done), Calendar Month Grid (Mon-Sun, task and routine cards per day), Routine: Chase the quiet deals (Fridays 16:00, Sales Lead, waits for OK), Routine: Triage the inbox (weekdays 08:00, Emails Lead), Routine: List overdue invoices and draft reminders (Mondays 09:00, Invoicing, waits for OK), Routines Sidebar (routine cards with schedule, owner agent, next run, waits-for-OK), Run Counters (routine runs, scheduled, done) (+10 more)

### Community 17 - "Model & Effort Selection"
Cohesion: 0.20
Nodes (16): DEFAULT_MODEL, EFFORT_KEYS, EFFORT_NAME, effortFor(), effortName(), FROM_TEXT, MODEL_KEYS, modelArgs() (+8 more)

### Community 18 - "Release Notes: UI Features"
Cohesion: 0.15
Nodes (17): 3.0.0-beta.1 Agents Office v3, 3.6.0-beta.1 models by name and usage gauge, 3.6.1-beta.1 bigger task box and effort, Model and effort precedence, Agents Office v3 (Beta), Brain graph (G), Company board (B), Task bar routing (+9 more)

### Community 19 - "View-Image MCP Server"
Cohesion: 0.14
Nodes (15): fetchImage(), guessMime(), main(), MIME_TYPES, resolveUrl(), TOOLS, dependencies, @modelcontextprotocol/sdk (+7 more)

### Community 20 - "Roster, Skills & Interview Docs"
Cohesion: 0.23
Nodes (15): 3.2.0-beta.1 skills and briefs, 3.3.0-beta.1 interview and lessons, Agent brief, Agents Office CLAUDE.md guide, Corrections feedback file, npm run check, office.agents.local.json, Agent roster (office.agents.json) (+7 more)

### Community 21 - "Usage Tracking"
Cohesion: 0.19
Nodes (13): bumpUsage(), getUsage(), ENDPOINT, fallback(), fetchUsage(), loadState(), parseUsage(), readToken() (+5 more)

### Community 22 - "Agent Teams Orchestration"
Cohesion: 0.13
Nodes (14): slug(), writeNote(), askedSize(), DEFAULTS, intent(), noteExtra(), num, parseJSON() (+6 more)

### Community 23 - "Sales Notes & Numbers Ledger"
Cohesion: 0.20
Nodes (11): Numbers ledger, Active clients metric, Monthly recurring revenue, Proposal win rate, Proposal template, Client list, MOC — Sales, Sales playbook (+3 more)

### Community 24 - "Offers, Brand & Delivery Notes"
Cohesion: 0.19
Nodes (13): Offer ladder, Brand kit offer, Website build offer, Visual identity, Voice, Asset conventions, Client portal (finals only), MOC — Delivery (+5 more)

### Community 25 - "Emails & Finance Rules"
Cohesion: 0.19
Nodes (10): Contractor terms, Contractor hourly rates, Email rules, MOC — Emails, Vendor list, Vendor renewals, Invoicing rules, MOC — Finance (+2 more)

### Community 26 - "MCP Logo Baking (Python)"
Cohesion: 0.19
Nodes (4): bbox_crop(), try_mark_crop(), bbox_crop(), tile_from()

### Community 27 - "Lessons from Corrections"
Cohesion: 0.22
Nodes (12): classify(), count(), dir(), file(), HEAD(), promptText(), read(), record() (+4 more)

### Community 28 - "Roster Loader"
Cohesion: 0.21
Nodes (11): brainFile(), defaults(), EDITABLE, EFFORTS, FILE, loadRoster(), LOCAL, MODELS (+3 more)

### Community 29 - "Release Script"
Cohesion: 0.17
Nodes (10): AUTHOR, bg, FILES, OUT, pkg, pub, push, rel (+2 more)

### Community 30 - "Operations & Reporting Notes"
Cohesion: 0.18
Nodes (9): Log, Monthly client report (four pages, sent on the 5th), Compliance checklist, Consent wording on every form, Privacy policy reviewed yearly, MOC — Operations, Reporting cadence, Monthly KPI roll-up into dashboards (+1 more)

### Community 31 - "Changelog: Teams, Leads & Licence"
Cohesion: 0.24
Nodes (10): Changelog, 3.2.0-beta.2 Agent Teams + Claude in Chrome, 3.2.0-beta.3 teams.mjs fix, 3.2.1-beta.1 calendar release, 3.2.1-beta.2 licence notices, 3.4.0-beta.1 every department has a lead, Agent Teams, Department lead (+2 more)

### Community 32 - "Check Script"
Cohesion: 0.22
Nodes (6): bad(), cfg, fails, ok(), results, step()

### Community 33 - "Config & Graph Build"
Cohesion: 0.31
Nodes (4): loadConfig(), readJSON(), OUT, SKIP

### Community 34 - "Shipped Example Skills"
Cohesion: 0.22
Nodes (10): Northgate Studio (sample studio), client-reply skill, house-style skill, numbers-ledger.md note, offer-ladder.md note, piper (Proposals agent), proposal skill, Proposal template (+2 more)

### Community 35 - "Marketing Notes"
Cohesion: 0.28
Nodes (5): Ad playbook, Content engine, MOC — Marketing, Newsletter, Reel hooks that worked

### Community 36 - "Skills Loader"
Cohesion: 0.31
Nodes (8): ROOT, brainDir(), LIMITS, loadSkills(), parseSkill(), readOne(), SHIPPED, DEPT_KEYS

### Community 37 - "Set-up Interview"
Cohesion: 0.42
Nodes (8): active(), handle(), load(), progress(), QUESTIONS, save(), stateFile(), writeUp()

### Community 38 - "Camera & Tweening"
Cohesion: 0.25
Nodes (9): applyCamera(), bezier(), clamp(), loop(), resize(), smooth(), tickLOD(), tickTween() (+1 more)

### Community 39 - "Routines & Calendar Docs"
Cohesion: 0.32
Nodes (8): 3.5.0-beta.1 routines, Brain folder, needsOk approval gate, Routine, routines.json, Scheduled task (calendar one-off), The calendar (P), Calendar overlay

### Community 40 - "Business Model & ICP"
Cohesion: 0.38
Nodes (6): Index, Business model, Northgate Studio, Growth retainer offer, Ideal customer (ICP), Owner-led trade and professional-services businesses

### Community 41 - "Bundle Build"
Cohesion: 0.33
Nodes (4): html, shell, buildBrainGraph(), esbuild

### Community 42 - "Connector Config & Privacy"
Cohesion: 0.33
Nodes (4): 3.1.0-beta.1 real connectors and roster, Claude in Chrome (tools.browser), MCP connector config (allow/deny/departments), office.config.json

### Community 43 - "Dark Mode Dimming"
Cohesion: 0.40
Nodes (6): applySceneDim(), dimTwin(), mix(), restoreSceneDim(), setDark(), tickDim()

### Community 45 - "Pipeline Rules"
Cohesion: 0.67
Nodes (3): Pipeline rules, Pipeline stages (new → won/lost), Invoice reminders (day 7, 14, 21)

### Community 46 - "Legal Basics"
Cohesion: 0.83
Nodes (4): Legal basics, Liability cap clause, Master agreement, Price lock clause

## Knowledge Gaps
- **179 isolated node(s):** `shell`, `html`, `results`, `cfg`, `fails` (+174 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 222 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Agents Office v3 (Beta)` connect `Release Notes: UI Features` to `Routines Engine`, `Office Scene Data & Main Loop`, `Connectors Bar & Hero Tiles`, `Brain Graph Overlay`, `Server Core & Vault Graph`, `MCP Access Control`, `Activity Feed & Demo Data`, `Model & Effort Selection`, `Roster, Skills & Interview Docs`, `Usage Tracking`, `Lessons from Corrections`, `Roster Loader`, `Changelog: Teams, Leads & Licence`, `Config & Graph Build`, `Shipped Example Skills`, `Skills Loader`, `Set-up Interview`, `Routines & Calendar Docs`, `Bundle Build`, `Connector Config & Privacy`?**
  _High betweenness centrality (0.216) - this node is a cross-community bridge._
- **Why does `initTasks()` connect `Task Board & Approvals UI` to `Routines Engine`, `Office Scene Data & Main Loop`, `Connectors Bar & Hero Tiles`, `Activity Feed & Demo Data`, `Model & Effort Selection`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `initBrain()` connect `Brain Graph Overlay` to `Office Scene Data & Main Loop`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `initTasks()` (e.g. with `addRoutine()` and `addTask()`) actually correct?**
  _`initTasks()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `initBrain()` (e.g. with `close()` and `open()`) actually correct?**
  _`initBrain()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `shell`, `html`, `results` to the rest of the system?**
  _179 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Task Board & Approvals UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07278481012658228 - nodes in this community are weakly interconnected._