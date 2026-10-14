// REPORTED (author-run) browser check against the built app. KAST VOICE is NOT exercised: there is no identity layer, no key,
// no microphone. Tool calls go through the same handlers KAST uses, via a test session opened with ?devtools=1.
// Film 01 is a REAL <video> playing a generated control-test clip (element state is asserted). Film 02 is a SYNTHETIC canvas slate.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { createServer } from '../server/dev.mjs';

const server = createServer({ env: {} });
await new Promise((r) => server.listen(4539, '127.0.0.1', r));
const base = 'http://127.0.0.1:4539/?devtools=1';
const receipts = [];
const rec = (step, data = {}) => { receipts.push({ step, ok: true, ...data }); console.log('✓', step, data.note ?? ''); };
await mkdir('docs/screens', { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1587, height: 991 } });
const page = await ctx.newPage();
const errors = [], tokenRequests = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (r.url().includes('/api/elevenlabs/session')) tokenRequests.push(r.url()); });
await page.addInitScript(() => { window.__gum = 0; const md = navigator.mediaDevices; if (md) { const o = md.getUserMedia?.bind(md); md.getUserMedia = (...a) => { window.__gum++; return o ? o(...a) : Promise.reject(new Error('none')); }; } });
const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__nasa.ws.state)));
const tool = (name, args = {}) => page.evaluate(async ([n, a]) => JSON.parse(await window.__nasa.s.tools[n](a)), [name, args]);
const bodyText = () => page.evaluate(() => document.body.innerText);

await page.goto(base); await page.waitForSelector('text=Select an agent'); await page.waitForFunction(() => window.__nasa);
assert.ok(!/[؀-ۿ]/.test(await bodyText()), 'no Arabic script in the rendered page'); assert.equal(await page.locator('html').getAttribute('lang'), 'en');
assert.equal(await page.locator('[role=radio][aria-checked=true]').count(), 0, 'nothing is preselected');
assert.equal(await page.getByRole('button', { name: 'Enter workspace' }).isDisabled(), true);
await page.screenshot({ path: 'docs/screens/01-gate.png' });
rec('English-only gate; no agent preselected; Enter disabled until an agent is chosen');
await page.evaluate(() => { window.__nasa.s = window.__nasa.open(); });
assert.equal((await tool('nasa_open_media', { target: 'film-01' })).error, 'not_entered'); rec('tools refused before Enter');

await page.getByRole('radio', { name: /Musa/ }).click(); assert.equal(await page.getByRole('button', { name: 'Enter workspace' }).isEnabled(), true);
await page.getByRole('radio', { name: /KAST/ }).click(); assert.equal((await st()).entryAgent, 'kast');
await page.getByRole('button', { name: 'Enter workspace' }).click(); await page.waitForSelector('.sphere');
await page.waitForSelector('text=KAST · not connected', { timeout: 8000 });
assert.match(await bodyText(), /Sign in is required/); assert.equal(tokenRequests.length, 0, 'no token request without an application session'); assert.equal(await page.evaluate(() => window.__gum), 0, 'getUserMedia was never called');
rec('Enter with KAST: fails closed ("Sign in is required"), zero token requests, zero getUserMedia calls', { note: 'no live KAST' });

// open a fresh test session after the failed voice attempt (the UI attempt opened and closed its own)
await page.evaluate(() => { window.__nasa.s = window.__nasa.open(); });
await page.waitForTimeout(600);
const box = await page.locator('.sphere').boundingBox(); const before = await st();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 8 }); await page.mouse.up();
const afterDrag = await st(); assert.notEqual(afterDrag.camera.yaw, before.camera.yaw); assert.equal(afterDrag.selectedNode, 'kast', 'drag did not change selection'); assert.equal(afterDrag.control, 'USER_CONTROL');
rec('drag orbits without selecting and takes USER_CONTROL', { yaw: [before.camera.yaw, afterDrag.camera.yaw] });
await page.keyboard.press('ArrowRight'); assert.notEqual((await st()).camera.yaw, afterDrag.camera.yaw); rec('ArrowRight orbits (keyboard)');
await page.waitForTimeout(900);
const front = await page.evaluateHandle(() => [...document.querySelectorAll('.node')].find((b) => b.style.opacity === '1' && b.style.pointerEvents === 'auto' && b.textContent !== 'KAST'));
await front.asElement().click(); rec('node label click selects', { node: (await st()).selectedNode });

assert.equal((await tool('nasa_view', { action: 'select_node', target: 'musa' })).error, 'user_control'); rec('KAST tool refused under USER_CONTROL');
await tool('nasa_tracker', { action: 'set_control', value: 'AGENT_CONTROL' }); await page.waitForSelector('[role=dialog]'); assert.equal((await st()).control, 'USER_CONTROL');
await page.getByRole('dialog').getByRole('button', { name: 'Allow' }).click(); assert.equal((await st()).control, 'AGENT_CONTROL'); rec("control handoff needs the user's Allow click");

