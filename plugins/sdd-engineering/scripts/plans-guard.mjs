#!/usr/bin/env node
// PreToolUse guard (matcher `Write|Edit`) for the two sdd-engineering agents that save their own
// result in the plans folder: implementation-planner (`--kind plan`) and brainstorm
// (`--kind brainstorm`). Exit 0 = allow, exit 2 = block (stderr goes back to the agent).
//
// Plugin agents cannot declare hooks in their frontmatter, so hooks/hooks.json registers this
// script for every session, once per kind. It acts only when the payload's `agent_type` is
// exactly that kind's agent (`sdd-engineering:implementation-planner` or
// `sdd-engineering:brainstorm`); for any other caller it exits 0 and does nothing.
//
// Both agents are otherwise read-only; this hook keeps Write/Edit to one file kind in
// `<plans_dir>` (plugin option plans_dir, default `docs/plans`):
//   --kind plan        NN-short-name.md, never a *.brainstorm.md, and only while the plan is
//                      `Status: draft` before and after the change (approval is the user's;
//                      a plan in progress belongs to the implementer)
//   --kind brainstorm  NN-short-name.brainstorm.md, only as `Status: awaiting choice`
//                      (the main session records the user's choice)
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { afterEdit, configuredDir, hasStatus, makeBlock, projectRoot, readInput, realPath } from './guard-lib.mjs';

const KINDS = {
  plan: {
    agent: 'sdd-engineering:implementation-planner',
    name: /^\d{2,}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/,
    status: 'draft',
    shown: 'NN-short-name.md',
  },
  brainstorm: {
    agent: 'sdd-engineering:brainstorm',
    name: /^\d{2,}-[a-z0-9]+(?:-[a-z0-9]+)*\.brainstorm\.md$/,
    status: 'awaiting choice',
    shown: 'NN-short-name.brainstorm.md',
  },
};
const DEFAULT_PLANS_DIR = 'docs/plans';
const block = makeBlock('plans guard');

const kindFlag = process.argv.indexOf('--kind');
const kind = kindFlag >= 0 ? KINDS[process.argv[kindFlag + 1]] : undefined;
if (!kind) {
  // Registered for every session, so a wrong command line must never block unrelated work.
  process.stderr.write('plans guard: the hook needs --kind plan or --kind brainstorm; doing nothing.\n');
  process.exit(0);
}

const input = readInput();
if (input === null || input.agent_type !== kind.agent) process.exit(0);

const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};
if (tool !== 'Write' && tool !== 'Edit') process.exit(0);

const root = projectRoot(input);
const plansDir = configuredDir(root, 'plans_dir', DEFAULT_PLANS_DIR);
const rawPath = args.file_path;
if (typeof rawPath !== 'string' || rawPath === '') block('no file_path in the tool input.');

const target = realPath(resolve(root, rawPath));
const parts = relative(plansDir, target).split(sep);
const inPlansDir = parts.length === 1 && parts[0] !== '' && parts[0] !== '..' && !isAbsolute(parts[0]);
if (!inPlansDir || !kind.name.test(parts[0])) {
  block(
    `"${rawPath}" is not ${relative(root, plansDir) || '.'}/${kind.shown}. ` +
      'That is the only file you may write; put anything else into your report.',
  );
}

const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
if (current !== null && !hasStatus(current, kind.status)) {
  block(`"${rawPath}" is no longer "Status: ${kind.status}", so it is read-only for you. Report the change to the caller instead.`);
}

const next = tool === 'Write' ? String(args.content ?? '') : afterEdit(current ?? '', args);
if (next !== null && !hasStatus(next, kind.status)) {
  block(`the file must keep exactly the status line "Status: ${kind.status}" after your change. Only the user moves it on.`);
}

process.exit(0);
