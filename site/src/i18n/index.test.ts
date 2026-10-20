import { describe, expect, it } from 'vitest';
import { messages, plural, t } from './index';

describe('t', () => {
  it('returns plain messages', () => {
    expect(t('common.copy')).toBe(messages.common.copy);
  });

  it('fills {placeholders}', () => {
    expect(t('card.viewLabel', { name: 'a:b' })).toBe('View a:b');
    expect(t('common.version', { version: '1.2.3' })).toBe('v1.2.3');
  });

  it('resolves keys built from a union', () => {
    const next: 'dark' | 'light' = 'dark';
    expect(t(`header.switchTo.${next}`)).toBe('Switch to dark theme');
  });

  it('leaves unknown placeholders untouched', () => {
    const loose = t as (key: string, params?: Record<string, string>) => string;
    expect(loose('card.viewLabel', { other: 'x' })).toBe('View {name}');
  });

  it('echoes an unknown key instead of throwing', () => {
    const loose = t as (key: string) => string;
    expect(loose('does.not.exist')).toBe('does.not.exist');
  });

  it('rejects wrong keys and missing params at compile time', () => {
    // @ts-expect-error unknown key
    t('header.nope');
    // @ts-expect-error missing params
    t('card.viewLabel');
    // @ts-expect-error wrong param name
    t('card.viewLabel', { nam: 'x' });
    // @ts-expect-error a plural key is not a plain message
    t('plugin.composition.skills');
  });
});

describe('plural', () => {
  it('picks the English form and fills {count}', () => {
    expect(plural('plugin.composition.skills', 1)).toBe('1 skill');
    expect(plural('plugin.composition.skills', 0)).toBe('0 skills');
    expect(plural('plugin.composition.skills', 3)).toBe('3 skills');
  });

  it('keeps the exact wording of the former inline strings', () => {
    expect(plural('search.results.count', 1)).toBe('1 result');
    expect(plural('search.results.showCount', 12)).toBe('Show 12 results');
    expect(plural('plugin.dependencySummary.dependsOn', 1)).toBe('depends on 1 plugin');
  });
});
