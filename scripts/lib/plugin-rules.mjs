// Plugin content rules of the strict check (spec sdd-plugins FR-13, FR-28). Used by check-marketplace.mjs only.
//
// Unlike analyze() (shared with build-index.mjs, which opens just marketplace.json and a fixed set of files per
// plugin), these rules walk the WHOLE plugin folder: forbidden strings, symlinks and scoped references need
// every file. They never run in the indexer, so the generator keeps its narrow read boundary.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readGitTags } from './git.mjs';
import { isValidVersion } from './semver.mjs';

const RESERVED_PREFIX_RE = /^(claude-|anthropic-|cc-plugin-)/;
const FORBIDDEN_AGENT_KEYS = ['hooks', 'mcpServers', 'permissionMode'];
const COMPONENT_KEYS = ['commands', 'agents', 'skills', 'hooks', 'mcpServers', 'lspServers', 'outputStyles', 'monitors'];
const DOTDOT_RE = /(^|[\\/])\.\.([\\/]|$)/;
const SCOPED_FILE_RE = /^(agents\/.+\.md|skills\/.+\.md|hooks\/[^/]+\.json|scripts\/[^/]+\.mjs|README\.md)$/;

/** Warning codes (set by lib/marketplace.mjs) that the strict check reports as errors, as FR-13 requires. */
export const STRICT_CODES = new Set(['docs-missing', 'changelog-version-mismatch', 'dependency-not-in-catalog']);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Recursively visits every entry of `dir` (never descends into symlinks or .git). */
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
  else if (isObject(value)) Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

/** Lines of a text file, or null for a binary file. */
function textLines(path) {
  const buffer = readFileSync(path);
  return buffer.includes(0) ? null : buffer.toString('utf8').split(/\r?\n/);
}

// FR-28 forbidden strings. The plugins are public and must not be tied to the project they were extracted
// from: its name is banned in every text file. This marketplace's own install command does not match any rule.
const CONDITIONAL_RE = /\b(if|when|where|whether|exists?|present|optional|optionally|any|unless)\b/i;
const FORBIDDEN = [
  { re: /dev[ -]?digest/gi, label: '"DevDigest" / "dev-digest" / "dev digest" (the source project must not be named)' },
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

/** Warnings from the loader that the strict check reports as errors (message unchanged). */
export function strictErrors(warnings) {
  return warnings.filter((w) => STRICT_CODES.has(w.code)).map((w) => w.message);
}

/**
 * Runs the strict plugin rules over an analyze() result.
 * @param {{ marketplace: object|null, plugins: Array<object> }} data result of analyze(root, { includeUnregistered: true })
 * @param {{ root: string, requireTags?: boolean }} opts
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkPluginRules(data, { root, requireTags = false }) {
  const errors = [];
  const warnings = [];
  const fail = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!data.marketplace) return { errors, warnings };

  for (const entry of data.marketplace.plugins ?? []) {
    if (typeof entry.source === 'string' && DOTDOT_RE.test(entry.source)) fail(`"${entry.name}": source "${entry.source}" contains a ".." path segment`);
  }
  for (const p of data.plugins) {
    if (RESERVED_PREFIX_RE.test(p.name ?? '')) fail(`"${p.name}": name must not start with claude-, anthropic- or cc-plugin-`);
  }

  const allNames = [...new Set(data.plugins.map((p) => p.name))].filter(Boolean);
  for (const p of data.plugins.filter((x) => x.source === 'local')) {
    checkManifestPaths(p, fail);
    checkAgentKeys(p, fail);
    checkChangelogHeading(p, fail);
    checkFiles(p, allNames, fail, warn);
  }
  checkTags(data, root, requireTags, requireTags ? fail : warn);
  return { errors, warnings };
}

function checkManifestPaths(p, fail) {
  for (const key of COMPONENT_KEYS) {
    for (const value of stringsIn(p.manifest[key])) {
      if (DOTDOT_RE.test(value)) fail(`"${p.name}": plugin.json "${key}" contains a ".." path segment: ${value}`);
    }
  }
}

function checkAgentKeys(p, fail) {
  for (const agent of p.agents) {
    for (const key of FORBIDDEN_AGENT_KEYS.filter((k) => Object.hasOwn(agent.frontmatter, k))) {
      fail(`"${p.name}": ${agent.path.slice(p.repoPath.length + 1)}: frontmatter "${key}" is ignored for plugin agents; move it to the plugin (hooks/hooks.json, .mcp.json)`);
    }
  }
}

function checkChangelogHeading(p, fail) {
  if (p.changelog && !p.changelog.sections.some((s) => isValidVersion(s.version))) {
    fail(`"${p.name}": CHANGELOG.md has no "## [x.y.z] - date" release heading`);
  }
}

/** One walk over the plugin folder: symlinks, FR-28 strings, scoped references to other plugins. */
function checkFiles(p, allNames, fail, warn) {
  const { name, dir } = p;
  if (!existsSync(dir)) return;
  const others = allNames.filter((n) => n !== name);
  const scoped = others.length ? new RegExp(`(?<![\\w-])(${others.map(escapeRe).join('|')}):([A-Za-z][\\w-]*)`, 'g') : null;
  const declared = new Set(p.dependencies.map((d) => d.name));
  const used = new Set();
  const reported = new Set();

  walk(dir, (path, d) => {
    const rel = relative(dir, path).split('\\').join('/');
    if (d.isSymbolicLink()) fail(`"${name}": ${rel} is a symlink (plugins are copied on their own)`);
    if (!d.isFile()) return;
    const lines = textLines(path);
    if (!lines) return;
    const scan = scoped && SCOPED_FILE_RE.test(rel);
    lines.forEach((line, i) => {
      for (const { re, label } of FORBIDDEN) {
        if (re.test(line)) fail(`"${name}": ${rel}:${i + 1}: forbidden ${label}`);
        re.lastIndex = 0;
      }
      if (/\b(INSIGHTS|AGENTS)\.md\b/.test(line) && !CONDITIONAL_RE.test(line)) {
        fail(`"${name}": ${rel}:${i + 1}: INSIGHTS.md/AGENTS.md must be optional ("if it exists"), not required`);
      }
      if (!scan) return;
      for (const m of line.matchAll(scoped)) {
        used.add(m[1]);
        const ref = `${m[1]}:${m[2]}`;
        if (declared.has(m[1]) || reported.has(ref)) continue;
        reported.add(ref);
        fail(`"${name}": uses ${ref} but ${m[1]} is not in dependencies (${rel}:${i + 1})`);
      }
    });
  });
  for (const dep of declared) {
    if (!used.has(dep)) warn(`"${name}": dependency "${dep}" is declared but never referenced as ${dep}:<component>`);
  }
}

/**
 * Tag <plugin>--v<version> for every local plugin that another plugin depends on: a warning until the first
 * release, an error with --require-tags. Skipped outside a git checkout.
 */
function checkTags(data, root, requireTags, report) {
  const tags = readGitTags(root);
  if (tags === null) return;
  const have = new Set(tags.map((t) => t.name));
  const byName = new Map(data.plugins.map((p) => [p.name, p]));
  const dependedOn = new Set(data.plugins.flatMap((p) => p.dependencies.map((d) => d.name)));
  for (const depName of [...dependedOn].sort()) {
    const target = byName.get(depName);
    if (target?.source !== 'local' || !target.version) continue;
    const tag = `${depName}--v${target.version}`;
    if (!have.has(tag)) report(`git tag "${tag}" does not exist (create it with: claude plugin tag plugins/${depName} --push)`);
  }
}
