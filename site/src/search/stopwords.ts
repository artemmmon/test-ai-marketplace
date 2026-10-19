// Stop words removed from queries and from the index (spec FR-37).
const EN = 'a an the for to of with in on and or me i my need want some any that which please find show how';
const UK = 'для з із зі в у на і й та що щоб як мені мене треба потрібно потрібен потрібна хочу якийсь щось будь ласка знайди покажи';

export const STOPWORDS: ReadonlySet<string> = new Set([...EN.split(' '), ...UK.split(' ')]);
