// Loads a marketplace checkout and validates it (spec FR-12, FR-19). Shared by check-marketplace.mjs
// and build-index.mjs.
//
// Reads ONLY .claude-plugin/marketplace.json and, per local plugin, plugins/<name>/:
//   .claude-plugin/plugin.json, README.md, CHANGELOG.md, COMPATIBILITY.md, skills/*/SKILL.md,
//   agents/*.md, commands/*.md, hooks/hooks.json, .mcp.json and the file names in bin/ and next to
//   each SKILL.md. Nothing else (no .claude/, docs/, site/, evals/, scripts/, references/...) is opened.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parseChangelog } from './changelog.mjs';
import { FrontmatterError, normalizeNewlines, parseFrontmatter } from './frontmatter.mjs';
import { byString, COMPONENT_NAME_RE, componentId, HOOK_NAME, MCP_NAME } from './ids.mjs';
import { computeReleases } from './releases.mjs';
import { compareVersions, isValidVersion, parseRange, satisfies } from './semver.mjs';
import { collapseWhitespace, firstLine } from './text.mjs';

export const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const HIDDEN_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;
const PINNABLE = new Set(['github', 'git-subdir', 'url']);
const INLINE_KEYS = ['hooks', 'mcpServers', 'commands', 'agents', 'skills'];

const readText = (path) => normalizeNewlines(readFileSync(path, 'utf8'));
const readJson = (path) => JSON.parse(readText(path));
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Sorted directory entries (deterministic order), symlinks are skipped on purpose. */
function listDir(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => byString(a.name, b.name));
}

/** Collects errors (strings) and warnings ({file, message}) while loading. */
function diagnostics() {
  const errors = [];
  const warnings = [];
  return {
    errors,
    warnings,
    fail: (msg) => errors.push(msg),
    warn: (file, message) => warnings.push({ file, message }),
  };
}

/**
 * Loads and normalizes the marketplace. Problems found on the way are returned in `errors` / `warnings`.
 * @param {string} root repository root (default '.')
 */
