#!/usr/bin/env node
// Marketplace invariants that `claude plugin validate` does not check.
// Thin CLI over scripts/lib/marketplace.mjs (shared with build-index.mjs) plus the strict plugin rules of
// scripts/lib/plugin-rules.mjs (sdd-plugins FR-13), which only this CLI runs.
// Usage (from the repo root): node scripts/check-marketplace.mjs [marketplace-root] [--require-tags]
//
// Checks every plugin registered in marketplace.json AND every folder under plugins/, so a plugin can be
// verified before it is registered. Warnings of the strict rules go to stderr; they do not fail the run.
import { analyze } from './lib/marketplace.mjs';
import { checkPluginRules, strictErrors } from './lib/plugin-rules.mjs';

const args = process.argv.slice(2);
const requireTags = args.includes('--require-tags');
const root = args.find((a) => !a.startsWith('--')) ?? '.';

const data = analyze(root, { includeUnregistered: true });
const rules = checkPluginRules(data, { root, requireTags });
const errors = [...data.errors, ...strictErrors(data.warnings), ...rules.errors];

if (rules.warnings.length) console.warn(rules.warnings.map((w) => `! ${w}`).join('\n'));
if (errors.length) {
  console.error(errors.map((e) => `✘ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`marketplace invariants ok (${data.plugins.length} plugins)`);
