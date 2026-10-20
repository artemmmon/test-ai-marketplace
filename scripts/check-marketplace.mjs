#!/usr/bin/env node
// Marketplace invariants that `claude plugin validate` does not check.
// Usage (from the repo root): node scripts/check-marketplace.mjs [marketplace-root] [--require-tags]
//
// Checks every plugin registered in marketplace.json AND every folder under plugins/, so a plugin
// can be verified before it is registered. See docs/specs/sdd-plugins.md, FR-13.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const REQUIRE_TAGS = args.includes('--require-tags');
const root = args.find((a) => !a.startsWith('--')) ?? '.';
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const RESERVED_PREFIX_RE = /^(claude-|anthropic-|cc-plugin-)/;
const HIDDEN_RE = /[​-‏‪-‮⁠-⁤﻿]/;
const PINNABLE = new Set(['github', 'git-subdir', 'url']);
const REQUIRED_DOCS = ['README.md', 'CHANGELOG.md', 'COMPATIBILITY.md'];
const FORBIDDEN_AGENT_KEYS = ['hooks', 'mcpServers', 'permissionMode'];
const COMPONENT_KEYS = ['commands', 'agents', 'skills', 'hooks', 'mcpServers', 'lspServers', 'outputStyles', 'monitors'];
const DOTDOT_RE = /(^|[\\/])\.\.([\\/]|$)/;

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// ---------------------------------------------------------------------------------------------
// Semver: just enough for dependency ranges (exact, =, ^, ~, >=, >, <=, <, space-separated AND).
// ---------------------------------------------------------------------------------------------
const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(text) {
  const m = VERSION_RE.exec(String(text).trim());
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null } : null;
}

function compareVersions(a, b) {
  for (const k of ['major', 'minor', 'patch']) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1;
  if (b.pre === null) return -1;
  return a.pre < b.pre ? -1 : 1;
}

