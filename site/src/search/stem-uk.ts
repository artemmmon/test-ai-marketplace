// Light suffix stemmer for Ukrainian (spec FR-39). It strips the longest
// matching suffix as long as at least three characters remain. Prefix search
// compensates for its inaccuracies.
const SUFFIXES = [
  'ування', 'ання', 'ення', 'ами', 'ями', 'ові', 'еві', 'ого', 'ому', 'ими',
  'ій', 'ий', 'ою', 'ею', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ів', 'ти',
  'и', 'і', 'а', 'я', 'у', 'ю', 'о', 'е', 'ь',
].sort((a, b) => b.length - a.length);

export function stemUk(word: string): string {
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}
