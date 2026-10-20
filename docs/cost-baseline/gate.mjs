#!/usr/bin/env node
// Quality gate A1-A6 for one run of the fixed scenario (see docs/COST-BASELINE.md). collect.mjs calls it.
//   node gate.mjs <clone> <plugins-dir> <turns> <turn-cap> <hook-blocks> <finished: true|false>
// Prints one JSON line; `pass` is true when A1-A6 all hold. <clone> and <plugins-dir> must be absolute paths.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const [clone, plugins, turns, cap, hookBlocks, finished] = process.argv.slice(2);
const sdd = join(plugins, 'sdd-engineering', 'skills');
const checkSpec = join(sdd, 'spec-authoring/assets/check-spec.mjs');
const checkPlan = join(sdd, 'run-plan/assets/check-plan.mjs');
const out = { A1: false, A2: false, A3: false, A4: false, A5: false, A6: false, notes: [] };
const ls = d => existsSync(join(clone, d)) ? readdirSync(join(clone, d)).filter(f => f.endsWith('.md') && f !== 'README.md') : [];
const specs = ls('specs');
const plans = ls('docs/plans').filter(f => !f.endsWith('.brainstorm.md'));
const run = (script, file) => spawnSync('node', [script, file], { cwd: clone, encoding: 'utf8' });
let specText = '', planText = '';
if (specs.length === 1) {
  const r = run(checkSpec, 'specs/' + specs[0]);
  out.A1 = r.status === 0; if (!out.A1) out.notes.push('check-spec: ' + (r.stdout + r.stderr).trim().slice(0, 300));
  specText = readFileSync(join(clone, 'specs', specs[0]), 'utf8');
} else out.notes.push(`A1: ${specs.length} spec files`);
if (plans.length === 1) {
  const r = run(checkPlan, 'docs/plans/' + plans[0]);
  planText = readFileSync(join(clone, 'docs/plans', plans[0]), 'utf8');
  const st = (planText.match(/^Status:\s*(.+)$/m) || [])[1]?.trim();
  out.A2 = r.status === 0 && ['draft', 'approved'].includes(st);
  if (!out.A2) out.notes.push(`A2: check-plan exit ${r.status}, status ${st}: ` + (r.stdout + r.stderr).trim().slice(0, 300));
} else out.notes.push(`A2: ${plans.length} plan files`);
// AC section of spec
let acLines = [];
if (specText) {
  const m = specText.match(/## Acceptance criteria[^\n]*\n([\s\S]*?)(?=\n## )/);
  acLines = (m ? m[1] : '').split('\n').filter(l => /^\s*[-*]\s*\**AC-\d+/.test(l));
}
const acIds = acLines.map(l => l.match(/AC-\d+/)[0]);
out.acCount = acIds.length;
if (planText && acIds.length) {
  const covered = new Set((planText.match(/^\s*(?:[-*]\s+)?\**Covers:?\**.*$/gim) || []).join(' ').match(/\bAC-\d+\b/g) || []);
  const missing = acIds.filter(i => !covered.has(i));
  out.A3 = missing.length === 0; if (missing.length) out.notes.push('A3 missing: ' + missing.join(','));
}
// A4
const st = execFileSync('git', ['status', '--porcelain', '-uall'], { cwd: clone, encoding: 'utf8' }).split('\n').filter(Boolean);
const bad = st.filter(l => !/^\?\? (specs\/|docs\/plans\/)/.test(l));
out.A4 = bad.length === 0 && st.length > 0; if (bad.length) out.notes.push('A4: ' + bad.join(' | '));
// A5
const DENY = [/\b[\w-]+\.(dart|ts|tsx|js|yaml|yml|json|md|kt|swift)\b/, /\b(lib|test|server|docs)\/[\w./-]+/, /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+\b/, /\b[a-z]+[A-Z]\w+\b/, /\b[a-z]+_[a-z_]+\b/, /\b(setState|StatefulWidget|ChoiceChip|FilterChip|ListView|BuildContext|Widget)\b/];
const hits = [];
for (const l of acLines) for (const re of DENY) { const m = l.match(re); if (m) { hits.push(`${l.match(/AC-\d+/)[0]}:${m[0]}`); break; } }
out.A5 = acLines.length > 0 && hits.length === 0; if (hits.length) out.notes.push('A5 hits: ' + hits.join(', '));
// A6
out.A6 = Number(turns) <= Number(cap) && Number(hookBlocks) === 0 && finished === 'true';
if (!out.A6) out.notes.push(`A6: turns ${turns}/${cap}, hookBlocks ${hookBlocks}, finished ${finished}`);
out.pass = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].every(k => out[k]);
console.log(JSON.stringify(out));
