// Tests for run-check-hook.mjs: the PostToolUse wrapper that runs a check script only for its own agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WRAPPER = join(dirname(fileURLToPath(import.meta.url)), 'run-check-hook.mjs');
const OWN = 'sdd-engineering:spec-creator';

// A stub check script: echoes its arguments and the payload's tool name on stderr, exits 2.
const dir = mkdtempSync(join(tmpdir(), 'check-hook-'));
const STUB = join(dir, 'stub-check.mjs');
writeFileSync(
  STUB,
  "import { readFileSync } from 'node:fs';\n" +
    "const p = JSON.parse(readFileSync(0, 'utf8'));\n" +
    "process.stderr.write(`stub ${process.argv.slice(2).join(' ')} ${p.tool_name}\\n`);\n" +
    'process.exit(2);\n',
);

function run(agent, script, payload, extraArgs = ['--hook']) {
  const result = spawnSync(process.execPath, [WRAPPER, agent, script, ...extraArgs], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  return { code: result.status, stderr: result.stderr, stdout: result.stdout };
}

test('own agent: the script runs with the payload and its exit code and stderr pass through', () => {
  const r = run(OWN, STUB, { tool_name: 'Write', agent_type: OWN, agent_id: 'a1' });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /stub --hook Write/);
});

test('not the own agent (other agent, main thread, unreadable payload): nothing runs, exit 0', () => {
  for (const payload of [
    { tool_name: 'Write', agent_type: 'sdd-engineering:implementer' },
    { tool_name: 'Write', agent_type: 'spec-creator' },
    { tool_name: 'Write' },
    'not json',
    '',
  ]) {
    const r = run(OWN, STUB, payload);
    assert.equal(r.code, 0);
    assert.equal(r.stderr, '');
  }
});

test('a script that does not exist is skipped without error', () => {
  const r = run(OWN, 'skills/none/assets/missing.mjs', { tool_name: 'Write', agent_type: OWN });
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
});
