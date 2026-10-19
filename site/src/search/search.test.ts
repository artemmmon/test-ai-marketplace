// Golden query set from spec FR-91, run against the demo fixtures in public/.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IndexFile } from '../types';
import { createEngine, highlight } from './engine';
import { parseQuery } from './query';

const index = JSON.parse(readFileSync(new URL('../../public/index.json', import.meta.url), 'utf8')) as IndexFile;
const engine = createEngine(index.items);
const none = { types: [], plugin: null, tags: [] };
const ids = (q: string) => engine.search(q, none, null).hits.map((h) => h.item.id);

describe('parseQuery', () => {
  it('drops templates and stop words and detects the type (UA)', () => {
    const p = parseQuery("мені треба скіл для код-рев'ю");
    expect(p.detectedType).toBe('skill');
    expect(p.highlightTerms).toEqual(['код', 'ревю']);
  });
  it('drops templates and detects the type (EN)', () => {
    const p = parseQuery('I need a skill for code review');
    expect(p.detectedType).toBe('skill');
    expect(p.groups).toHaveLength(1);
    expect(p.phraseNames).toContain('code-review');
  });
  it('recognises a type-only query', () => {
    expect(parseQuery('хуки')).toMatchObject({ detectedType: 'hook', typeOnly: true, groups: [] });
  });
});

describe('golden set (FR-91)', () => {
  const top = (q: string, k: number) => ids(q).slice(0, k);
  it('1 UA code review', () => expect(top("мені треба скіл для код-рев'ю", 1)).toEqual(['engineering-paved-path:skill:code-review']));
  it('2 EN code review', () => expect(top('I need a skill for code review', 1)).toEqual(['engineering-paved-path:skill:code-review']));
  it('3 перевірка коду', () => expect(top('перевірка коду', 3)).toContain('engineering-paved-path:skill:code-review'));
  it('4 react', () => expect(top('react', 1)).toEqual(['engineering-paved-path:skill:react-best-practices']));
  it('5 exact qualified name', () =>
    expect(top('engineering-paved-path:react-best-practices', 1)).toEqual(['engineering-paved-path:skill:react-best-practices']));
  it('6 агент для архітектури', () => expect(top('агент для архітектури', 1)).toEqual(['architecture-review:agent:architecture-reviewer']));
  it('7 коміт', () => expect(top('коміт', 1)).toEqual(['engineering-paved-path:skill:commit-conventions']));
  it('8 специфікація', () => expect(top('специфікація', 3)).toContain('sdd-engineering:skill:spec-writing'));
  it('9 дослідження', () => {
    const t = top('дослідження', 3);
    expect(t.includes('research-tools') || t.includes('research-tools:skill:web-research')).toBe(true);
  });
  it('10 sdd', () => expect(top('sdd', 3)).toContain('sdd-engineering'));
  it('11 architecture-review', () =>
    expect(new Set(top('architecture-review', 2))).toEqual(new Set(['architecture-review', 'architecture-review:skill:architecture-review'])));
  it('12 typo', () => expect(top('reviw', 3)).toContain('engineering-paved-path:skill:code-review'));
  it('13 хуки', () => {
    const p = parseQuery('хуки');
    const r = engine.search('', { ...none, types: [p.detectedType!] }, null);
    expect(r.hits.map((h) => h.item.id)).toEqual(['engineering-paved-path:hook:hooks']);
  });
  it('14 mcp', () => {
    const p = parseQuery('mcp');
    expect(p.typeOnly).toBe(true);
    const r = engine.search('', { ...none, types: [p.detectedType!] }, null);
    expect(r.hits.map((h) => h.item.id)).toEqual(['research-tools:mcp:mcp-servers']);
  });
  it('15 kubernetes', () => expect(ids('kubernetes')).toEqual([]));
  it('16 empty query returns everything, recently updated first', () => {
    const all = ids('');
    expect(all).toHaveLength(index.items.length);
    expect(all[0].startsWith('sdd-engineering')).toBe(true);
  });
});

describe('highlight', () => {
  it('marks code-review as one part', () => {
    const r = engine.search("мені треба скіл для код-рев'ю", none, null).hits[0];
    expect(highlight(r.item.name, r.terms)).toEqual([{ text: 'code-review', mark: true }]);
  });
});
