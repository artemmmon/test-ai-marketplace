// Tests for retro.mjs on a synthetic transcript tree: a main session, two parallel subagents and
// one nested under the first. No network, no real transcripts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LEDGER, bashReads, claudeDir, collect, ledgerRow, option, parallelism, render, write } from '../retro.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../retro.mjs');
const PRICES = { opus: { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 }, sonnet: { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 } };
const CWD = '/work/demo';
const T = (minute, second = 0) => `2026-10-04T10:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;

// One assistant line. `final` adds the stop_reason that marks the real output count.
function line(requestId, at, usage, content, { model = 'claude-sonnet-5-5', final = true } = {}) {
  return JSON.stringify({
    type: 'assistant', requestId, timestamp: at,
    message: { id: `msg_${requestId}`, model, stop_reason: final ? 'tool_use' : null, content,
      usage: { input_tokens: usage.input ?? 0, output_tokens: usage.output ?? 0, cache_read_input_tokens: usage.read ?? 0, cache_creation_input_tokens: usage.write ?? 0, cache_creation: { ephemeral_1h_input_tokens: usage.write1h ?? 0 } } },
  });
}
const tool = (id, name, input) => ({ type: 'tool_use', id, name, input });

function fixture(cwd = CWD) {
  const projects = mkdtempSync(join(tmpdir(), 'retro-'));
  const dir = join(projects, cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  const sub = join(dir, 'sess-1', 'subagents');
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(dir, 'sess-1.jsonl'), [
    JSON.stringify({ type: 'user', timestamp: T(0), message: { content: 'build docs/plans/06-x.md' } }),
    // One response written as two lines: the usage must be counted once, with the final output.
    line('m1', T(0, 5), { input: 10, output: 5, read: 1000, write: 500, write1h: 500 }, [tool('tu_a', 'Agent', { subagent_type: 'implementer' })], { model: 'claude-opus-5-5', final: false }),
    line('m1', T(0, 6), { input: 10, output: 200, read: 1000, write: 500, write1h: 500 }, [tool('tu_b', 'Agent', { subagent_type: 'implementer' })], { model: 'claude-opus-5-5' }),
    line('m2', T(30), { input: 10, output: 100, read: 2000 }, [tool('tu_r', 'Read', { file_path: `${CWD}/AGENTS.md` })], { model: 'claude-opus-5-5' }),
  ].join('\n'));
  const agent = (id, meta, lines) => {
    writeFileSync(join(sub, `agent-${id}.meta.json`), JSON.stringify(meta));
    writeFileSync(join(sub, `agent-${id}.jsonl`), lines.join('\n'));
  };
  agent('aaaa1111', { agentType: 'implementer', description: 'group A', toolUseId: 'tu_a', spawnDepth: 1 }, [
    line('a1', T(1), { input: 5, output: 50, read: 100, write: 900 }, [tool('tu_a1', 'Read', { file_path: `${CWD}/src/INSIGHTS.md` })]),
    line('a2', T(5), { input: 5, output: 50, read: 1000 }, [tool('tu_n', 'Agent', { subagent_type: 'researcher' }), tool('tu_a2', 'Bash', { command: `cat ${CWD}/src/INSIGHTS.md | head -5` })]),
    // No stop_reason on any line of this request: output is estimated from the 400 characters.
    line('a3', T(10), { input: 5, output: 3, read: 2000 }, [{ type: 'text', text: 'x'.repeat(400) }], { final: false }),
  ]);
  agent('bbbb2222', { agentType: 'implementer', description: 'group B', toolUseId: 'tu_b', spawnDepth: 1 }, [
    line('b1', T(2), { input: 5, output: 50, read: 100, write: 900 }, [tool('tu_b1', 'Bash', { command: `sed -n '1,40p' src/INSIGHTS.md && npm run typecheck` })]),
    line('b2', T(8), { input: 5, output: 50, read: 1000 }, [tool('tu_b2', 'Edit', { file_path: `${CWD}/a.ts` })]),
  ]);
  agent('cccc3333', { agentType: 'researcher', description: 'nested question', toolUseId: 'tu_n', spawnDepth: 2 }, [
    line('c1', T(6), { input: 5, output: 20, read: 100, write: 300 }, [tool('tu_c1', 'Read', { file_path: `${CWD}/src/INSIGHTS.md` })], { model: 'claude-haiku-4-5' }),
    line('c2', T(7), { input: 5, output: 20, read: 400 }, [{ type: 'text', text: 'done' }], { model: 'claude-haiku-4-5' }),
  ]);
  return projects;
}
const opts = (projectsDir, extra = {}) => ({ cwd: CWD, projectsDir, sessions: [], plan: null, since: null, until: null, shallow: false, prices: PRICES, ...extra });
const agentOf = (result, label) => result.agents.find((a) => a.label.startsWith(label));

test('deep: every transcript is read, one usage per request, the final output wins', () => {
  const result = collect(opts(fixture()));
  assert.equal(result.agents.length, 4);
  const main = agentOf(result, 'main');
  assert.equal(main.requests, 2);
  assert.equal(main.output, 300);
  assert.equal(main.cacheRead, 3000);
  assert.equal(main.toolCalls, 3);
  assert.equal(main.launched, 2);
  assert.equal(result.totals.agents, 3);
  assert.equal(result.totals.maxDepth, 2);
  assert.equal(result.totals.tokens, result.agents.reduce((t, a) => t + a.total, 0));
});

test('output without a stop_reason is estimated from the response text', () => {
  const a = agentOf(collect(opts(fixture())), 'implementer:1111');
  assert.equal(a.output, 50 + 50 + 100);
  assert.equal(a.outputEstimated, 1);
});

test('nested subagents: the parent is the transcript holding the tool call, subtrees add up', () => {
  const result = collect(opts(fixture()));
  const nested = agentOf(result, 'researcher');
  const a = agentOf(result, 'implementer:1111');
  assert.equal(nested.parent, a.label);
  assert.equal(nested.depth, 2);
  assert.equal(a.subtreeAgents, 1);
  assert.equal(a.subtreeTotal, a.total + nested.total);
  assert.equal(agentOf(result, 'main').subtreeTotal, result.totals.tokens);
});

test('shallow: only the main session is counted, and the report says what is missing', () => {
  const projects = fixture();
  const shallow = collect(opts(projects, { shallow: true }));
  const deep = collect(opts(projects));
  assert.equal(shallow.agents.length, 1);
  assert.equal(shallow.unread, 3);
  assert.ok(shallow.totals.tokens < deep.totals.tokens);
  assert.match(render(shallow, 'x'), /3 subagent transcript\(s\) were NOT read/);
});

test('parallelism: peak, the agents at the peak, agent time', () => {
  const result = collect(opts(fixture()));
  assert.equal(result.parallel.peak, 3);
  assert.equal(result.parallel.peakSet.length, 3);
  assert.equal(result.parallel.agentMs, (9 + 6 + 1) * 60_000);
  assert.equal(parallelism([]).peak, 0);
});

test('cost: priced per model family, and left out when a model has no price', () => {
  const result = collect(opts(fixture()));
  const main = agentOf(result, 'main');
  assert.ok(Math.abs(main.cost - (20 * 4 + 300 * 20 + 3000 * 0.2 + 500 * 8) / 1e6) < 1e-9);
  assert.equal(agentOf(result, 'researcher').cost, null);
  assert.equal(result.totals.cost, null);
  assert.match(render(result, 'x'), /No price for: claude-haiku-4-5/);
});

test('bashReads: cat, sed -n, head and tail name files with a folder; other commands do not', () => {
  assert.deepEqual(bashReads("cat a/b.md c.json | head -3 && sed -n '1,40p' d/e.ts; tail -20 f.log"), ['a/b.md', 'd/e.ts']);
  assert.deepEqual(bashReads("sed -i 's/a/b/' x.ts && npm test && git diff -- a.ts && cat $FILE"), []);
});

test('signals: a file read by several agents, through Read or Bash', () => {
  const result = collect(opts(fixture()));
  const kinds = result.signals.map((s) => `${s.kind}: ${s.text}`);
  assert.ok(kinds.some((k) => k.startsWith('preload') && k.includes('2 of 2 `implementer` agents read `src/INSIGHTS.md`')), kinds.join('\n'));
  assert.ok(kinds.some((k) => k.includes('read more than once by the same agent: implementer:1111 ×2')), kinds.join('\n'));
  assert.ok(!kinds.some((k) => k.startsWith('concurrency')), 'peak 3 is under the limit');
});

test('window: --since drops earlier requests', () => {
  const result = collect(opts(fixture(), { since: T(4) }));
  assert.equal(agentOf(result, 'main').requests, 1);
  assert.equal(agentOf(result, 'implementer:2222').requests, 1);
});

test('--plan finds the sessions that mention the plan; nothing found is exit 2', () => {
  const projects = fixture();
  assert.equal(collect(opts(projects, { plan: 'docs/plans/06-x.md' })).files.length, 1);
  assert.throws(() => collect(opts(projects, { plan: 'docs/plans/99-none.md' })), /no session transcripts/);
  const cli = spawnSync(process.execPath, [SCRIPT, '--projects-dir', projects, '--cwd', '/work/other'], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
});

test('--write: a report file, a ledger with a header, one row per run and label', () => {
  const projects = fixture();
  const ledger = join(projects, 'retros', 'ledger.md');
  const result = collect(opts(projects));
  const first = write(result, 'Blast Radius', null, ledger);
  assert.match(first.report, /retros\/2026-10-04-blast-radius\.md$/);
  assert.equal(first.ledger, ledger);
  assert.match(readFileSync(first.report, 'utf8'), /## By agent/);
  write(result, 'Blast Radius', 'split implementer groups', ledger);
  write(result, 'second run', null, ledger);
  const rows = readFileSync(first.ledger, 'utf8').split('\n').filter((l) => l.startsWith('| 2026-'));
  assert.equal(rows.length, 2);
  assert.match(rows[0], /second run|Blast Radius/);
  assert.ok(rows.some((r) => r.includes('split implementer groups')));
  assert.equal(ledgerRow(result, 'x', 'a | b').split('|').length, 16);
});

test('CLI prints the Markdown report', () => {
  const cli = spawnSync(process.execPath, [SCRIPT, '--projects-dir', fixture(), '--cwd', CWD, '--label', 'demo'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /# Workflow retro: demo/);
  assert.match(cli.stdout, /\| implementer \| 2 \|/);
});

// The child process must not inherit plugin options or the project dir of the session running the tests.
const cleanEnv = (extra = {}) => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^CLAUDE_PLUGIN_OPTION_/i.test(key) || key === 'CLAUDE_PROJECT_DIR' || key === 'CLAUDE_CONFIG_DIR') delete env[key];
  return { ...env, ...extra };
};

test('option(): env value, upper-case name, and the unset rule', () => {
  assert.equal(DEFAULT_LEDGER, 'docs/retros/ledger.md');
  assert.equal(option('retro_ledger', DEFAULT_LEDGER, {}), DEFAULT_LEDGER);
  assert.equal(option('retro_ledger', DEFAULT_LEDGER, { CLAUDE_PLUGIN_OPTION_retro_ledger: 'notes/l.md' }), 'notes/l.md');
  assert.equal(option('retro_ledger', DEFAULT_LEDGER, { CLAUDE_PLUGIN_OPTION_RETRO_LEDGER: 'notes/l.md' }), 'notes/l.md');
  assert.equal(option('retro_ledger', DEFAULT_LEDGER, { CLAUDE_PLUGIN_OPTION_retro_ledger: '' }), DEFAULT_LEDGER);
  assert.equal(option('retro_ledger', DEFAULT_LEDGER, { CLAUDE_PLUGIN_OPTION_retro_ledger: '${user_config.retro_ledger}' }), DEFAULT_LEDGER);
  assert.equal(claudeDir({ CLAUDE_CONFIG_DIR: '/x/cfg' }), '/x/cfg');
  assert.match(claudeDir({}), /\.claude$/);
  assert.match(claudeDir({ CLAUDE_CONFIG_DIR: '${CLAUDE_CONFIG_DIR}' }), /\.claude$/);
});

test('CLI --write: ledger from the default, the option, the unset rule and --ledger', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'retro-cwd-'));
  const projects = fixture(cwd);
  const run = (env, ...args) =>
    spawnSync(process.execPath, [SCRIPT, '--projects-dir', projects, '--cwd', cwd, '--label', 'demo', '--write', ...args], { cwd, encoding: 'utf8', env: cleanEnv(env) });
  const rows = (file) => readFileSync(join(cwd, file), 'utf8').split('\n').filter((l) => l.startsWith('| 2026-')).length;

  let result = run({});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /wrote docs\/retros\/2026-10-04-demo\.md and one row in docs\/retros\/ledger\.md/);
  assert.equal(rows('docs/retros/ledger.md'), 1);

  for (const unset of ['', '${user_config.retro_ledger}']) {
    result = run({ CLAUDE_PLUGIN_OPTION_retro_ledger: unset });
    assert.match(result.stderr, /docs\/retros\/ledger\.md/, `"${unset}" counts as unset`);
  }
  assert.equal(rows('docs/retros/ledger.md'), 1, 'the same run and label replaces its row');

  result = run({ CLAUDE_PLUGIN_OPTION_retro_ledger: 'notes/retro-log.md' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(rows('notes/retro-log.md'), 1);
  assert.ok(readFileSync(join(cwd, 'notes/2026-10-04-demo.md'), 'utf8').includes('# Workflow retro: demo'), 'the report sits beside the ledger');

  result = run({ CLAUDE_PLUGIN_OPTION_retro_ledger: 'notes/retro-log.md' }, '--ledger', 'other/l.md');
  assert.equal(rows('other/l.md'), 1, '--ledger wins over the option');
});

test('CLI: transcripts are read from CLAUDE_CONFIG_DIR/projects', () => {
  const config = mkdtempSync(join(tmpdir(), 'retro-cfg-'));
  const projects = fixture();
  const dir = join(config, 'projects');
  mkdirSync(dir);
  // reuse the fixture tree by copying its project folder
  const cp = spawnSync('cp', ['-R', join(projects, '-work-demo'), dir]);
  assert.equal(cp.status, 0);
  const cli = spawnSync(process.execPath, [SCRIPT, '--cwd', CWD, '--label', 'demo'], { encoding: 'utf8', env: cleanEnv({ CLAUDE_CONFIG_DIR: config }) });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /# Workflow retro: demo/);
});
