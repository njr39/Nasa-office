// Runs the REAL useKast hook under React Strict Mode against a fake SDK, in Chromium. Author-run evidence; no provider involved.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const bundle = await build({ entryPoints: ['tests/harness/hook-harness.tsx'], bundle: true, write: false, format: 'iife', jsx: 'automatic', target: 'es2022', define: { 'process.env.NODE_ENV': '"development"' } });
const code = bundle.outputFiles[0].text;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const results = []; let failed = 0;
async function scenario(name, fn) {
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  await page.goto('about:blank'); await page.addScriptTag({ content: code });
  const w = (f, ...a) => page.evaluate(f, ...a); const until = (f, ...a) => page.waitForFunction(f, ...a, { timeout: 3000 });
  try { await w(() => window.__h.mount()); await until(() => document.getElementById('state')); await fn({ page, w, until }); assert.deepEqual(errors, [], 'no console errors or React warnings'); results.push({ name, pass: true }); console.log('✓', name); }
  catch (e) { failed++; results.push({ name, pass: false, error: String(e.message).slice(0, 400) }); console.log('✗', name, '\n  ', e.message.split('\n')[0]); }
  await page.close();
}
const attr = (a) => `document.getElementById('state').dataset.${a}`;
const start = (w, until) => w(() => window.__h.kast.start()).then(() => until(() => window.__h.calls.length >= 1));
const tool = (w, i, n, a = {}) => w(([i, n, a]) => window.__h.calls[i].opts.clientTools[n](a), [i, n, a]).then(JSON.parse);
const link = (w) => w(() => document.getElementById('state').dataset.link);

