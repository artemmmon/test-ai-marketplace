// Releases = union of CHANGELOG.md sections and git tags `<plugin>--v<semver>` (spec FR-26).
import { byString, releaseId, TAG_RE, tagName } from './ids.mjs';
import { compareVersions, isValidVersion } from './semver.mjs';

/**
 * @param {Array<{name: string, source: string, changelog: {sections: Array<{version: string, date: string|null, notesMarkdown: string}>} | null}>} plugins
 *   catalog plugins (only local ones carry a changelog)
 * @param {Array<{name: string, date: string|null, commit: string|null}>} tags
 * @returns {{ releases: Array<object>, warnings: Array<{file: string|null, message: string}> }}
 */
export function computeReleases(plugins, tags = []) {
  const warnings = [];
  const byPlugin = new Map(plugins.map((p) => [p.name, p]));
  const found = new Map(); // releaseId -> release

  for (const plugin of plugins) {
    for (const s of plugin.changelog?.sections ?? []) {
      if (!isValidVersion(s.version)) continue;
      found.set(releaseId(plugin.name, s.version), {
        id: releaseId(plugin.name, s.version),
        plugin: plugin.name,
        version: s.version,
        date: s.date,
        tag: null,
        commit: null,
        notesMarkdown: s.notesMarkdown,
        origin: 'changelog',
      });
    }
  }

  for (const tag of [...tags].sort((a, b) => byString(a.name, b.name))) {
    const m = TAG_RE.exec(tag.name);
    if (!m) continue; // not a release tag
    const [, pluginName, version] = m;
    const plugin = byPlugin.get(pluginName);
    if (!plugin || plugin.source !== 'local') {
      warnings.push({ file: null, message: `tag ${tag.name}: no local plugin "${pluginName}" in the catalog, the tag is ignored` });
      continue;
    }
    const id = releaseId(pluginName, version);
    const existing = found.get(id);
    if (existing) {
      existing.tag = tag.name;
      existing.commit = tag.commit ?? null;
      existing.date = existing.date ?? tag.date ?? null;
      existing.origin = 'changelog+tag';
    } else {
      warnings.push({ file: null, message: `tag ${tag.name}: no "${version}" section in ${pluginName}/CHANGELOG.md, the release has empty notes` });
      found.set(id, {
        id,
        plugin: pluginName,
        version,
        date: tag.date ?? null,
        tag: tagName(pluginName, version),
        commit: tag.commit ?? null,
        notesMarkdown: '',
        origin: 'tag',
      });
    }
  }

  // Date desc (undated last), then semver desc, then plugin asc.
  const releases = [...found.values()].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? 1 : -1;
    }
    const v = compareVersions(b.version, a.version);
    return v !== 0 ? v : byString(a.plugin, b.plugin);
  });
  return { releases, warnings };
}

/** The release with the highest version of one plugin, or null. */
export function latestRelease(releases, pluginName) {
  let best = null;
  for (const r of releases) {
    if (r.plugin === pluginName && (!best || compareVersions(r.version, best.version) > 0)) best = r;
  }
  return best;
}