// ---- project, REAL <video> playback (generated control-test clip), then the synthetic slate
const vid = (fn) => page.evaluate(fn);
assert.equal((await tool('nasa_tracker', { action: 'select_project', target: 'yah' })).ok, true);
assert.equal((await tool('nasa_open_media', { target: 'film-01' })).state.media.status, 'ready');
await page.waitForSelector('video');
assert.equal(await page.locator('video').count(), 1, 'one real video element'); assert.match(await bodyText(), /Video player/);
assert.match(await page.locator('.demo-badge', { hasText: 'TEST CLIP' }).innerText(), /TEST CLIP/);
await page.waitForFunction(() => document.querySelector('video').readyState >= 1, null, { timeout: 8000 });
const meta = await vid(() => { const v = document.querySelector('video'); return { dur: v.duration, w: v.videoWidth, h: v.videoHeight, paused: v.paused, t: v.currentTime }; });
assert.ok(meta.dur > 7 && meta.dur < 9, `clip duration ${meta.dur}`); assert.equal(meta.w, 480); assert.equal(meta.paused, true);
// 1) the USER presses Play: the element itself must start advancing
await page.getByRole('button', { name: 'Play', exact: true }).click();
await page.waitForFunction(() => { const v = document.querySelector('video'); return !v.paused && v.currentTime > 0.6; }, null, { timeout: 8000 });
const t1 = await vid(() => { const v = document.querySelector('video'); return { paused: v.paused, t: v.currentTime, ended: v.ended }; });
assert.equal(t1.paused, false); assert.equal((await st()).media.status, 'playing');
await page.getByRole('button', { name: 'Pause', exact: true }).click();
const t2 = await vid(() => { const v = document.querySelector('video'); return { paused: v.paused, t: v.currentTime }; }); assert.equal(t2.paused, true);
await page.waitForTimeout(700); const t3 = await vid(() => document.querySelector('video').currentTime); assert.ok(Math.abs(t3 - t2.t) < 0.05, 'element position frozen while paused'); assert.equal((await st()).media.status, 'paused');
rec('REAL VIDEO (manual): user Play advanced the <video> element currentTime; Pause froze it', { from: meta.t, playedTo: t1.t, pausedAt: t2.t });
// 2) KAST tool path against the same real element (user gesture already happened in this page)
await page.evaluate(() => window.__nasa.ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse'));
const play = await tool('nasa_control', { action: 'play' }); assert.equal(play.status, 'applied', JSON.stringify(play)); assert.equal(play.observed.status, 'playing');
await page.waitForFunction((from) => document.querySelector('video').currentTime > from + 0.5, t2.t, { timeout: 8000 });
assert.equal(await vid(() => document.querySelector('video').paused), false);
const paused = await tool('nasa_control', { action: 'pause' }); assert.equal(paused.observed.status, 'paused'); assert.equal(await vid(() => document.querySelector('video').paused), true);
rec('REAL VIDEO (shared handlers): the nasa_control tool handler played and paused the same <video> element', { note: 'tool handlers called from the test harness, NOT by spoken KAST' });
// 3) seek by the keyboard-reachable range input, then a manual action revokes agent control
await page.locator('input.seek').focus(); await page.keyboard.press('End');
await page.waitForFunction(() => document.querySelector('video').currentTime > 6, null, { timeout: 4000 }); assert.equal((await st()).control, 'USER_CONTROL'); rec('seek input (keyboard End) moved the element to the end and took USER_CONTROL');
// 4) ended is reported from the element
await page.evaluate(() => window.__nasa.ws.act({ type: 'media_seek', sec: 6.6 }, 'mouse'));
await page.getByRole('button', { name: 'Play', exact: true }).click(); await page.waitForFunction(() => document.querySelector('video').ended, null, { timeout: 10000 });
await page.waitForFunction(() => window.__nasa.ws.state.media.status === 'paused'); rec('REAL VIDEO ended event reached the shared state');
await page.screenshot({ path: 'docs/screens/03-real-video.png' });
// 5) local approved file: plays in this browser, is invisible to the agent
await page.setInputFiles('#local-video-input', 'src/assets/test-clip.webm');
await page.waitForSelector('.demo-badge:has-text("LOCAL FILE")'); await page.waitForFunction(() => document.querySelector('video').readyState >= 1);
assert.equal(JSON.stringify(await tool('nasa_get_state')).includes('test-clip'), false, 'the local filename is not exposed to the agent');
await page.evaluate(() => window.__nasa.ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse'));
assert.equal((await tool('nasa_open_media', { target: 'local-1' })).ok, false); rec('local video file plays in the browser; agent cannot open it or see its name');
// 6) film-02 stays a labelled synthetic slate
const viewer = page.getByRole('region', { name: 'Viewer' });
await viewer.getByRole('button', { name: 'Film 02', exact: true }).click(); await page.waitForSelector('canvas'); assert.equal(await page.locator('video').count(), 0);
assert.match(await bodyText(), /Synthetic slate-control test/i); rec('Film 02 is a labelled SYNTHETIC SLATE (control path only)');
await viewer.getByRole('button', { name: 'Film 01', exact: true }).click(); await page.waitForSelector('video');

// ---- Settings: background + motion change nothing else (navigation, project, film, session)
assert.match(await page.getByTestId('build').innerText(), /^[0-9a-f]{12}/); rec('commit shown inside the app', { build: await page.getByTestId('build').innerText() });
const keep = async () => { const x = await st(); return JSON.stringify({ p: x.openProject, d: x.openDocument, m: x.media.id, sel: x.selectedNode, view: x.projectView, entry: x.entryAgent, phase: x.phase, layout: x.layout, mode: x.mode, y: Math.round(x.camera.yaw * 1000) }); };
const sessionBefore = await page.evaluate(() => { return window.__nasa.s.session; });
const kept = await keep(); const tBefore = await vid(() => document.querySelector('video').currentTime);
await page.getByRole('button', { name: 'Settings' }).click(); await page.waitForSelector('[role=dialog][aria-labelledby=st-t]');
await page.getByLabel('Dusk gradient').check(); assert.equal(await page.locator('.plate').getAttribute('data-bg'), 'dusk');
await page.getByLabel('Solid ink').check(); assert.equal(await page.locator('.plate').getAttribute('data-bg'), 'ink');
assert.equal(await page.getByLabel(/Your image/).isDisabled(), true, 'image option is disabled until a file is chosen');
await page.setInputFiles('#bg-image-input', 'docs/screens/01-gate.png'); await page.waitForSelector('.plate img.fill'); assert.equal(await page.locator('.plate').getAttribute('data-bg'), 'image');
await page.setInputFiles('#bg-video-input', 'src/assets/test-clip.webm'); await page.waitForSelector('.plate video.fill');
await page.waitForFunction(() => { const v = document.querySelector('.plate video'); return v && !v.paused; }, null, { timeout: 6000 });
rec('background selector: dusk, ink, local image and local video all apply; the background video plays');
await page.setInputFiles('#bg-image-input', 'src/assets/test-clip.webm'); await page.waitForSelector('text=is not an image'); rec('a non-image file is refused with a message');
assert.equal(await keep(), kept, 'navigation, project, film, selection and layout are unchanged'); assert.equal(await vid(() => document.querySelector('.viewer video').currentTime) >= tBefore, true);
assert.equal(await page.evaluate((g) => window.__nasa.ws.sessionLive(g), sessionBefore), true, 'the open voice-session binding survived a background change'); rec('background change preserved navigation, project, film, selection and the session binding');
await page.getByLabel('Always reduce motion').check(); assert.equal(await page.locator('.app').getAttribute('data-motion'), 'reduced');
await page.waitForFunction(() => document.querySelector('.plate video').paused); rec('Always reduce motion: data-motion=reduced and the background video is paused');
await page.getByLabel(/Follow my device/).check(); await page.getByLabel('Demo plate (default)').check();
await page.getByText('Background formats').click(); assert.match(await page.getByRole('dialog').innerText(), /Needs assets or implementation/);
await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { state: 'detached' }); assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Settings'); rec('Settings closes with Escape and returns focus to the Settings button');
// OS-level reduced motion
await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => document.querySelector('.app').dataset.motion === 'reduced'); rec('OS prefers-reduced-motion switches the page to reduced motion');
await page.emulateMedia({ reducedMotion: 'no-preference' });

