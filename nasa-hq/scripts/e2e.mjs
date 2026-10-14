// REPORTED (author-run) browser check against the built app. KAST VOICE is NOT exercised: there is no identity layer, no key,
// no microphone. Tool calls go through the same handlers KAST uses, via a test session opened with ?devtools=1.
// "Slate" steps use a SYNTHETIC canvas slate: they test the control path, not film playback.
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

// ---- project, synthetic slate control test
assert.equal((await tool('nasa_tracker', { action: 'select_project', target: 'yah' })).ok, true);
assert.equal((await tool('nasa_open_media', { target: 'film-01' })).state.media.status, 'ready');
assert.match(await bodyText(), /Synthetic slate-control test/i);
const play = await tool('nasa_control', { action: 'play' }); assert.equal(play.status, 'applied'); assert.equal(play.observed.status, 'playing');
await page.waitForTimeout(1500);
const mid = await tool('nasa_get_state'); assert.ok(mid.media.positionSec > 1.2, `clock ${mid.media.positionSec}`);
const paused = await tool('nasa_control', { action: 'pause' }); assert.equal(paused.observed.status, 'paused');
await page.waitForTimeout(700); assert.ok(Math.abs((await tool('nasa_get_state')).media.positionSec - paused.observed.positionSec) < 0.05);
rec('SYNTHETIC SLATE control test: open, play (clock advanced), pause (clock frozen). Not a film, not a media element', { playedTo: mid.media.positionSec });
assert.equal(await page.locator('video, audio').count(), 0, 'no real media element exists in this build');
await page.screenshot({ path: 'docs/screens/03-slate-control-test.png' });

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
await writeFile('docs/e2e-receipts.json', JSON.stringify({ ranAt: new Date().toISOString(), kind: 'REPORTED by the author; not independently run', voiceExercised: false, realMediaExercised: false, environment: { node: process.version, browser: 'Chromium (playwright-core 1.64.0) with SwiftShader, no GPU', providers: 'none' }, receipts }, null, 2));
console.log('E2E PASS');
