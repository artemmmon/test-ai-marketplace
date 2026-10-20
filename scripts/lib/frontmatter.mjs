// Zero-dependency parser for the YAML subset used in SKILL.md / agent / command frontmatter (spec FR-16).
//
// Supported:
//   key: scalar            unquoted string, "double", 'single', number, true/false, null/~
//   key: [a, b]            inline list of scalars (one line)
//   key:                   block list ("- a") or a nested mapping (indented "key: scalar" lines)
//   key: >  |  >-  |+      folded / literal block scalar
//   plain scalars may continue on following, more indented lines (folded with a space)
//   "# comment" lines and " #" trailing comments on unquoted values
// Everything else (anchors, tags, flow mappings, multi-line quoted scalars, tabs for
// indentation, mappings inside lists, ...) is a FrontmatterError that carries the 1-based line.
//
// Extension over FR-16: nested mappings, because real skills use `metadata:\n  tags: ...`.

export class FrontmatterError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'FrontmatterError';
    this.line = line;
  }
}

/** Normalizes line endings and drops a BOM. */
export function normalizeNewlines(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/**
 * Splits a markdown file into frontmatter data and body.
 * Without a leading `---` block the data is `{}` and the body is the whole text.
 * @returns {{ data: Record<string, unknown>, body: string, hasFrontmatter: boolean }}
 */
export function parseFrontmatter(text) {
  const lines = normalizeNewlines(text).split('\n');
  if (lines[0]?.trimEnd() !== '---') return { data: {}, body: lines.join('\n'), hasFrontmatter: false };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trimEnd();
    if (t === '---' || t === '...') {
      end = i;
      break;
    }
  }
  if (end === -1) throw new FrontmatterError('frontmatter block is not closed (missing closing ---)', 1);

  const data = parseBlock(lines.slice(1, end), 2);
  return { data, body: lines.slice(end + 1).join('\n'), hasFrontmatter: true };
}

const KEY_RE = /^([A-Za-z0-9_][A-Za-z0-9_.-]*)[ \t]*:(?:[ \t]+(.*))?$/;
const BLOCK_SCALAR_RE = /^([|>])([+-]?)(\d?)([+-]?)$/;

function parseBlock(rawLines, firstLineNo) {
  const lines = rawLines.map((raw, i) => {
    const num = firstLineNo + i;
    const trimmed = raw.trim();
    const indentMatch = /^[ \t]*/.exec(raw)[0];
    if (indentMatch.includes('\t') && trimmed !== '') throw new FrontmatterError('tabs are not allowed for indentation', num);
    return { raw, num, text: raw.trimEnd(), indent: indentMatch.length, blank: trimmed === '' || trimmed.startsWith('#') };
  });
  const state = { lines, i: 0 };
  const data = parseMapping(state, 0);
  skipBlank(state);
  if (state.i < lines.length) throw new FrontmatterError(`unexpected indentation: "${lines[state.i].text.trim()}"`, lines[state.i].num);
  return data;
}

function skipBlank(state) {
  while (state.i < state.lines.length && state.lines[state.i].blank) state.i++;
}

function nextContent(state, from) {
  let j = from;
  while (j < state.lines.length && state.lines[j].blank) j++;
  return j < state.lines.length ? state.lines[j] : null;
}

function parseMapping(state, indent) {
  const out = {};
  for (;;) {
    skipBlank(state);
    const line = state.lines[state.i];
    if (!line || line.indent < indent) return out;
    if (line.indent > indent) throw new FrontmatterError(`unexpected indentation: "${line.text.trim()}"`, line.num);
    const m = KEY_RE.exec(line.text.trim());
    if (!m) throw new FrontmatterError(`unsupported line (expected "key: value"): "${line.text.trim()}"`, line.num);
    const key = m[1];
    if (Object.hasOwn(out, key)) throw new FrontmatterError(`duplicate key "${key}"`, line.num);
    state.i++;

    const rest = stripComment(m[2] ?? '').trim();
    if (rest === '') {
      const next = nextContent(state, state.i);
      const isDash = next && (next.text.trim() === '-' || next.text.trim().startsWith('- '));
      if (next && isDash && next.indent >= indent) {
        out[key] = parseList(state, next.indent);
      } else if (next && next.indent > indent) {
        out[key] = parseMapping(state, next.indent);
      } else {
        out[key] = null;
      }
    } else if (BLOCK_SCALAR_RE.test(rest)) {
      out[key] = parseBlockScalar(state, rest, indent);
    } else {
      out[key] = parseValueWithContinuation(state, rest, line, indent);
    }
  }
}

