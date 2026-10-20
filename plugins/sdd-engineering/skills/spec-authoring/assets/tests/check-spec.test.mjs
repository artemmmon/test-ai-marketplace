// Tests for check-spec.mjs: the worked example must pass, and each rule must catch its fault.
// Run directly: node check-spec.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSpec, isSpecPath, option, specsDir } from '../check-spec.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '../check-spec.mjs');
const EXAMPLE = readFileSync(join(here, '../../references/example-spec.md'), 'utf8');
const NAME = '00-link-click-counter.md';

const errors = (text, name = NAME) => checkSpec(text, name).filter((p) => p.level === 'error').map((p) => p.message);
const warnings = (text) => checkSpec(text, NAME).filter((p) => p.level === 'warning').map((p) => p.message);
const has = (list, part) => assert.ok(list.some((m) => m.includes(part)), `no "${part}" in:\n${list.join('\n')}`);
const swap = (from, to) => {
  assert.ok(EXAMPLE.includes(from), `fixture lost "${from}"`);
  return EXAMPLE.replace(from, to);
};
const BROKEN = EXAMPLE.replace('Status: draft\n', '');

// The child process must not inherit plugin options or the project dir of the session running the tests.
const cleanEnv = (extra = {}) => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^CLAUDE_PLUGIN_OPTION_/i.test(key) || key === 'CLAUDE_PROJECT_DIR') delete env[key];
  return { ...env, ...extra };
};
const tempRoot = () => mkdtempSync(join(tmpdir(), 'spec-check-'));
const write = (root, file, text) => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};

test('the worked example has no errors and no warnings', () => {
  assert.deepEqual(checkSpec(EXAMPLE, NAME), []);
});

test('header: title, fields, status and file name', () => {
  has(errors(swap('# Spec: Link Click Counter', '# Link Click Counter')), '# Spec: <feature name>');
  has(errors(swap('Packages: api, web\n', '')), '"Packages:" is missing');
  has(errors(swap('Status: draft', 'Status: done')), 'Status must be one of');
  has(errors(EXAMPLE, '10-link-click-counter.md'), 'does not match the file number');
  has(errors(EXAMPLE, 'LinkClickCounter.md'), 'kebab-case');
});

test('sections: missing, empty, unknown', () => {
  const untrusted = EXAMPLE.slice(EXAMPLE.indexOf('## Untrusted inputs'), EXAMPLE.indexOf('## Open questions'));
  has(errors(swap(untrusted, '')), '"## Untrusted inputs" is missing');
  has(errors(swap(untrusted, '## Untrusted inputs\n\n')), 'is empty');
  has(errors(swap('## Edge cases', '## Design\nText.\n\n## Edge cases')), 'not in the template');
});

test('user stories: shape and coverage', () => {
  has(errors(swap('As a link owner, I want to see how many times each short link was opened,', 'Show how many times each short link was opened,')), 'US-1 must read');
  const onlyUs1 = EXAMPLE.split('(US-1, US-2)').join('(US-1)').replace('- AC-4 (US-2)', '- AC-4 (US-1)').replace('- AC-5 (US-2)', '- AC-5 (US-1)');
  has(errors(onlyUs1), 'US-2 has no acceptance criterion');
});

test('acceptance criteria: EARS shape, one shall, story reference', () => {
  has(errors(swap('WHEN a visitor is redirected through a short link, the api shall add', 'When a visitor is redirected through a short link, the api shall add')), 'keyword in capitals');
  has(errors(swap('WHEN a visitor is redirected through a short link, the api shall add 1 to that\n  link\'s click count.', 'The api adds 1, when a visitor is redirected, to the click count.')), '0 "shall"');
  has(errors(swap('the api shall add 1', 'the api shall validate and shall add 1')), '2 "shall"');
  has(errors(swap('WHEN a visitor is redirected through a short link, the api shall add', 'the api shall, WHEN a visitor is redirected, add')), 'no EARS pattern');
  has(errors(swap('- AC-1 (US-1): WHEN', '- AC-1: WHEN')), 'must name the stories');
  has(errors(swap('- AC-1 (US-1): WHEN', '- AC-1 (US-9): WHEN')), 'US-9, which does not exist');
  has(errors(swap('- AC-3 (US-1)', '- AC-2 (US-1)')), 'AC-2 is used twice');
});

test('acceptance criteria: vague words and compound responses are warnings', () => {
  has(warnings(swap('the api shall add 1 to that', 'the api shall quickly add 1 to that')), '"quickly" is not checkable');
  has(warnings(swap('shall show `No clicks yet` in\n  place of the count.', 'shall show `No clicks yet` and hide the count.')), 'one response per criterion');
});

test('edge cases: arrow and a covering criterion that exists', () => {
  has(errors(swap('both opens are counted (AC-1)', 'both opens are counted')), 'names no criterion');
  has(errors(swap('leave the total (AC-4)', 'leave the total (AC-12)')), 'AC-12, which does not exist');
  has(errors(swap('the same moment → both', 'the same moment: both')), 'EC-2 must read');
});

