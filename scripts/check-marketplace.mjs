#!/usr/bin/env node
// Marketplace invariants that `claude plugin validate` does not check.
// Thin CLI over scripts/lib/marketplace.mjs (shared with build-index.mjs).
// Usage (from the repo root): node scripts/check-marketplace.mjs [marketplace-root]
import { analyze } from './lib/marketplace.mjs';

const root = process.argv[2] ?? '.';
const { errors, plugins } = analyze(root);

if (errors.length) {
  console.error(errors.map((e) => `✘ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`marketplace invariants ok (${plugins.length} plugins)`);
