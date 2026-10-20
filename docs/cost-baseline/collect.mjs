#!/usr/bin/env node
// Measures one finished run: tokens, API calls and tool calls per agent from the transcripts (retro.mjs),
// hook blocks from the transcripts, the quality gate A1-A6 (gate.mjs), and writes runs/<arm><n>/summary.json.
//
//   WORK=<dir> node collect.mjs <arm> <n>     (run right after drive.mjs, before the clone is reset)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const S = process.env.WORK;
if (!S) { console.error('set WORK=<dir>'); process.exit(2); }
const [arm, n] = process.argv.slice(2);
const dir = join(S, 'runs', `${arm}${n}`);
const R = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
const PLUG = R.plugin_tree, CLONE = join(S, 'sample');
const retroScript = join(PLUG, 'sdd-engineering/skills/workflow-retro/assets/retro.mjs');
const HERE = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const retro = spawnSync('node', [retroScript, '--cwd', CLONE, '--session', R.session, '--json'], { encoding: 'utf8', maxBuffer: 1 << 28, env });
writeFileSync(join(dir, 'retro.json'), retro.stdout);
writeFileSync(join(dir, 'retro.md'), spawnSync('node', [retroScript, '--cwd', CLONE, '--session', R.session], { encoding: 'utf8', maxBuffer: 1 << 28, env }).stdout);
const T = JSON.parse(retro.stdout);
// hook blocks from the transcripts
const proj = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');
const mangled = realpathSync(CLONE).replace(/[^A-Za-z0-9]/g, '-');
const pdir = readdirSync(proj).find(d => d === mangled) ?? readdirSync(proj).find(d => mangled.endsWith(d) || d.endsWith(mangled));
const files = [join(proj, pdir, R.session + '.jsonl')];
const sub = join(proj, pdir, R.session, 'subagents');
if (existsSync(sub)) for (const f of readdirSync(sub)) if (f.endsWith('.jsonl')) files.push(join(sub, f));
let hookBlocks = 0, checkFeedback = 0, toolErrors = 0; const blockTexts = [];
for (const f of files) for (const line of readFileSync(f, 'utf8').split('\n')) {
  if (!line.includes('tool_result')) continue;
  let o; try { o = JSON.parse(line); } catch { continue; }
  const c = o.message?.content; if (!Array.isArray(c)) continue;
  for (const it of c) if (it.type === 'tool_result') {
    const t = typeof it.content === 'string' ? it.content : JSON.stringify(it.content);
    if (it.is_error) toolErrors++;
    if (/\b(spec-creator|plans?|brainstorm) guard:/.test(t) && !/^\s*"?# /.test(t) && it.is_error !== false) { hookBlocks++; blockTexts.push(t.slice(0, 200)); }
    if (/:\d+: error:/.test(t)) checkFeedback++;
  }
}
const calls = {}; const seen = new Set();
for (const f of files) {
  const who = f.includes('/subagents/') ? 'sub:' + (f.match(/agent-(\w+)\.jsonl/)||[])[1] : 'main';
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.includes('tool_use')) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const c = o.message?.content; if (!Array.isArray(c)) continue;
    for (const it of c) if (it.type === 'tool_use' && !seen.has(it.id)) {
      seen.add(it.id);
      const i = it.input || {};
      const d = i.file_path ? i.file_path.replace(/^.*\/(sample|plugins)\//, '$1/') : i.skill || i.pattern || i.command || i.subagent_type || i.description || '';
      (calls[who] ||= []).push(`${it.name}: ${String(d).replace(/\s+/g, ' ').slice(0, 110)}`);
    }
  }
}
const gate = JSON.parse(spawnSync('node', [join(HERE, 'gate.mjs'), CLONE, PLUG, String(R.turns.length), '10', String(hookBlocks), String(R.finished)], { encoding: 'utf8', env }).stdout);
const denials = R.turns.reduce((a, t) => a + (t.denials || 0), 0);
// files read per path (from retro) and agents
const reads = {};
for (const [p, v] of Object.entries(T.files || {})) reads[p] = v;
const out = {
  arm, n: Number(n), session: R.session, plugin_tree: PLUG, finished: R.finished, turns: R.turns.length,
  cost_reported: R.total_cost_usd, cost_est: T.totals.cost, latency_s: Math.round(R.wall_ms / 1000),
  agent_time_s: Math.round(T.totals.agentMs / 1000), retro_wall_s: Math.round(T.totals.wallMs / 1000),
  requests: T.totals.requests, tool_calls: T.totals.toolCalls, tokens: T.totals.tokens,
  input: T.totals.input, output: T.totals.output, cache_read: T.totals.cacheRead, cache_write: T.totals.cacheWrite,
  main_tokens: T.totals.mainTokens, child_tokens: T.totals.childTokens,
  agents: (T.agents || []).map(a => ({ label: a.label, model: a.model, requests: a.requests, tokens: a.total, cost: a.cost, toolCalls: a.toolCalls, tools: a.tools, firstContext: a.firstContext, peakContext: a.peakContext, output: a.output, cacheRead: a.cacheRead, cacheWrite: a.cacheWrite, input: a.input })), calls,
  hookBlocks, blockTexts, checkFeedback, toolErrors, permissionDenials: denials, gate,
};
writeFileSync(join(dir, 'summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, agents: undefined, blockTexts: undefined }));
