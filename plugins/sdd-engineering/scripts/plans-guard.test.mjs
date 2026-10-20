// Tests for plans-guard.mjs: each case feeds one PreToolUse payload to the hook in a
// throw-away project dir and checks the exit code (0 = allow, 2 = block).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'plans-guard.mjs');
const AGENTS = { plan: 'sdd-engineering:implementation-planner', brainstorm: 'sdd-engineering:brainstorm' };
const PLAN = '# Development Plan: Probe\nStatus: draft\n\n## Goal\nText.\n';
const BRIEF = '# Brainstorm: Probe\nStatus: awaiting choice\n\n## Problem\nText.\n';

function project(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'plans-guard-'));
  mkdirSync(join(root, 'docs/plans'), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

// The caller is the kind's own agent unless `extra` says otherwise.
function run(root, kind, tool_name, tool_input = {}, { extra, env = {} } = {}) {
  const payloadExtra = extra ?? { agent_type: AGENTS[kind], agent_id: 'a1' };
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_PLUGIN_OPTION_')));
  const result = spawnSync(process.execPath, [GUARD, ...(kind ? ['--kind', kind] : [])], {
    input: JSON.stringify({ tool_name, tool_input, ...payloadExtra }),
    env: { ...clean, CLAUDE_PROJECT_DIR: root, ...env },
    encoding: 'utf8',
  });
  return { code: result.status, stderr: result.stderr };
}

const allowed = (r) => assert.equal(r.code, 0, r.stderr);
const blocked = (r) => assert.equal(r.code, 2, 'expected the guard to block');

test('a missing or unknown --kind does nothing (the hook runs in every session)', () => {
  const root = project();
  allowed(run(root, null, 'Write', { file_path: 'docs/plans/06-probe.md', content: PLAN }, { extra: { agent_type: AGENTS.plan } }));
  allowed(run(root, 'spec', 'Write', { file_path: 'docs/plans/06-probe.md', content: PLAN }, { extra: { agent_type: AGENTS.plan } }));
});

test('tools other than Write and Edit are not this hook\'s business', () => {
  allowed(run(project(), 'plan', 'Read', { file_path: 'src/a.ts' }));
});

test('plan: only a draft <plans_dir>/NN-name.md passes', () => {
  const root = project({ 'src/a.ts': '' });
  allowed(run(root, 'plan', 'Write', { file_path: 'docs/plans/06-probe.md', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/06-probe.brainstorm.md', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/probe.md', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/nested/06-probe.md', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/../06-probe.md', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/06-probe.md', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'specs/10-probe.md', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'src/a.ts', content: PLAN }));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/06-probe.md', content: PLAN.replace('draft', 'approved') }));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/06-probe.md', content: '# Development Plan: no status\n' }));
});

test('plan: an approved or running plan is read-only, and an Edit cannot change the status', () => {
  const root = project({
    'docs/plans/06-draft.md': PLAN,
    'docs/plans/07-approved.md': PLAN.replace('draft', 'approved'),
    'docs/plans/08-running.md': PLAN.replace('draft', 'in progress'),
  });
  const edit = (file, old_string, new_string) => run(root, 'plan', 'Edit', { file_path: `docs/plans/${file}`, old_string, new_string });
  allowed(edit('06-draft.md', 'Text.', 'Better text.'));
  blocked(edit('06-draft.md', 'draft', 'approved'));
  blocked(edit('06-draft.md', 'Status: draft\n', ''));
  blocked(edit('07-approved.md', 'Text.', 'Better text.'));
  blocked(edit('08-running.md', 'in progress', 'draft'));
});

test('brainstorm: only an awaiting-choice brief passes', () => {
  const root = project({ 'docs/plans/05-chosen.brainstorm.md': BRIEF.replace('awaiting choice', 'chosen: option 2') });
  allowed(run(root, 'brainstorm', 'Write', { file_path: 'docs/plans/06-probe.brainstorm.md', content: BRIEF }));
  blocked(run(root, 'brainstorm', 'Write', { file_path: 'docs/plans/06-probe.md', content: BRIEF }));
  blocked(run(root, 'brainstorm', 'Write', { file_path: 'docs/plans/06-probe.brainstorm.md', content: BRIEF.replace('awaiting choice', 'chosen: option 1') }));
  blocked(run(root, 'brainstorm', 'Edit', { file_path: 'docs/plans/05-chosen.brainstorm.md', old_string: 'Text.', new_string: 'New.' }));
});

test('a symlink cannot lead a write out of the plans folder', () => {
  const root = project({ 'src/a.ts': '' });
  symlinkSync(join(root, 'src/a.ts'), join(root, 'docs/plans/06-link.md'));
  blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/06-link.md', content: PLAN }));
});

test('not this kind\'s agent (other agent, the other kind, main thread): allow and do nothing', () => {
  const root = project({ 'src/a.ts': '' });
  const outside = { file_path: 'src/a.ts', content: 'x' };
  const approved = { file_path: 'docs/plans/06-probe.md', content: PLAN.replace('draft', 'approved') };
  for (const extra of [
    { agent_type: 'sdd-engineering:implementer', agent_id: 'a1' },
    { agent_type: 'sdd-engineering:spec-creator', agent_id: 'a2' },
    { agent_type: 'implementation-planner', agent_id: 'a3' },
    {}, // main thread
  ]) {
    for (const kind of ['plan', 'brainstorm']) {
      allowed(run(root, kind, 'Write', outside, { extra }));
      allowed(run(root, kind, 'Write', approved, { extra }));
    }
  }
  // The planner is not bound by the brainstorm kind's rules, and the other way round.
  allowed(run(root, 'brainstorm', 'Write', outside, { extra: { agent_type: AGENTS.plan } }));
  allowed(run(root, 'plan', 'Write', outside, { extra: { agent_type: AGENTS.brainstorm } }));
  const raw = spawnSync(process.execPath, [GUARD, '--kind', 'plan'], { input: 'not json', encoding: 'utf8' });
  assert.equal(raw.status, 0);
});

test('plans_dir: the built-in default applies when the option is unset, empty or a user_config placeholder', () => {
  const root = project({ 'src/a.ts': '' });
  for (const value of [undefined, '', '${user_config.plans_dir}']) {
    const env = value === undefined ? {} : { CLAUDE_PLUGIN_OPTION_plans_dir: value };
    allowed(run(root, 'plan', 'Write', { file_path: 'docs/plans/06-probe.md', content: PLAN }, { env }));
    blocked(run(root, 'plan', 'Write', { file_path: 'plans/06-probe.md', content: PLAN }, { env }));
  }
});

test('plans_dir: a saved option moves the writable folder', () => {
  const root = project({ 'src/a.ts': '' });
  for (const env of [
    { CLAUDE_PLUGIN_OPTION_plans_dir: 'work/plans' },
    { CLAUDE_PLUGIN_OPTION_PLANS_DIR: 'work/plans/' },
    { CLAUDE_PLUGIN_OPTION_plans_dir: join(root, 'work/plans') },
  ]) {
    allowed(run(root, 'plan', 'Write', { file_path: 'work/plans/06-probe.md', content: PLAN }, { env }));
    allowed(run(root, 'brainstorm', 'Write', { file_path: 'work/plans/06-probe.brainstorm.md', content: BRIEF }, { env }));
    blocked(run(root, 'plan', 'Write', { file_path: 'docs/plans/06-probe.md', content: PLAN }, { env }));
    blocked(run(root, 'plan', 'Write', { file_path: 'work/plans/06-probe.md', content: PLAN.replace('draft', 'approved') }, { env }));
  }
});
