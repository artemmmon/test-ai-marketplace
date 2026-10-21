// check-plugin-install.mjs: the pure parsing of `claude plugin list --json` against recorded real output
// (scripts/__fixtures__/plugin-list/, taken from Claude Code 2.1.304/2.1.306 runs), and the CLI flow with a stub `claude`.
import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { checkPluginList, expectedPlugins } from '../check-plugin-install.mjs';
import { loadMarketplace } from '../lib/marketplace.mjs';
import { SCRIPTS, cleanupTemp, makeRepo, minimalFiles, runScript, tempDir } from './helpers.mjs';

after(cleanupTemp);

const FIXTURES = join(SCRIPTS, '__fixtures__/plugin-list');
const sample = (name) => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'));
const MARKETPLACE = 'test-ai-marketplace';
const EXPECTED = [
  { name: 'sdd-engineering', version: '1.2.0' },
  { name: 'engineering-paved-path', version: '1.0.1' },
  { name: 'research-tools', version: '1.0.0' },
  { name: 'architecture-review', version: '1.0.0' },
];

describe('checkPluginList on recorded output', () => {
  test('a clean install from GitHub has no problems', () => {
    assert.deepEqual(checkPluginList(sample('github-ok'), EXPECTED, MARKETPLACE), []);
  });

  test('a clean install from a local git checkout (dependencies listed as "<version>-<sha12>") has no problems', () => {
    const list = sample('local-checkout-ok');
    assert.match(list.find((p) => p.id.startsWith('research-tools')).version, /^1\.0\.0-[0-9a-f]{12}$/);
    assert.deepEqual(checkPluginList(list, EXPECTED, MARKETPLACE), []);
  });

  test('a dependency range that the installed version does not satisfy is reported with its type and message', () => {
    assert.deepEqual(checkPluginList(sample('range-unsatisfied'), EXPECTED, MARKETPLACE), [
      'sdd-engineering@test-ai-marketplace: [dependency-version-unsatisfied] Requires "research-tools@test-ai-marketplace" ^9.0.0, installed 1.0.0',
    ]);
  });

  test('a disabled dependency is reported as dependency-unsatisfied and as not enabled', () => {
    assert.deepEqual(checkPluginList(sample('dependency-disabled'), EXPECTED, MARKETPLACE), [
      'sdd-engineering@test-ai-marketplace: [dependency-unsatisfied] Dependency "research-tools@test-ai-marketplace" is disabled — enable it or remove the dependency',
      'research-tools@test-ai-marketplace: not enabled',
    ]);
  });
});

describe('checkPluginList on edited samples', () => {
  const clone = (name) => structuredClone(sample(name));

  test('an error on a plugin that is not one of the expected ones still fails', () => {
    const list = clone('github-ok');
    list.push({ id: 'broken@test-ai-marketplace', version: 'unknown', scope: 'project', enabled: false, errors: ['boom'], errorDetails: [{ type: 'path-not-found' }] });
    assert.deepEqual(checkPluginList(list, EXPECTED, MARKETPLACE), ['broken@test-ai-marketplace: [path-not-found] boom']);
  });

  test('errorDetails without errors, and errors without errorDetails, are both reported', () => {
    const list = clone('github-ok');
    list[0].errorDetails = [{ type: 'range-conflict', dependency: 'research-tools@test-ai-marketplace' }];
    list[1].errors = ['something'];
    assert.deepEqual(checkPluginList(list, EXPECTED, MARKETPLACE), [
      'architecture-review@test-ai-marketplace: [range-conflict] reported by Claude Code (dependency research-tools@test-ai-marketplace)',
      'engineering-paved-path@test-ai-marketplace: something',
    ]);
  });

  test('notes are advisory and do not fail', () => {
    const list = clone('github-ok');
    list[0].notes = ['a note'];
    list[0].noteDetails = [{ type: 'generic-note' }];
    assert.deepEqual(checkPluginList(list, EXPECTED, MARKETPLACE), []);
  });

  test('a missing plugin, a missing dependency and a wrong version are reported', () => {
    const list = clone('github-ok').filter((p) => !p.id.startsWith('research-tools'));
    list.find((p) => p.id.startsWith('sdd-engineering')).version = '1.1.1';
    list.find((p) => p.id.startsWith('architecture-review')).version = '1.0.0-rc.1';
    assert.deepEqual(checkPluginList(list, EXPECTED, MARKETPLACE), [
      'sdd-engineering@test-ai-marketplace: version "1.1.1" is listed, plugin.json says 1.2.0',
      'research-tools@test-ai-marketplace: not in the list (expected 1.0.0)',
      'architecture-review@test-ai-marketplace: version "1.0.0-rc.1" is listed, plugin.json says 1.0.0',
    ]);
  });

  test('an empty list and a non-array both fail', () => {
    assert.equal(checkPluginList([], EXPECTED, MARKETPLACE).length, EXPECTED.length);
    assert.deepEqual(checkPluginList({ plugins: [] }, EXPECTED, MARKETPLACE), ['`claude plugin list --json` did not print a JSON array']);
  });
});

