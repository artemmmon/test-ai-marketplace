// feed.xml: Atom 1.0 feed of the newest releases (spec §4.8, FR-29).
const MAX_ENTRIES = 50;

// Characters that are not allowed in XML 1.0 documents.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function xmlEscape(text) {
  return String(text ?? '')
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {{ index: object, releases: object[] }} input */
export function buildFeed({ index, releases }) {
  const { marketplace: m, generatedAt } = index;
  const site = m.siteUrl;
  const dateOf = (r) => (r.date ? `${r.date}T00:00:00Z` : generatedAt);
  const newest = releases.find((r) => r.date);
  const updated = newest ? dateOf(newest) : generatedAt;

  const out = [];
  out.push('<?xml version="1.0" encoding="utf-8"?>');
  out.push('<feed xmlns="http://www.w3.org/2005/Atom">');
  out.push(`  <id>${xmlEscape(site)}</id>`);
  out.push(`  <title>${xmlEscape(`${m.name} — releases`)}</title>`);
  out.push(`  <link rel="self" href="${xmlEscape(`${site}feed.xml`)}"/>`);
  out.push(`  <link rel="alternate" href="${xmlEscape(`${site}#/whats-new`)}"/>`);
  out.push(`  <updated>${xmlEscape(updated)}</updated>`);
  out.push(`  <author><name>${xmlEscape(m.owner.name)}</name></author>`);
  for (const r of releases.slice(0, MAX_ENTRIES)) {
    out.push('  <entry>');
    out.push(`    <id>${xmlEscape(`${site}#/whats-new?release=${r.id}`)}</id>`);
    out.push(`    <title>${xmlEscape(`${r.plugin} v${r.version}`)}</title>`);
    out.push(`    <link href="${xmlEscape(`${site}#/plugin/${r.plugin}`)}"/>`);
    out.push(`    <updated>${xmlEscape(dateOf(r))}</updated>`);
    out.push(`    <content type="text">${xmlEscape(r.notesMarkdown)}</content>`);
    out.push('  </entry>');
  }
  out.push('</feed>');
  return `${out.join('\n')}\n`;
}