await scenario('STRICT MODE: double effects start exactly one SDK session; tools are bound to it', async ({ w, until }) => {
  assert.deepEqual(await w(() => [window.__h.effects, window.__h.cleanups]), [2, 1], 'Strict Mode really ran mount, simulated unmount, mount');
  await start(w, until); assert.equal(await w(() => window.__h.calls.length), 1);
  await w(() => window.__h.calls[0].resolve()); await until(() => document.getElementById('state').dataset.link === 'connected');
  assert.equal(await w(() => window.__h.calls.length), 1); assert.equal((await tool(w, 0, 'nasa_get_state')).phase, 'hq');
});
await scenario('LATE CALLBACKS from finished attempt A cannot touch attempt B (message, mode, error, disconnect)', async ({ w, until }) => {
  await start(w, until); await w(() => window.__h.calls[0].resolve()); await until(() => document.getElementById('state').dataset.link === 'connected');
  await w(() => window.__h.kast.stop()); await until(() => document.getElementById('state').dataset.canstart === 'true');
  assert.equal(await w(() => window.__h.calls[0].conv.ended), 1);
  await w(() => window.__h.kast.start()); await until(() => window.__h.calls.length === 2); await w(() => window.__h.calls[1].resolve()); await until(() => document.getElementById('state').dataset.link === 'connected');
  await w(() => { const a = window.__h.calls[0].opts; a.onMessage({ message: 'LATE FROM A', event_id: 9, source: 'ai' }); a.onModeChange({ mode: 'speaking' }); a.onError('late error from A'); a.onDisconnect(); });
  await new Promise((r) => setTimeout(r, 150));
  const d = await w(() => ({ ...document.getElementById('state').dataset, endedB: window.__h.calls[1].conv.ended, endedA: window.__h.calls[0].conv.ended }));
  assert.equal(d.link, 'connected'); assert.equal(d.speaking, 'false'); assert.equal(d.error, ''); assert.ok(!d.lines.includes('LATE')); assert.equal(d.endedB, 0, 'B was not torn down by A'); assert.equal(d.endedA, 1, 'A is not ended twice');
  assert.equal((await tool(w, 1, 'nasa_get_state')).phase, 'hq', "B's tools still work"); assert.equal((await tool(w, 0, 'nasa_get_state')).error, 'session_ended', "A's tools are dead");
});
await scenario('DISCONNECT BEFORE START RESOLVES: never connected; the late session is ended; tools dead', async ({ w, until }) => {
  await start(w, until); await w(() => window.__h.calls[0].opts.onDisconnect()); await w(() => window.__h.calls[0].resolve());
  await until(() => document.getElementById('state').dataset.link === 'failed' || window.__h.calls[0].conv.ended === 1); await until(() => document.getElementById('state').dataset.teardown === 'verified');
  const d = await w(() => ({ links: window.__h.links, ended: window.__h.calls[0].conv.ended, err: document.getElementById('state').dataset.error }));
  assert.ok(!d.links.includes('connected'), 'was never reported connected'); assert.equal(d.ended, 1); assert.match(d.err, /disconnected_during_start/); assert.equal((await tool(w, 0, 'nasa_get_state')).error, 'session_ended');
});
await scenario('PROVIDER ERROR invalidates tools at once, while cleanup is still pending, then ends once', async ({ w, until }) => {
  await start(w, until); await w(() => { let rel; window.__h.calls[0].conv.endGate = new Promise((r) => (rel = r)); window.__h.release = rel; window.__h.calls[0].resolve(); });
  await until(() => document.getElementById('state').dataset.link === 'connected'); assert.equal((await tool(w, 0, 'nasa_get_state')).phase, 'hq');
  await w(() => window.__h.calls[0].opts.onError('boom'));
  assert.equal((await tool(w, 0, 'nasa_view', { action: 'orbit', yaw: 0.1 })).error, 'session_ended', 'dead BEFORE end() has resolved');
  assert.equal(await link(w), 'stopping'); assert.equal(await w(() => window.__h.kast.canStart), false);
  await w(() => window.__h.release()); await until(() => document.getElementById('state').dataset.teardown === 'verified');
  assert.equal(await w(() => window.__h.calls[0].conv.ended), 1); assert.equal(await w(() => window.__h.kast.canStart), true);
});
await scenario('START REJECTED (mic denied): contained, retry blocked, reload required, no second SDK call', async ({ w, until }) => {
  await start(w, until); await w(() => window.__h.calls[0].reject(new Error('NotAllowedError: Permission denied'))); await until(() => document.getElementById('state').dataset.link === 'failed');
  const d = await w(() => ({ ...document.getElementById('state').dataset }));
  assert.equal(d.reload, 'true'); assert.equal(d.canstart, 'false'); assert.equal(d.teardown, 'unverified'); assert.match(d.error, /Permission denied/);
  assert.equal((await tool(w, 0, 'nasa_get_state')).error, 'session_ended', 'tools handed to the failed attempt are dead');
  await w(() => window.__h.kast.start()); await new Promise((r) => setTimeout(r, 100)); assert.equal(await w(() => window.__h.calls.length), 1, 'no new attempt'); assert.match(await w(() => document.getElementById('state').dataset.error), /Reload the page/);
});
await scenario('DELAYED cleanup blocks a replacement; it unblocks only after end() resolves', async ({ w, until }) => {
  await start(w, until); await w(() => { let rel; window.__h.calls[0].conv.endGate = new Promise((r) => (rel = r)); window.__h.release = rel; window.__h.calls[0].resolve(); });
  await until(() => document.getElementById('state').dataset.link === 'connected'); await w(() => window.__h.kast.stop()); await until(() => document.getElementById('state').dataset.link === 'stopping');
  await w(() => window.__h.kast.start()); await new Promise((r) => setTimeout(r, 100)); assert.equal(await w(() => window.__h.calls.length), 1, 'start ignored while cleanup pending');
  await w(() => window.__h.release()); await until(() => document.getElementById('state').dataset.canstart === 'true'); await w(() => window.__h.kast.start()); await until(() => window.__h.calls.length === 2);
});
await scenario('FAILED cleanup stays blocked and asks for a reload', async ({ w, until }) => {
  await start(w, until); await w(() => { window.__h.calls[0].conv.endFails = true; window.__h.calls[0].resolve(); }); await until(() => document.getElementById('state').dataset.link === 'connected');
  await w(() => window.__h.kast.stop()); await until(() => document.getElementById('state').dataset.link === 'failed');
  const d = await w(() => ({ ...document.getElementById('state').dataset })); assert.equal(d.teardown, 'unverified'); assert.equal(d.reload, 'true'); assert.equal(d.canstart, 'false');
});
await scenario('UNMOUNT while connected: session ended once, tools dead, no late state updates', async ({ w, until }) => {
  await start(w, until); await w(() => window.__h.calls[0].resolve()); await until(() => document.getElementById('state').dataset.link === 'connected');
  const rendersBefore = await w(() => window.__h.renders); await w(() => window.__h.unmount()); await new Promise((r) => setTimeout(r, 150));
  assert.equal(await w(() => window.__h.calls[0].conv.ended), 1); assert.equal((await tool(w, 0, 'nasa_get_state')).error, 'session_ended');
  await w(() => { const a = window.__h.calls[0].opts; a.onMessage({ message: 'after unmount', event_id: 1, source: 'ai' }); a.onError('after unmount'); }); await new Promise((r) => setTimeout(r, 100));
  assert.equal(await w(() => window.__h.renders), rendersBefore, 'no renders after unmount');
});
await scenario('UNMOUNT while the start is pending: the late session is ended once and never reported connected', async ({ w, until }) => {
  await start(w, until); await w(() => window.__h.unmount()); await w(() => window.__h.calls[0].resolve()); await new Promise((r) => setTimeout(r, 200));
  assert.equal(await w(() => window.__h.calls[0].conv.ended), 1); assert.ok(!(await w(() => window.__h.links)).includes('connected'));
});
await scenario('READ-ONLY keeps typed Q&A available while tools stay denied; saved context is never sent to the provider', async ({ w, until }) => {
  await w(() => { window.__h.ws.savedContext = { version: 1, summary: 'UNIQUE-SAVED-NOTE-XYZ', view: {}, projectId: null, savedAt: '', expiresAt: '', synthetic: true }; });
  await start(w, until); await w(() => window.__h.calls[0].resolve()); await until(() => document.getElementById('state').dataset.link === 'connected');
  await w(async () => { await window.__h.ws.act({ type: 'set_mode', mode: 'read_only' }, 'mouse'); }); await w(() => window.__h.kast.sendText('What is on screen?'));
  assert.deepEqual(await w(() => window.__h.calls[0].conv.sent), ['What is on screen?']);
  assert.equal((await tool(w, 0, 'nasa_tracker', { action: 'select_project', target: 'seven' })).error, 'read_only');
  await w(async () => { await window.__h.ws.act({ type: 'open_project', id: 'seven' }, 'mouse'); }); await new Promise((r) => setTimeout(r, 100));
  const ctx = await w(() => window.__h.calls[0].conv.contextual.join('\n')); assert.ok(ctx.length > 0 && !ctx.includes('UNIQUE-SAVED-NOTE-XYZ'));
});
await browser.close();
await writeFile('docs/hook-receipts.json', JSON.stringify({ ranAt: new Date().toISOString(), kind: 'REPORTED by the author: real useKast hook, real React 19.2.0 StrictMode, FAKE SDK, Chromium; no provider, network or microphone', results }, null, 2));
console.log(failed ? `HOOK TESTS FAILED: ${failed}` : `HOOK TESTS PASS: ${results.length}`); process.exit(failed ? 1 : 0);