describe('expectedPlugins', () => {
  test('lists the plugin first, then its dependencies, each once, with the plugin.json version', () => {
    const data = loadMarketplace(join(SCRIPTS, '..'));
    assert.deepEqual(
      expectedPlugins(data, 'sdd-engineering').map((p) => p.name),
      ['sdd-engineering', 'engineering-paved-path', 'research-tools', 'architecture-review'],
    );
  });

  test('an unknown plugin throws', () => {
    const root = makeRepo(minimalFiles());
    assert.throws(() => expectedPlugins(loadMarketplace(root), 'nope'), /"nope" is not in the marketplace/);
  });
});

describe('CLI with a stub claude', () => {
  /** A node script that behaves like `claude`: it records its calls and prints the recorded list for `plugin list --json`. */
  function stub({ listSample, failOn } = {}) {
    const dir = tempDir('tam-stub-');
    const calls = join(dir, 'calls.log');
    const script = join(dir, 'claude');
    writeFileSync(
      script,
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args, config: process.env.CLAUDE_CONFIG_DIR, cwd: process.cwd() }) + '\\n');
if (${JSON.stringify(failOn ?? '')} && args.join(' ').includes(${JSON.stringify(failOn ?? '')})) { console.error('stub failure'); process.exit(1); }
if (args[1] === 'list') process.stdout.write(fs.readFileSync(${JSON.stringify(join(FIXTURES, `${listSample ?? 'github-ok'}.json`))}, 'utf8'));
`,
    );
    chmodSync(script, 0o755);
    return { script, readCalls: () => readFileSync(calls, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) };
  }
  const repoRoot = join(SCRIPTS, '..');
  const tamDirs = () => readdirSync(tmpdir()).filter((n) => /^tam-(profile|project)-/.test(n));

  test('adds the marketplace, installs the plugin, lists, and cleans up the profile and project', () => {
    const before = tamDirs();
    const { script, readCalls } = stub();
    const r = runScript('check-plugin-install.mjs', [repoRoot, '--claude', script]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /plugin install ok \(4 plugins: sdd-engineering@1\.2\.0, engineering-paved-path@1\.0\.1, research-tools@1\.0\.0, architecture-review@1\.0\.0\)/);
    const calls = readCalls();
    assert.deepEqual(calls.map((c) => c.args), [
      ['plugin', 'marketplace', 'add', repoRoot],
      ['plugin', 'install', 'sdd-engineering@test-ai-marketplace', '--scope', 'project'],
      ['plugin', 'list', '--json'],
    ]);
    assert.equal(new Set(calls.map((c) => c.config)).size, 1);
    assert.match(calls[0].config, /tam-profile-/);
    assert.ok(!existsSync(calls[0].config), 'the profile is removed');
    assert.ok(!existsSync(calls[0].cwd), 'the project is removed');
    assert.deepEqual(tamDirs(), before);
  });

  test('fails with exit 1 and the problems when the list reports an error', () => {
    const { script } = stub({ listSample: 'range-unsatisfied' });
    const r = runScript('check-plugin-install.mjs', [repoRoot, '--claude', script]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /✘ sdd-engineering@test-ai-marketplace: \[dependency-version-unsatisfied\] Requires "research-tools@test-ai-marketplace" \^9\.0\.0, installed 1\.0\.0/);
    assert.match(r.stderr, /did not install cleanly \(1 problem\(s\)\)/);
  });

  test('fails with exit 1 and the output when an install is refused', () => {
    const { script } = stub({ failOn: 'plugin install' });
    const r = runScript('check-plugin-install.mjs', [repoRoot, '--claude', script]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /plugin install sdd-engineering@test-ai-marketplace --scope project exited with 1:\nstub failure/);
  });

  test('fails readably when claude is not installed', () => {
    const r = runScript('check-plugin-install.mjs', [repoRoot, '--claude', join(tmpdir(), 'no-such-claude-binary')]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /the claude executable was not found/);
  });

  test('exits 2 with usage on a bad option, 1 on an invalid marketplace', () => {
    const bad = runScript('check-plugin-install.mjs', ['--nope']);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /usage: node scripts\/check-plugin-install\.mjs/);
    const empty = runScript('check-plugin-install.mjs', [makeRepo({})]);
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /is not a valid marketplace/);
  });
});
