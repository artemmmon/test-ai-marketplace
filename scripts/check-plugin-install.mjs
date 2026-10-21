#!/usr/bin/env node
// Install check: adds the marketplace to a throw-away Claude Code profile, installs a plugin with its dependencies,
// runs `claude plugin list --json` and fails if the install is not clean.
// Usage (from the repo root): node scripts/check-plugin-install.mjs [source] [--plugin <name>] [--root <dir>]
//                                                                  [--claude <command>] [--keep]
//   source    what `claude plugin marketplace add` gets: a path (default ".") or owner/repo or an https URL
//   --plugin  plugin to install (default sdd-engineering); its dependencies are read from plugin.json
//   --root    checkout whose marketplace.json and plugin.json files give the expected versions
//             (default: the source if it is a directory, else ".")
//   --claude  the claude executable (default "claude")
//   --keep    keep the throw-away profile and project directory and print where they are
//
// Needs no model credentials: marketplace add, install and list never call the model. The profile is a fresh
// CLAUDE_CONFIG_DIR, so nothing of the real configuration is read or written.
//
// What `claude plugin list --json` reports (observed with Claude Code 2.1.304 and 2.1.306): one object per installed
// plugin with id, version, scope, enabled, installPath, ... A plugin that loaded with a problem also carries
//   "errors":       ["Requires \"research-tools@test-ai-marketplace\" ^9.0.0, installed 1.0.0"]
//   "errorDetails": [{ "type": "dependency-version-unsatisfied", "plugin": "sdd-engineering", "dependency": "..." }]
// and "notes"/"noteDetails" for advisory messages. The keys are omitted when there is nothing to report. Types seen:
// dependency-unsatisfied (dependency disabled or missing) and dependency-version-unsatisfied (installed version outside
// the range). `range-conflict` and `no-matching-tag` are reasons an install is refused, so they show up as a failing
// `claude plugin install`, not in the list; this script fails on that as well.
//
// Coverage: dependency ranges against the versions the marketplace offers, enabled state, the exact versions of the
// plugin and its dependencies. Tags `<plugin>--v<version>` are consulted by Claude Code only when the marketplace is
// added from GitHub (owner/repo or an https URL), not from a local path, so `no-matching-tag` can only be reproduced
// with such a source; that form tests the remote, not the working copy.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadMarketplace } from './lib/marketplace.mjs';

const USAGE = 'usage: node scripts/check-plugin-install.mjs [source] [--plugin <name>] [--root <dir>] [--claude <command>] [--keep]';
const DEFAULT_PLUGIN = 'sdd-engineering';
const STEP_TIMEOUT_MS = 180_000;

/**
 * The plugin and, transitively, its dependencies, each with the version in its plugin.json.
 * @param {ReturnType<typeof loadMarketplace>} data
 * @returns {{ name: string, version: string }[]} the plugin first, then the dependencies in discovery order
 */
export function expectedPlugins(data, pluginName) {
  const byName = new Map(data.plugins.map((p) => [p.name, p]));
  const out = [];
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const p = byName.get(name);
    if (!p) throw new Error(`plugin "${name}" is not in the marketplace`);
    if (!p.version) throw new Error(`plugin "${name}" has no version in plugin.json`);
    out.push({ name, version: p.version });
    for (const dep of p.dependencies) visit(dep.name);
  };
  visit(pluginName);
  return out;
}

// A plugin read from a git checkout can be listed as "<version>-<12 hex>" (observed for dependencies of a marketplace
// added from a local git checkout); the part before the dash is still the manifest version.
const versionMatches = (listed, expected) => listed === expected || new RegExp(`^${expected.replace(/\./g, '\\.')}-[0-9a-f]{12}$`).test(listed);

/**
 * Pure check of the parsed output of `claude plugin list --json`.
 * @param {unknown} list
 * @param {{ name: string, version: string }[]} expected plugins that must be installed and enabled
 * @param {string} marketplace marketplace name (the part after "@" in a plugin id)
 * @returns {string[]} problems, empty when the install is clean
 */
