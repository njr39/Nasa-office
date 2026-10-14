import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const out = (await build({ entryPoints: ['src/integration.ts'], bundle: true, format: 'esm', write: false })).outputFiles[0].text;
const { MATRIX } = await import('data:text/javascript;base64,' + Buffer.from(out).toString('base64'));
const md = `# Integration matrix

Generated from \`src/integration.ts\` (same data as the in-app STATUS dialog). Two separate columns, on purpose:

- **Reported**: the author ran it, in the environment named in the evidence. **None of it has been independently run.** \`pass\`, \`partial\` or \`not_run\`.
- **Live verification**: checked against the real provider, backend, device or real media. **Nothing is live-verified.** \`not_tested\`, \`on_hold\` (waiting for an approval) or \`blocked\`.

| Feature | Reported | Live verification | Evidence and limits | Next |
|---|---|---|---|---|
${MATRIX.map((r) => `| ${r.feature} | **${r.reported}** | **${r.live.replace(/_/g, ' ')}** | ${r.evidence} | ${r.next ?? ''} |`).join('\n')}

Environment for every "reported" pass: see \`docs/test-receipts.json\` and \`docs/e2e-receipts.json\` (Node, Chromium, PostgreSQL and package versions, timestamps). Dependencies are pinned exactly and the lockfile is committed; install with \`npm ci\`.
`;
await writeFile('docs/INTEGRATION_MATRIX.md', md); console.log('matrix written');
