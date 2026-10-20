// Tests for check-plan.mjs: a well-formed plan passes, and each rule catches its fault.
// The --implemented cases build a throw-away git repo: no network, no dependencies.
// Run directly: node check-plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKER, TEST_FILE, checkImplemented, checkPlan, isPlanPath, option, specIds, stepFiles, parsePlan } from '../check-plan.mjs';

const NOTES = 'src/INSIGHTS.md'; // optional file a plan may list under "Insights to record"
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../check-plan.mjs');

const SPEC = [
  '# Spec: Probe', 'Spec ID: SPEC-10', 'Status: approved', 'Supersedes: none', 'Packages: api', 'Sources: user brief', '',
  '## User stories', '- US-1: As a dev, I want a probe, so that I can test.', '',
  '## Acceptance criteria (EARS)', '- AC-1 (US-1): WHEN asked, the system shall answer.', '- AC-2 (US-1): The system shall log.', '',
  '## Edge cases', '- EC-1: empty input → `—` (AC-1)', '',
  '## Non-functional requirements', '- NFR-1: answers within 2 s', '',
].join('\n');

const PLAN = [
  '# Development Plan: Probe', 'Status: draft', 'Save as: docs/plans/06-probe.md', 'Spec: specs/10-probe.md', 'Brainstorm: none',
  'Execution mode: multi-agent (chosen by the user)', '',
  '## Goal', 'A probe.', '',
  '## Step groups', '| Group | Steps |', '|---|---|', '| G1 | 1–2 |', '',
  '## Steps',
  '### Step 1 — service (api)',
  '- Files: create `src/probe.ts` · modify `src/app.ts`',
  '- Change: add the probe.',
  '- Covers: AC-1, EC-1',
  '- Rules / skills: none',
  '- Practices: keep the probe free of side effects (`src/app.ts:1`).',
  '- Tests (new): `test/probe.test.ts` — proves AC-1, EC-1',
  '- Existing tests to update: none',
  '- Done when: typecheck passes.',
  '### Step 2 — log (api)',
  '- Files: modify `src/app.ts`',
  '- Change: log it.',
  '- Covers: AC-2, NFR-1',
  '- Done when: the log line appears.', '',
  '## Verification', '| Package | Checks |', '|---|---|', '| api | `npm test` |', '',
  '## Insights to record', `- \`${NOTES}\` · Codebase Patterns — the probe`, '',
  MARKER, '',
  '## Design notes', 'None.', '',
].join('\n');

