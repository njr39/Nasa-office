import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

await mkdir('dist', { recursive: true });
const r = await build({
  entryPoints: { app: 'src/main.tsx' }, bundle: true, minify: true, format: 'esm', target: 'es2022', outdir: 'dist',
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' }, metafile: true, sourcemap: false, legalComments: 'none',
});
await build({ entryPoints: { app: 'src/styles.css' }, bundle: true, minify: true, outdir: 'dist' });
await cp('index.html', 'dist/index.html');
const js = await readFile('dist/app.js');
console.log(`app.js ${(js.length / 1024).toFixed(0)} KB raw, ${(gzipSync(js).length / 1024).toFixed(0)} KB gzip`);
// Single-file variant for hosting as one page.
const css = await readFile('dist/app.css', 'utf8');
const html = (await readFile('index.html', 'utf8'))
  .replace('<link rel="stylesheet" href="app.css" />', `<style>${css}</style>`)
  .replace('<script type="module" src="app.js"></script>', `<script type="module">${js.toString('utf8').replace(/<\/script/gi, '<\\/script')}</script>`);
await writeFile('dist/review.html', html);
console.log(`review.html ${(html.length / 1024).toFixed(0)} KB`);

// Variant for the Artifact host: it wraps the page in its own document skeleton, so no doctype/html/head/body here.
const art = `<title>NASA HQ Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js.toString('utf8').replace(/<\/script/gi, '<\\/script')}</script>`;
await writeFile('dist/artifact.html', art);
console.log(`artifact.html ${(art.length / 1024).toFixed(0)} KB`);
