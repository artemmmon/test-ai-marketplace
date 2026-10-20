#!/usr/bin/env node
// Runs every scripts/**/*.test.mjs with the Node test runner (fixtures are skipped).
// Needed because `node --test <directory>` and glob arguments behave differently on Node 20 and 22.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['__fixtures__', 'node_modules']);

function find(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((e) => {
      if (e.isDirectory()) return SKIP.has(e.name) ? [] : find(join(dir, e.name));
      return e.isFile() && e.name.endsWith('.test.mjs') ? [join(dir, e.name)] : [];
    });
}

const files = find(scripts);
if (files.length === 0) {
  console.error('no *.test.mjs files found under scripts/');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
