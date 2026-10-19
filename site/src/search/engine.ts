// In-browser search over index.json with MiniSearch (spec §5).
import MiniSearch, { type Query, type SearchResult } from 'minisearch';
import type { ArtifactType, IndexItem } from '../types';
import { parseQuery, type ParsedQuery } from './query';
import { indexTerm, normalize, stem, tokenize } from './text';

export type SortKey = 'relevance' | 'name' | 'updated';

export interface Filters {
  types: ArtifactType[];
  plugin: string | null;
  tags: string[];
}

export interface Hit {
  item: IndexItem;
  score: number;
  /** Index terms (stemmed) that matched, used for highlighting. */
  terms: Set<string>;
  /** True when only the body text (searchText) matched. */
  bodyOnly: boolean;
}

export interface SearchOutcome {
  parsed: ParsedQuery;
  hits: Hit[];
  partial: boolean;
  facets: {
    types: Map<ArtifactType, number>;
    plugins: Map<string, number>;
    tags: Map<string, number>;
  };
}

const FIELDS = ['name', 'qualifiedName', 'keywords', 'description', 'plugin', 'searchText'] as const;
const BOOST = { name: 6, qualifiedName: 4, keywords: 3, description: 2, plugin: 1.5, searchText: 1 };

export interface Engine {
  items: IndexItem[];
  byId: Map<string, IndexItem>;
  search(q: string, filters: Filters, sort: SortKey | null): SearchOutcome;
}

function nameKeys(item: IndexItem): string[] {
  return [tokenize(item.name).join(' '), tokenize(item.qualifiedName).join(' ')];
}

export function createEngine(items: IndexItem[]): Engine {
  const byId = new Map(items.map((i) => [i.id, i]));
  const mini = new MiniSearch<IndexItem>({
    fields: [...FIELDS],
    idField: 'id',
    extractField: (doc, field) => {
      const value = (doc as unknown as Record<string, unknown>)[field];
      return Array.isArray(value) ? value.join(' ') : String(value ?? '');
    },
    tokenize: (text) => normalize(text).split(/[^\p{L}\p{N}]+/u),
    processTerm: (term) => indexTerm(term),
    // Query terms arrive already normalized and stemmed by parseQuery.
    searchOptions: { tokenize: (text) => [text], processTerm: (term) => term },
  });
  mini.addAll(items);
  const exactKeys = new Map(items.map((i) => [i.id, nameKeys(i)]));

  function run(parsed: ParsedQuery, combineWith: 'AND' | 'OR', typeBoost: boolean): SearchResult[] {
    const query: Query = {
      combineWith,
      queries: parsed.groups.map((group) => ({ combineWith: 'OR', queries: group })),
    };
    const results = mini.search(query, {
      boost: BOOST,
      prefix: (term) => term.length >= 2,
      fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
      // Synonyms count, but less than the words the user actually typed.
      boostTerm: (term) => (parsed.primary.includes(term) ? 1 : 0.4),
      boostDocument: (id) => {
        const item = byId.get(id as string);
        if (!item) return 1;
        let factor = 1;
        if (typeBoost && item.type === parsed.detectedType) factor *= 2;
        // Plugins are what gets installed: lift them slightly when no type is asked for.
        else if (!parsed.detectedType && item.type === 'plugin') factor *= 1.5;
        if (parsed.phraseNames.some((n) => item.name.includes(n))) factor *= 3;
        if (parsed.exactName && exactKeys.get(item.id)?.includes(parsed.exactName)) factor *= 5;
        return factor;
      },
    });
    return results;
  }

  function search(q: string, filters: Filters, sort: SortKey | null): SearchOutcome {
    const parsed = parseQuery(q);
    const explicitType = filters.types.length > 0;
    let partial = false;
    let hits: Hit[];

    if (parsed.groups.length === 0) {
      hits = items.map((item) => ({ item, score: 0, terms: new Set(), bodyOnly: false }));
    } else {
      let results = run(parsed, 'AND', !explicitType);
      if (results.length === 0 && parsed.groups.length > 1) {
        results = run(parsed, 'OR', !explicitType);
        partial = results.length > 0;
      }
      const typed = parsed.highlightTerms.map(stem);
      hits = results.map((r) => {
        const fields = new Set(Object.values(r.match).flat());
        return {
          item: byId.get(r.id as string)!,
          score: r.score,
          // Matched index terms plus the words the user typed (e.g. "code" in "code review").
          terms: new Set([...r.terms, ...typed]),
          bodyOnly: fields.size === 1 && fields.has('searchText'),
        };
      });
      // An exact name match always comes first (FR-41).
      if (parsed.exactName) {
        const exact = (h: Hit) => exactKeys.get(h.item.id)!.includes(parsed.exactName!);
        hits = [...hits.filter(exact), ...hits.filter((h) => !exact(h))];
      }
    }

    const typeSet = new Set(filters.types);
    const tagSet = new Set(filters.tags);
    const byType = (h: Hit) => typeSet.size === 0 || typeSet.has(h.item.type);
    const byPlugin = (h: Hit) => !filters.plugin || h.item.plugin === filters.plugin;
    const byTag = (h: Hit) => tagSet.size === 0 || h.item.keywords.some((k) => tagSet.has(k));

    // Facet counts honour the current query and the other facets (spec §6.3).
    const types = new Map<ArtifactType, number>();
    const plugins = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const h of hits) {
      if (byPlugin(h) && byTag(h)) types.set(h.item.type, (types.get(h.item.type) ?? 0) + 1);
      if (byType(h) && byTag(h)) plugins.set(h.item.plugin, (plugins.get(h.item.plugin) ?? 0) + 1);
      if (byType(h) && byPlugin(h)) for (const k of h.item.keywords) tags.set(k, (tags.get(k) ?? 0) + 1);
    }

    let filtered = hits.filter((h) => byType(h) && byPlugin(h) && byTag(h));
    const effectiveSort = sort ?? (parsed.groups.length ? 'relevance' : 'updated');
    if (effectiveSort === 'name') {
      filtered = [...filtered].sort((a, b) => a.item.qualifiedName.localeCompare(b.item.qualifiedName));
    } else if (effectiveSort === 'updated' || parsed.groups.length === 0) {
      filtered = [...filtered].sort(
        (a, b) =>
          (b.item.updatedAt ?? '').localeCompare(a.item.updatedAt ?? '') ||
          a.item.qualifiedName.localeCompare(b.item.qualifiedName),
      );
    }

    return { parsed, hits: filtered, partial, facets: { types, plugins, tags } };
  }

  return { items, byId, search };
}