function project(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-plan-'));
  const all = { 'specs/10-probe.md': SPEC, 'src/app.ts': 'export {};\n', [NOTES]: '# Insights\n', ...files };
  for (const [path, content] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const git = (root, ...args) => assert.equal(spawnSync('git', args, { cwd: root }).status, 0, `git ${args.join(' ')}`);

const errors = (text, root = project()) => checkPlan(text, root).filter((p) => p.level === 'error').map((p) => p.message);
const has = (list, part) => assert.ok(list.some((m) => m.includes(part)), `no "${part}" in:\n${list.join('\n')}`);
const swap = (from, to) => {
  assert.ok(PLAN.includes(from), `fixture lost "${from}"`);
  return PLAN.replace(from, to);
};

test('a well-formed plan has no errors and no warnings', () => {
  assert.deepEqual(checkPlan(PLAN, project()), []);
});

test('header, marker and sections', () => {
  has(errors(swap('# Development Plan: Probe', '# Probe')), '# Development Plan: <title>');
  has(errors(swap('Status: draft', 'Status: done')), 'Status must be one of');
  has(errors(swap('Execution mode: multi-agent (chosen by the user)\n', '')), '"Execution mode:" is missing');
  has(errors(swap('multi-agent (chosen', 'swarm (chosen')), 'Execution mode must be');
  has(errors(swap(`${MARKER}\n`, '')), 'marker');
  has(errors(swap('## Verification\n| Package | Checks |\n|---|---|\n| api | `npm test` |\n\n', '')), '"## Verification" is missing');
  has(errors(PLAN.replace(`${MARKER}\n\n`, '').replace('## Verification', `${MARKER}\n\n## Verification`)), 'must be above the marker');
});

test('a long brief is a warning, not an error', () => {
  const long = swap('A probe.', 'x'.repeat(21_000));
  const problems = checkPlan(long, project());
  assert.deepEqual(problems.map((p) => p.level), ['warning']);
});

test('steps: fields, sequence and files', () => {
  has(errors(swap('- Change: log it.\n', '')), 'Step 2 has no "- Change:" line');
  has(errors(swap('- Done when: the log line appears.', '- Done when:')), 'Step 2 has no "- Done when:" line');
  has(errors(swap('### Step 2', '### Step 3')), 'out of sequence');
  has(errors(swap('modify `src/app.ts`\n- Change: log', 'modify `src/gone.ts`\n- Change: log')), '"src/gone.ts" (modify) does not exist');
  assert.deepEqual(errors(swap('modify `src/app.ts`\n- Change: log', 'modify `src/probe.ts`\n- Change: log')), []);
  has(errors(swap('create `src/probe.ts` · modify `src/app.ts`', 'modify `src/probe.ts`').replace('modify `src/app.ts`\n- Change: log', 'create `src/probe.ts`\n- Change: log')), 'Step 1: "src/probe.ts" (modify) does not exist');
  const exists = checkPlan(PLAN, project({ 'src/probe.ts': '' }));
  has(exists.filter((p) => p.level === 'warning').map((p) => p.message), 'already exists');
});

test('a baseline-relative "Done when" needs a Baseline line in Verification (warning)', () => {
  const warnings = (text) => checkPlan(text, project()).filter((p) => p.level === 'warning').map((p) => p.message);
  const relative = swap('- Done when: typecheck passes.', '- Done when: `flutter analyze` reports no new issues.');
  has(warnings(relative), 'no "Baseline:" line');
  const recorded = relative.replace('| api | `npm test` |', '| api | `npm test` |\nBaseline: to be recorded: `flutter analyze` (the implementer of Step 1\'s group writes it here)');
  assert.deepEqual(warnings(recorded), []);
  assert.deepEqual(errors(relative), []); // a warning, never an error
  assert.deepEqual(warnings(PLAN), []);
});

test('stepFiles reads verbs and skips what is not a repo path', () => {
  const plan = parsePlan(swap('create `src/probe.ts` · modify `src/app.ts`', 'create `src/a.ts`, `src/b.ts` · modify `@scope/shared`, `src/**/*.ts`, `app.ts`, `.github/workflows/ci.yml`'));
  assert.deepEqual(stepFiles(plan.steps[0]).map((f) => `${f.verb} ${f.path}`), ['create src/a.ts', 'create src/b.ts', 'modify .github/workflows/ci.yml']);
});

test('coverage: every spec id is cited, nothing else is, and the spec is approved', () => {
  assert.deepEqual(specIds(SPEC), ['AC-1', 'AC-2', 'EC-1', 'NFR-1']);
  has(errors(swap('- Covers: AC-2, NFR-1', '- Covers: AC-2')), 'no step cites NFR-1');
  has(errors(swap('- Covers: AC-2, NFR-1', '- Covers: AC-2, NFR-1, AC-9')), 'cites AC-9');
  has(errors(PLAN, project({ 'specs/10-probe.md': SPEC.replace('approved', 'draft') })), 'only for an approved spec');
  has(errors(swap('Spec: specs/10-probe.md', 'Spec: specs/11-gone.md')), 'does not exist');
  assert.deepEqual(errors(swap('Spec: specs/10-probe.md', 'Spec: none').replace(/- Covers:.*\n/g, '')), []);
  assert.deepEqual(errors(swap('Status: draft', 'Status: implemented'), project({ 'specs/10-probe.md': SPEC.replace('approved', 'implemented') })), []);
});

test('--implemented: statuses, files, insights, unplanned changes and test names', () => {
  const root = project({ 'docs/plans/06-probe.md': PLAN });
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
  const done = PLAN.replace('Status: draft', 'Status: implemented');
  write(root, 'docs/plans/06-probe.md', done);
  write(root, 'specs/10-probe.md', SPEC.replace('approved', 'implemented'));
  write(root, 'src/probe.ts', 'export const probe = 1;\n');
  write(root, 'test/probe.test.ts', "it('AC-1: answers', () => {});\nit('EC-1: empty', () => {});\n");
  write(root, 'src/extra.ts', 'export {};\n');
  const lines = checkImplemented(done, root, 'docs/plans/06-probe.md', 'HEAD');
  const row = (id) => lines.filter((l) => l.id === id).map((l) => `${l.level} ${l.message}`);
  assert.match(row('P1')[0], /^PASS/);
  assert.match(row('P2')[0], /^PASS/);
  assert.match(row('S1.files')[0], /^FAIL src\/app\.ts is unchanged/);
  assert.match(row('I1')[0], /^FAIL/);
  assert.deepEqual(row('unplanned-change'), ['FAIL src/extra.ts']);
  assert.match(row('AC-1')[0], /^INFO named by test\/probe\.test\.ts:1/);
  assert.match(row('AC-2')[0], /no changed test names it/);

  const cli = spawnSync(process.execPath, [SCRIPT, '--root', root, join(root, 'docs/plans/06-probe.md'), '--implemented', '--base', 'HEAD'], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /FAIL unplanned-change\s+src\/extra\.ts/);
});

// The child process must not inherit plugin options or the project dir of the session running the tests.
const cleanEnv = (extra = {}) => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^CLAUDE_PLUGIN_OPTION_/i.test(key) || key === 'CLAUDE_PROJECT_DIR') delete env[key];
  return { ...env, ...extra };
};

