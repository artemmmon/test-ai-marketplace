#!/usr/bin/env node
// Runs every scripts/**/*.test.mjs and plugins/**/*.test.mjs (the tests that sit beside the plugins' own scripts)
// with the Node test runner. Fixtures, node_modules and eval results (evals/) are skipped.
// Needed because `node --test <directory>` and glob arguments behave differently on Node 20 and 22.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['scripts', 'plugins'];
const SKIP = new Set(['__fixtures__', 'node_modules', 'evals']);

function find(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((e) => {
      if (e.isDirectory()) return SKIP.has(e.name) ? [] : find(join(dir, e.name));
      return e.isFile() && e.name.endsWith('.test.mjs') ? [join(dir, e.name)] : [];
    });
}

// Each file once, even if the roots ever overlap.
const files = [...new Set(ROOTS.map((r) => join(root, r)).filter(existsSync).flatMap(find))];
if (files.length === 0) {
  console.error(`no *.test.mjs files found under ${ROOTS.join('/, ')}/`);
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
