// Shared helpers for the generator tests (not a test file itself).
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE_REPO = join(SCRIPTS, '__fixtures__/repo');
export const FIXTURE_TAGS = join(SCRIPTS, '__fixtures__/tags.json');
export const EXPECTED = join(SCRIPTS, '__fixtures__/expected');
export const FIXTURE_NOW = '2026-10-19T12:00:00Z';
export const FIXTURE_COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
export const FIXTURE_SLUG = 'artemmmon/test-ai-marketplace';

const cleanups = [];
/** Removes every temp directory created by tempDir()/makeRepo(); call from an `after` hook. */
export function cleanupTemp() {
  while (cleanups.length) rmSync(cleanups.pop(), { recursive: true, force: true });
}

export function tempDir(prefix = 'tam-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(dir);
  return dir;
}

/** Writes `files` ({ 'relative/path': string | object (JSON) }) into a new temp directory. */
export function makeRepo(files) {
  const root = tempDir();
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  return root;
}

/** A copy of the fixture repo that tests may extend or break. */
export function copyFixtureRepo() {
  const root = tempDir();
  cpSync(FIXTURE_REPO, root, { recursive: true });
  return root;
}

export function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
}

const CHANGELOG = (version) => `# Changelog\n\n## [Unreleased]\n\n## [${version}] - 2026-10-01\n\n### Added\n- First release.\n`;

/** A minimal valid marketplace with one local plugin, "alpha-plugin". Pass `edit(files)` to change it. */
export function minimalFiles(edit) {
  const files = {
    '.claude-plugin/marketplace.json': {
      name: 'demo-market',
      owner: { name: 'someone' },
      description: 'Demo marketplace',
      plugins: [{ name: 'alpha-plugin', source: './plugins/alpha-plugin', description: 'Alpha' }],
    },
    'plugins/alpha-plugin/.claude-plugin/plugin.json': { name: 'alpha-plugin', version: '1.0.0', description: 'Alpha plugin' },
    'plugins/alpha-plugin/README.md': '# Alpha\n\nAn alpha plugin.\n',
    'plugins/alpha-plugin/CHANGELOG.md': CHANGELOG('1.0.0'),
    'plugins/alpha-plugin/COMPATIBILITY.md': '# Compatibility\n\nRequires Claude Code >=2.1.0.\n',
    'plugins/alpha-plugin/skills/do-thing/SKILL.md': '---\nname: do-thing\ndescription: Does the thing\n---\n\nBody of the skill.\n',
  };
  edit?.(files);
  return files;
}

export function minimalRepo(edit) {
  return makeRepo(minimalFiles(edit));
}

/** Runs a script with the current Node; returns { status, stdout, stderr }. */
export function runScript(script, args = [], { env = {}, cwd } = {}) {
  const clean = { ...process.env };
  delete clean.GITHUB_ACTIONS;
  delete clean.GITHUB_SHA;
  delete clean.GITHUB_REPOSITORY;
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { encoding: 'utf8', env: { ...clean, ...env }, cwd });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
