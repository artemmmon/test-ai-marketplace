// build-index.mjs as a program: golden output, determinism, what it writes and deletes, CI annotations.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { after, describe, test } from 'node:test';
import { OUTPUT_DIRS, OUTPUT_FILES, annotate, formatNow } from '../build-index.mjs';
import { EXPECTED, FIXTURE_COMMIT, FIXTURE_NOW, FIXTURE_REPO, FIXTURE_TAGS, cleanupTemp, copyFixtureRepo, makeRepo, minimalFiles, minimalRepo, runScript, tempDir, write } from './helpers.mjs';

after(cleanupTemp);

const fixtureArgs = (out) => ['--root', FIXTURE_REPO, '--out', out, '--tags-file', FIXTURE_TAGS, '--now', FIXTURE_NOW, '--commit', FIXTURE_COMMIT, '--fixture'];
const fixtureEnv = { GITHUB_REPOSITORY: 'artemmmon/test-ai-marketplace' };

/** All files below `dir` as { 'relative/path': content }. */
function tree(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[relative(dir, p)] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
}

describe('golden files (FR-80)', () => {
  test('the fixture catalog produces the stored golden files, byte for byte', () => {
    const out = tempDir('tam-out-');
    const r = runScript('build-index.mjs', fixtureArgs(out), { env: fixtureEnv });
    assert.equal(r.status, 0, r.stderr);
    const golden = ['index.json', 'catalog.json', 'releases.json', 'stats.json', 'llms.txt', 'feed.xml'];
    if (process.env.UPDATE_GOLDEN === '1') {
      mkdirSync(EXPECTED, { recursive: true });
      for (const f of golden) writeFileSync(join(EXPECTED, f), readFileSync(join(out, f)));
    }
    for (const f of golden) {
      assert.equal(readFileSync(join(out, f), 'utf8'), readFileSync(join(EXPECTED, f), 'utf8'), `${f} differs from scripts/__fixtures__/expected/${f} (UPDATE_GOLDEN=1 regenerates it)`);
    }
  });

  test('identical inputs give a byte-for-byte identical output tree', () => {
    const a = tempDir('tam-a-');
    const b = tempDir('tam-b-');
    assert.equal(runScript('build-index.mjs', fixtureArgs(a), { env: fixtureEnv }).status, 0);
    assert.equal(runScript('build-index.mjs', fixtureArgs(b), { env: fixtureEnv }).status, 0);
    assert.deepEqual(tree(a), tree(b));
  });

  test('writes exactly the six files and bodies/ (33 files on the fixtures)', () => {
    const out = tempDir('tam-out-');
    const r = runScript('build-index.mjs', fixtureArgs(out), { env: fixtureEnv });
    assert.deepEqual(readdirSync(out).sort(), ['bodies', ...OUTPUT_FILES].sort());
    assert.equal(Object.keys(tree(out)).length, 33);
    assert.match(r.stdout, /build-index: 4 plugins, 9 skills, 4 agents, 2 commands, 1 hooks, 1 MCP servers, 6 releases -> .* \(33 files\)/);
    assert.match(r.stdout, /warning: "architecture-review": COMPATIBILITY\.md is missing/);
    assert.deepEqual(OUTPUT_DIRS, ['bodies']);
  });

  test('without --fixture the metadata says fixture: false', () => {
    const out = tempDir('tam-out-');
    const args = fixtureArgs(out).filter((a) => a !== '--fixture');
    assert.equal(runScript('build-index.mjs', args, { env: fixtureEnv }).status, 0);
    assert.equal(JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')).fixture, false);
  });
});

describe('what it deletes and writes', () => {
  test('removes only its own outputs from --out', () => {
    const out = tempDir('tam-out-');
    for (const f of ['favicon.svg', 'theme-init.js', 'robots.txt', 'custom/keep.txt']) write(out, f, 'keep');
    for (const f of ['index.json', 'catalog.json', 'releases.json', 'stats.json', 'llms.txt', 'feed.xml', 'bodies/stale-plugin/README.md']) write(out, f, 'stale');
    const r = runScript('build-index.mjs', fixtureArgs(out), { env: fixtureEnv });
    assert.equal(r.status, 0, r.stderr);
    const files = tree(out);
    for (const f of ['favicon.svg', 'theme-init.js', 'robots.txt', 'custom/keep.txt']) assert.equal(files[f], 'keep', f);
    assert.equal(files['bodies/stale-plugin/README.md'], undefined);
    assert.notEqual(files['index.json'], 'stale');
  });

  test('on validation errors: exit 1, the errors on stderr, nothing written, existing outputs untouched', () => {
    const root = makeRepo(minimalFiles((f) => delete f['plugins/alpha-plugin/.claude-plugin/plugin.json']['version']));
    const out = tempDir('tam-out-');
    write(out, 'index.json', 'previous');
    write(out, 'bodies/x/README.md', 'previous');
    const before = tree(out);
    const r = runScript('build-index.mjs', ['--root', root, '--out', out, '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /✘ "alpha-plugin": plugin\.json has no "version"/);
    assert.match(r.stderr, /nothing was written/);
    assert.deepEqual(tree(out), before);
  });

  test('--out is created when missing', () => {
    const out = join(tempDir('tam-out-'), 'nested/public');
    assert.equal(runScript('build-index.mjs', fixtureArgs(out), { env: fixtureEnv }).status, 0);
    assert.ok(existsSync(join(out, 'index.json')));
  });
});

describe('inputs: only marketplace.json and plugins/<name>/ (hard constraint)', () => {
  const MARKERS = [
    'DECOY-DEV-SKILL', 'DECOY-DOCS', 'DECOY-SITE', 'DECOY-ROOT-EVALS', 'DECOY-SCRIPTS', 'DECOY-PLUGIN-EVALS', 'DECOY-PLUGIN-SCRIPTS', 'DECOY-PLUGIN-DOCS',
    'DECOY-REFERENCE', 'DECOY-ASSET', 'DECOY-RULES', 'DECOY-OTHER-PLUGIN-FILE', 'DECOY-GITHUB', 'DECOY-AGENTS-TOP', 'DECOY-HOOKS-TOP',
  ];

  /**
   * The fixture catalog plus decoy files everywhere the generator must not look. Decoys next to a SKILL.md
   * (references/, assets/, rules/) only show up as file names in `files`, so they are optional.
   */
  function repoWithDecoys({ skillSiblings = true } = {}) {
    const root = copyFixtureRepo();
    const decoys = {
      '.claude/skills/dev-only/SKILL.md': '---\nname: dev-only\ndescription: DECOY-DEV-SKILL\n---\nDECOY-DEV-SKILL\n',
      '.claude/agents/dev-agent.md': '---\nname: dev-agent\ndescription: DECOY-DEV-SKILL\n---\nDECOY-DEV-SKILL\n',
      'docs/specs/x.md': 'DECOY-DOCS',
      'site/public/index.json': '{"DECOY-SITE": true}',
      'evals/e.yaml': 'DECOY-ROOT-EVALS',
      'scripts/other.mjs': '// DECOY-SCRIPTS',
      '.github/workflows/x.yml': '# DECOY-GITHUB',
      'agents/top.md': '---\nname: top\ndescription: DECOY-AGENTS-TOP\n---\nDECOY-AGENTS-TOP',
      'hooks/hooks.json': '{"hooks": {"DECOY-HOOKS-TOP": []}}',
      'plugins/stray.md': 'DECOY-OTHER-PLUGIN-FILE',
      'plugins/not-in-marketplace/.claude-plugin/plugin.json': '{"name": "not-in-marketplace", "version": "1.0.0", "description": "DECOY-OTHER-PLUGIN-FILE"}',
      'plugins/not-in-marketplace/skills/x/SKILL.md': '---\nname: x\ndescription: DECOY-OTHER-PLUGIN-FILE\n---\nDECOY-OTHER-PLUGIN-FILE',
      'plugins/research-tools/evals/e.yaml': 'DECOY-PLUGIN-EVALS',
      'plugins/research-tools/scripts/run.mjs': '// DECOY-PLUGIN-SCRIPTS',
      'plugins/research-tools/docs/notes.md': 'DECOY-PLUGIN-DOCS',
      'plugins/research-tools/skills/web-research/evals/e.yaml': 'DECOY-PLUGIN-EVALS',
    };
    if (skillSiblings) {
      decoys['plugins/research-tools/skills/web-research/references/r.md'] = 'DECOY-REFERENCE';
      decoys['plugins/research-tools/skills/web-research/assets/a.json'] = 'DECOY-ASSET';
      decoys['plugins/research-tools/skills/web-research/rules/r.md'] = 'DECOY-RULES';
    }
    for (const [path, content] of Object.entries(decoys)) write(root, path, content);
    return root;
  }

  test('content outside the inputs cannot appear in any generated file', () => {
    const root = repoWithDecoys();
    const out = tempDir('tam-out-');
    const r = runScript('build-index.mjs', ['--root', root, '--out', out, '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT, '--now', FIXTURE_NOW], { env: fixtureEnv });
    assert.equal(r.status, 0, r.stderr);
    const files = tree(out);
    const all = Object.values(files).join('\n') + r.stdout + r.stderr;
    for (const marker of MARKERS) assert.ok(!all.includes(marker), `${marker} leaked into the output`);
    assert.equal(Object.keys(files).length, 33, 'the decoys add no files');
    const index = JSON.parse(files['index.json']);
    assert.equal(index.items.some((i) => ['dev-only', 'dev-agent', 'top', 'not-in-marketplace', 'x'].includes(i.name)), false);
    assert.deepEqual(index.items.filter((i) => i.type === 'plugin').map((i) => i.name), ['architecture-review', 'engineering-paved-path', 'research-tools', 'sdd-engineering']);
  });

  test('the output is identical with and without the decoys', () => {
    const plain = tempDir('tam-a-');
    const decoyed = tempDir('tam-b-');
    const args = (root, out) => ['--root', root, '--out', out, '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT, '--now', FIXTURE_NOW];
    assert.equal(runScript('build-index.mjs', args(FIXTURE_REPO, plain), { env: fixtureEnv }).status, 0);
    assert.equal(runScript('build-index.mjs', args(repoWithDecoys({ skillSiblings: false }), decoyed), { env: fixtureEnv }).status, 0);
    assert.deepEqual(tree(decoyed), tree(plain));
  });

  test('the generator never opens the forbidden directories (made unreadable)', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
    const root = repoWithDecoys({ skillSiblings: false });
    const locked = [
      '.claude', 'docs', 'site', 'evals', 'scripts', 'agents', 'hooks', '.github', 'plugins/not-in-marketplace',
      'plugins/research-tools/evals', 'plugins/research-tools/scripts', 'plugins/research-tools/docs', 'plugins/research-tools/skills/web-research/evals',
      'plugins/engineering-paved-path/scripts', 'plugins/engineering-paved-path/evals',
    ].map((p) => join(root, p));
    for (const dir of locked) chmodSync(dir, 0o000);
    try {
      const out = tempDir('tam-out-');
      const r = runScript('build-index.mjs', ['--root', root, '--out', out, '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT, '--now', FIXTURE_NOW], { env: fixtureEnv });
      assert.equal(r.status, 0, `reading a forbidden directory would fail here:\n${r.stderr}`);
      assert.equal(Object.keys(tree(out)).length, 33);
    } finally {
      for (const dir of locked) chmodSync(dir, 0o755);
    }
  });

  test('files is the only thing derived from skill siblings: names, never content', () => {
    const root = repoWithDecoys();
    const out = tempDir('tam-out-');
    runScript('build-index.mjs', ['--root', root, '--out', out, '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT], { env: fixtureEnv });
    const skill = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')).items.find((i) => i.id === 'research-tools:skill:web-research');
    assert.deepEqual(skill.files, [
      'plugins/research-tools/skills/web-research/assets/a.json',
      'plugins/research-tools/skills/web-research/references/r.md',
      'plugins/research-tools/skills/web-research/rules/r.md',
    ]);
  });
});

describe('empty catalog (FR-55)', () => {
  const emptyRepo = () => makeRepo({ '.claude-plugin/marketplace.json': { name: 'test-ai-marketplace', owner: { name: 'artemmmon' }, description: 'Empty', plugins: [] }, 'plugins/.gitkeep': '' });

  test('produces a valid empty catalog that the site accepts', () => {
    const out = tempDir('tam-out-');
    const r = runScript('build-index.mjs', ['--root', emptyRepo(), '--out', out, '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT, '--now', FIXTURE_NOW], { env: fixtureEnv });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /0 plugins/);
    const files = tree(out);
    assert.deepEqual(Object.keys(files).sort(), [...OUTPUT_FILES].sort());
    const index = JSON.parse(files['index.json']);
    assert.deepEqual(Object.keys(index), ['schemaVersion', 'generatedAt', 'commit', 'fixture', 'marketplace', 'items']);
    assert.deepEqual(index.items, []);
    assert.equal(index.fixture, false);
    assert.equal(index.marketplace.siteUrl, 'https://artemmmon.github.io/test-ai-marketplace/');
    assert.deepEqual(JSON.parse(files['releases.json']).releases, []);
    assert.deepEqual(Object.values(JSON.parse(files['stats.json']).counts), Array(10).fill(0));
    assert.deepEqual(JSON.parse(files['catalog.json']).plugins, []);
    assert.match(files['llms.txt'], /No plugins are published yet\./);
    assert.doesNotMatch(files['feed.xml'], /<entry>/);
  });
});

describe('GitHub Actions annotations (FR-17)', () => {
  test('warnings and errors as ::warning / ::error', () => {
    const warnRoot = minimalRepo((f) => delete f['plugins/alpha-plugin/README.md']);
    const w = runScript('build-index.mjs', ['--root', warnRoot, '--out', tempDir('tam-out-'), '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT], { env: { GITHUB_ACTIONS: 'true' } });
    assert.equal(w.status, 0, w.stderr);
    assert.match(w.stdout, /^warning: "alpha-plugin": README\.md is missing/m);
    assert.match(w.stdout, /^::warning file=plugins\/alpha-plugin\/README\.md::"alpha-plugin": README\.md is missing/m);

    const errRoot = minimalRepo((f) => (f['plugins/alpha-plugin/.claude-plugin/plugin.json'].version = 'nope'));
    const e = runScript('build-index.mjs', ['--root', errRoot, '--out', tempDir('tam-out-'), '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT], { env: { GITHUB_ACTIONS: 'true' } });
    assert.equal(e.status, 1);
    assert.match(e.stdout, /^::error::"alpha-plugin": plugin\.json version "nope" is not a valid semantic version/m);
  });

  test('no annotations outside GitHub Actions', () => {
    const root = minimalRepo((f) => delete f['plugins/alpha-plugin/README.md']);
    const r = runScript('build-index.mjs', ['--root', root, '--out', tempDir('tam-out-'), '--tags-file', FIXTURE_TAGS, '--commit', FIXTURE_COMMIT]);
    assert.doesNotMatch(r.stdout, /^::/m);
  });

  test('annotate() escapes newlines, percent signs, colons and commas', () => {
    assert.equal(annotate('warning', 'a%b\nc'), '::warning::a%25b%0Ac');
    assert.equal(annotate('warning', 'm', 'dir/a:b,c.md'), '::warning file=dir/a%3Ab%2Cc.md::m');
  });
});

describe('options and defaults (FR-15)', () => {
  test('--now is normalized to UTC without milliseconds; invalid values fail', () => {
    assert.equal(formatNow('2026-10-19T12:00:00Z'), '2026-10-19T12:00:00Z');
    assert.equal(formatNow('2026-10-19T12:00:00.123+02:00'), '2026-10-19T10:00:00Z');
    assert.throws(() => formatNow('yesterday'), /invalid --now/);
    const r = runScript('build-index.mjs', ['--root', FIXTURE_REPO, '--out', tempDir('tam-out-'), '--now', 'yesterday']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /invalid --now/);
  });

  test('commit: --commit wins over $GITHUB_SHA', () => {
    const run = (args, env) => {
      const out = tempDir('tam-out-');
      runScript('build-index.mjs', ['--root', FIXTURE_REPO, '--out', out, '--tags-file', FIXTURE_TAGS, ...args], { env });
      return JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')).commit;
    };
    assert.equal(run(['--commit', 'f'.repeat(40)], { GITHUB_SHA: 'e'.repeat(40) }), 'f'.repeat(40));
    assert.equal(run([], { GITHUB_SHA: 'e'.repeat(40) }), 'e'.repeat(40));
  });

  test('the repository slug comes from $GITHUB_REPOSITORY and drives siteUrl and the commands', () => {
    const out = tempDir('tam-out-');
    runScript('build-index.mjs', fixtureArgs(out), { env: { GITHUB_REPOSITORY: 'Someone/My-Repo' } });
    const m = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')).marketplace;
    assert.equal(m.siteUrl, 'https://someone.github.io/My-Repo/');
    assert.equal(m.addCommands.cli, 'claude plugin marketplace add Someone/My-Repo');
    assert.equal(m.repo.url, 'https://github.com/Someone/My-Repo');
  });

  test('git tags are read from the checkout when --tags-file is absent', () => {
    const repo = copyFixtureRepo();
    const git = (...a) => runGit(repo, a);
    git('init', '-q', '-b', 'main');
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'init');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'tag', '-a', 'sdd-engineering--v1.0.0', '-m', 'release');
    git('tag', 'engineering-paved-path--v1.2.0');
    git('tag', 'ghost--v1.0.0');
    const out = tempDir('tam-out-');
    const r = runScript('build-index.mjs', ['--root', repo, '--out', out, '--now', FIXTURE_NOW], { env: fixtureEnv });
    assert.equal(r.status, 0, r.stderr);
    const head = runGit(repo, ['rev-parse', 'HEAD']).trim();
    const releases = JSON.parse(readFileSync(join(out, 'releases.json'), 'utf8')).releases;
    const sdd = releases.find((x) => x.id === 'sdd-engineering@1.0.0');
    assert.deepEqual([sdd.tag, sdd.commit, sdd.origin], ['sdd-engineering--v1.0.0', head, 'changelog+tag']);
    assert.equal(releases.find((x) => x.id === 'engineering-paved-path@1.2.0').commit, head);
    assert.equal(releases.find((x) => x.id === 'research-tools@1.0.1').tag, null);
    assert.match(r.stdout, /tag ghost--v1\.0\.0: no local plugin "ghost"/);
    assert.equal(JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')).commit, head);
  });

  test('a bad --tags-file and unknown options are reported', () => {
    const missing = runScript('build-index.mjs', ['--root', FIXTURE_REPO, '--out', tempDir('tam-out-'), '--tags-file', '/nonexistent/tags.json']);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /cannot read tags file/);
    const bad = runScript('build-index.mjs', ['--nope']);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /usage: node scripts\/build-index\.mjs/);
  });
});

function runGit(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
