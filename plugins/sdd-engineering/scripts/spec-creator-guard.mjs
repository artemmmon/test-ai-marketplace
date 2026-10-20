#!/usr/bin/env node
// PreToolUse guard for the sdd-engineering:spec-creator agent (hooks/hooks.json).
// Exit 0 = allow, exit 2 = block (stderr goes back to the agent).
//
// Plugin agents cannot declare hooks in their frontmatter, so this hook is registered by the
// plugin for every session. It acts only when the payload's `agent_type` is exactly
// `sdd-engineering:spec-creator`; for any other caller (another agent, the main thread, or a
// payload it cannot read) it exits 0 and does nothing.
//
// For spec-creator it runs for Write, Edit, Agent/Task and MCP tools (the matcher in hooks.json)
// and checks what a `tools` allowlist cannot:
//   - MCP calls only to Figma read tools (`get_*`): the allowlist names the whole Figma server;
//   - the Agent tool only to start `research-tools:researcher` (read-only, one question each);
//   - Write/Edit of `<specs_dir>/*.md` only (plugin option specs_dir, default `specs`);
//   - spec files only while they are `Status: draft`, before and after the change
//     (approval is the user's);
//   - one exception, the amendment: an `approved` spec may be changed when the change itself
//     turns it back into `Status: draft`, so the user approves it again. Implemented and legacy
//     specs stay read-only.
// Any other tool is not this hook's business: it exits 0.
import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { afterEdit, configuredDir, hasStatus, makeBlock, projectRoot, readInput, realPath } from './guard-lib.mjs';

const OWN_AGENT = 'sdd-engineering:spec-creator';
const RESEARCH_AGENT = 'research-tools:researcher';
// The subagent tool is `Agent`; older builds call it `Task`.
const AGENT_TOOLS = ['Agent', 'Task'];
const DEFAULT_SPECS_DIR = 'specs';
const block = makeBlock('spec-creator guard');

const isDraft = (text) => hasStatus(text, 'draft');
// Only a current-template spec (`Spec ID:`) can be reopened; legacy specs have other statuses.
const isReopenable = (text) => hasStatus(text, 'approved') && /^Spec ID:/m.test(text);

const input = readInput();
if (input === null || input.agent_type !== OWN_AGENT) process.exit(0);

const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};

if (tool.startsWith('mcp__')) {
  const name = tool.split('__').pop() ?? '';
  if (/figma/i.test(tool) && name.startsWith('get_')) process.exit(0);
  block(`MCP tool "${tool}" is not allowed. Only Figma read tools (get_*) are.`);
}

if (AGENT_TOOLS.includes(tool)) {
  if (args.subagent_type === RESEARCH_AGENT) process.exit(0);
  block(
    `you may start only the "${RESEARCH_AGENT}" agent (subagent_type: "${RESEARCH_AGENT}"), ` +
      `not "${args.subagent_type ?? 'the default agent'}". It is read-only; other agents can write.`,
  );
}

if (tool !== 'Write' && tool !== 'Edit') process.exit(0);

const root = projectRoot(input);
const specsDir = configuredDir(root, 'specs_dir', DEFAULT_SPECS_DIR);
const rawPath = args.file_path;
if (typeof rawPath !== 'string' || rawPath === '') block('no file_path in the tool input.');

const target = realPath(resolve(root, rawPath));
const parts = relative(specsDir, target).split(sep);
const inSpecsDir = parts.length === 1 && parts[0] !== '' && parts[0] !== '..' && !isAbsolute(parts[0]);
if (!inSpecsDir || !target.endsWith('.md')) {
  block(
    `"${rawPath}" is outside the spec folder. You may write only ` +
      `${relative(root, specsDir) || '.'}/*.md. Put anything else into your report.`,
  );
}

// The folder index is not a spec: no Status rules.
if (basename(target) === 'README.md') process.exit(0);

const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
if (current !== null && !isDraft(current) && !isReopenable(current)) {
  block(
    `"${rawPath}" is neither "Status: draft" nor "Status: approved". Implemented and legacy specs ` +
      'are read-only for you: write a new spec with "Supersedes:" instead, or report the change to the user.',
  );
}

const next = tool === 'Write' ? String(args.content ?? '') : afterEdit(current ?? '', args);
if (next !== null && !isDraft(next)) {
  block(
    current !== null && isReopenable(current)
      ? `"${rawPath}" is "Status: approved". To amend it, your first Edit must replace ` +
          '"Status: approved" with "Status: draft"; the user approves it again afterwards.'
      : 'a spec must keep exactly the status line "Status: draft" after your change. ' +
          'Only the user approves a spec.',
  );
}

process.exit(0);
