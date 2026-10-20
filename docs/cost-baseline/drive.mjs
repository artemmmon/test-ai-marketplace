#!/usr/bin/env node
// Drives the fixed scenario (a spec and a plan for one small feature, no implementation) through
// `claude -p --resume`, with a fixed answer policy, and records every turn.
//
//   WORK=<dir> node drive.mjs <arm> <n>
//
// WORK holds: sample/ (a throw-away clone of the sample app, reset before each run),
// arms/<arm>/plugins/ (one copy of this repository's plugins/ per arm, for example `base` and `opt`),
// runs/ (the output: runs/<arm><n>/NN.json per turn, result.json). Run collect.mjs right after, before the
// next run resets the clone.
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const S = process.env.WORK;
if (!S) { console.error('set WORK=<dir>'); process.exit(2); }
const [arm, n] = process.argv.slice(2);
const PLUG = join(S, 'arms', arm, 'plugins');
const CLONE = join(S, 'sample');
const OUT = join(S, 'runs', `${arm}${n}`);
const TURN_CAP = 10;
const RUN_BUDGET = 6; // USD, driver-level stop
mkdirSync(OUT, { recursive: true });

const BRIEF = 'Let the user filter the lineups list by grenade type (Smoke, Flash, Molotov, HE) with a chip row under the existing map chips, plus an All chip; the map and grenade type filters combine. Device only: no server or API change.';
const START = `/sdd-engineering:run-plan --until plan --mode single "${BRIEF}"`;
const ANSWERS = 'Answers: for every question choose the option marked (recommended); where none is marked choose option 1. Accept every default assumption. Nothing to add. Continue.';
const approveSpec = p => `Approved: ${p} is approved. Set it to approved and proceed.`;
const CHOOSE = 'For the brainstorm: choose the option marked (recommended) and accept the recommended answer to each of its questions. Continue.';
const MODE = 'Mode: single-agent. Otherwise answer every question with the option marked (recommended). Continue.';

const sh = (c, a, o = {}) => spawnSync(c, a, { encoding: 'utf8', cwd: CLONE, ...o });
// reset
sh('git', ['clean', '-fdxq']); sh('git', ['checkout', '.']);
const head = sh('git', ['rev-parse', 'HEAD']).stdout.trim();

const allow = ['Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git ls-files:*)', 'Bash(git rev-parse:*)', 'Bash(git merge-base:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(grep:*)', 'Bash(rg:*)', 'Bash(cat:*)', 'Bash(find:*)', 'Bash(wc:*)', 'Bash(echo:*)', 'Bash(sed:*)', 'Bash(awk:*)', 'Bash(head:*)', 'Bash(tail:*)', 'Bash(diff:*)', 'Bash(sort:*)', 'Bash(tr:*)', 'Bash(cut:*)', 'Bash(cd:*)', 'Bash(dart:*)', 'Bash(flutter:*)',
  `Read(/${PLUG}/**)`, `Glob(/${PLUG}/**)`, `Grep(/${PLUG}/**)`];
const base = ['--output-format', 'json', '--max-budget-usd', '5', '--permission-mode', 'acceptEdits', '--setting-sources', 'project,local',
  ...['engineering-paved-path', 'research-tools', 'architecture-review', 'sdd-engineering'].flatMap(p => ['--plugin-dir', join(PLUG, p)]),
  '--allowedTools', ...allow, '--disallowedTools', 'WebFetch', 'WebSearch'];

const files = d => existsSync(join(CLONE, d)) ? readdirSync(join(CLONE, d)).filter(f => f.endsWith('.md') && f !== 'README.md') : [];
const status = f => (readFileSync(join(CLONE, f), 'utf8').match(/^Status:\s*(.+)$/m) || [])[1]?.trim();
const checkSpec = join(PLUG, 'sdd-engineering/skills/spec-authoring/assets/check-spec.mjs');
const checkPlan = join(PLUG, 'sdd-engineering/skills/run-plan/assets/check-plan.mjs');

function nextMessage() {
  const plans = files('docs/plans').filter(f => !f.endsWith('.brainstorm.md'));
  const briefs = files('docs/plans').filter(f => f.endsWith('.brainstorm.md'));
  const specs = files('specs');
  if (plans.length) {
    const p = 'docs/plans/' + plans[0];
    const r = sh('node', [checkPlan, p]);
    if (r.status === 0 && ['draft', 'approved'].includes(status(p))) return { stop: true };
    return { msg: MODE, why: 'plan exists but not passing' };
  }
  if (briefs.length) {
    const b = 'docs/plans/' + briefs[0];
    const st = status(b) || '';
    if (/awaiting/i.test(st)) return { msg: CHOOSE, why: 'brief awaiting choice' };
    return { msg: MODE, why: 'brief ' + st + ', planner questions' };
  }
  if (specs.length) {
    const p = 'specs/' + specs[0];
    const st = status(p);
    if (st === 'draft') {
      const r = sh('node', [checkSpec, p]);
      if (r.status === 0) return { msg: approveSpec(p), why: 'spec draft passes check' };
      return { msg: ANSWERS, why: 'spec draft failing check' };
    }
    return { msg: MODE, why: 'spec ' + st };
  }
  return { msg: ANSWERS, why: 'no spec yet' };
}

const turns = []; let session = null, finished = false, cost = 0, msg = START, why = 'start';
const t0 = Date.now();
for (let i = 1; i <= TURN_CAP; i++) {
  const args = ['-p', msg, ...base]; if (session) args.push('--resume', session);
  const s = Date.now();
  const r = spawnSync('claude', args, { cwd: CLONE, encoding: 'utf8', input: '', maxBuffer: 1 << 28, timeout: 25 * 60 * 1000, env: process.env });
  const wall = Date.now() - s;
  const label = String(i).padStart(2, '0');
  writeFileSync(join(OUT, `${label}.json`), r.stdout || ''); writeFileSync(join(OUT, `${label}.err`), r.stderr || '');
  let d = {}; try { d = JSON.parse(r.stdout); } catch { }
  session ??= d.session_id; cost = d.total_cost_usd ?? cost;
  turns.push({ i, why, msg: msg.slice(0, 80), wall_ms: wall, duration_ms: d.duration_ms, num_turns: d.num_turns, cum_cost: d.total_cost_usd, subtype: d.subtype, is_error: d.is_error, denials: (d.permission_denials || []).length });
  console.log(JSON.stringify(turns.at(-1)));
  if (d.is_error || !d.session_id) break;
  const nx = nextMessage();
  if (nx.stop) { finished = true; break; }
  if (cost > RUN_BUDGET) { console.log('run budget exceeded'); break; }
  msg = nx.msg; why = nx.why;
}
const wallTotal = Date.now() - t0;
const result = { arm, n: Number(n), plugin_tree: PLUG, sample_head: head, session, finished, turns, wall_ms: wallTotal, total_cost_usd: cost };
writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 1));
console.log('DONE', JSON.stringify({ arm, n, session, finished, cost, wall_s: Math.round(wallTotal / 1000), turns: turns.length }));