export interface Part {
  text: string;
  mark: boolean;
}

/**
 * Splits text into plain and highlighted parts. A word is highlighted when its
 * stem is one of the matched index terms. Hyphen-joined highlighted words are
 * merged so that "code-review" becomes a single mark. Works on plain text only;
 * React escapes the parts when rendering (FR-46).
 */
export function highlight(text: string, terms: Set<string>): Part[] {
  if (terms.size === 0) return [{ text, mark: false }];
  const pieces = text.split(/([\p{L}\p{N}'’ʼ‘`]+)/u);
  const parts: Part[] = [];
  const push = (t: string, mark: boolean) => {
    if (!t) return;
    const last = parts[parts.length - 1];
    if (last && last.mark === mark) last.text += t;
    else parts.push({ text: t, mark });
  };
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (i % 2 === 1) {
      const token = normalize(piece);
      push(piece, token.length >= 2 && terms.has(stem(token)));
    } else {
      // A lone hyphen between two highlighted words stays inside the mark.
      const prevMarked = parts[parts.length - 1]?.mark;
      const next = pieces[i + 1];
      const nextMarked = next !== undefined && terms.has(stem(normalize(next)));
      push(piece, piece === '-' && !!prevMarked && nextMarked);
    }
  }
  return parts;
}

export function hasMark(parts: Part[]): boolean {
  return parts.some((p) => p.mark);
}

/** About 160 characters of body text around the first highlighted word (FR-46). */
export function snippet(text: string, terms: Set<string>): Part[] | null {
  const parts = highlight(text, terms);
  let offset = 0;
  let start = -1;
  for (const p of parts) {
    if (p.mark) {
      start = offset;
      break;
    }
    offset += p.text.length;
  }
  if (start < 0) return null;
  const from = Math.max(0, start - 60);
  const to = Math.min(text.length, from + 160);
  const slice = (from > 0 ? '…' : '') + text.slice(from, to).trim() + (to < text.length ? '…' : '');
  return highlight(slice, terms);
}
