// CHANGELOG.md parser (Keep a Changelog headings, spec FR-26).
import { normalizeNewlines } from './frontmatter.mjs';

// ## [1.2.0] - 2026-09-30  |  ## 1.2.0 - 2026-09-30  |  ## [1.2.0]
export const RELEASE_HEADING_RE =
  /^##\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?(?:\s+[-–]\s+(\d{4}-\d{2}-\d{2}))?\s*$/;
const UNRELEASED_RE = /^##\s+\[?unreleased\]?(?:\s.*)?$/i;
const H2_RE = /^##(?!#)\s*\S/;
const LINK_REF_RE = /^\[[^\]]+\]:\s*\S+/;

/**
 * @returns {{
 *   sections: Array<{version: string, date: string | null, heading: string, line: number, notesMarkdown: string}>,
 *   skipped: Array<{line: number, heading: string, reason: string}>,
 * }}
 * `sections` keep file order. Unrecognized `## ` headings and duplicate versions are listed in `skipped`
 * and their content is dropped; `## [Unreleased]` is skipped silently.
 */
export function parseChangelog(text) {
  const lines = normalizeNewlines(text).split('\n');
  const sections = [];
  const skipped = [];
  let current = null; // { section|null, body: string[] }
  let fence = null;

  const flush = () => {
    if (current?.section) current.section.notesMarkdown = cleanNotes(current.body);
  };

  lines.forEach((line, idx) => {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
    }
    if (!fence && H2_RE.test(line)) {
      flush();
      const heading = line.trim();
      const m = RELEASE_HEADING_RE.exec(heading);
      if (m) {
        if (sections.some((s) => s.version === m[1])) {
          skipped.push({ line: idx + 1, heading, reason: 'duplicate version' });
          current = { section: null, body: [] };
        } else {
          const section = { version: m[1], date: m[2] ?? null, heading, line: idx + 1, notesMarkdown: '' };
          sections.push(section);
          current = { section, body: [] };
        }
      } else {
        if (!UNRELEASED_RE.test(heading)) skipped.push({ line: idx + 1, heading, reason: 'unrecognized heading' });
        current = { section: null, body: [] };
      }
      return;
    }
    if (current) current.body.push(line);
  });
  flush();
  return { sections, skipped };
}

function cleanNotes(bodyLines) {
  const lines = [...bodyLines];
  const trimEnd = () => {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  };
  trimEnd();
  // Trailing link reference definitions ("[1.0.0]: https://...") belong to the file, not to the release.
  while (lines.length && LINK_REF_RE.test(lines[lines.length - 1])) {
    lines.pop();
    trimEnd();
  }
  while (lines.length && lines[0].trim() === '') lines.shift();
  return lines.join('\n');
}