export function checkPluginList(list, expected, marketplace) {
  if (!Array.isArray(list)) return ['`claude plugin list --json` did not print a JSON array'];
  const problems = [];

  // 1. Errors reported by Claude Code, on any listed plugin.
  for (const entry of list) {
    const id = entry?.id ?? '(entry without id)';
    const messages = Array.isArray(entry?.errors) ? entry.errors : [];
    const details = Array.isArray(entry?.errorDetails) ? entry.errorDetails : [];
    const n = Math.max(messages.length, details.length);
    for (let i = 0; i < n; i++) {
      const type = details[i]?.type;
      const message = messages[i];
      const label = type ? `[${type}] ` : '';
      problems.push(`${id}: ${label}${message ?? `reported by Claude Code${details[i]?.dependency ? ` (dependency ${details[i].dependency})` : ''}`}`);
    }
  }

  // 2. The plugin and its dependencies are all there, enabled, at their manifest versions.
  for (const { name, version } of expected) {
    const id = `${name}@${marketplace}`;
    const entries = list.filter((e) => e?.id === id);
    if (entries.length === 0) {
      problems.push(`${id}: not in the list (expected ${version})`);
      continue;
    }
    for (const entry of entries) {
      if (entry.enabled !== true) problems.push(`${id}: not enabled`);
      if (typeof entry.version !== 'string' || !versionMatches(entry.version, version)) {
        problems.push(`${id}: version ${JSON.stringify(entry.version)} is listed, plugin.json says ${version}`);
      }
    }
  }
  return problems;
}

/** Runs one claude command; throws an Error with the command and its output when it cannot run or exits non-zero. */
function runClaude(claude, args, { cwd, env }) {
  const label = `${claude} ${args.join(' ')}`;
  const r = spawnSync(claude, args, { cwd, env, encoding: 'utf8', input: '', timeout: STEP_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    const why = r.error.code === 'ENOENT' ? 'the claude executable was not found (install Claude Code or pass --claude)' : r.error.message;
    throw new Error(`${label}: ${why}`);
  }
  if (r.status !== 0) {
    const output = `${r.stdout}${r.stderr}`.trim();
    throw new Error(`${label} exited with ${r.status}${output ? `:\n${output}` : ''}`);
  }
  return r.stdout;
}

const isDirectory = (path) => existsSync(path) && statSync(path).isDirectory();

export function main(argv = process.argv.slice(2), env = process.env) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        plugin: { type: 'string', default: DEFAULT_PLUGIN },
        root: { type: 'string' },
        claude: { type: 'string', default: 'claude' },
        keep: { type: 'boolean', default: false },
      },
      strict: true,
    }));
    if (positionals.length > 1) throw new Error('only one source can be given');
  } catch (e) {
    console.error(`check-plugin-install: ${e.message}`);
    console.error(USAGE);
    return 2;
  }

  // A path that exists is passed as an absolute path; anything else (owner/repo, URL) goes to Claude Code unchanged.
  const given = positionals[0] ?? '.';
  const source = isDirectory(given) ? resolve(given) : given;
  const root = values.root ?? (isDirectory(given) ? given : '.');

  const data = loadMarketplace(root);
  if (data.errors.length) {
    console.error(data.errors.map((e) => `✘ ${e}`).join('\n'));
    console.error(`check-plugin-install: ${root} is not a valid marketplace`);
    return 1;
  }
  let expected;
  try {
    expected = expectedPlugins(data, values.plugin);
  } catch (e) {
    console.error(`✘ ${e.message}`);
    return 1;
  }
  const marketplace = data.marketplace.name;

  const profile = mkdtempSync(join(tmpdir(), 'tam-profile-'));
  const project = mkdtempSync(join(tmpdir(), 'tam-project-'));
  const childEnv = { ...env, CLAUDE_CONFIG_DIR: profile };
  const run = (args) => runClaude(values.claude, args, { cwd: project, env: childEnv });

  let problems;
  try {
    console.log(`profile ${profile}, source ${source}`);
    run(['plugin', 'marketplace', 'add', source]);
    run(['plugin', 'install', `${values.plugin}@${marketplace}`, '--scope', 'project']);
    const stdout = run(['plugin', 'list', '--json']);
    let list;
    try {
      list = JSON.parse(stdout);
    } catch (e) {
      throw new Error(`\`claude plugin list --json\` did not print JSON (${e.message}):\n${stdout.slice(0, 500)}`);
    }
    problems = checkPluginList(list, expected, marketplace);
    if (problems.length === 0) {
      for (const { name, version } of expected) {
        const listed = list.find((e) => e.id === `${name}@${marketplace}`);
        console.log(`✔ ${name}@${marketplace} ${listed.version} enabled`);
      }
    }
  } catch (e) {
    problems = [e.message];
  } finally {
    if (values.keep) console.log(`kept: profile ${profile}, project ${project}`);
    else for (const dir of [profile, project]) rmSync(dir, { recursive: true, force: true });
  }

  if (problems.length) {
    console.error(problems.map((p) => `✘ ${p}`).join('\n'));
    console.error(`check-plugin-install: ${values.plugin} did not install cleanly (${problems.length} problem(s))`);
    return 1;
  }
  console.log(`plugin install ok (${expected.length} plugins: ${expected.map((p) => `${p.name}@${p.version}`).join(', ')})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
