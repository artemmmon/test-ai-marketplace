// Link builders for GitHub, issues and in-app routes.
import type { ArtifactType, ComponentType, IndexFile, IndexItem, PluginItem } from '../types';

export function blobUrl(index: IndexFile, path: string): string {
  return `${index.marketplace.repo.url}/blob/${index.commit}/${path}`;
}

export function treeUrl(index: IndexFile, path: string): string {
  return `${index.marketplace.repo.url}/tree/${index.commit}/${path}`;
}

export function tagUrl(index: IndexFile, tag: string): string {
  return `${index.marketplace.repo.url}/tree/${encodeURIComponent(tag)}`;
}

export function commitUrl(index: IndexFile): string {
  return `${index.marketplace.repo.url}/commit/${index.commit}`;
}

/** Source link of an item: GitHub tree/blob for local items, the external URL otherwise. */
export function sourceUrl(index: IndexFile, item: IndexItem): string | null {
  if (item.type === 'plugin' && item.external) return item.external.url;
  if (!item.path) return null;
  return item.type === 'plugin' ? treeUrl(index, item.path) : blobUrl(index, item.path);
}

export function itemHref(item: IndexItem): string {
  return item.type === 'plugin' ? `/plugin/${item.name}` : `/artifact/${item.id}`;
}

/** "Report an issue" link with a prefilled title (spec FR-60). */
export function issueUrl(index: IndexFile | null, title: string): string {
  const repo = index?.marketplace.repo.url ?? 'https://github.com/artemmmon/test-ai-marketplace';
  const body = [
    `Page: ${window.location.href}`,
    `Catalog commit: ${index?.commit ?? 'unknown'}`,
    '',
    '## What happened',
    '',
    '## Expected',
    '',
  ].join('\n');
  const q = `title=${encodeURIComponent(title)}&labels=site-feedback&body=${encodeURIComponent(body)}`;
  return `${repo}/issues/new?${q}`;
}

export const TYPE_ORDER: ArtifactType[] = ['skill', 'agent', 'command', 'plugin', 'hook', 'mcp'];
export const COMPONENT_TYPES: ComponentType[] = ['skill', 'agent', 'command', 'hook', 'mcp'];

export const TYPE_LABEL: Record<ArtifactType, string> = {
  plugin: 'Plugin',
  skill: 'Skill',
  agent: 'Agent',
  command: 'Command',
  hook: 'Hook',
  mcp: 'MCP',
};

export const TYPE_PLURAL: Record<ArtifactType, string> = {
  plugin: 'Plugins',
  skill: 'Skills',
  agent: 'Agents',
  command: 'Commands',
  hook: 'Hooks',
  mcp: 'MCP',
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3 skills, 1 agent, 1 command, hooks" */
export function composition(p: PluginItem): string {
  if (p.source === 'external') return 'not indexed';
  const c = p.components;
  const parts: string[] = [];
  if (c.skill.length) parts.push(plural(c.skill.length, 'skill', 'skills'));
  if (c.agent.length) parts.push(plural(c.agent.length, 'agent', 'agents'));
  if (c.command.length) parts.push(plural(c.command.length, 'command', 'commands'));
  if (c.hook.length) parts.push('hooks');
  if (c.mcp.length) parts.push(plural(c.mcp.length, 'MCP server', 'MCP servers'));
  if (p.bin.length) parts.push(plural(p.bin.length, 'bin file', 'bin files'));
  return parts.join(', ') || 'no components';
}

export function dependencySummary(p: PluginItem): string {
  const n = p.dependencies.length;
  return n === 0 ? 'no dependencies' : `depends on ${plural(n, 'plugin', 'plugins')}`;
}

/** File name shown for a body ("SKILL.md", "code-reviewer.md", "hooks/hooks.json"). */
export function bodyFileName(item: IndexItem): string {
  switch (item.type) {
    case 'plugin':
      return 'README.md';
    case 'skill':
      return 'SKILL.md';
    case 'hook':
      return 'hooks/hooks.json';
    case 'mcp':
      return '.mcp.json';
    default:
      return `${item.name}.md`;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-10" → "Oct 10, 2026" without time zone shifts. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatMonth(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${full[m - 1]} ${y}`;
}
