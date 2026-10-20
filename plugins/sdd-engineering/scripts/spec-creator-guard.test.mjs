// Tests for spec-creator-guard.mjs: each case feeds one PreToolUse payload to the hook in a
// throw-away project dir and checks the exit code (0 = allow, 2 = block).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'spec-creator-guard.mjs');
const OWN = 'sdd-engineering:spec-creator';
const DRAFT = '# Spec: Probe\nSpec ID: SPEC-10\nStatus: draft\n\n## Problem and user\nText.\n';

function project(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'spec-guard-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

// `extra` is merged into the payload (agent_type, agent_id); `env` into the hook's environment.
function run(root, tool_name, tool_input = {}, { extra = { agent_type: OWN }, env = {} } = {}) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_PLUGIN_OPTION_')));
  const result = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name, tool_input, ...extra }),
    env: { ...clean, CLAUDE_PROJECT_DIR: root, ...env },
    encoding: 'utf8',
  });
  return { code: result.status, stderr: result.stderr };
}

const allowed = (r) => assert.equal(r.code, 0, r.stderr);
const blocked = (r) => assert.equal(r.code, 2, 'expected the guard to block');

test('tools other than Write, Edit, Agent and MCP are not this hook\'s business', () => {
  const root = project();
  for (const tool of ['Read', 'Grep', 'Skill', 'SubagentHandback', 'SendMessage', '']) allowed(run(root, tool));
});

test('Agent: only research-tools:researcher may be started', () => {
  const root = project();
  allowed(run(root, 'Agent', { subagent_type: 'research-tools:researcher', prompt: 'q' }));
  allowed(run(root, 'Task', { subagent_type: 'research-tools:researcher', prompt: 'q' }));
  blocked(run(root, 'Agent', { subagent_type: 'researcher', prompt: 'q' }));
  blocked(run(root, 'Agent', { subagent_type: 'sdd-engineering:implementer', prompt: 'q' }));
  blocked(run(root, 'Agent', { subagent_type: 'general-purpose', prompt: 'q' }));
  blocked(run(root, 'Agent', { subagent_type: 'fork', prompt: 'q' }));
  blocked(run(root, 'Agent', { prompt: 'q' }));
});

test('MCP: only Figma get_* tools pass, under both known server prefixes', () => {
  const root = project();
  allowed(run(root, 'mcp__plugin_design_figma__get_design_context'));
  allowed(run(root, 'mcp__plugin_figma_figma__get_design_context'));
  blocked(run(root, 'mcp__plugin_design_figma__authenticate'));
  blocked(run(root, 'mcp__plugin_figma_figma__use_figma'));
  blocked(run(root, 'mcp__claude_ai_Claude_Docs__batch'));
});

test('Write: a draft spec in the spec folder passes, anything else is blocked', () => {
  const root = project({ 'specs/README.md': '# Specs\n', 'src/a.ts': '' });
  allowed(run(root, 'Write', { file_path: 'specs/10-probe.md', content: DRAFT }));
  allowed(run(root, 'Write', { file_path: join(root, 'specs/10-probe.md'), content: DRAFT }));
  allowed(run(root, 'Write', { file_path: 'specs/README.md', content: '# Specs\n- new line\n' }));
  blocked(run(root, 'Write', { file_path: 'src/a.ts', content: DRAFT }));
  blocked(run(root, 'Write', { file_path: 'docs/plans/10-probe.md', content: DRAFT }));
  blocked(run(root, 'Write', { file_path: 'pkg/specs/10-probe.md', content: DRAFT }));
  blocked(run(root, 'Write', { file_path: 'specs/nested/10-probe.md', content: DRAFT }));
  blocked(run(root, 'Write', { file_path: 'specs/../src/10-probe.md', content: DRAFT }));
  blocked(run(root, 'Write', { file_path: 'specs/10-probe.txt', content: DRAFT }));
  blocked(run(root, 'Write', { file_path: 'specs/10-probe.md', content: DRAFT.replace('draft', 'approved') }));
  blocked(run(root, 'Write', { file_path: 'specs/10-probe.md', content: '# Spec: no status\n' }));
});

test('Write and Edit: implemented and legacy specs are read-only', () => {
  const root = project({
    'specs/09-legacy.md': '# Legacy\nStatus: done\n',
    'specs/08-legacy-approved.md': '# Legacy\nStatus: approved\n',
    'specs/10-implemented.md': DRAFT.replace('draft', 'implemented'),
  });
  blocked(run(root, 'Write', { file_path: 'specs/10-implemented.md', content: DRAFT }));
  blocked(run(root, 'Edit', { file_path: 'specs/10-implemented.md', old_string: 'implemented', new_string: 'draft' }));
  blocked(run(root, 'Edit', { file_path: 'specs/09-legacy.md', old_string: 'Legacy', new_string: 'New' }));
  blocked(run(root, 'Edit', { file_path: 'specs/08-legacy-approved.md', old_string: 'approved', new_string: 'draft' }));
});

