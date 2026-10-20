#!/usr/bin/env node
// PostToolUse wrapper: runs one of the skill check scripts (`check-spec.mjs --hook`,
// `check-plan.mjs --hook`) only for the agent it belongs to, so the check scripts themselves
// stay unchanged and ignorant of agents.
//
//   node run-check-hook.mjs <agent_type> <script path relative to the plugin root> [args...]
//
// Reads the hook payload on stdin. If its `agent_type` is not exactly <agent_type> (another
// agent, the main thread, unreadable payload) it exits 0 and does nothing. Otherwise it runs the
// script with the same payload on stdin and passes its stderr, stdout and exit code through
// (the check scripts exit 2 with their errors on stderr, which Claude Code returns to the agent).
// A script that is not there is skipped without error.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [agent, script, ...extra] = process.argv.slice(2);
if (!agent || !script) {
  process.stderr.write('run-check-hook: usage: run-check-hook.mjs <agent_type> <script> [args...]\n');
  process.exit(0);
}

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}
let input = null;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}
if (input === null || typeof input !== 'object' || input.agent_type !== agent) process.exit(0);

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(pluginRoot, script);
if (!existsSync(path)) process.exit(0);

const result = spawnSync(process.execPath, [path, ...extra], { input: raw, encoding: 'utf8' });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status === null ? 0 : result.status);
