// Query parsing pipeline (spec §5.2). `parseQuery` is a pure function.
import type { ArtifactType } from '../types';
import synonymsFile from './synonyms.json';
import { isStopword, normalize, stem, tokenize } from './text';

export interface ParsedQuery {
  raw: string;
  /** Type named in the query ("скіл", "agents", "хуки"…), if any. */
  detectedType: ArtifactType | null;
  /** Each group is a term plus its synonyms: OR inside, AND between groups. */
  groups: string[][];
  /** Normalized surface words of the query, for display purposes. */
  highlightTerms: string[];
  /** Normalized query without template phrases and type words (FR-41). */
  exactName: string | null;
  /** True when the query consisted only of a type word (FR-38). */
  typeOnly: boolean;
  /** Stems typed by the user (or a phrase's canonical term); synonyms rank lower. */
  primary: string[];
  /** Hyphenated multi-word synonyms of the matched groups (e.g. "code-review"), boosted in names. */
  phraseNames: string[];
}

const MAX_LENGTH = 200;

// Template phrases removed from the start of the query (FR-34). Applied
// repeatedly. `\b` is ASCII-only in JS, so word ends are matched with a lookahead.
const END = '(?=\\s|$)';
const TEMPLATES: Array<[RegExp, string]> = [
  [new RegExp(`^мені\\s+(треба|потрібен|потрібна|потрібно)${END}`, 'u'), ''],
  [new RegExp(`^(шукаю|хочу|знайди|покажи)${END}`, 'u'), ''],
  [new RegExp(`^чи\\s+є${END}`, 'u'), ''],
  [new RegExp(`^є\\s+щось\\s+для${END}`, 'u'), ''],
  [new RegExp(`^i\\s+(need|want)${END}`, 'u'), ''],
  [new RegExp(`^(im|i\\s+am)\\s+looking\\s+for${END}`, 'u'), ''],
  [new RegExp(`^looking\\s+for${END}`, 'u'), ''],
  [new RegExp(`^is\\s+there${END}`, 'u'), ''],
  [new RegExp(`^(find|show)\\s+me${END}`, 'u'), ''],
  [new RegExp(`^something\\s+for${END}`, 'u'), ''],
  // "a skill for …" keeps the type word so that type detection still sees it.
  [new RegExp(`^(an?|any)\\s+(skill|agent|command|plugin|tool)s?\\s+(for|to)${END}`, 'u'), '$2'],
];

// Type words (FR-38): [word, exact match only?, type].
const TYPE_WORDS: Array<[string, boolean, ArtifactType]> = [
  ['skill', false, 'skill'],
  ['скіл', false, 'skill'],
  ['навичк', false, 'skill'],
  ['subagent', false, 'agent'],
  ['субагент', false, 'agent'],
  ['agent', false, 'agent'],
  ['агент', false, 'agent'],
  ['command', false, 'command'],
  ['команд', false, 'command'],
  ['slash', true, 'command'],
  ['слеш', true, 'command'],
  ['hook', false, 'hook'],
  ['хук', false, 'hook'],
  ['mcp', true, 'mcp'],
  ['мсп', true, 'mcp'],
  ['мцп', true, 'mcp'],
  ['plugin', false, 'plugin'],
  ['плагін', false, 'plugin'],
];

function typeOf(token: string): ArtifactType | null {
  for (const [word, exact, type] of TYPE_WORDS) {
    if (exact ? token === word : token.startsWith(word)) return type;
  }
  return null;
}

interface SynonymIndex {
  /** stem of a one-word member → group index */
  single: Map<string, number>;
  /** stems of each group's one-word members */
  groupStems: string[][];
  /** multi-word members as stem sequences, longest first */
  phrases: Array<{ stems: string[]; group: number }>;
  /** hyphenated multi-word members per group ("code-review") */
  groupPhraseNames: string[][];
}