test('amendment: an approved spec can only be changed by reopening it as a draft', () => {
  const root = project({ 'specs/10-approved.md': DRAFT.replace('draft', 'approved') });
  const edit = (old_string, new_string) => run(root, 'Edit', { file_path: 'specs/10-approved.md', old_string, new_string });
  blocked(edit('Text.', 'Better text.'));
  blocked(run(root, 'Write', { file_path: 'specs/10-approved.md', content: DRAFT.replace('draft', 'approved') }));
  allowed(edit('Status: approved', 'Status: draft\nAmended: 2026-10-04 — AC-9 added'));
  allowed(run(root, 'Write', { file_path: 'specs/10-approved.md', content: DRAFT }));
});

test('Edit: the status cannot change, whatever part of the line is replaced', () => {
  const root = project({ 'specs/10-probe.md': DRAFT });
  const edit = (old_string, new_string, extra = {}) =>
    run(root, 'Edit', { file_path: 'specs/10-probe.md', old_string, new_string, ...extra });
  allowed(edit('Text.', 'Better text.'));
  blocked(edit('Status: draft', 'Status: approved'));
  blocked(edit('draft', 'approved'));
  blocked(edit('draft', 'approved', { replace_all: true }));
  blocked(edit('Status: draft\n', ''));
  blocked(edit('Spec ID: SPEC-10\n', 'Spec ID: SPEC-10\nStatus: approved\n'));
});

test('an insights file is outside the spec folder: blocked for spec-creator, open to the implementer', () => {
  const root = project({ 'src/INSIGHTS.md': '# Insights\n' });
  for (const file_path of ['INSIGHTS.md', 'src/INSIGHTS.md', 'specs/../INSIGHTS.md']) {
    blocked(run(root, 'Write', { file_path, content: 'x' }));
    blocked(run(root, 'Edit', { file_path, old_string: 'a', new_string: 'b' }));
    allowed(run(root, 'Write', { file_path, content: 'x' }, { extra: { agent_type: 'sdd-engineering:implementer', agent_id: 'i1' } }));
  }
});

test('a symlink cannot lead a write out of the spec folder', () => {
  const root = project({ 'specs/README.md': '# Specs\n', 'src/a.ts': '' });
  symlinkSync(join(root, 'src/a.ts'), join(root, 'specs/10-link.md'));
  blocked(run(root, 'Write', { file_path: 'specs/10-link.md', content: DRAFT }));
});

test('not spec-creator (other agent, main thread, unreadable payload): allow and do nothing', () => {
  const root = project({ 'src/a.ts': '' });
  const outside = { file_path: 'src/a.ts', content: 'x' };
  const approved = { file_path: 'specs/10-probe.md', content: DRAFT.replace('draft', 'approved') };
  for (const extra of [
    { agent_type: 'sdd-engineering:implementer', agent_id: 'a1' },
    { agent_type: 'sdd-engineering:implementation-planner', agent_id: 'a2' },
    { agent_type: 'spec-creator', agent_id: 'a3' }, // unscoped name is not the plugin agent
    { agent_type: 'other-plugin:spec-creator', agent_id: 'a4' },
    {}, // main thread: neither agent_id nor agent_type
  ]) {
    allowed(run(root, 'Write', outside, { extra }));
    allowed(run(root, 'Write', approved, { extra }));
    allowed(run(root, 'Agent', { subagent_type: 'sdd-engineering:implementer' }, { extra }));
    allowed(run(root, 'mcp__claude_ai_Claude_Docs__batch', {}, { extra }));
  }
  const raw = spawnSync(process.execPath, [GUARD], { input: 'not json', encoding: 'utf8' });
  assert.equal(raw.status, 0);
});

test('specs_dir: the built-in default applies when the option is unset, empty or a user_config placeholder', () => {
  const root = project({ 'src/a.ts': '' });
  for (const value of [undefined, '', '${user_config.specs_dir}']) {
    const env = value === undefined ? {} : { CLAUDE_PLUGIN_OPTION_specs_dir: value };
    allowed(run(root, 'Write', { file_path: 'specs/10-probe.md', content: DRAFT }, { env }));
    blocked(run(root, 'Write', { file_path: '${user_config.specs_dir}/10-probe.md', content: DRAFT }, { env }));
    blocked(run(root, 'Write', { file_path: 'docs/specs/10-probe.md', content: DRAFT }, { env }));
  }
});

test('specs_dir: a saved option moves the writable folder (relative or absolute, either env name case)', () => {
  const root = project({ 'src/a.ts': '' });
  for (const env of [
    { CLAUDE_PLUGIN_OPTION_specs_dir: 'docs/specs' },
    { CLAUDE_PLUGIN_OPTION_SPECS_DIR: 'docs/specs/' },
    { CLAUDE_PLUGIN_OPTION_specs_dir: join(root, 'docs/specs') },
  ]) {
    allowed(run(root, 'Write', { file_path: 'docs/specs/10-probe.md', content: DRAFT }, { env }));
    blocked(run(root, 'Write', { file_path: 'specs/10-probe.md', content: DRAFT }, { env }));
    blocked(run(root, 'Write', { file_path: 'docs/specs/10-probe.md', content: DRAFT.replace('draft', 'approved') }, { env }));
  }
});