export function loadMarketplace(root = '.') {
  const d = diagnostics();
  const marketplacePath = join(root, '.claude-plugin/marketplace.json');
  const result = { root, marketplace: null, plugins: [], errors: d.errors, warnings: d.warnings };

  if (!existsSync(marketplacePath)) {
    d.fail(`${marketplacePath} is missing`);
    return result;
  }
  let marketplace;
  try {
    marketplace = readJson(marketplacePath);
  } catch (e) {
    d.fail(`${marketplacePath}: invalid JSON (${e.message})`);
    return result;
  }
  if (!isObject(marketplace)) {
    d.fail(`${marketplacePath}: must be a JSON object`);
    return result;
  }
  result.marketplace = marketplace;

  if (typeof marketplace.name !== 'string' || marketplace.name.trim() === '') d.fail(`${marketplacePath}: "name" is required`);
  if (marketplace.plugins !== undefined && !Array.isArray(marketplace.plugins)) {
    d.fail(`${marketplacePath}: "plugins" must be an array`);
    return result;
  }
  const entries = marketplace.plugins ?? [];
  const names = entries.map((p) => p.name);

  if (names.join('\n') !== [...names].sort().join('\n')) d.fail('plugins[] must be sorted by name');
  for (const dup of new Set(names.filter((n, i) => names.indexOf(n) !== i))) d.fail(`duplicate plugin name "${dup}"`);

  for (const entry of entries) {
    const name = entry.name;
    if (!NAME_RE.test(name ?? '')) d.fail(`"${name}": name must match ${NAME_RE}`);
    if (HIDDEN_RE.test(`${name}${entry.description ?? ''}`)) d.fail(`"${name}": hidden Unicode in name or description`);

    if (typeof entry.source === 'string') {
      const record = loadLocalPlugin(root, entry, d);
      if (record) result.plugins.push(record);
    } else {
      if (PINNABLE.has(entry.source?.source) && !entry.source.sha && !entry.source.ref) {
        d.fail(`"${name}": external ${entry.source.source} source must be pinned by sha or ref`);
      }
      result.plugins.push(externalRecord(entry, d));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// External plugins: only the metadata of the marketplace entry is used (FR-25).

function externalRecord(entry, d) {
  const src = isObject(entry.source) ? entry.source : {};
  let kind = src.source;
  let url = '';
  if (kind === 'github') {
    url = `https://github.com/${String(src.repo ?? '').replace(/\.git$/, '')}`;
  } else if (kind === 'git-subdir' || kind === 'url') {
    url = String(src.url ?? '');
    if (kind === 'git-subdir' && url && !/^[a-z][a-z0-9+.-]*:|^git@/i.test(url)) url = `https://github.com/${url.replace(/\.git$/, '')}`;
  } else {
    d.warn(null, `"${entry.name}": unsupported source type "${kind}", it is shown as a plain link`);
    kind = 'url';
    url = String(src.url ?? src.repo ?? src.package ?? '');
  }
  return {
    name: entry.name,
    entry,
    source: 'external',
    version: typeof entry.version === 'string' ? entry.version : null,
    external: { kind, url, ref: src.ref ?? null, sha: src.sha ?? null, path: kind === 'git-subdir' ? (src.path ?? null) : null },
    dependencies: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Local plugins

function loadLocalPlugin(root, entry, d) {
  const name = entry.name;
  const repoPath = posix.normalize(entry.source.replace(/\\/g, '/')).replace(/^\.\//, '').replace(/\/+$/, '');
  if (repoPath === '..' || repoPath.startsWith('../') || repoPath.startsWith('/') || !repoPath.startsWith('plugins/')) {
    d.fail(`"${name}": source "${entry.source}" must be a path inside ./plugins/`);
    return null;
  }
  const dir = join(root, entry.source);
  const manifestPath = join(dir, '.claude-plugin/plugin.json');
  if (!existsSync(manifestPath)) {
    d.fail(`"${name}": ${manifestPath} is missing`);
    return null;
  }
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (e) {
    d.fail(`${manifestPath}: invalid JSON (${e.message})`);
    return null;
  }
  if (!isObject(manifest)) {
    d.fail(`${manifestPath}: must be a JSON object`);
    return null;
  }

  if (manifest.name !== name) d.fail(`"${name}": plugin.json name is "${manifest.name}"`);
  if (entry.version && manifest.version && entry.version !== manifest.version) {
    d.fail(`"${name}": version ${entry.version} in marketplace.json, ${manifest.version} in plugin.json`);
  }

  const record = {
    name,
    entry,
    source: 'local',
    dir,
    repoPath,
    manifest,
    version: null,
    docs: {},
    changelog: null,
    compat: null,
    skills: [],
    agents: [],
    commands: [],
    hook: null,
    mcp: null,
    bin: [],
    inlineKeys: INLINE_KEYS.filter((k) => manifest[k] !== undefined),
    dependencies: [],
  };
  const manifestRepoPath = posix.join(repoPath, '.claude-plugin/plugin.json');

  if (typeof manifest.version !== 'string' || manifest.version.trim() === '') {
    d.fail(`"${name}": plugin.json has no "version" (bump it on every change)`);
  } else if (!isValidVersion(manifest.version)) {
    d.fail(`"${name}": plugin.json version "${manifest.version}" is not a valid semantic version (x.y.z)`);
  } else {
    record.version = manifest.version;
  }
  record.dependencies = parseDependencies(name, manifest, manifestPath, d);

  for (const key of record.inlineKeys) {
    const runs = key === 'hooks' || key === 'mcpServers' ? '; the plugin is marked as executing code' : '';
    d.warn(manifestRepoPath, `"${name}": plugin.json declares "${key}" inline or with custom paths, its content is not indexed${runs}`);
  }

  loadDocs(record, d);
  loadSkills(record, d);
  loadMarkdownDir(record, 'agent', 'agents', d);
  loadMarkdownDir(record, 'command', 'commands', d);
  loadHooks(record, d);
  loadMcp(record, d);
  loadBin(record);
  return record;
}

function parseDependencies(name, manifest, manifestPath, d) {
  const deps = manifest.dependencies;
  if (deps === undefined) return [];
  if (!Array.isArray(deps)) {
    d.fail(`"${name}": ${manifestPath}: "dependencies" must be an array of { "name", "version" } objects`);
    return [];
  }
  const out = [];
  deps.forEach((dep, i) => {
    if (!isObject(dep) || typeof dep.name !== 'string' || typeof dep.version !== 'string') {
      d.fail(`"${name}": ${manifestPath}: dependencies[${i}] must be { "name": string, "version": string }`);
    } else {
      out.push({ name: dep.name, range: dep.version });
    }
  });
  return out;
}

function loadDocs(record, d) {
  const { name, dir, repoPath } = record;
  const files = [
    ['readme', 'README.md'],
    ['changelog', 'CHANGELOG.md'],
    ['compat', 'COMPATIBILITY.md'],
  ];
  for (const [key, file] of files) {
    const path = join(dir, file);
    if (existsSync(path)) record.docs[key] = readText(path);
    else d.warn(posix.join(repoPath, file), `"${name}": ${file} is missing, the site shows "Not provided"`);
  }
  const clFile = posix.join(repoPath, 'CHANGELOG.md');
  if (record.docs.changelog !== undefined) {
    record.changelog = parseChangelog(record.docs.changelog);
    for (const s of record.changelog.skipped) {
      d.warn(clFile, `"${name}": ${clFile}:${s.line}: ${s.reason} "${s.heading}", the section is skipped`);
    }
    const versions = record.changelog.sections.map((s) => s.version).filter(isValidVersion);
    if (versions.length && record.version) {
      const newest = versions.reduce((a, b) => (compareVersions(b, a) > 0 ? b : a));
      if (newest !== record.version) {
        d.warn(clFile, `"${name}": the newest CHANGELOG.md version is ${newest}, plugin.json says ${record.version}`);
      }
    }
  }
  if (record.docs.compat !== undefined) {
    const claudeCode = extractClaudeCodeRange(record.docs.compat);
    record.compat = { claudeCode };
    if (claudeCode === null) {
      d.warn(posix.join(repoPath, 'COMPATIBILITY.md'), `"${name}": COMPATIBILITY.md has no "Claude Code <range>" line, claudeCode is null`);
    }
  }
}

const COMPAT_RE =
  /Claude\s+Code\s+(?:version\s*)?:?\s*((?:(?:>=|<=|>|<|=|\^|~)\s*)?v?\d+\.\d+(?:\.\d+)?(?:\s+(?:>=|<=|>|<)\s*v?\d+\.\d+(?:\.\d+)?)*)/i;

/**
 * Extracts the version range from the line "Claude Code <range>" of COMPATIBILITY.md.
 * Also understands "Minimum Claude Code version: 2.1.269"; a bare version means ">= that version".
 * @returns {string | null} e.g. ">=2.1.110"
 */
export function extractClaudeCodeRange(markdown) {
  const m = COMPAT_RE.exec(markdown);
  if (!m) return null;
  const parts = m[1].replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').trim().split(/\s+/);
  const normalized = parts.map((p) => {
    const mm = /^(>=|<=|>|<|=|\^|~)?v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(p);
    return `${mm[1] ?? ''}${mm[2]}.${mm[3]}.${mm[4] ?? '0'}`;
  });
  if (normalized.length === 1 && /^\d/.test(normalized[0])) normalized[0] = `>=${normalized[0]}`;
  return normalized.join(' ');
}

/** Parses frontmatter, reporting a parse error as a validation error. Returns null on failure. */
function readMarkdown(file, repoFile, d) {
  try {
    return parseFrontmatter(readText(file));
  } catch (e) {
    if (e instanceof FrontmatterError) {
      d.fail(`${file}:${e.line}: ${e.message}`);
      return null;
    }
    throw e;
  }
}

const stringOrNull = (v) => (typeof v === 'string' && v.trim() !== '' ? collapseWhitespace(v) : null);

function loadSkills(record, d) {
  const { name, dir, repoPath } = record;
  const skillsDir = join(dir, 'skills');
  if (!existsSync(skillsDir)) return;
  for (const skill of listDir(skillsDir).filter((e) => e.isDirectory())) {
    const file = join(skillsDir, skill.name, 'SKILL.md');
    if (!existsSync(file)) {
      d.fail(`"${name}": ${file} is missing`);
      continue;
    }
    const repoFile = posix.join(repoPath, 'skills', skill.name, 'SKILL.md');
    const parsed = readMarkdown(file, repoFile, d);
    if (!parsed) continue;
    const fmName = parsed.data.name;
    if (String(fmName) !== skill.name) d.fail(`${file}: frontmatter name "${fmName}" must equal "${skill.name}"`);
    if (!COMPONENT_NAME_RE.test(skill.name)) d.fail(`${file}: skill name "${skill.name}" must match ${COMPONENT_NAME_RE}`);
    const description = stringOrNull(parsed.data.description);
    if (!description) d.fail(`${file}: frontmatter "description" is required`);
    record.skills.push({
      type: 'skill',
      name: skill.name,
      path: repoFile,
      description: description ?? '',
      frontmatter: parsed.data,
      body: parsed.body,
      files: listSkillFiles(join(skillsDir, skill.name), posix.join(repoPath, 'skills', skill.name)),
    });
  }
}

/** Names (not contents) of the other files in a skill directory, repo-relative. */
function listSkillFiles(dir, repoDir, sub = '') {
  const out = [];
  for (const e of listDir(join(dir, sub))) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'evals') continue;
    const rel = sub ? `${sub}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listSkillFiles(dir, repoDir, rel));
    else if (e.isFile() && rel !== 'SKILL.md') out.push(`${repoDir}/${rel}`);
  }
  return out;
}

/** agents/*.md and commands/*.md */
function loadMarkdownDir(record, type, dirName, d) {
  const { name, dir, repoPath } = record;
  const base = join(dir, dirName);
  if (!existsSync(base)) return;
  for (const e of listDir(base).filter((x) => x.isFile() && x.name.endsWith('.md') && !x.name.startsWith('.'))) {
    const file = join(base, e.name);
    const repoFile = posix.join(repoPath, dirName, e.name);
    const parsed = readMarkdown(file, repoFile, d);
    if (!parsed) continue;
    const fileName = e.name.slice(0, -'.md'.length);
    let componentName = fileName;
    let description = stringOrNull(parsed.data.description);

    if (type === 'agent') {
      const fmName = stringOrNull(parsed.data.name);
      if (fmName) componentName = fmName;
      else d.warn(repoFile, `"${name}": ${repoFile}: frontmatter "name" is missing, using the file name "${fileName}"`);
      if (!description) d.fail(`${file}: frontmatter "description" is required`);
    } else if (!description) {
      description = firstLine(parsed.body, 160) || null;
      d.warn(repoFile, `"${name}": ${repoFile}: frontmatter "description" is missing, using the first line of the body`);
    }
    if (!COMPONENT_NAME_RE.test(componentName)) d.fail(`${file}: ${type} name "${componentName}" must match ${COMPONENT_NAME_RE}`);
    record[`${type}s`].push({
      type,
      name: componentName,
      path: repoFile,
      description: description ?? '',
      frontmatter: parsed.data,
      body: parsed.body,
    });
  }
}

function loadJsonFile(record, relFile, d) {
  const file = join(record.dir, relFile);
  if (!existsSync(file)) return null;
  const raw = readText(file);
  try {
    return { raw, json: JSON.parse(raw), path: posix.join(record.repoPath, relFile) };
  } catch (e) {
    d.fail(`${file}: invalid JSON (${e.message})`);
    return null;
  }
}

function loadHooks(record, d) {
  const file = loadJsonFile(record, 'hooks/hooks.json', d);
  if (!file) return;
  const hooks = isObject(file.json) ? file.json.hooks : undefined;
  let events = [];
  if (isObject(hooks)) events = Object.keys(hooks);
  else d.warn(file.path, `"${record.name}": ${file.path} has no "hooks" object, events is empty`);
  record.hook = { type: 'hook', name: HOOK_NAME, path: file.path, raw: file.raw, events };
}

function transportOf(server) {
  const type = isObject(server) ? server.type : undefined;
  if (type === 'stdio' || type === 'http' || type === 'sse') return type;
  if (type === 'streamable-http') return 'http';
  if (isObject(server) && typeof server.command === 'string') return 'stdio';
  return 'unknown';
}

function loadMcp(record, d) {
  const file = loadJsonFile(record, '.mcp.json', d);
  if (!file) return;
  const servers = isObject(file.json) ? file.json.mcpServers : undefined;
  let list = [];
  if (isObject(servers)) {
    list = Object.keys(servers).map((serverName) => {
      const s = servers[serverName];
      const transport = transportOf(s);
      return {
        name: serverName,
        transport,
        command: transport === 'stdio' && typeof s?.command === 'string' ? s.command : null,
        url: transport !== 'stdio' && typeof s?.url === 'string' ? s.url : null,
      };
    });
  } else {
    d.warn(file.path, `"${record.name}": ${file.path} has no "mcpServers" object, servers is empty`);
  }
  record.mcp = { type: 'mcp', name: MCP_NAME, path: file.path, raw: file.raw, servers: list };
}

function loadBin(record) {
  const dir = join(record.dir, 'bin');
  if (!existsSync(dir)) return;
  record.bin = listDir(dir)
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

// ---------------------------------------------------------------------------------------------
// Cross-plugin checks: ids, dependencies, cycles, releases.

/** Components of a local record in a stable order: skill, agent, command, hook, mcp. */
export function componentsOf(record) {
  return [...record.skills, ...record.agents, ...record.commands, ...(record.hook ? [record.hook] : []), ...(record.mcp ? [record.mcp] : [])];
}

function resolveDependencies(plugins, d) {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  for (const p of plugins) p.usedBy = [];

  for (const p of plugins) {
    p.resolved = [];
    for (const dep of p.dependencies) {
      let valid = true;
      try {
        parseRange(dep.range);
      } catch {
        valid = false;
        d.fail(`"${p.name}": dependency "${dep.name}": unsupported version range "${dep.range}" (supported: 1.2.3, ^1.2.3, ~1.2.3, >=1.2.3, ">=1.0.0 <2.0.0", *)`);
      }
      const target = byName.get(dep.name);
      if (!target) {
        d.warn(p.source === 'local' ? posix.join(p.repoPath, '.claude-plugin/plugin.json') : null, `"${p.name}": dependency "${dep.name}" is not in the catalog (status not-in-catalog)`);
        p.resolved.push({ name: dep.name, range: dep.range, resolvedVersion: null, status: 'not-in-catalog' });
        continue;
      }
      target.usedBy.push(p.name);
      if (valid && target.version && isValidVersion(target.version) && !satisfies(target.version, dep.range)) {
        d.fail(`"${p.name}": dependency "${dep.name}" ${dep.range} is not satisfied by ${dep.name} ${target.version}`);
      }
      p.resolved.push({ name: dep.name, range: dep.range, resolvedVersion: target.version, status: 'satisfied' });
    }
  }
  for (const p of plugins) p.usedBy = [...new Set(p.usedBy)].sort(byString);

  // Cycle detection (DFS over dependencies that exist in the catalog).
  const state = new Map(); // name -> 1 visiting | 2 done
  const stack = [];
  const reported = new Set();
  const visit = (name) => {
    state.set(name, 1);
    stack.push(name);
    for (const dep of byName.get(name).dependencies) {
      if (!byName.has(dep.name)) continue;
      if (state.get(dep.name) === 1) {
        const cycle = [...stack.slice(stack.indexOf(dep.name)), dep.name];
        const key = [...cycle.slice(0, -1)].sort().join(',');
        if (!reported.has(key)) {
          reported.add(key);
          d.fail(`dependency cycle: ${cycle.join(' -> ')}`);
        }
      } else if (!state.has(dep.name)) {
        visit(dep.name);
      }
    }
    stack.pop();
    state.set(name, 2);
  };
  for (const p of plugins) if (!state.has(p.name)) visit(p.name);
}

function checkDuplicateIds(plugins, d) {
  const seen = new Set();
  const done = new Set(); // a duplicate plugin name is reported once, not again as duplicate ids
  for (const p of plugins) {
    if (p.source !== 'local' || done.has(p.name)) continue;
    done.add(p.name);
    for (const c of componentsOf(p)) {
      const id = componentId(p.name, c.type, c.name);
      if (seen.has(id)) d.fail(`duplicate id "${id}" (${c.path})`);
      seen.add(id);
    }
  }
}

/**
 * Loads, validates and resolves the marketplace.
 * @param {string} root
 * @param {{ tags?: Array<{name: string, date: string|null, commit: string|null}> }} [opts] git tags for the release checks
 */
export function analyze(root = '.', { tags = [] } = {}) {
  const loaded = loadMarketplace(root);
  const d = { errors: loaded.errors, warnings: loaded.warnings, fail: (m) => loaded.errors.push(m), warn: (file, message) => loaded.warnings.push({ file, message }) };
  let releases = [];
  if (loaded.marketplace) {
    checkDuplicateIds(loaded.plugins, d);
    resolveDependencies(loaded.plugins, d);
    const computed = computeReleases(loaded.plugins, tags);
    releases = computed.releases;
    loaded.warnings.push(...computed.warnings);
  }
  return { ...loaded, releases };
}

/**
 * Validates a marketplace checkout.
 * @returns {{ errors: string[], warnings: Array<{file: string|null, message: string}> }}
 */
export function validate(root = '.', opts = {}) {
  const { errors, warnings } = analyze(root, opts);
  return { errors, warnings };
}
