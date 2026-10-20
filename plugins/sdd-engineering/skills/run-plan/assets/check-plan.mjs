#!/usr/bin/env node
// Mechanical check of a Development Plan (<plans_dir>/NN-short-name.md) from implementation-planner.
// It checks form and traceability only; whether the plan is a good one is a human's call.
//
//   node check-plan.mjs <plan.md>                  form + coverage of the spec's AC/EC/NFR ids
//   node check-plan.mjs <plan.md> --implemented    after implementation: the mechanical items
//                                                  (statuses, step files, unplanned changes,
//                                                  insights, which tests name which spec id)
//   node check-plan.mjs <plan.md> --implemented --base <ref>   diff against another ref
//   node check-plan.mjs --hook                     PostToolUse hook: reads the payload on stdin,
//                                                  checks the written plan if it sits directly in
//                                                  the plans folder, exit 2 with the errors
//   node check-plan.mjs --root <dir> <plan.md>     the project root (default: the current directory)
//   node check-plan.mjs --plans-dir <d> --specs-dir <d>   override the folders below
//
// Folders: --plans-dir / --specs-dir, else the plugin options `plans_dir` / `specs_dir`
// (env CLAUDE_PLUGIN_OPTION_plans_dir / _specs_dir, also read in upper case), else the built-in
// defaults `docs/plans` and `specs`. An env value that is unset, empty or still a `${...}`
// placeholder counts as unset (Claude Code does not apply the option's default when nothing was
// saved). The plan's `Spec:` line gives the spec path; if no file is there, the spec is looked up
// by its file name in the specs folder.
//
// Exit 0 = no errors (warnings allowed), 1 = errors / a FAIL line, 2 = errors in hook mode, 3 = usage.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKER = '<!-- implementer-brief:end -->';
const BRIEF_LIMIT = 20_000;
const STATUSES = ['draft', 'approved', 'in progress', 'implemented', 'partial'];
const BEFORE_CODE = ['draft', 'approved', 'in progress'];
const MODES = ['multi-agent', 'single-agent'];
const BRIEF_SECTIONS = ['Goal', 'Step groups', 'Steps', 'Verification'];
const STEP_FIELDS = ['Files', 'Change', 'Done when'];
const SPEC_ITEM = /^\s*(?:[-*]\s+)?\**((?:AC|EC|NFR)-\d+)\b/;
const ID = /\b(?:AC|EC|NFR)-\d+\b/g;
export const DEFAULT_PLANS_DIR = 'docs/plans';
export const DEFAULT_SPECS_DIR = 'specs';

// A test file in the usual conventions of several ecosystems. Tests are traced through spec ids.
export const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$|_test\.(?:go|py|rb)$|(?:^|\/)test_[^/]*\.py$|(?:^|\/)(?:__tests__|tests?)\//;
// Output of a planned step rather than a change of its own, and tests.
const GENERATED = [
  /(^|\/)migrations?\//,
  /(^|\/)INSIGHTS\.md$/,
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|Pipfile\.lock|go\.sum|Gemfile\.lock|composer\.lock)$/,
  TEST_FILE,
];

