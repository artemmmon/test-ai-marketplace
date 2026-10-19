#!/usr/bin/env node
// Marketplace invariants that `claude plugin validate` does not check.
// Usage (from the repo root): node scripts/check-marketplace.mjs [marketplace-root]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? '.';
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const HIDDEN_RE = /[​-‏‪-‮⁠-⁤﻿]/;
const PINNABLE = new Set(['github', 'git-subdir', 'url']);

const errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const marketplace = readJson(join(root, '.claude-plugin/marketplace.json'));
const plugins = marketplace.plugins ?? [];
const names = plugins.map((p) => p.name);

if (names.join('\n') !== [...names].sort().join('\n')) fail('plugins[] must be sorted by name');
for (const dup of new Set(names.filter((n, i) => names.indexOf(n) !== i))) fail(`duplicate plugin name "${dup}"`);

for (const entry of plugins) {
  const name = entry.name;
  if (!NAME_RE.test(name ?? '')) fail(`"${name}": name must match ${NAME_RE}`);
  if (HIDDEN_RE.test(`${name}${entry.description ?? ''}`)) fail(`"${name}": hidden Unicode in name or description`);

  if (typeof entry.source === 'string') {
    checkLocalPlugin(entry, join(root, entry.source));
  } else if (PINNABLE.has(entry.source?.source) && !entry.source.sha && !entry.source.ref) {
    fail(`"${name}": external ${entry.source.source} source must be pinned by sha or ref`);
  }
}

function checkLocalPlugin(entry, dir) {
  const manifestPath = join(dir, '.claude-plugin/plugin.json');
  if (!existsSync(manifestPath)) return fail(`"${entry.name}": ${manifestPath} is missing`);

  const manifest = readJson(manifestPath);
  if (manifest.name !== entry.name) fail(`"${entry.name}": plugin.json name is "${manifest.name}"`);
  if (entry.version && manifest.version && entry.version !== manifest.version) {
    fail(`"${entry.name}": version ${entry.version} in marketplace.json, ${manifest.version} in plugin.json`);
  }

  const skillsDir = join(dir, 'skills');
  if (!existsSync(skillsDir)) return;
  for (const skill of readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const file = join(skillsDir, skill.name, 'SKILL.md');
    if (!existsSync(file)) {
      fail(`"${entry.name}": ${file} is missing`);
      continue;
    }
    const frontmatterName = readFileSync(file, 'utf8').match(/^---\n[\s\S]*?^name:\s*(\S+)\s*$/m)?.[1];
    if (frontmatterName !== skill.name) fail(`${file}: frontmatter name "${frontmatterName}" must equal "${skill.name}"`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✘ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`marketplace invariants ok (${plugins.length} plugins)`);
