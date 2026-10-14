import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const out = (await build({ entryPoints: ['src/integration.ts'], bundle: true, format: 'esm', write: false })).outputFiles[0].text;
const { MATRIX } = await import('data:text/javascript;base64,' + Buffer.from(out).toString('base64'));
const icon = { working: 'WORKING', prepared: 'PREPARED', blocked: 'BLOCKED' };
const md = `# Integration matrix\n\nGenerated from \`src/integration.ts\` (same data as the in-app STATUS panel).\n\n- **WORKING**: exercised by a test or real-browser run in this repo, with the evidence shown.\n- **PREPARED**: built, not proven end to end because a credential, access or review step is missing.\n- **BLOCKED**: cannot proceed from this session.\n\n| Feature | Status | Evidence | Next |\n|---|---|---|---|\n${MATRIX.map((r) => `| ${r.feature} | **${icon[r.status]}** | ${r.evidence} | ${r.next ?? ''} |`).join('\n')}\n`;
await writeFile('docs/INTEGRATION_MATRIX.md', md); console.log('matrix written');
