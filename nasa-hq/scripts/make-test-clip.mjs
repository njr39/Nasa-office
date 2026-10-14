// Generates src/assets/test-clip.webm: an 8 s, 480x270, silent VP8 clip with a visible running timecode.
// It is a GENERATED CONTROL-TEST CLIP. It is not NOJARA work, not a portfolio film and not approved media.
// Frames are drawn in headless Chromium and encoded with the Playwright-bundled ffmpeg (libvpx).
import { chromium } from 'playwright-core';
import { statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const FPS = 12, SECONDS = 8, W = 480, H = 270;
const frames = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent('<canvas id=c width=480 height=270></canvas>');
for (let i = 0; i < FPS * SECONDS; i++) {
  const url = await page.evaluate(([i, FPS, W, H]) => {
    const t = i / FPS, c = document.getElementById('c'), g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, `hsl(${(t * 30) % 360},45%,22%)`); bg.addColorStop(1, `hsl(${(t * 30 + 70) % 360},55%,45%)`);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '700 64px monospace'; g.textAlign = 'center';
    g.fillText(`${String(Math.floor(t / 60)).padStart(2, '0')}:${t.toFixed(1).padStart(4, '0').replace(/^(\d)\./, '0$1.')}`.slice(0, 7), W / 2, 125);
    g.font = '600 15px sans-serif'; g.fillText('TEST CLIP · generated for control testing', W / 2, 165); g.fillText('not NOJARA work · not approved media', W / 2, 187);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(40 + (W - 80) * ((t / 2) % 1), 225, 11, 0, 7); g.fill();
    g.fillStyle = '#3b6bff'; g.fillRect(0, H - 6, W * (t / 8), 6);
    return c.toDataURL('image/jpeg', 0.92);
  }, [i, FPS, W, H]);
  frames.push(Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
const out = new URL('../src/assets/test-clip.webm', import.meta.url).pathname;
const r = spawnSync('/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '160k', '-crf', '33', '-g', String(FPS), '-pix_fmt', 'yuv420p', '-an', out], { input: Buffer.concat(frames), maxBuffer: 1 << 28 });
if (r.status !== 0) { console.error(String(r.stderr)); process.exit(1); }
console.log(`wrote ${out} (${(statSync(out).size / 1024).toFixed(0)} KB, ${SECONDS}s)`);
