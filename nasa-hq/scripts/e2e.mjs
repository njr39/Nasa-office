// Real-browser run against the built app. KAST VOICE is NOT exercised here (needs key + mic);
// tool calls go through the same handlers KAST uses and are labelled as such in the receipts.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { createServer } from '../server/dev.mjs';

const server = createServer({ env: {} });
await new Promise((r) => server.listen(4539, r));
const base = 'http://localhost:4539/?devtools=1';
const receipts = [];
const rec = (step, data) => { receipts.push({ step, ...data }); console.log('✓', step, data.note ?? ''); };
await mkdir('docs/screens', { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1587, height: 991 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__nasa.ws.state)));
const tool = (name, args = {}) => page.evaluate(async ([n, a]) => JSON.parse(await window.__nasa.tools[n](a)), [name, args]);

await page.goto(base); await page.waitForSelector('text=Enter workspace');
await page.waitForFunction(() => window.__nasa);
await page.screenshot({ path: 'docs/screens/01-gate.png' });
assert.equal((await tool('nasa_open_media', { target: 'film-01' })).error, 'not_entered'); rec('gate blocks tools before Enter', { ok: true });

await page.click('text=Enter workspace'); await page.waitForSelector('.sphere');
await page.waitForSelector('text=KAST · not connected', { timeout: 8000 });
assert.equal((await st()).phase, 'hq');
rec('Enter -> HQ; KAST honestly reports not connected (no key on this host)', { ok: true, note: 'no simulated connection' });

// --- sphere: drag orbits without selecting; click selects; keyboard orbits
await page.waitForTimeout(600);
const box = await page.locator('.sphere').boundingBox();
const before = await st();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 8 }); await page.mouse.up();
const afterDrag = await st();
assert.notEqual(afterDrag.camera.yaw, before.camera.yaw); assert.equal(afterDrag.selectedNode, null); assert.equal(afterDrag.control, 'USER_CONTROL');
rec('mouse drag orbits, does not select, takes USER_CONTROL', { ok: true, yaw: [before.camera.yaw, afterDrag.camera.yaw] });
await page.keyboard.press('ArrowRight'); assert.notEqual((await st()).camera.yaw, afterDrag.camera.yaw); rec('ArrowRight orbits (keyboard)', { ok: true });
await page.waitForTimeout(900);
const front = await page.evaluateHandle(() => [...document.querySelectorAll('.node')].find((b) => b.style.opacity === '1' && b.style.pointerEvents === 'auto'));
await front.asElement().click(); assert.ok((await st()).selectedNode); rec('node label click selects', { ok: true, node: (await st()).selectedNode });
await page.screenshot({ path: 'docs/screens/02-hq-desktop.png' });

// --- KAST cannot act while user holds control; must ask; user approves
const blocked = await tool('nasa_view', { action: 'select_node', target: 'musa' });
assert.equal(blocked.error, 'user_control'); rec('KAST tool rejected under USER_CONTROL', { ok: true, receipt: blocked });
await tool('nasa_tracker', { action: 'set_control', value: 'AGENT_CONTROL' });
await page.waitForSelector('[role=dialog]'); assert.equal((await st()).control, 'USER_CONTROL');
await page.click('role=dialog >> text=Allow'); assert.equal((await st()).control, 'AGENT_CONTROL'); rec('control handoff needs the user\'s Allow click', { ok: true });

// --- project -> film -> play/pause with REAL status
const sel = await tool('nasa_tracker', { action: 'select_project', target: 'yah' }); assert.equal(sel.ok, true);
const found = await tool('nasa_find_media', { query: 'film 01', type: 'video' }); assert.equal(found.results[0].id, 'film-01');
const open = await tool('nasa_open_media', { target: 'film-01' }); assert.equal(open.state.media.status, 'ready');
const play = await tool('nasa_control', { action: 'play' }); assert.equal(play.ok, true); assert.equal(play.state.media.status, 'playing');
await page.waitForTimeout(1500);
const mid = await tool('nasa_get_state'); assert.ok(mid.media.positionSec > 1.2, `position ${mid.media.positionSec}`);
const paused = await tool('nasa_control', { action: 'pause' }); assert.equal(paused.state.media.status, 'paused');
await page.waitForTimeout(700); const still = await tool('nasa_get_state');
assert.ok(Math.abs(still.media.positionSec - paused.state.media.positionSec) < 0.05, 'position frozen while paused');
rec('open project, open film, play (clock advanced), pause (clock frozen)', { ok: true, playedTo: mid.media.positionSec, pausedAt: still.media.positionSec });
await page.screenshot({ path: 'docs/screens/03-film-playing-paused.png' });

// --- scroll is a real scroll (portrait stack)
await page.setViewportSize({ width: 390, height: 844 });
await tool('nasa_control', { action: 'portrait' }); await page.waitForTimeout(300);
const sc = await tool('nasa_view', { action: 'scroll', section: 'viewer' }); await page.waitForTimeout(900);
const y = await page.evaluate(() => window.scrollY); assert.ok(y > 100, `scrollY ${y}`);
assert.ok((await tool('nasa_get_state')).scroll_y > 100); rec('KAST scroll moves the real page', { ok: true, scrollY: y, receipt: sc.detail });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at 390px'); rec('no horizontal overflow at 390x844', { ok: true });
await page.screenshot({ path: 'docs/screens/04-portrait-390.png' });
await tool('nasa_view', { action: 'scroll', section: 'top' });

// --- orbit + select + document via KAST tool
await page.setViewportSize({ width: 1587, height: 991 }); await tool('nasa_control', { action: 'auto' });
const o = await tool('nasa_view', { action: 'orbit', yaw: 0.5, pitch: 0 }); assert.equal(o.ok, true);
assert.equal((await tool('nasa_view', { action: 'select_node', target: 'grandy' })).ok, true);
assert.equal((await tool('nasa_view', { action: 'open_document', target: 'doc-seven' })).ok, true);
assert.equal((await tool('nasa_control', { action: 'next' })).state.openDocument, 'doc-seven'); rec('KAST orbit, select_node, open_document, next slide', { ok: true });

// --- save approved context -> fresh session retrieves latest
const rem = await tool('nasa_tracker', { action: 'remember', value: 'Reviewing SEVEN brief slide 2. Prefers short answers.' });
assert.equal(rem.ok, true); await page.waitForSelector('[role=dialog]');
assert.equal(await page.evaluate(() => localStorage.getItem('nasa_hq.synthetic.context.v1')), null, 'nothing stored before approval');
await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(300);
assert.equal((await st()).lastSavedContext.version, 1);
await page.reload(); await page.waitForFunction(() => window.__nasa);
await page.click('text=Enter workspace'); await page.waitForSelector('.sphere');
await page.waitForFunction(() => window.__nasa.ws.savedContext?.version === 1);
const fresh = await tool('nasa_get_state'); assert.equal(fresh.saved_context_version, 1);
await page.waitForSelector('text=Reviewing SEVEN brief slide 2');
rec('approved context saved (v1), fresh session loaded it', { ok: true, store: fresh.context_store, note: 'synthetic localStorage store, NOT Supabase' });
await page.screenshot({ path: 'docs/screens/05-fresh-session-memory.png' });

assert.deepEqual(errors.filter((e) => !/Failed to load resource|fonts\.g|net::ERR|503/.test(e)), [], 'no console errors');
rec('no unexpected console errors', { ok: true });
await browser.close(); server.close();
await writeFile('docs/e2e-receipts.json', JSON.stringify({ ranAt: new Date().toISOString(), voiceExercised: false, receipts }, null, 2));
console.log('E2E PASS');
