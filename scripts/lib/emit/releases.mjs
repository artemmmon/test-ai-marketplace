// releases.json (spec §4.4). The release list itself is computed by lib/releases.mjs.
export function buildReleasesFile({ releases, commit, generatedAt }) {
  return { schemaVersion: '1.0', generatedAt, commit, releases };
}
