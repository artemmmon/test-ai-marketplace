// index.json: one flat list of plugins and their components (spec §4.3, FR-20..FR-25).
import { COMPONENT_TYPES, byString, componentBodyRef, componentId, installCommands, pluginDocRef, qualifiedName, uniqueLower } from '../ids.mjs';
import { componentsOf } from '../marketplace.mjs';
import { latestRelease } from '../releases.mjs';
import { normalizePerson } from '../site-info.mjs';
import { collapseWhitespace, markdownToPlainText } from '../text.mjs';

const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Keyword-ish frontmatter value: a list or a comma-separated string. */
function listOf(value) {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' || typeof v === 'number').map(String);
  if (typeof value === 'string') return value.split(',');
  return [];
}

function repositoryOf(manifest) {
  const r = manifest.repository;
  if (typeof r === 'string') return str(r);
  if (r && typeof r === 'object') return str(r.url);
  return null;
}

/** Body of a skill/agent/command as written to bodies/: the markdown after the frontmatter. */
export function componentBodyText(component) {
  if (component.type === 'hook' || component.type === 'mcp') return component.raw;
  const body = component.body.replace(/^\n+/, '').trimEnd();
  return body === '' ? '' : `${body}\n`;
}

function emptyComponents() {
  return { skill: [], agent: [], command: [], hook: [], mcp: [] };
}

function externalPluginItem(p, info) {
  const e = p.entry;
  return {
    id: p.name,
    type: 'plugin',
    name: p.name,
    qualifiedName: p.name,
    plugin: p.name,
    version: p.version,
    description: collapseWhitespace(e.description),
    keywords: uniqueLower(listOf(e.keywords)),
    path: null,
    bodyRef: null,
    bodyFormat: null,
    searchText: '',
    source: 'external',
    executesCode: false,
    installCommands: installCommands(p.name, info.name),
    updatedAt: null,
    owner: null,
    license: null,
    homepage: null,
    repository: null,
    compatibility: null,
    dependencies: [],
    usedBy: p.usedBy ?? [],
    components: emptyComponents(),
    bin: [],
    readmeRef: null,
    changelogRef: null,
    latestRelease: null,
    external: p.external,
  };
}

