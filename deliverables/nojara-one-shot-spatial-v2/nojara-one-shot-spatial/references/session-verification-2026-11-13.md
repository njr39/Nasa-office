# Verification record — Claude session, 13 November 2026

What one Claude Code cloud session actually read through the Google Drive connector. This is a dated checkpoint, not current truth. Recheck before depending on any item.

## Access
| Source | State | Notes |
|---|---|---|
| HAMZA Extractions folder | TEXT_READ | START_HERE, APPROVAL_PLAN, CODE_INTEGRATION_ADDENDUM, HAMZA_REFERENCE_CATALOG.json, ROUND2_REFERENCE_INDEX.json, PRD read in full. WEB_REFERENCE_PLUGIN_DESIGN.md and "DREIRAUM — extraction.md" listed, not read |
| HAMZA_Extractions_14_Sites.zip (1,355,455 bytes) | METADATA_ONLY | not opened |
| WEB_REFERENCE_ROUND2_38_SITES.zip (7,793,810 bytes) | METADATA_ONLY | not opened; its index was read |
| Enviroments folder | TEXT_READ | README, room_licenses.json, spatial reference pack, hamza-city-assembly-source.txt and one SOURCE.json read. All repository ZIPs and unzipped folders METADATA_ONLY |
| 48-Hour Build Report folder | TEXT_READ | build_report.md, FINAL_BUILD_INSTRUCTIONS_2026-11-13.md, 39_OS_BUILD_INDEX_v03, 39OS_LOCAL_BUILD_ACCEPTANCE read. ARCHIVE_MANIFEST.md, the PDF, and folders 02, 03, 04 listed, not read |
| GitHub repositories | NOT_ACCESSED | every commit hash in this skill is as recorded in Drive notes |
| The reference websites | NOT_ACCESSED | no site was opened in this session |
| This skill package | BINARY_VERIFIED | all 11 original files matched manifest SHA-256 |

Of the 48 Drive IDs referenced in the original package, 41 appeared in live listings in this session. Seven did not: `17jZBi9RxQWSjdg9roOv02pd-ojVWTLeb` and `1Htwh9mVP58MlffHUqAV9fMefZGTJ-ZLH` (seen only as a parent id or inside a document), and `1aDsqR7XNor4kpnuDnzQNcbqkxizGE22g`, `1KMIU2QzrilCkoc0Qm9cu6s7CAOxXBvDE`, `1_ERenVCIT5J9NmaoRa4Ba2ZCxvC9r5F8`, `1ke6e0tuvu3rNgDYi8CRWqPDJPUIq0lPo`, `1kh12VfNI_27kpS3p8YVxLiiNkiu2IVr4` (not looked up).

## Reference sites: what the Drive indexes say
52 unique URLs in the PRD appendix: 14 first round, 38 second round. All are reference only with no reuse license verified. In the second-round index every entry has `code_repository_verified: false` and `full_journey_verified: false`.

First round (HAMZA_REFERENCE_CATALOG.json, 14 entries, inspected 2026-11-11):
- Recorded with observations: dibjick-mediapuls.de (HTML read; screenshot near-black, motion not verified), austensor.com/page5 (static preview, scene black), junkbranding.com (bundle read; live 3D did not start), yuusuke.work (hero verified, transitions not tested), dreiraum.studio (text layout seen; identifies Three.js, GSAP, Astro), edolus.com (loader reached 99 percent only), threejspunk.com (failed to load), two Awwwards collections (directories, not techniques).
- Empty records, no tags or runtime status: ciaoenergy.com, mijiheon.com, jesperlandberg.com, tosen.es, to-portfolio.com.

Second round (ROUND2_REFERENCE_INDEX.json, 38 entries):
- Live viewport or entrance inspected: blacktideisland.tw, milestoners.nl, kyoosangchoi.com.
- Loading screen only: bigstudio-tw.com.
- Blocked or unavailable: moonslider.monochrome.paris (no WebGL in the inspecting browser), sensunova.com (HTTP 503).
- Publisher preview and public HTML or metadata only: john-and-patricias-comfort-site…, thecosmicstage.com, ivan.technology, mms.inherited.band, vanlent.dev, mola-zone.com, awwwards aralesk listing.
- Inspection level not recorded (null), some with a viewport or preview image: collective-pixels.com, pragenhatlen.com, workbyw.com, enzo-casalini.dev, cutobot.byholm.co, hirotos.com, mensch.club, ntch.design, holmchrome.byholm.co, thibaultguignand.com, zelviano.strategyfox.in, cypher.g-next.jetstyle.in, nohero.studio.
- Public source metadata only: members-play.lacoste.com, awards.racing, cerebrium.ai, soundsfun.co, coloniazacamil.com, awwwards elliot-eriksson listing, premotio.com, michaelgatt.com, mdebeauty.com, overworldaudio.com, chasing-the-moment.byholm.co, usavionix.com.

Consequence: no site in the corpus has a verified end-to-end journey or a verified code source. Use them as visual direction and write original implementations.

## Environment assets: points that change a build
- Moodle rooms: code is GPL-3.0-or-later; the 19 room GLBs are CC0, CC-BY-3.0, CC-BY-4.0 or MPL-2.0 per `room_licenses.json` in the Enviroments folder. CC-BY rooms need the recorded credit line. Using a GLB does not import the GPL code, but copying the loader code would.
- Virtual Art Gallery: paintings load at runtime from an external API and are not cleared.
- AWS warehouse: unsupported upstream since 10 September 2025.
- Voxel51 splats: 10 of 18 files in Drive; all eight PLYs missing.
- SuperSplat: editor source only; no hosted scene is downloaded or licensed.
- hamza-city-assembly-original-concept.png is a generated concept image, not a City Simulator screenshot.

## Owner builds, as reported by their implementers
| Build | Recorded state | Not established |
|---|---|---|
| NOJARA story review site | CSS3D, one scene, 11 planes, six stations, five video inserts; commit b47c3660 | physical iPhone and Safari, full audio listening, owner visual approval |
| 39 OS preview | one scene and camera, 11 stations; local commit 8bca78c2; 13 automated tests; software-GPU median 33.3 ms, p95 66.6 ms | provider generation, real hands, physical mobile performance |
| Hands, CRB_NJR_26 feat/cerebro-spatial-next | tracking recovery repair at 89fe3e87; six regression tests | real-hand test; the owner's rejection of the earlier preview is unresolved |
| HAMZA camera owner | `src/three/camera/CameraDirector.ts` at d97b83ea | equivalence with Site v11 f0941a04; current HEAD |

Footage selections, cut points and the closing action for the NOJARA story are in FINAL_BUILD_INSTRUCTIONS_2026-11-13.md in the build report folder. Read them there; they are not copied into this skill.