test('inputs: one provenance tag, and a reason for every new call', () => {
  has(errors(swap('[deterministic: links]', 'computed')), 'exactly one provenance tag');
  has(errors(swap('| [deterministic: links] | Counts are read from stored data, no model |', '| [new: 1 LLM call] | |')), 'why nothing existing can serve');
  assert.deepEqual(errors(swap('| [deterministic: links] |', '| [new: 2 LLM calls] |')), []);
});

test('untrusted inputs and open questions', () => {
  has(errors(swap('| Matched exactly as data; a code that matches nothing changes nothing |', '| |')), 'all four cells');
  has(errors(swap(' — default if unanswered: no; every\n  redirect counts.', '')), 'default if unanswered');
});

test('what, not how: a code path in the body is an error, a diagram is not scanned', () => {
  has(errors(swap('Contract fields that cross', 'See `api/src/links/click.ts`, which crosses')), 'is a code path');
  assert.deepEqual(errors(swap('  API-->>V: redirect to the target address', '  API-->>V: shall shall src/a/b.ts')), []);
});

test('option(): env value, upper-case name, and the unset rule', () => {
  assert.equal(option('specs_dir', 'specs', {}), 'specs');
  assert.equal(option('specs_dir', 'specs', { CLAUDE_PLUGIN_OPTION_specs_dir: 'docs/specs' }), 'docs/specs');
  assert.equal(option('specs_dir', 'specs', { CLAUDE_PLUGIN_OPTION_SPECS_DIR: 'docs/specs' }), 'docs/specs');
  assert.equal(option('specs_dir', 'specs', { CLAUDE_PLUGIN_OPTION_specs_dir: '' }), 'specs');
  assert.equal(option('specs_dir', 'specs', { CLAUDE_PLUGIN_OPTION_specs_dir: '   ' }), 'specs');
  assert.equal(option('specs_dir', 'specs', { CLAUDE_PLUGIN_OPTION_specs_dir: '${user_config.specs_dir}' }), 'specs');
  assert.equal(option('specs_dir', 'specs', { CLAUDE_PLUGIN_OPTION_specs_dir: '${user_config.specs_dir}', CLAUDE_PLUGIN_OPTION_SPECS_DIR: 'a' }), 'a');
});

test('specsDir() and isSpecPath(): only .md files directly inside the folder', () => {
  const root = tempRoot();
  write(root, 'specs/00-a.md', 'x');
  write(root, 'specs/README.md', 'x');
  write(root, 'specs/sub/00-b.md', 'x');
  write(root, 'other/00-c.md', 'x');
  const folder = specsDir(root, undefined, {});
  assert.equal(folder, join(root, 'specs'));
  assert.equal(specsDir(root, undefined, { CLAUDE_PLUGIN_OPTION_specs_dir: 'docs/specs' }), join(root, 'docs/specs'));
  assert.equal(isSpecPath(folder, join(folder, '00-a.md')), true);
  assert.equal(isSpecPath(folder, join(folder, 'README.md')), false);
  assert.equal(isSpecPath(folder, join(folder, 'sub/00-b.md')), false);
  assert.equal(isSpecPath(folder, join(root, 'other/00-c.md')), false);
  assert.equal(isSpecPath(folder, join(folder, '00-a.txt')), false);
});

test('CLI: default folder is specs; scans it, skips legacy specs and README, exits 1 on errors', () => {
  const root = tempRoot();
  write(root, 'specs/README.md', '# Specs\n');
  write(root, 'specs/01-legacy.md', '# Legacy\nStatus: done\n');
  write(root, 'specs/00-link-click-counter.md', EXAMPLE);
  write(root, 'docs/specs/00-link-click-counter.md', BROKEN);
  const run = (env, ...args) => spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8', env: cleanEnv(env) });

  let result = run({});
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /1 spec\(s\), 0 error\(s\)/);

  // a copy with the same Spec ID in the same folder
  write(root, 'specs/00-copy.md', EXAMPLE);
  result = run({});
  assert.equal(result.status, 1);
  assert.match(result.stdout, /SPEC-00 is also used by/);
});

test('CLI: the folder from the plugin option, the unset rule, and --specs-dir', () => {
  const root = tempRoot();
  write(root, 'specs/00-link-click-counter.md', EXAMPLE);
  write(root, 'docs/specs/00-broken.md', BROKEN);
  const run = (env, ...args) => spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8', env: cleanEnv(env) });

  let result = run({ CLAUDE_PLUGIN_OPTION_specs_dir: 'docs/specs' });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /"Status:" is missing/);
  assert.match(result.stdout, /1 spec\(s\), 1 error\(s\)/);

  result = run({ CLAUDE_PLUGIN_OPTION_SPECS_DIR: 'docs/specs' });
  assert.equal(result.status, 1, 'the upper-case name is read too');

  for (const unset of ['', '${user_config.specs_dir}']) {
    result = run({ CLAUDE_PLUGIN_OPTION_specs_dir: unset });
    assert.equal(result.status, 0, `"${unset}" must count as unset\n${result.stdout}`);
    assert.match(result.stdout, /1 spec\(s\), 0 error\(s\)/);
  }

  result = run({ CLAUDE_PLUGIN_OPTION_specs_dir: 'specs' }, '--specs-dir', 'docs/specs');
  assert.equal(result.status, 1, '--specs-dir wins over the option');

  result = run({ CLAUDE_PLUGIN_OPTION_specs_dir: 'missing/folder' });
  assert.equal(result.status, 0, 'a folder that does not exist has no specs');
  assert.match(result.stdout, /0 spec\(s\), 0 error\(s\)/);
});

