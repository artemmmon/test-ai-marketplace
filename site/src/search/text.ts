// Shared text pipeline for indexing and querying (spec FR-33, FR-36, FR-39).
import { stemmer } from 'stemmer';
import { stemUk } from './stem-uk';
import { STOPWORDS } from './stopwords';

const APOSTROPHE_IN_WORD = /(?<=[\p{L}\p{N}])['’ʼ‘`](?=[\p{L}\p{N}])/gu;
const SPLIT = /[^\p{L}\p{N}]+/u;
const LATIN = /^[a-z0-9]+$/;
const CYRILLIC = /[Ѐ-ӿ]/;

/** NFKC, lower-case and drop apostrophes inside words (рев'ю → ревю). */
export function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(APOSTROPHE_IN_WORD, '');
}

/** Split normalized text into tokens of two or more characters. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(SPLIT)
    .filter((t) => t.length >= 2);
}

/** Porter stemmer for Latin tokens, the light suffix stemmer for Cyrillic. */
export function stem(token: string): string {
  if (LATIN.test(token)) return /^\d+$/.test(token) ? token : stemmer(token);
  if (CYRILLIC.test(token)) return stemUk(token);
  return token;
}

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

/** Index-side term processing: drop stop words, stem the rest. */
export function indexTerm(token: string): string | null {
  if (token.length < 2 || isStopword(token)) return null;
  return stem(token);
}
