// Plain-text helpers for search text and short descriptions.

export const SEARCH_TEXT_LIMIT = 8000;

export function collapseWhitespace(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Cuts at `limit` characters without splitting a surrogate pair. */
export function truncate(text, limit) {
  if (text.length <= limit) return text;
  let end = limit;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end--;
  return text.slice(0, end);
}

/** Markdown to plain text for searching: no markup, no frontmatter, one line, at most `limit` characters. */
export function markdownToPlainText(markdown, limit = SEARCH_TEXT_LIMIT) {
  let s = String(markdown ?? '').replace(/\r\n?/g, '\n');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/^\s*(```+|~~~+)[^\n]*$/gm, ' '); // fence markers; the code itself stays searchable
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1'); // images: keep alt text
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // inline links: keep the label
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1'); // reference links
  s = s.replace(/^\[[^\]]+\]:\s*\S+.*$/gm, ' '); // link reference definitions
  s = s.replace(/<\/?[A-Za-z][^>]*>/g, ' '); // html tags
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, ''); // heading markers
  s = s.replace(/^\s{0,3}>\s?/gm, ''); // blockquote markers
  s = s.replace(/^\s*([-*+]|\d+[.)])\s+/gm, ''); // list markers
  s = s.replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' '); // table separator rows
  s = s.replace(/\|/g, ' ');
  s = s.replace(/(\*\*|__|\*|~~)/g, ''); // emphasis markers
  s = s.replace(/`+/g, '');
  return truncate(collapseWhitespace(s), limit);
}

/** First non-empty line of a markdown body as plain text, at most `limit` characters. */
export function firstLine(markdown, limit = 160) {
  for (const line of String(markdown ?? '').split('\n')) {
    const text = markdownToPlainText(line, Infinity);
    if (text) return text.length > limit ? `${truncate(text, limit - 1).trimEnd()}…` : text;
  }
  return '';
}