function localItems(p, info, releases) {
  const m = p.manifest;
  const keywords = uniqueLower(listOf(m.keywords), listOf(p.entry.keywords));
  const description = collapseWhitespace(m.description) || collapseWhitespace(p.entry.description);
  const latest = latestRelease(releases, p.name);
  const updatedAt = latest?.date ?? null;
  const install = installCommands(p.name, info.name);
  const executesCode = Boolean(p.hook || p.mcp || p.bin.length > 0 || p.inlineKeys.includes('hooks') || p.inlineKeys.includes('mcpServers'));
  const has = (key) => p.docs[key] !== undefined;
  const readmeRef = has('readme') ? pluginDocRef(p.name, 'README.md') : null;

  const base = (c, { description = c.description, searchText, ...extra }) => ({
    id: componentId(p.name, c.type, c.name),
    type: c.type,
    name: c.name,
    qualifiedName: qualifiedName(p.name, c.name),
    plugin: p.name,
    version: p.version,
    description,
    keywords: uniqueLower(keywords, listOf(c.frontmatter?.keywords), listOf(c.frontmatter?.tags), c.servers?.map((s) => s.name)),
    path: c.path,
    bodyRef: componentBodyRef(p.name, c.type, c.name),
    bodyFormat: c.type === 'hook' || c.type === 'mcp' ? 'json' : 'markdown',
    searchText,
    source: 'local',
    executesCode: c.type === 'hook' || c.type === 'mcp',
    installCommands: install,
    updatedAt,
    ...extra,
  });

  const items = [];
  for (const s of p.skills) {
    items.push(base(s, { searchText: markdownToPlainText(s.body), frontmatter: s.frontmatter, files: s.files }));
  }
  for (const a of p.agents) {
    const tools = a.frontmatter.tools;
    const toolList = tools === undefined || tools === null ? null : listOf(tools).map((t) => t.trim()).filter(Boolean);
    items.push(base(a, { searchText: markdownToPlainText(a.body), tools: toolList, model: str(a.frontmatter.model), frontmatter: a.frontmatter }));
  }
  for (const c of p.commands) {
    items.push(base(c, { searchText: markdownToPlainText(c.body), argumentHint: str(c.frontmatter['argument-hint']), frontmatter: c.frontmatter }));
  }
  if (p.hook) {
    const events = p.hook.events;
    items.push(base(p.hook, { description: events.length ? `Hooks: ${events.join(', ')}.` : 'Hooks.', searchText: events.join(' '), events }));
  }
  if (p.mcp) {
    const names = p.mcp.servers.map((s) => s.name);
    items.push(base(p.mcp, { description: names.length ? `MCP servers: ${names.join(', ')}.` : 'MCP servers.', searchText: names.join(' '), servers: p.mcp.servers }));
  }

  const components = emptyComponents();
  for (const it of items) components[it.type].push(it.id);
  for (const t of COMPONENT_TYPES) components[t].sort(byString);

  const plugin = {
    id: p.name,
    type: 'plugin',
    name: p.name,
    qualifiedName: p.name,
    plugin: p.name,
    version: p.version,
    description,
    keywords,
    path: p.repoPath,
    bodyRef: readmeRef,
    bodyFormat: readmeRef ? 'markdown' : null,
    searchText: has('readme') ? markdownToPlainText(p.docs.readme) : '',
    source: 'local',
    executesCode,
    installCommands: install,
    updatedAt,
    owner: normalizePerson(m.author) ?? info.owner,
    license: str(m.license),
    homepage: str(m.homepage),
    repository: repositoryOf(m),
    compatibility: has('compat') ? { claudeCode: p.compat.claudeCode, bodyRef: pluginDocRef(p.name, 'COMPATIBILITY.md') } : null,
    dependencies: p.resolved,
    usedBy: p.usedBy,
    components,
    bin: p.bin,
    readmeRef,
    changelogRef: has('changelog') ? pluginDocRef(p.name, 'CHANGELOG.md') : null,
    latestRelease: latest ? { version: latest.version, date: latest.date, tag: latest.tag } : null,
    external: null,
  };
  return { plugin, items };
}

/**
 * @param {{ info: object, plugins: object[], releases: object[], commit: string, generatedAt: string, fixture: boolean }} input
 */
export function buildIndex({ info, plugins, releases, commit, generatedAt, fixture }) {
  const pluginItems = [];
  const componentItems = [];
  for (const p of [...plugins].sort((a, b) => byString(a.name, b.name))) {
    if (p.source === 'external') {
      pluginItems.push(externalPluginItem(p, info));
    } else {
      const { plugin, items } = localItems(p, info, releases);
      pluginItems.push(plugin);
      componentItems.push(...items);
    }
  }
  componentItems.sort((a, b) => byString(a.id, b.id));
  return { schemaVersion: '1.0', generatedAt, commit, fixture, marketplace: info, items: [...pluginItems, ...componentItems] };
}

/**
 * Files under bodies/: plugin README/CHANGELOG/COMPATIBILITY and one file per component.
 * @returns {Map<string, string>} path relative to the output directory -> text
 */
export function buildBodies(plugins) {
  const files = new Map();
  for (const p of plugins) {
    if (p.source !== 'local') continue;
    for (const [key, file] of [['readme', 'README.md'], ['changelog', 'CHANGELOG.md'], ['compat', 'COMPATIBILITY.md']]) {
      if (p.docs[key] !== undefined) files.set(pluginDocRef(p.name, file), p.docs[key]);
    }
    for (const c of componentsOf(p)) files.set(componentBodyRef(p.name, c.type, c.name), componentBodyText(c));
  }
  return files;
}