function parseList(state, indent) {
  const out = [];
  for (;;) {
    skipBlank(state);
    const line = state.lines[state.i];
    if (!line || line.indent !== indent) return out;
    const t = line.text.trim();
    if (t !== '-' && !t.startsWith('- ')) return out;
    state.i++;
    const itemText = stripComment(t.slice(1)).trim();
    if (itemText === '') throw new FrontmatterError('empty list item', line.num);
    if (/^[A-Za-z0-9_][A-Za-z0-9_.-]*:(\s|$)/.test(itemText) && !/^["'[]/.test(itemText)) {
      throw new FrontmatterError('mappings inside lists are not supported', line.num);
    }
    out.push(parseInline(itemText, line.num));
  }
}

function parseBlockScalar(state, indicator, parentIndent) {
  const [, style, c1, , c2] = BLOCK_SCALAR_RE.exec(indicator);
  const chomp = c1 || c2 || 'clip';
  const body = [];
  let blockIndent = null;
  while (state.i < state.lines.length) {
    const line = state.lines[state.i];
    const isBlank = line.raw.trim() === '';
    if (!isBlank && line.indent <= parentIndent) break;
    if (!isBlank && blockIndent === null) blockIndent = line.indent;
    if (!isBlank && line.indent < blockIndent) break;
    body.push(isBlank ? '' : line.raw.slice(blockIndent));
    state.i++;
  }
  while (body.length && body[body.length - 1] === '') body.pop();
  let text;
  if (style === '|') {
    text = body.join('\n');
  } else {
    // Folded: single newlines become spaces, blank lines stay as newlines.
    text = '';
    body.forEach((l, i) => {
      if (i === 0) text = l;
      else if (l === '') text += '\n';
      else text += text.endsWith('\n') || body[i - 1] === '' ? l : ` ${l}`;
    });
  }
  if (chomp === '-') return text;
  return text === '' ? '' : `${text}\n`;
}

/** A plain scalar may continue on following, more indented lines. Quoted / flow values may not. */
function parseValueWithContinuation(state, rest, line, indent) {
  if (/^["'[{&*!%@`]/.test(rest) || rest.startsWith('? ')) return parseInline(rest, line.num);
  let text = rest;
  for (;;) {
    const next = state.lines[state.i];
    if (!next || next.blank || next.indent <= indent) break;
    if (KEY_RE.test(next.text.trim()) && next.indent === line.indent) break;
    text += ` ${stripComment(next.text.trim()).trim()}`;
    state.i++;
  }
  return parseInline(text, line.num);
}

/** Removes a trailing " # comment" from an unquoted value (quoted values handle it themselves). */
function stripComment(value) {
  if (/^\s*["']/.test(value)) return value;
  const idx = value.search(/\s#/);
  return idx === -1 ? value : value.slice(0, idx);
}

function parseInline(text, num) {
  const t = text.trim();
  if (t.startsWith('[')) return parseFlowList(t, num);
  if (t.startsWith('{')) throw new FrontmatterError('inline mappings ({...}) are not supported', num);
  return parseScalar(t, num);
}

function parseFlowList(text, num) {
  const close = findFlowEnd(text, num);
  const after = stripComment(text.slice(close + 1)).trim();
  if (after !== '') throw new FrontmatterError(`unexpected text after the list: "${after}"`, num);
  const inner = text.slice(1, close);
  const items = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && /\s/.test(inner[i])) i++;
    if (i >= inner.length) break;
    let end;
    if (inner[i] === '"' || inner[i] === "'") {
      end = quotedEnd(inner, i, num);
      items.push(parseScalar(inner.slice(i, end + 1), num));
      i = end + 1;
      while (i < inner.length && /\s/.test(inner[i])) i++;
      if (i < inner.length && inner[i] !== ',') throw new FrontmatterError('expected "," between list items', num);
    } else {
      end = inner.indexOf(',', i);
      if (end === -1) end = inner.length;
      const raw = inner.slice(i, end).trim();
      if (/[[\]{}]/.test(raw)) throw new FrontmatterError('nested lists or mappings are not supported', num);
      items.push(parseScalar(raw, num));
      i = end;
    }
    if (inner[i] === ',') i++;
  }
  return items;
}

function findFlowEnd(text, num) {
  for (let i = 1; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") i = quotedEnd(text, i, num);
    else if (c === ']') return i;
  }
  throw new FrontmatterError('inline list is not closed on the same line', num);
}

function quotedEnd(text, start, num) {
  const q = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (q === '"' && text[i] === '\\') i++;
    else if (q === "'" && text[i] === "'" && text[i + 1] === "'") i++;
    else if (text[i] === q) return i;
  }
  throw new FrontmatterError('unterminated quoted string (multi-line quoted strings are not supported)', num);
}

function parseScalar(text, num) {
  if (text === '') return '';
  const c = text[0];
  if (c === '"' || c === "'") {
    const end = quotedEnd(text, 0, num);
    const after = text.slice(end + 1).trim();
    if (after !== '' && !after.startsWith('#')) throw new FrontmatterError(`unexpected text after the quoted string: "${after}"`, num);
    const inner = text.slice(1, end);
    return c === '"' ? unescapeDouble(inner, num) : inner.replace(/''/g, "'");
  }
  if ('&*!%@`|>'.includes(c)) throw new FrontmatterError(`unsupported YAML syntax at "${text.slice(0, 20)}"`, num);
  if (/^(true|True|TRUE)$/.test(text)) return true;
  if (/^(false|False|FALSE)$/.test(text)) return false;
  if (/^(null|Null|NULL|~)$/.test(text)) return null;
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(text)) return Number(text);
  return text;
}

const ESCAPES = { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', '\\': '\\', '/': '/', ' ': ' ', b: '\b', f: '\f', e: '\x1b', a: '\x07', v: '\v' };

function unescapeDouble(s, num) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') {
      out += s[i];
      continue;
    }
    const n = s[++i];
    if (n === 'x' || n === 'u' || n === 'U') {
      const len = n === 'x' ? 2 : n === 'u' ? 4 : 8;
      const hex = s.slice(i + 1, i + 1 + len);
      if (!new RegExp(`^[0-9a-fA-F]{${len}}$`).test(hex)) throw new FrontmatterError(`invalid \\${n} escape`, num);
      out += String.fromCodePoint(parseInt(hex, 16));
      i += len;
    } else if (n in ESCAPES) {
      out += ESCAPES[n];
    } else {
      throw new FrontmatterError(`unknown escape "\\${n ?? ''}"`, num);
    }
  }
  return out;
}
