// Identifiers, slugs, body paths and install commands (spec FR-20..FR-22, §4.3).

export const COMPONENT_TYPES = ['skill', 'agent', 'command', 'hook', 'mcp'];

/** A component name (skill dir, agent, command) and the plugin-level name rule of FR-19. */
export const COMPONENT_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Constant component names (FR-20). */
export const HOOK_NAME = 'hooks';
export const MCP_NAME = 'mcp-servers';

export const pluginId = (plugin) => plugin;
export const componentId = (plugin, type, name) => `${plugin}:${type}:${name}`;
export const qualifiedName = (plugin, name) => `${plugin}:${name}`;

/** Body file of a component, relative to the site base: no colons in file names (FR-22). */
export function componentBodyRef(plugin, type, name) {
  const ext = type === 'hook' || type === 'mcp' ? 'json' : 'md';
  return `bodies/${plugin}/${type}/${name}.${ext}`;
}

export const pluginDocRef = (plugin, file) => `bodies/${plugin}/${file}`; // README.md | CHANGELOG.md | COMPATIBILITY.md

export function installCommands(plugin, marketplaceName) {
  const target = `${plugin}@${marketplaceName}`;
  return {
    chat: `/plugin install ${target}`,
    cliProject: `claude plugin install ${target} --scope project`,
    cliUser: `claude plugin install ${target} --scope user`,
  };
}

export function addCommands(slug) {
  return {
    chat: `/plugin marketplace add ${slug}`,
    cli: `claude plugin marketplace add ${slug}`,
  };
}

/** Release tag `<plugin>--v<semver>` (FR-26). */
export const TAG_RE = /^(.+)--v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
export const tagName = (plugin, version) => `${plugin}--v${version}`;
export const releaseId = (plugin, version) => `${plugin}@${version}`;

/** Deterministic string order (code units), independent of the locale. */
export const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function uniqueLower(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      const k = String(item).trim().toLowerCase();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
  }
  return out;
}
