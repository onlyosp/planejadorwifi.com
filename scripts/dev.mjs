#!/usr/bin/env node
// Development loop: builds dist/, serves it, and rebuilds when sources change.
// Usage: node scripts/dev.mjs [port]
import { watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from './build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.argv[2] || process.env.PORT || 8080;

async function rebuild() {
  try { const r = await build(); console.log(`[dev] built (version ${r.version})`); }
  catch (e) { console.error('[dev] build failed: ' + e.message); }
}

await rebuild();
let timer = 0;
for (const dir of ['src', 'i18n', 'assets']) {
  watch(join(ROOT, dir), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });
}
spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), join(ROOT, 'dist'), String(port)], { stdio: 'inherit' });