// A plugin option is unset when its env var is missing, empty or still a `${...}` placeholder.
const isUnset = (value) => value === undefined || value.trim() === '' || /^\$\{/.test(value.trim());

export function option(key, fallback, env = process.env) {
  for (const name of [`CLAUDE_PLUGIN_OPTION_${key}`, `CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`]) {
    if (!isUnset(env[name])) return env[name].trim();
  }
  return fallback;
}

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

const headerValue = (lines, name) => {
  const hit = lines.find((l) => l.text.startsWith(`${name}:`));
  return hit ? { value: hit.text.slice(name.length + 1).trim(), line: hit.line } : null;
};

// Splits the plan into its header, the `##` sections and the `### Step n` blocks of the brief.
export function parsePlan(text) {
  const all = text.split('\n').map((raw, index) => ({ text: raw, line: index + 1 }));
  const markerAt = all.findIndex((l) => l.text.trim() === MARKER);
  const header = [];
  const sections = [];
  const steps = [];
  let section = null;
  let step = null;
  for (const entry of all) {
    const h2 = /^## (.+?)\s*$/.exec(entry.text);
    const h3 = /^### Step (\d+)\b/.exec(entry.text);
    if (h2) {
      section = { name: h2[1], line: entry.line, lines: [], inBrief: markerAt < 0 || entry.line - 1 < markerAt };
      sections.push(section);
      step = null;
    } else if (h3 && section && section.name === 'Steps') {
      step = { n: Number(h3[1]), line: entry.line, lines: [] };
      steps.push(step);
    } else if (step) {
      if (entry.text.trim() !== MARKER) step.lines.push(entry);
    } else if (section) {
      section.lines.push(entry);
    } else {
      header.push(entry);
    }
  }
  const brief = markerAt < 0 ? text : all.slice(0, markerAt).map((l) => l.text).join('\n');
  return { header, sections, steps, brief, hasMarker: markerAt >= 0 };
}

// The text of one `- Field:` bullet of a step, continuation lines included.
function field(step, name) {
  const start = step.lines.findIndex((l) => new RegExp(`^- ${name}\\b[^:]*:`).test(l.text));
  if (start < 0) return null;
  const out = [step.lines[start].text.replace(/^- [^:]*:/, '')];
  for (const entry of step.lines.slice(start + 1)) {
    if (/^- \S/.test(entry.text) || /^#/.test(entry.text)) break;
    out.push(entry.text);
  }
  return { text: out.join('\n').trim(), line: step.lines[start].line };
}

// A repo-root-relative file: has a folder and an extension, is no glob, alias or relative path.
const isRepoPath = (token) => /^[\w-][\w./\[\]()-]*\/[\w./\[\]()-]*\.\w+$/.test(token) || /^\.[\w-]+\/[\w./-]+\.\w+$/.test(token);

// `create `a` · modify `b`, `c`` → [{verb, path}]; a chunk without a verb keeps the previous one.
export function stepFiles(step) {
  const files = field(step, 'Files');
  if (!files) return [];
  const found = [];
  let verb = 'modify';
  for (const chunk of files.text.split(/[·\n;]/)) {
    const named = /\b(create|modify|delete)\b/i.exec(chunk);
    if (named) verb = named[1].toLowerCase();
    for (const match of chunk.matchAll(/`([^`\s]+)`/g)) {
      if (isRepoPath(match[1])) found.push({ verb, path: match[1], line: files.line });
    }
  }
  return found;
}

export function specIds(specText) {
  const ids = [];
  let fenced = false;
  for (const line of specText.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const match = fenced ? null : SPEC_ITEM.exec(line);
    if (match && !ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

function readSpec(root, plan, specsDir = DEFAULT_SPECS_DIR) {
  const spec = headerValue(plan.header, 'Spec');
  const path = spec ? (/[\w./-]+\.md/.exec(spec.value) ?? [null])[0] : null;
  if (!path) return { path, text: null, line: spec ? spec.line : 1 };
  // The path as written, else the same file name in the specs folder.
  const found = [path, join(specsDir, basename(path))].find((candidate) => existsSync(join(root, candidate)));
  if (!found) return { path, text: null, line: spec.line };
  return { path: found, text: readFileSync(join(root, found), 'utf8'), line: spec.line };
}

export function checkPlan(text, root, specsDir = DEFAULT_SPECS_DIR) {
  const problems = [];
  const error = (line, message) => problems.push({ level: 'error', line, message });
  const warning = (line, message) => problems.push({ level: 'warning', line, message });
  const plan = parsePlan(text);

  if (!/^# Development Plan: \S/.test(plan.header[0]?.text ?? '')) error(1, 'the first line must be "# Development Plan: <title>".');
  const status = headerValue(plan.header, 'Status');
  if (!status) error(1, 'header line "Status:" is missing.');
  else if (!STATUSES.includes(status.value)) error(status.line, `Status must be one of: ${STATUSES.join(' | ')}.`);
  const mode = headerValue(plan.header, 'Execution mode');
  if (!mode) error(1, 'header line "Execution mode:" is missing.');
  else if (!MODES.some((m) => mode.value.startsWith(m))) error(mode.line, `Execution mode must be ${MODES.join(' or ')}.`);
  if (!headerValue(plan.header, 'Spec')) error(1, 'header line "Spec:" is missing; write "none" when there is no spec.');

  if (!plan.hasMarker) error(1, `the marker ${MARKER} is missing; the implementer reads only what is above it.`);
  else if (plan.brief.length > BRIEF_LIMIT) {
    warning(1, `the implementer brief is ${plan.brief.length} characters (aim for ${BRIEF_LIMIT} or less); move design prose below the marker or make the groups smaller.`);
  }
  for (const name of BRIEF_SECTIONS) {
    const section = plan.sections.find((s) => s.name === name);
    if (!section) error(1, `section "## ${name}" is missing.`);
    else if (!section.inBrief) error(section.line, `section "## ${name}" must be above the marker.`);
  }

  if (plan.steps.length === 0) error(1, 'no steps; write "### Step 1 — <title> (<package>)".');
  const created = new Set(); // paths an earlier step creates: a later step may modify or delete them
  plan.steps.forEach((step, index) => {
    if (step.n !== index + 1) error(step.line, `step ${step.n} is out of sequence; expected Step ${index + 1}.`);
    for (const name of STEP_FIELDS) {
      const value = field(step, name);
      if (!value || value.text === '') error(step.line, `Step ${step.n} has no "- ${name}:" line.`);
    }
    const before = status && ['draft', 'approved'].includes(status.value);
    for (const file of stepFiles(step)) {
      const exists = existsSync(join(root, file.path));
      if (file.verb !== 'create' && !exists && !created.has(file.path) && before) error(file.line, `Step ${step.n}: "${file.path}" (${file.verb}) does not exist.`);
      if (file.verb === 'create' && exists && before) warning(file.line, `Step ${step.n}: "${file.path}" is to be created but already exists.`);
      if (file.verb === 'create') created.add(file.path);
    }
  });

  // Coverage: every AC/EC/NFR of a current-template spec is cited by a step, and nothing else is.
  const spec = readSpec(root, plan, specsDir);
  if (spec.path && spec.text === null) error(spec.line, `the spec "${spec.path}" does not exist.`);
  if (spec.text !== null && /^Spec ID:/m.test(spec.text)) {
    const specStatus = (/^Status:[ \t]*(.*)$/m.exec(spec.text) ?? [null, ''])[1].trim();
    if (status && BEFORE_CODE.includes(status.value) && specStatus !== 'approved') {
      error(spec.line, `the spec is "Status: ${specStatus}"; a plan is written and executed only for an approved spec.`);
    }
    const required = specIds(spec.text);
    const stepText = plan.steps.map((s) => s.lines.map((l) => l.text).join('\n')).join('\n');
    const cited = new Set(stepText.match(ID) ?? []);
    for (const id of required) {
      if (!cited.has(id)) error(spec.line, `uncovered-requirement: no step cites ${id} (write each id out; ranges are not read).`);
    }
    for (const id of cited) {
      if (!required.includes(id)) error(spec.line, `a step cites ${id}, which the spec does not have.`);
    }
  }
  return problems.sort((a, b) => a.line - b.line);
}

const git = (root, args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
};

// The ref to diff against: --base, else the merge base with the default branch.
function changedFiles(root, base) {
  const head = git(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])?.trim();
  const candidates = [head, 'origin/main', 'main', 'origin/master', 'master'].filter(Boolean);
  const ref = base ?? candidates.map((r) => git(root, ['merge-base', 'HEAD', r])?.trim()).find(Boolean);
  if (!ref) return null;
  const tracked = git(root, ['diff', '--name-only', ref]) ?? '';
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']) ?? '';
  return { ref, files: [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))] };
}

// The items of a finished plan that need no judgement. One line each: PASS | FAIL | INFO.
export function checkImplemented(text, root, planPath, base, specsDir = DEFAULT_SPECS_DIR) {
  const lines = [];
  const say = (level, id, message) => lines.push({ level, id, message });
  const plan = parsePlan(text);
  const changed = changedFiles(root, base);
  if (!changed) return [{ level: 'FAIL', id: 'base', message: 'no base ref: pass --base <ref>.' }];
  const isChanged = (path) => changed.files.includes(path);

  const status = headerValue(plan.header, 'Status')?.value ?? '';
  say(['implemented', 'partial'].includes(status) ? 'PASS' : 'FAIL', 'P1', `plan Status is "${status}" (expected implemented or partial)`);
  const spec = readSpec(root, plan, specsDir);
  const specIsCurrent = spec.text !== null && /^Spec ID:/m.test(spec.text);
  if (specIsCurrent) {
    const specStatus = (/^Status:[ \t]*(.*)$/m.exec(spec.text) ?? [null, ''])[1].trim();
    const wanted = status === 'partial' ? 'approved' : 'implemented';
    say(specStatus === wanted ? 'PASS' : 'FAIL', 'P2', `spec Status is "${specStatus}" (expected ${wanted})`);
  }

  const named = new Set([planPath, spec.path, planPath.replace(/\.md$/, '.brainstorm.md')].filter(Boolean));
  for (const step of plan.steps) {
    const problems = [];
    for (const file of stepFiles(step)) {
      named.add(file.path);
      const exists = existsSync(join(root, file.path));
      if (file.verb === 'delete') {
        if (exists) problems.push(`${file.path} still exists`);
      } else if (!exists) problems.push(`${file.path} does not exist`);
      else if (!isChanged(file.path)) problems.push(`${file.path} is unchanged since ${changed.ref.slice(0, 8)}`);
    }
    // Paths a step names anywhere else (its Tests line, generated outputs) are planned too.
    for (const match of step.lines.map((l) => l.text).join('\n').matchAll(/`([^`\s]+)`/g)) {
      if (isRepoPath(match[1])) named.add(match[1]);
    }
    say(problems.length ? 'FAIL' : 'PASS', `S${step.n}.files`, problems.join('; ') || 'every file is there and changed');
  }

  const insights = plan.sections.find((s) => s.name === 'Insights to record');
  let n = 0;
  for (const entry of insights?.lines ?? []) {
    const target = /^- .*?([\w./-]*INSIGHTS\.md)/.exec(entry.text);
    if (!target) continue;
    n += 1;
    say(isChanged(target[1]) ? 'PASS' : 'FAIL', `I${n}`, `${target[1]} ${isChanged(target[1]) ? 'has changes' : 'is unchanged'} (read the entry itself)`);
  }

  const unplanned = changed.files.filter((f) => !named.has(f) && !GENERATED.some((g) => g.test(f)));
  for (const file of unplanned) say('FAIL', 'unplanned-change', file);
  if (unplanned.length === 0) say('PASS', 'unplanned-change', 'every changed file belongs to a step or is generated output');

  if (specIsCurrent) {
    const tests = changed.files.filter((f) => TEST_FILE.test(f) && existsSync(join(root, f)));
    const bodies = tests.map((f) => ({ f, rows: readFileSync(join(root, f), 'utf8').split('\n') }));
    for (const id of specIds(spec.text)) {
      const word = new RegExp(`\\b${id}\\b`);
      const hits = bodies.flatMap(({ f, rows }) => rows.flatMap((row, i) => (word.test(row) ? [`${f}:${i + 1}`] : [])));
      say('INFO', id, hits.length ? `named by ${hits.slice(0, 4).join(', ')}${hits.length > 4 ? ` (+${hits.length - 4})` : ''}` : 'no changed test names it');
    }
  }
  return lines;
}

// A plan is a .md file (no brief, no README) that sits directly in the plans folder.
export const isPlanPath = (plansDir, file) =>
  file.endsWith('.md') && !file.endsWith('.brainstorm.md') && basename(file) !== 'README.md' && real(dirname(file)) === real(plansDir);

function main(argv) {
  const hook = argv.includes('--hook');
  const valueOf = (flag) => {
    const at = argv.indexOf(flag);
    return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : null;
  };
  const flagged = ['--root', '--base', '--plans-dir', '--specs-dir'].map((f) => argv.indexOf(f)).filter((i) => i >= 0).map((i) => i + 1);
  let root = resolve(valueOf('--root') ?? process.cwd());
  let files = argv.filter((a, i) => !a.startsWith('--') && !flagged.includes(i)).map((f) => resolve(f));
  const folders = (base) => ({
    plans: resolve(base, valueOf('--plans-dir') ?? option('plans_dir', DEFAULT_PLANS_DIR)),
    specs: valueOf('--specs-dir') ?? option('specs_dir', DEFAULT_SPECS_DIR),
  });

  if (hook) {
    let payload;
    try {
      payload = JSON.parse(readFileSync(0, 'utf8'));
    } catch {
      process.exit(0);
    }
    if (payload === null || typeof payload !== 'object') process.exit(0);
    root = resolve(valueOf('--root') ?? (process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd()));
    const path = payload.tool_input && payload.tool_input.file_path;
    if (typeof path !== 'string' || path === '') process.exit(0);
    const plansDir = folders(root).plans;
    files = [resolve(root, path)].filter((f) => existsSync(f) && isPlanPath(plansDir, f));
  } else if (files.length === 0) {
    process.stderr.write('check-plan: give a plan path (<plans_dir>/NN-short-name.md).\n');
    process.exit(3);
  }
  const specsDir = folders(root).specs;

  let errors = 0;
  const out = hook ? process.stderr : process.stdout;
  for (const file of files) {
    if (!existsSync(file)) {
      out.write(`${file}: error: no such file\n`);
      errors += 1;
      continue;
    }
    const text = readFileSync(file, 'utf8');
    const shown = relative(root, file) || file;
    if (argv.includes('--implemented')) {
      for (const line of checkImplemented(text, root, shown, valueOf('--base'), specsDir)) {
        out.write(`${line.level.padEnd(4)} ${line.id.padEnd(17)} ${line.message}\n`);
        if (line.level === 'FAIL') errors += 1;
      }
      continue;
    }
    for (const problem of checkPlan(text, root, specsDir)) {
      if (hook && problem.level !== 'error') continue;
      out.write(`${shown}:${problem.line}: ${problem.level}: ${problem.message}\n`);
      if (problem.level === 'error') errors += 1;
    }
  }
  if (hook) {
    if (errors > 0) out.write('plan check: fix these before you finish (format: the Development Plan format of the implementation-planner agent).\n');
    process.exit(errors > 0 ? 2 : 0);
  }
  out.write(`plan check: ${files.length} plan(s), ${errors} ${argv.includes('--implemented') ? 'FAIL line(s)' : 'error(s)'}\n`);
  process.exit(errors > 0 ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