test('--hook: errors come back on stderr with exit 2; other paths are ignored', () => {
  const root = project({ 'docs/plans/06-probe.md': PLAN.replace(`${MARKER}\n`, '') });
  const run = (file_path) =>
    spawnSync(process.execPath, [SCRIPT, '--hook'], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path } }),
      env: cleanEnv({ CLAUDE_PROJECT_DIR: root }),
      encoding: 'utf8',
    });
  const bad = run('docs/plans/06-probe.md');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /marker/);
  assert.equal(bad.stdout, '');
  assert.equal(run('src/app.ts').status, 0);
  assert.equal(run('docs/plans/06-probe.brainstorm.md').status, 0);
  assert.equal(run('docs/plans/README.md').status, 0);
  assert.equal(run('docs/plans/nested/06-probe.md').status, 0, 'only files directly inside the plans folder');
  assert.equal(run('docs/plans/07-missing.md').status, 0, 'a file that is not there is skipped');
});

test('--hook: plans folder from the option, the unset rule, spec found in the specs folder', () => {
  const broken = PLAN.replace(`${MARKER}\n`, '');
  const root = project({ 'plans/06-probe.md': broken, 'docs/plans/06-probe.md': broken });
  const run = (file_path, env) =>
    spawnSync(process.execPath, [SCRIPT, '--hook'], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path } }),
      env: cleanEnv({ CLAUDE_PROJECT_DIR: root, ...env }),
      encoding: 'utf8',
    });
  assert.equal(run('plans/06-probe.md', { CLAUDE_PLUGIN_OPTION_plans_dir: 'plans' }).status, 2);
  assert.equal(run('plans/06-probe.md', { CLAUDE_PLUGIN_OPTION_PLANS_DIR: 'plans' }).status, 2, 'upper-case name');
  assert.equal(run('docs/plans/06-probe.md', { CLAUDE_PLUGIN_OPTION_plans_dir: 'plans' }).status, 0, 'the default folder is ignored once another is set');
  for (const unset of ['', '${user_config.plans_dir}']) {
    assert.equal(run('docs/plans/06-probe.md', { CLAUDE_PLUGIN_OPTION_plans_dir: unset }).status, 2, `"${unset}" counts as unset`);
    assert.equal(run('plans/06-probe.md', { CLAUDE_PLUGIN_OPTION_plans_dir: unset }).status, 0);
  }
  assert.equal(run('docs/plans/06-probe.md', {}).status, 2, 'default folder');
});

test('the spec is also found by file name in the specs folder', () => {
  const root = project({ 'docs/specs/10-probe.md': SPEC });
  rmSync(join(root, 'specs'), { recursive: true });
  const plan = swap('Spec: specs/10-probe.md', 'Spec: 10-probe.md');
  has(errors(plan, root), 'the spec "10-probe.md" does not exist');
  assert.deepEqual(checkPlan(plan, root, 'docs/specs'), []);
  // the path as written still wins when the file is there
  assert.deepEqual(checkPlan(PLAN, project(), 'docs/specs'), []);
});

test('CLI: --plans-dir and --specs-dir, the options, and the root defaults to the current directory', () => {
  const root = project({ 'docs/specs/10-probe.md': SPEC, 'plans/06-probe.md': swap('Spec: specs/10-probe.md', 'Spec: 10-probe.md') });
  rmSync(join(root, 'specs'), { recursive: true });
  const run = (env, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: cleanEnv(env) });
  let result = run({}, 'plans/06-probe.md');
  assert.equal(result.status, 1, 'default specs folder has no spec');
  assert.match(result.stdout, /the spec "10-probe\.md" does not exist/);
  result = run({ CLAUDE_PLUGIN_OPTION_specs_dir: 'docs/specs' }, 'plans/06-probe.md');
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /1 plan\(s\), 0 error\(s\)/);
  result = run({ CLAUDE_PLUGIN_OPTION_specs_dir: '${user_config.specs_dir}' }, 'plans/06-probe.md', '--specs-dir', 'docs/specs');
  assert.equal(result.status, 0, result.stdout);
});