// A comparator is { op, version } with op in >=, >, <=, <, =. Returns null for unsupported syntax.
function parsePartial(text) {
  const m = /^v?(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/.exec(text);
  if (!m) return null;
  const num = (s) => (s === undefined || /[xX*]/.test(s) ? null : +s);
  return { major: +m[1], minor: num(m[2]), patch: num(m[3]) };
}

function parseComparators(token) {
  const m = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(token);
  if (!m) return null;
  const op = m[1] ?? '=';
  const full = parseVersion(m[2]);
  const part = full ?? parsePartial(m[2]);
  if (!part) return null;
  const lower = { major: part.major, minor: part.minor ?? 0, patch: part.patch ?? 0, pre: full?.pre ?? null };
  const next = (major, minor, patch) => ({ major, minor, patch, pre: null });
  if (op === '^') {
    let upper;
    if (lower.major > 0 || part.minor === null) upper = next(lower.major + 1, 0, 0);
    else if (lower.minor > 0 || part.patch === null) upper = next(0, lower.minor + 1, 0);
    else upper = next(0, 0, lower.patch + 1);
    return [{ op: '>=', version: lower }, { op: '<', version: upper }];
  }
  if (op === '~') {
    const upper = part.minor === null ? next(lower.major + 1, 0, 0) : next(lower.major, lower.minor + 1, 0);
    return [{ op: '>=', version: lower }, { op: '<', version: upper }];
  }
  if (op === '=' && !full) {
    // "1" or "1.2" or "1.2.x" behave like a range of the missing parts.
    const upper = part.minor === null ? next(lower.major + 1, 0, 0) : part.patch === null ? next(lower.major, lower.minor + 1, 0) : next(lower.major, lower.minor, lower.patch + 1);
    return [{ op: '>=', version: lower }, { op: '<', version: upper }];
  }
  return [{ op, version: lower }];
}

// Returns true / false, or null when the range uses syntax this script does not understand.
function satisfies(versionText, rangeText) {
  const version = parseVersion(versionText);
  if (!version) return null;
  const range = String(rangeText).trim();
  if (range === '' || range === '*') return true;
  const tokens = range.replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1').split(/\s+/);
  const comparators = [];
  for (const token of tokens) {
    const parsed = parseComparators(token);
    if (!parsed) return null;
    comparators.push(...parsed);
  }
  // A prerelease only satisfies an exact match; ranges never pick prereleases up implicitly.
  if (version.pre !== null) {
    return comparators.length === 1 && comparators[0].op === '=' && compareVersions(version, comparators[0].version) === 0;
  }
  return comparators.every(({ op, version: v }) => {
    const c = compareVersions(version, v);
    return { '>=': c >= 0, '>': c > 0, '<=': c <= 0, '<': c < 0, '=': c === 0 }[op];
  });
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : null;
}

function frontmatterKeys(text) {
  const fm = frontmatter(text);
  if (fm === null) return [];
  return [...fm.matchAll(/^([A-Za-z_][\w-]*)\s*:/gm)].map((m) => m[1]);
}

function frontmatterValue(text, key) {
  const fm = frontmatter(text);
  const raw = fm?.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm'))?.[1];
  return raw === undefined ? undefined : raw.replace(/^(["'])(.*)\1$/, '$2');
}

function walk(dir, visit) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.name === '.git') continue;
    const path = join(dir, d.name);
    visit(path, d);
    if (d.isDirectory() && !d.isSymbolicLink()) walk(path, visit);
  }
}

function stringsIn(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

// ---------------------------------------------------------------------------------------------
// FR-28 forbidden strings. "DevDigest" is allowed only inside a README.md "Sources" section.
// ---------------------------------------------------------------------------------------------
const CONDITIONAL_RE = /\b(if|when|where|whether|exists?|present|optional|optionally|any|unless)\b/i;
const FORBIDDEN = [
  { re: /devdigest/gi, label: '"DevDigest"', allowedInSources: true },
  { re: /(?<![\w./@#-])server\//g, label: 'path "server/"' },
  { re: /(?<![\w./@#-])client\//g, label: 'path "client/"' },
  { re: /reviewer-core/g, label: '"reviewer-core"' },
  { re: /\.claude\/(skills|hooks)\//g, label: 'path ".claude/skills/" or ".claude/hooks/"' },
  { re: /\$\{?CLAUDE_PROJECT_DIR\}?\/\.claude\//g, label: '"$CLAUDE_PROJECT_DIR/.claude/"' },
  { re: /\bpnpm\s+\S/g, label: 'a "pnpm ..." command' },
  { re: /check-changed\.sh/g, label: '"check-changed.sh"' },
  { re: /shared-contracts\.sh/g, label: '"shared-contracts.sh"' },
  { re: /routing\.json/g, label: '"routing.json"' },
];

function scanForbidden(pluginName, dir) {
  walk(dir, (path, d) => {
    if (!d.isFile()) return;
    const buffer = readFileSync(path);
    if (buffer.includes(0)) return;
    const rel = relative(dir, path);
    const isReadme = /(^|\/)README\.md$/.test(rel.split('\\').join('/'));
    const lines = buffer.toString('utf8').split(/\r?\n/);
    let inSources = false;
    let sourcesLevel = 0;
    lines.forEach((line, i) => {
      const heading = isReadme ? /^(#{1,6})\s+(.*?)\s*$/.exec(line) : null;
      if (heading) {
        const level = heading[1].length;
        if (/^sources\b/i.test(heading[2])) {
          inSources = true;
          sourcesLevel = level;
        } else if (inSources && level <= sourcesLevel) inSources = false;
      }
      for (const { re, label, allowedInSources } of FORBIDDEN) {
        for (const m of line.matchAll(re)) {
          if (allowedInSources && inSources && m[0] === 'DevDigest') continue;
          fail(`"${pluginName}": ${rel}:${i + 1}: forbidden ${label}`);
        }
      }
      if (/\b(INSIGHTS|AGENTS)\.md\b/.test(line) && !CONDITIONAL_RE.test(line)) {
        fail(`"${pluginName}": ${rel}:${i + 1}: INSIGHTS.md/AGENTS.md must be optional ("if it exists"), not required`);
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Per-plugin checks
// ---------------------------------------------------------------------------------------------
const plugins = []; // { name, dir, manifest }

function checkPluginDir(dir, entry, folderName) {
  const label = entry?.name ?? folderName;
  const manifestPath = join(dir, '.claude-plugin/plugin.json');
  if (!existsSync(manifestPath)) return fail(`"${label}": ${manifestPath} is missing`);

  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (e) {
    return fail(`"${label}": ${manifestPath} is not valid JSON (${e.message})`);
  }
  const expectedName = entry?.name ?? folderName;
  if (manifest.name !== expectedName) fail(`"${label}": plugin.json name is "${manifest.name}", expected "${expectedName}"`);
  if (!NAME_RE.test(manifest.name ?? '')) fail(`"${label}": plugin.json name must match ${NAME_RE}`);
  if (RESERVED_PREFIX_RE.test(manifest.name ?? '')) fail(`"${label}": name must not start with claude-, anthropic- or cc-plugin-`);
  if (entry?.version && manifest.version && entry.version !== manifest.version) {
    fail(`"${label}": version ${entry.version} in marketplace.json, ${manifest.version} in plugin.json`);
  }
  if (!parseVersion(manifest.version ?? '')) fail(`"${label}": plugin.json version "${manifest.version}" is not semver X.Y.Z`);
  plugins.push({ name: manifest.name ?? label, dir, manifest });

  checkSkills(label, dir);
  checkAgents(label, dir);
  checkDocs(label, dir, manifest);
  checkPaths(label, dir, manifest);
  scanForbidden(label, dir);
}

function checkSkills(label, dir) {
  const skillsDir = join(dir, 'skills');
  if (!existsSync(skillsDir)) return;
  for (const skill of readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const file = join(skillsDir, skill.name, 'SKILL.md');
    if (!existsSync(file)) {
      fail(`"${label}": ${file} is missing`);
      continue;
    }
    const name = frontmatterValue(readFileSync(file, 'utf8'), 'name');
    if (name !== skill.name) fail(`${file}: frontmatter name "${name}" must equal "${skill.name}"`);
  }
}

function checkAgents(label, dir) {
  const agentsDir = join(dir, 'agents');
  if (!existsSync(agentsDir)) return;
  walk(agentsDir, (path, d) => {
    if (!d.isFile() || !path.endsWith('.md')) return;
    const keys = frontmatterKeys(readFileSync(path, 'utf8'));
    for (const key of FORBIDDEN_AGENT_KEYS.filter((k) => keys.includes(k))) {
      fail(`"${label}": ${relative(dir, path)}: frontmatter "${key}" is ignored for plugin agents; move it to the plugin (hooks/hooks.json, .mcp.json)`);
    }
  });
}

function checkDocs(label, dir, manifest) {
  for (const doc of REQUIRED_DOCS) if (!existsSync(join(dir, doc))) fail(`"${label}": ${doc} is missing`);
  const changelog = join(dir, 'CHANGELOG.md');
  if (!existsSync(changelog)) return;
  const versions = [...readFileSync(changelog, 'utf8').matchAll(/^##\s+\[(\d+\.\d+\.\d+[^\]]*)\]/gm)]
    .map((m) => parseVersion(m[1]))
    .filter(Boolean);
  if (!versions.length) return fail(`"${label}": CHANGELOG.md has no "## [x.y.z] - date" release heading`);
  const newest = versions.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
  const newestText = `${newest.major}.${newest.minor}.${newest.patch}${newest.pre ? `-${newest.pre}` : ''}`;
  if (newestText !== manifest.version) fail(`"${label}": newest CHANGELOG version ${newestText} != plugin.json version ${manifest.version}`);
}

function checkPaths(label, dir, manifest) {
  walk(dir, (path, d) => {
    if (d.isSymbolicLink()) fail(`"${label}": ${relative(dir, path)} is a symlink (plugins are copied on their own)`);
  });
  for (const key of COMPONENT_KEYS) {
    for (const value of stringsIn(manifest[key])) {
      if (DOTDOT_RE.test(value)) fail(`"${label}": plugin.json "${key}" contains a ".." path segment: ${value}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Marketplace entries, then every folder under plugins/
// ---------------------------------------------------------------------------------------------
const marketplace = readJson(join(root, '.claude-plugin/marketplace.json'));
const entries = marketplace.plugins ?? [];
const names = entries.map((p) => p.name);

if (names.join('\n') !== [...names].sort().join('\n')) fail('plugins[] must be sorted by name');
for (const dup of new Set(names.filter((n, i) => names.indexOf(n) !== i))) fail(`duplicate plugin name "${dup}"`);

const checkedDirs = new Set();
for (const entry of entries) {
  const name = entry.name;
  if (!NAME_RE.test(name ?? '')) fail(`"${name}": name must match ${NAME_RE}`);
  if (HIDDEN_RE.test(`${name}${entry.description ?? ''}`)) fail(`"${name}": hidden Unicode in name or description`);

  if (typeof entry.source === 'string') {
    if (DOTDOT_RE.test(entry.source)) fail(`"${name}": source "${entry.source}" contains a ".." path segment`);
    const dir = join(root, entry.source);
    checkedDirs.add(resolve(dir));
    checkPluginDir(dir, entry);
  } else if (PINNABLE.has(entry.source?.source) && !entry.source.sha && !entry.source.ref) {
    fail(`"${name}": external ${entry.source.source} source must be pinned by sha or ref`);
  }
}

const pluginsRoot = join(root, 'plugins');
let folderCount = 0;
if (existsSync(pluginsRoot)) {
  for (const d of readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    folderCount++;
    const dir = join(pluginsRoot, d.name);
    if (!checkedDirs.has(resolve(dir))) checkPluginDir(dir, undefined, d.name);
  }
}

// ---------------------------------------------------------------------------------------------
// Dependencies: names exist, ranges are satisfied, no cycles, tags exist
// ---------------------------------------------------------------------------------------------
const byName = new Map(plugins.map((p) => [p.name, p]));
const graph = new Map(); // name -> dependency names
const dependedOn = new Set();

for (const { name, manifest } of plugins) {
  const deps = Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
  graph.set(name, []);
  for (const dep of deps) {
    const depName = typeof dep === 'string' ? dep : dep?.name;
    const range = typeof dep === 'string' ? undefined : dep?.version;
    if (!depName) {
      fail(`"${name}": a dependency has no name`);
      continue;
    }
    const known = byName.get(depName);
    if (!known && !names.includes(depName)) {
      fail(`"${name}": dependency "${depName}" is not a plugin of this marketplace`);
      continue;
    }
    graph.get(name).push(depName);
    dependedOn.add(depName);
    if (!range) {
      warn(`"${name}": dependency "${depName}" has no version range; it will float with every release`);
    } else if (known) {
      const ok = satisfies(known.manifest.version, range);
      if (ok === null) fail(`"${name}": dependency "${depName}" range "${range}" is not understood (use ^ ~ >= or an exact version)`);
      else if (!ok) fail(`"${name}": dependency "${depName}" range "${range}" is not satisfied by its version ${known.manifest.version}`);
    }
  }
}

const state = new Map(); // name -> 1 visiting, 2 done
const trail = [];
function visit(node) {
  if (state.get(node) === 2) return;
  if (state.get(node) === 1) return fail(`dependency cycle: ${[...trail.slice(trail.indexOf(node)), node].join(' -> ')}`);
  state.set(node, 1);
  trail.push(node);
  for (const next of graph.get(node) ?? []) visit(next);
  trail.pop();
  state.set(node, 2);
}
for (const name of graph.keys()) visit(name);

// Tags: <plugin>--v<version> for every plugin that something depends on. Warning until the first
// release, error with --require-tags. Skipped outside a git repository.
const inGit = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
if (inGit.status === 0 && inGit.stdout.trim() === 'true') {
  const report = REQUIRE_TAGS ? fail : warn;
  for (const name of [...dependedOn].sort()) {
    const target = byName.get(name);
    if (!target?.manifest.version) continue;
    const tag = `${name}--v${target.manifest.version}`;
    const out = spawnSync('git', ['-C', root, 'tag', '--list', tag], { encoding: 'utf8' });
    if (out.status === 0 && !out.stdout.split('\n').includes(tag)) report(`git tag "${tag}" does not exist (create it with: claude plugin tag plugins/${name} --push)`);
  }
}

if (warnings.length) console.warn(warnings.map((w) => `! ${w}`).join('\n'));
if (errors.length) {
  console.error(errors.map((e) => `✘ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`marketplace invariants ok (${entries.length} registered, ${folderCount} plugin folders)`);
