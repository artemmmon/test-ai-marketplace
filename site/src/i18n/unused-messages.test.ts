// Guard: every message in en.ts is used somewhere in src (no dead copy), and
// the file stays plain text (no JSX or HTML).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from './en';

const SRC = join(process.cwd(), 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    const code = /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && path !== join(SRC, 'i18n', 'en.ts');
    return code ? [readFileSync(path, 'utf8')] : [];
  });
}

/** Dotted path -> text of every message (plural forms are joined into one entry). */
function flatten(node: unknown, prefix = ''): Array<[string, string[]]> {
  if (typeof node === 'string') return [[prefix, [node]]];
  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length > 0 && entries.every(([form, v]) => ['zero', 'one', 'two', 'few', 'many', 'other'].includes(form) && typeof v === 'string')) {
    return [[prefix, entries.map(([, v]) => v as string)]];
  }
  return entries.flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

const messages = flatten(en);
const code = sources(SRC).join('\n');

// Keys built with a template literal, e.g. t(`types.label.${type}`).
const dynamic = [...code.matchAll(/`((?:[\w]+\.)+)\$\{[^}]+\}([\w.]*)`/g)].map(
  ([, prefix, suffix]) => new RegExp(`^${prefix.replace(/\./g, '\\.')}[^.]+${suffix.replace(/\./g, '\\.')}$`),
);

describe('en.ts', () => {
  it('has no unused messages', () => {
    const unused = messages.map(([key]) => key).filter((key) => !code.includes(`'${key}'`) && !dynamic.some((re) => re.test(key)));
    expect(unused, `Unused keys (delete them or use them):\n${unused.join('\n')}`).toEqual([]);
  });

  it('contains plain text only (no HTML or JSX)', () => {
    const markup = messages.filter(([, texts]) => texts.some((text) => /<\/?[a-z][^>]*>/i.test(text))).map(([key]) => key);
    expect(markup, `Split rich text into fragments: ${markup.join(', ')}`).toEqual([]);
  });

  it('uses the same placeholders in every plural form', () => {
    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    const mismatched = messages.filter(([, texts]) => new Set(texts.map(names)).size > 1).map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});