test('option() and the path predicates', () => {
  assert.equal(option('plans_dir', 'docs/plans', {}), 'docs/plans');
  assert.equal(option('plans_dir', 'docs/plans', { CLAUDE_PLUGIN_OPTION_plans_dir: 'p' }), 'p');
  assert.equal(option('plans_dir', 'docs/plans', { CLAUDE_PLUGIN_OPTION_PLANS_DIR: 'p' }), 'p');
  assert.equal(option('plans_dir', 'docs/plans', { CLAUDE_PLUGIN_OPTION_plans_dir: ' ' }), 'docs/plans');
  assert.equal(option('plans_dir', 'docs/plans', { CLAUDE_PLUGIN_OPTION_plans_dir: '${user_config.plans_dir}' }), 'docs/plans');
  const root = project({ 'docs/plans/06-probe.md': PLAN });
  const dir = join(root, 'docs/plans');
  assert.equal(isPlanPath(dir, join(dir, '06-probe.md')), true);
  assert.equal(isPlanPath(dir, join(dir, '06-probe.brainstorm.md')), false);
  assert.equal(isPlanPath(dir, join(dir, 'README.md')), false);
  assert.equal(isPlanPath(dir, join(root, 'src/app.ts')), false);
  for (const yes of ['a.test.ts', 'src/a.spec.jsx', 'pkg/a_test.go', 'tests/x.py', 'test_x.py', 'src/__tests__/a.js']) assert.ok(TEST_FILE.test(yes), yes);
  for (const no of ['src/app.ts', 'src/contest.ts', 'docs/plans/06-probe.md']) assert.ok(!TEST_FILE.test(no), no);
});

test('the planner format: Tests (new) and Existing tests to update lines do not break the steps', () => {
  const plan = parsePlan(PLAN);
  assert.equal(plan.steps.length, 2);
  assert.deepEqual(stepFiles(plan.steps[0]).map((f) => f.path), ['src/probe.ts', 'src/app.ts']);
  // A step whose Tests (new) line is "none" still needs its Files, Change and Done when.
  assert.deepEqual(errors(swap('- Tests (new): `test/probe.test.ts` — proves AC-1, EC-1', '- Tests (new): none')), []);
  // A spec id cited only on a Tests (new) line counts as covered.
  assert.deepEqual(errors(swap('- Covers: AC-1, EC-1', '- Covers: none')), []);
  has(errors(swap('- Covers: AC-1, EC-1', '- Covers: none').replace('— proves AC-1, EC-1', '— proves AC-1')), 'no step cites EC-1');
});

test('--implemented P2: the spec follows the plan (implemented plan -> implemented spec, partial plan -> approved spec)', () => {
  const p2 = (planStatus, specStatus) => {
    const root = project({ 'docs/plans/06-probe.md': PLAN, 'specs/10-probe.md': SPEC.replace('approved', specStatus) });
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'add', '.');
    git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
    const text = PLAN.replace('Status: draft', `Status: ${planStatus}`);
    return checkImplemented(text, root, 'docs/plans/06-probe.md', 'HEAD').find((l) => l.id === 'P2');
  };
  assert.equal(p2('implemented', 'implemented').level, 'PASS');
  assert.equal(p2('implemented', 'approved').level, 'FAIL'); // the implementer forgot the spec
  assert.equal(p2('partial', 'approved').level, 'PASS');
  assert.equal(p2('partial', 'implemented').level, 'FAIL');
});

test('--implemented: falls back to master when there is no main', () => {
  const root = project({ 'docs/plans/06-probe.md': PLAN });
  git(root, 'init', '-q', '-b', 'master');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'feature');
  write(root, 'src/probe.ts', 'export {};\n');
  const lines = checkImplemented(PLAN.replace('Status: draft', 'Status: implemented'), root, 'docs/plans/06-probe.md');
  assert.ok(lines.some((l) => l.id === 'S1.files'), 'the base was found');
  assert.ok(!lines.some((l) => l.id === 'base'));
});

test('no plan path is a usage error', () => {
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: cleanEnv() }).status, 3);
});
