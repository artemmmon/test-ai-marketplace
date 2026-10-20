// stats.json (spec §4.5), counted from index.json items and the release list.
export function buildStats({ index, releases }) {
  const items = index.items;
  const of = (type) => items.filter((i) => i.type === type);
  const plugins = of('plugin');
  const sum = (list, f) => list.reduce((n, i) => n + f(i), 0);
  return {
    schemaVersion: '1.0',
    generatedAt: index.generatedAt,
    commit: index.commit,
    counts: {
      plugins: plugins.length,
      pluginsLocal: plugins.filter((p) => p.source === 'local').length,
      pluginsExternal: plugins.filter((p) => p.source === 'external').length,
      skills: of('skill').length,
      agents: of('agent').length,
      commands: of('command').length,
      hooks: of('hook').length,
      hookEvents: sum(of('hook'), (h) => h.events.length),
      mcp: sum(of('mcp'), (m) => m.servers.length),
      releases: releases.length,
    },
  };
}
