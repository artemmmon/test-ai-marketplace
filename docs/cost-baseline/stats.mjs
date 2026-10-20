// Medians and ranges per arm from runs/<arm><n>/summary.json, as Markdown tables.
//   cd $WORK && node <repo>/docs/cost-baseline/stats.mjs base:1,2,3 opt:1,2,3
import { readFileSync } from 'node:fs';
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x, d = 2) => (typeof x === 'number' ? x.toFixed(d) : x);
const groups = process.argv.slice(2).map(g => { const [arm, ns] = g.split(':'); return { arm, ns: ns.split(',').map(Number) }; });
const keys = [['cost_reported', 'cost $ (CLI)', 3], ['cost_est', 'cost $ (est)', 3], ['latency_s', 'latency s', 0], ['agent_time_s', 'agent time s', 0], ['tokens', 'tokens total', 0], ['input', 'input', 0], ['output', 'output', 0], ['cache_read', 'cache read', 0], ['cache_write', 'cache write', 0], ['requests', 'API calls', 0], ['tool_calls', 'tool calls', 0], ['turns', 'CLI turns', 0]];
for (const g of groups) {
  g.runs = g.ns.map(n => JSON.parse(readFileSync(`runs/${g.arm}${n}/summary.json`, 'utf8')));
  console.log(`\n## ${g.arm} runs ${g.ns.join(',')}`);
  console.log('| run | ' + keys.map(k => k[1]).join(' | ') + ' | gate | AC |\n|' + '---|'.repeat(keys.length + 3));
  for (const r of g.runs) console.log(`| ${g.arm}${r.n} | ` + keys.map(k => f(r[k[0]], k[2])).join(' | ') + ` | ${r.gate.pass ? 'pass' : 'FAIL ' + r.gate.notes.join(';')} | ${r.gate.acCount} |`);
  console.log(`| **median** | ` + keys.map(k => f(med(g.runs.map(r => r[k[0]])), k[2])).join(' | ') + ` | ${g.runs.filter(r => r.gate.pass).length}/${g.runs.length} | |`);
  console.log(`| **range** | ` + keys.map(k => { const v = g.runs.map(r => r[k[0]]); return `${f(Math.min(...v), k[2])}-${f(Math.max(...v), k[2])}`; }).join(' | ') + ' | | |');
}
// per-agent role
for (const g of groups) {
  const roles = {};
  for (const r of g.runs) for (const a of r.agents) { const k = a.label.replace(/:[0-9a-f]{4,8}$/, '').replace(/^main:.*/, 'main'); (roles[k] ||= []).push(a); }
  console.log(`\n### ${g.arm} per role (median over runs)`);
  console.log('| role | model | first ctx | peak ctx | requests | output | cache write | cost $ |\n|---|---|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(roles)) console.log(`| ${k} | ${v[0].model.replace('claude-', '')} | ${f(med(v.map(a => a.firstContext)), 0)} | ${f(med(v.map(a => a.peakContext)), 0)} | ${f(med(v.map(a => a.requests)), 0)} | ${f(med(v.map(a => a.output)), 0)} | ${f(med(v.map(a => a.cacheWrite)), 0)} | ${f(med(v.map(a => a.cost)), 3)} |`);
}