test('CLI: every spec path given is checked, with or without --root', () => {
  const root = tempRoot();
  const good = join(root, '00-link-click-counter.md');
  const broken = join(root, '00-broken.md');
  writeFileSync(good, EXAMPLE);
  writeFileSync(broken, BROKEN);
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: cleanEnv() });

  let result = run(broken);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /"Status:" is missing/);
  assert.match(result.stdout, /1 spec\(s\), 1 error\(s\)/);

  result = run(broken, good);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /2 spec\(s\)/);

  result = run(good);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /1 spec\(s\), 0 error\(s\)/);

  result = run('--root', root, broken);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /1 spec\(s\), 1 error\(s\)/);
});

test('hook mode: exit 2 with the errors on stderr, silent on a clean spec or another file', () => {
  const root = tempRoot();
  write(root, 'specs/00-link-click-counter.md', EXAMPLE);
  write(root, 'specs/00-broken.md', BROKEN);
  write(root, 'specs/README.md', '# Specs\n');
  write(root, 'specs/nested/00-broken.md', BROKEN);
  write(root, 'elsewhere/00-broken.md', BROKEN);
  const hook = (file_path, env = {}, payload = {}) =>
    spawnSync(process.execPath, [SCRIPT, '--hook'], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path }, ...payload }),
      env: cleanEnv({ CLAUDE_PROJECT_DIR: root, ...env }),
      encoding: 'utf8',
    });

  assert.equal(hook('specs/00-link-click-counter.md').status, 0);
  assert.equal(hook('specs/README.md').status, 0);
  assert.equal(hook('specs/nested/00-broken.md').status, 0, 'only files directly inside the folder');
  assert.equal(hook('elsewhere/00-broken.md').status, 0, 'other folders are not specs');
  assert.equal(hook('specs/00-missing.md').status, 0, 'a file that is not there is skipped');
  const broken = hook('specs/00-broken.md');
  assert.equal(broken.status, 2);
  assert.match(broken.stderr, /"Status:" is missing/);
  assert.equal(broken.stdout, '');
  assert.equal(hook(join(root, 'specs/00-broken.md')).status, 2, 'an absolute path works too');
});

test('hook mode: custom folder from the option, the unset rule, root from the payload cwd', () => {
  const root = tempRoot();
  write(root, 'specs/00-broken.md', BROKEN);
  write(root, 'docs/specs/00-broken.md', BROKEN);
  const hook = (file_path, env, payload = {}) =>
    spawnSync(process.execPath, [SCRIPT, '--hook'], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path }, ...payload }),
      env: cleanEnv({ CLAUDE_PROJECT_DIR: root, ...env }),
      encoding: 'utf8',
    });

  assert.equal(hook('docs/specs/00-broken.md', { CLAUDE_PLUGIN_OPTION_specs_dir: 'docs/specs' }).status, 2);
  assert.equal(hook('specs/00-broken.md', { CLAUDE_PLUGIN_OPTION_specs_dir: 'docs/specs' }).status, 0, 'the default folder is not checked once another is set');
  for (const unset of ['', '${user_config.specs_dir}']) {
    assert.equal(hook('specs/00-broken.md', { CLAUDE_PLUGIN_OPTION_specs_dir: unset }).status, 2, `"${unset}" must count as unset`);
    assert.equal(hook('docs/specs/00-broken.md', { CLAUDE_PLUGIN_OPTION_specs_dir: unset }).status, 0);
  }
  assert.equal(hook('specs/00-broken.md', {}).status, 2, 'default folder');

  const fromCwd = spawnSync(process.execPath, [SCRIPT, '--hook'], {
    input: JSON.stringify({ cwd: root, tool_input: { file_path: 'specs/00-broken.md' } }),
    env: cleanEnv(),
    encoding: 'utf8',
  });
  assert.equal(fromCwd.status, 2, 'without CLAUDE_PROJECT_DIR the payload cwd is the root');
});

test('hook mode: unreadable or irrelevant payloads exit 0 silently', () => {
  const run = (input) => spawnSync(process.execPath, [SCRIPT, '--hook'], { input, env: cleanEnv(), encoding: 'utf8' });
  for (const input of ['', 'not json', 'null', '[]', '{}', JSON.stringify({ tool_input: {} }), JSON.stringify({ tool_input: { file_path: 5 } })]) {
    const result = run(input);
    assert.equal(result.status, 0, input);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, '');
  }
});
