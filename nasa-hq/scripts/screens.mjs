// Screenshots of THIS build (the commit label is visible in the banner of every shot). Desktop 1440x900 and mobile 390x844.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { createServer } from '../server/dev.mjs';
const server = createServer({ env: {} }); await new Promise((r) => server.listen(4543, '127.0.0.1', r));
await mkdir('docs/screens', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const [tag, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: tag === 'mobile' ? 2 : 1, hasTouch: tag === 'mobile' }); const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4543/?devtools=1'); await page.waitForFunction(() => window.__nasa);
  const shot = (n, full = false) => page.screenshot({ path: `docs/screens/${tag}-${n}.png`, fullPage: full });
  await shot('1-gate');
  await page.getByRole('radio', { name: /KAST/ }).click(); await page.getByRole('button', { name: 'Enter workspace' }).click(); await page.waitForSelector('.sphere'); await page.waitForTimeout(1200);
  await shot('2-sphere');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
  await page.evaluate(async () => { const w = window.__nasa.ws; await w.act({ type: 'open_project', id: 'yah' }, 'mouse'); });
  await page.waitForSelector('.detail'); await page.locator('#sec-projects').scrollIntoViewIfNeeded(); await shot('3-project-open');
  await page.getByRole('button', { name: 'Working brief' }).first().click(); await page.waitForSelector('.slide'); await page.locator('#sec-viewer').scrollIntoViewIfNeeded(); await shot('4-document');
  await page.getByRole('region', { name: 'Projects' }).getByRole('button', { name: /^Film 01/ }).click(); await page.waitForSelector('video'); await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  await page.getByRole('button', { name: 'Play', exact: true }).click(); await page.waitForFunction(() => document.querySelector('video').currentTime > 2.2, null, { timeout: 9000 }); await page.locator('#sec-viewer').scrollIntoViewIfNeeded(); await shot('5-real-video-playing');
  await page.locator('#sec-kast').scrollIntoViewIfNeeded(); await shot('6-kast-widget-not-connected');
  await page.getByRole('button', { name: 'Settings' }).click(); await page.getByLabel('Dusk gradient').check(); await shot('7-settings-background');
  await ctx.close();
}
await browser.close(); server.close(); console.log('screens done');