function buildSynonymIndex(groups: string[][]): SynonymIndex {
  const single = new Map<string, number>();
  const groupStems: string[][] = [];
  const phrases: SynonymIndex['phrases'] = [];
  const groupPhraseNames: string[][] = [];
  groups.forEach((members, g) => {
    const stems = new Set<string>();
    const names: string[] = [];
    for (const member of members) {
      const tokens = tokenize(member);
      if (tokens.length === 1) {
        const s = stem(tokens[0]);
        stems.add(s);
        if (!single.has(s)) single.set(s, g);
      } else if (tokens.length > 1) {
        phrases.push({ stems: tokens.map(stem), group: g });
        names.push(tokens.join('-'));
      }
    }
    groupStems.push([...stems]);
    groupPhraseNames.push(names);
  });
  phrases.sort((a, b) => b.stems.length - a.stems.length);
  return { single, groupStems, phrases, groupPhraseNames };
}

const SYNONYMS = buildSynonymIndex(synonymsFile.groups);

function stripTemplates(text: string): string {
  let current = text.trim();
  for (let changed = true; changed; ) {
    changed = false;
    for (const [re, replacement] of TEMPLATES) {
      const next = current.replace(re, replacement).trim();
      if (next !== current) {
        current = next;
        changed = true;
      }
    }
  }
  return current;
}

/** Levenshtein distance capped at 2, enough for one-typo synonym lookup. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Synonym group of a stem; tokens of five or more characters tolerate one typo. */
function synonymGroup(s: string): number | undefined {
  const exact = SYNONYMS.single.get(s);
  if (exact !== undefined || s.length < 5) return exact;
  for (const [member, group] of SYNONYMS.single) {
    if (member.length >= 4 && distance(s, member) <= 1) return group;
  }
  return undefined;
}

type Unit = { kind: 'token'; token: string } | { kind: 'phrase'; group: number };

export function parseQuery(raw: string): ParsedQuery {
  const normalized = normalize(raw.slice(0, MAX_LENGTH)).replace(/\s+/g, ' ').trim();
  const stripped = stripTemplates(normalized);

  // Type words are removed before stop words, so "скіл для …" still detects the type.
  let detectedType: ArtifactType | null = null;
  const tokens: string[] = [];
  for (const token of tokenize(stripped)) {
    const type = typeOf(token);
    if (type) {
      detectedType ??= type;
      continue;
    }
    tokens.push(token);
  }

  const exactName = tokens.length ? tokens.join(' ') : null;

  // Stop words; fall back to the original tokens if nothing is left (FR-37).
  const meaningful = tokens.filter((t) => !isStopword(t));
  const words = meaningful.length ? meaningful : tokens;

  // Phrase synonyms ("перевірка коду", "code review") collapse into their group (FR-35).
  const stems = words.map(stem);
  const units: Unit[] = [];
  const matchedGroups = new Set<number>();
  for (let i = 0; i < words.length; ) {
    const phrase = SYNONYMS.phrases.find(
      (p) => p.stems.length <= stems.length - i && p.stems.every((s, k) => stems[i + k] === s),
    );
    if (phrase) {
      units.push({ kind: 'phrase', group: phrase.group });
      matchedGroups.add(phrase.group);
      i += phrase.stems.length;
    } else {
      units.push({ kind: 'token', token: words[i] });
      i += 1;
    }
  }

  // Each remaining word expands to its synonym group (FR-40).
  const groups: string[][] = [];
  const primary: string[] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    let group: string[];
    if (unit.kind === 'phrase') {
      group = SYNONYMS.groupStems[unit.group];
      primary.push(group[0]);
    } else {
      const s = stem(unit.token);
      const g = synonymGroup(s);
      primary.push(s);
      if (g !== undefined) matchedGroups.add(g);
      group = g === undefined ? [s] : [...new Set([s, ...SYNONYMS.groupStems[g]])];
    }
    const key = [...group].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(group);
  }

  return {
    raw,
    detectedType,
    groups,
    highlightTerms: words,
    exactName,
    typeOnly: detectedType !== null && tokens.length === 0,
    primary,
    phraseNames: [...matchedGroups].flatMap((g) => SYNONYMS.groupPhraseNames[g]),
  };
}
