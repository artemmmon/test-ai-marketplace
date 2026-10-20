// Tiny typed translation helper. No runtime dependencies and no language
// switcher: `messages` is the active table, so supporting another language
// later means pointing it at a different table of the same shape.
import { en } from './en';

export const LOCALE = 'en';
export const messages = en;

type Messages = typeof messages;
type PluralForms = { readonly one: string; readonly other: string };

/** Dotted paths of the leaves of T that are Leaf; the other kind of leaf is skipped. */
type Paths<T, Leaf, Other, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${Prefix}${K}` : T[K] extends Other ? never : Paths<T[K], Leaf, Other, `${Prefix}${K}.`>;
}[keyof T & string];

/** Keys of plain messages, e.g. 'header.githubRepository'. */
export type MessageKey = Paths<Messages, string, PluralForms>;
/** Keys of plural messages, e.g. 'plugin.composition.skills'. */
export type PluralKey = Paths<Messages, PluralForms, string>;

type Get<T, K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? Get<T[Head], Rest>
    : never
  : K extends keyof T
    ? T[K]
    : never;

/** Names of the `{placeholders}` in a message type. */
type Placeholders<S> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never;

type Value = string | number;
type ParamsArg<Names extends string> = [Names] extends [never] ? [params?: undefined] : [params: Record<Names, Value>];

type PluralNames<K extends string> = Get<Messages, K> extends infer F
  ? F extends { readonly one: infer O; readonly other: infer X }
    ? Exclude<Placeholders<O> | Placeholders<X>, 'count'>
    : never
  : never;

function lookup(key: string): unknown {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function interpolate(message: string, params: Record<string, Value> | undefined): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** Message by key, with `{name}` placeholders filled from params. */
export function t<K extends MessageKey>(key: K, ...args: ParamsArg<Placeholders<Get<Messages, K>>>): string {
  const message = lookup(key);
  if (typeof message !== 'string') return key;
  return interpolate(message, args[0]);
}

const rules = new Intl.PluralRules(LOCALE);

/** Plural message by key: picks the form for `count`; `{count}` is filled automatically. */
export function plural<K extends PluralKey>(key: K, count: number, ...args: ParamsArg<PluralNames<K>>): string {
  const forms = lookup(key) as Partial<Record<Intl.LDMLPluralRule, string>> | undefined;
  const message = forms?.[rules.select(count)] ?? forms?.other;
  if (typeof message !== 'string') return key;
  return interpolate(message, { ...(args[0] as Record<string, Value> | undefined), count });
}
