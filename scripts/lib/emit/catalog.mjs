// catalog.json: the stable public schema for agents (spec §4.6, FR-27). Absolute URLs only, no bodies.
import { COMPONENT_TYPES } from '../ids.mjs';

export const CATALOG_SCHEMA_VERSION = '1.0.0';

/** @param {object} index the IndexFile */
export function buildCatalog(index) {
  const { marketplace: m, commit } = index;
  const site = m.siteUrl;
  const treeRef = commit || m.repo.defaultBranch;
  const byId = new Map(index.items.map((i) => [i.id, i]));
  const abs = (ref) => (ref ? `${site}${ref}` : null);

  const plugins = index.items
    .filter((i) => i.type === 'plugin')
    .map((p) => {
      const components = [];
      for (const type of COMPONENT_TYPES) {
        for (const id of p.components[type]) {
          const c = byId.get(id);
          components.push({
            id: c.id,
            type: c.type,
            name: c.name,
            qualifiedName: c.qualifiedName,
            description: c.description,
            bodyUrl: abs(c.bodyRef),
            pageUrl: `${site}#/artifact/${c.id}`,
          });
        }
      }
      return {
        name: p.name,
        version: p.version,
        description: p.description,
        keywords: p.keywords,
        source: p.source,
        sourceUrl: p.source === 'external' ? p.external.url : `${m.repo.url}/tree/${treeRef}/${p.path}`,
        executesCode: p.source === 'external' ? null : p.executesCode,
        dependencies: p.dependencies.map((d) => ({ name: d.name, range: d.range })),
        install: p.installCommands,
        pageUrl: `${site}#/plugin/${p.name}`,
        readmeUrl: abs(p.readmeRef),
        components,
      };
    });

  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    generatedAt: index.generatedAt,
    commit,
    marketplace: {
      name: m.name,
      description: m.description,
      owner: { name: m.owner.name },
      repository: m.repo.url,
      siteUrl: site,
      addCommands: m.addCommands,
    },
    plugins,
  };
}