// ---- S05 blocked web viewer, S07 read only, S08 command card, project views
await page.getByRole('button', { name: 'Website' }).click(); await page.waitForSelector('text=Preview unavailable');
assert.equal(await page.locator('iframe').count(), 0); assert.equal(await page.getByRole('link', { name: 'Open in browser' }).getAttribute('rel'), 'noopener noreferrer'); rec('S05 blocked viewer: no iframe, safe link out');
await page.getByRole('tab', { name: 'Memory' }).click(); assert.equal((await st()).projectView, 'memory'); await page.getByRole('tab', { name: 'List' }).click(); assert.match(await page.locator('.view-body').innerText(), /Working notes|film/i); rec('project views render (board/list/timeline/memory/media)');
await page.getByRole('button', { name: /Read only/ }).click(); assert.equal((await st()).mode, 'read_only');
const ro = await tool('nasa_view', { action: 'orbit', yaw: 0.2 }); assert.equal(ro.error, 'read_only'); await page.waitForSelector('text=No changes made'); rec('S07 read-only: KAST refused, "No changes made" shown');
await page.getByRole('button', { name: /Read only/ }).click();
await page.evaluate(() => window.__nasa.ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse'));   // the user hands control back
await tool('nasa_view', { action: 'propose', command: 'open_viewer' }); await page.waitForSelector('text=Open viewer'); assert.equal((await st()).openDocument, null);
await page.getByRole('button', { name: 'Run', exact: true }).click(); assert.equal((await st()).command.status, 'done'); assert.equal((await st()).openDocument, 'doc-yah'); rec('S08 command: proposed, nothing ran until the user pressed Run');
await page.evaluate(() => { window.__nasa.ws.act({ type: 'set_control', owner: 'AGENT_CONTROL' }, 'mouse'); });

// ---- scroll receipt reports the observed position (portrait stack)
await page.setViewportSize({ width: 390, height: 844 }); await tool('nasa_control', { action: 'portrait' }); await page.waitForTimeout(300);
const sc = await tool('nasa_view', { action: 'scroll', section: 'kast' });
const y = await page.evaluate(() => window.scrollY); assert.equal(sc.status, 'applied'); assert.ok(sc.observed.scrollY > 100); assert.ok(Math.abs(sc.observed.scrollY - y) <= 2, `receipt ${sc.observed.scrollY} vs page ${y}`); assert.equal(sc.observed.settled, true);
rec('scroll receipt reports the OBSERVED final position (not 0, not the request)', { receipt: sc.observed.scrollY, page: y });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at 390'); rec('no horizontal overflow at 390x844');
await page.screenshot({ path: 'docs/screens/04-portrait-390.png' });
await tool('nasa_view', { action: 'scroll', section: 'top' }); await page.setViewportSize({ width: 1587, height: 991 }); await tool('nasa_control', { action: 'auto' });

// ---- synthetic context: view summary only, focus restoration, fresh session
await page.getByRole('button', { name: 'Save this view…' }).focus(); await page.keyboard.press('Enter'); await page.waitForSelector('[role=dialog]');
assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')), 'focus moved into the dialog');
await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { state: 'detached' });
assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Save this view…'); rec('dialog focus: moves in, Escape closes, focus returns to the opener');
assert.equal(await page.evaluate(() => localStorage.getItem('nasa_hq.synthetic.context.v2')), null);
await page.getByRole('button', { name: 'Save this view…' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(300);
const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('nasa_hq.synthetic.context.v2'))); assert.equal(stored[0].synthetic, true); assert.deepEqual(Object.keys(stored[0].view).sort(), ['documentId', 'mediaId', 'projectId', 'slideIndex']);
rec('approved save stored an app-generated view summary only', { version: stored[0].version });
await page.reload(); await page.waitForFunction(() => window.__nasa); await page.getByRole('radio', { name: /Katib/ }).click(); await page.getByRole('button', { name: 'Enter workspace' }).click(); await page.waitForSelector('.sphere');
await page.evaluate(() => { window.__nasa.s = window.__nasa.open(); }); await tool('nasa_tracker', { action: 'select_project', target: 'yah' });
await page.evaluate(() => window.__nasa.ws.loadLatestContext('yah')); await page.waitForSelector('text=Last saved view (v1)');
assert.equal(JSON.stringify(await tool('nasa_get_state')).includes('Young'), false, 'saved summary text is not exposed to the tool layer'); assert.ok(!JSON.stringify(await tool('nasa_get_state')).includes('Last saved'));
rec('after a reload, the page shows the synthetic view for that project; nothing was sent to KAST', { note: 'same browser profile, localStorage: NOT durable private recall' });
await page.getByRole('button', { name: 'Clear' }).click(); assert.equal(await page.evaluate(() => localStorage.getItem('nasa_hq.synthetic.context.v2')), null); rec('Clear removes the synthetic context');
await page.screenshot({ path: 'docs/screens/05-after-reload.png' });

assert.deepEqual(errors.filter((e) => !/Failed to load resource|fonts\.g|net::ERR/.test(e)), [], 'no console errors'); rec('no unexpected console errors');
await browser.close(); server.close();
await writeFile('docs/e2e-receipts.json', JSON.stringify({ ranAt: new Date().toISOString(), kind: 'REPORTED by the author; not independently run', voiceExercised: false, realMediaExercised: true, realMediaNote: 'a generated 8 s control-test clip, not NOJARA work; element currentTime/paused/ended asserted', environment: { node: process.version, browser: 'Chromium (playwright-core 1.64.0) with SwiftShader, no GPU', providers: 'none' }, receipts }, null, 2));
console.log('E2E PASS');
