// llms.txt (spec §4.7, FR-28, example in §12.2).
import { COMPONENT_TYPES } from '../ids.mjs';
import { CATALOG_SCHEMA_VERSION } from './catalog.mjs';

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function executesList(p) {
  const parts = [];
  if (p.components.hook.length) parts.push('hooks');
  if (p.components.mcp.length) parts.push('MCP');
  if (p.bin.length) parts.push('bin');
  // Inline hooks / mcpServers in plugin.json (A-6) set executesCode without an indexed artifact.
  if (parts.length === 0 && p.executesCode) parts.push('inline hooks or MCP');
  return parts;
}

/** @param {object} index the IndexFile */
export function buildLlms(index) {
  const { marketplace: m } = index;
  const site = m.siteUrl;
  const byId = new Map(index.items.map((i) => [i.id, i]));
  const lines = [];

  lines.push(`# ${m.name}`, '');
  const description = oneLine(m.description);
  const lead = description ? `${/[.!?]$/.test(description) ? description : `${description}.`} ` : '';
  lines.push(`> ${lead}Plugins bundle skills, agents, commands, hooks and MCP servers. Installing a plugin installs all of its components.`, '');
  lines.push(`Add the marketplace: \`${m.addCommands.cli}\` (chat: \`${m.addCommands.chat}\`).`);
  lines.push(`Install a plugin: \`claude plugin install <plugin>@${m.name} --scope project|user\` (chat: \`/plugin install <plugin>@${m.name}\`).`);
  lines.push('Plugins marked "executes code" contain hooks, MCP servers or bin/ executables.', '');

  lines.push('## Catalog', '');
  lines.push(`- [catalog.json](${site}catalog.json): machine-readable catalog, schemaVersion ${CATALOG_SCHEMA_VERSION}`, '');

  lines.push('## Plugins', '');
  const plugins = index.items.filter((i) => i.type === 'plugin');
  if (plugins.length === 0) lines.push('No plugins are published yet.');
  for (const p of plugins) {
    const meta = [];
    if (p.version) meta.push(`v${p.version}`);
    if (p.source === 'external') meta.push('external, not indexed');
    const exec = executesList(p);
    if (exec.length) meta.push(`executes code: ${exec.join(', ')}`);
    if (p.dependencies.length) meta.push(`depends on ${p.dependencies.map((d) => `${d.name} ${d.range}`).join(', ')}`);
    const suffix = meta.length ? ` (${meta.join('; ')})` : '';
    lines.push(`- [${p.name}](${site}#/plugin/${p.name}): ${oneLine(p.description)}${suffix}`);
    for (const type of COMPONENT_TYPES) {
      for (const id of p.components[type]) {
        const c = byId.get(id);
        lines.push(`  - [${c.type} ${c.qualifiedName}](${site}${c.bodyRef}): ${oneLine(c.description)}`);
      }
    }
  }
  lines.push('');

  lines.push('## Optional', '');
  lines.push(`- [releases.json](${site}releases.json): release history`);
  lines.push(`- [feed.xml](${site}feed.xml): Atom feed of releases`);
  return `${lines.join('\n')}\n`;
}
