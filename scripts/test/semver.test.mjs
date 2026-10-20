import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVersions, isSupportedRange, isValidVersion, parseVersion, satisfies } from '../lib/semver.mjs';

test('parseVersion', () => {
  assert.deepEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3, prerelease: [] });
  assert.deepEqual(parseVersion('1.2.3-beta.1+build'), { major: 1, minor: 2, patch: 3, prerelease: ['beta', '1'] });
  for (const bad of ['1.2', '1', 'v1.2.3', '01.2.3', '1.2.3.4', 'x', '', '1.2.3-', '^1.2.3']) assert.equal(isValidVersion(bad), false, bad);
});

test('compareVersions orders versions and prereleases', () => {
  const ordered = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.1.0', '2.0.0', '10.0.0'];
  for (let i = 0; i < ordered.length - 1; i++) {
    assert.equal(compareVersions(ordered[i], ordered[i + 1]), -1, `${ordered[i]} < ${ordered[i + 1]}`);
    assert.equal(compareVersions(ordered[i + 1], ordered[i]), 1);
  }
  assert.equal(compareVersions('1.2.3', '1.2.3+meta'), 0);
});

// [version, range, expected]
const TABLE = [
  // exact
  ['1.2.3', '1.2.3', true],
  ['1.2.3', '=1.2.3', true],
  ['1.2.4', '1.2.3', false],
  // caret
  ['1.2.3', '^1.2.3', true],
  ['1.9.9', '^1.2.3', true],
  ['1.2.2', '^1.2.3', false],
  ['2.0.0', '^1.2.3', false],
  ['1.0.0', '^1.0.0', true],
  ['0.2.5', '^0.2.3', true],
  ['0.3.0', '^0.2.3', false],
  ['0.0.3', '^0.0.3', true],
  ['0.0.4', '^0.0.3', false],
  // tilde
  ['1.2.9', '~1.2.3', true],
  ['1.3.0', '~1.2.3', false],
  ['1.2.2', '~1.2.3', false],
  // >=, >, <=, <
  ['1.0.0', '>=1.0.0', true],
  ['2.5.0', '>=1.0.0', true],
  ['0.9.9', '>=1.0.0', false],
  ['1.0.1', '>1.0.0', true],
  ['1.0.0', '>1.0.0', false],
  ['1.0.0', '<=1.0.0', true],
  ['1.0.0', '<1.0.0', false],
  // AND of comparators
  ['1.5.0', '>=1.0.0 <2.0.0', true],
  ['2.0.0', '>=1.0.0 <2.0.0', false],
  ['0.9.0', '>=1.0.0 <2.0.0', false],
  ['1.0.0', '  >=1.0.0   <2.0.0 ', true],
  // any
  ['0.0.1', '*', true],
  ['99.0.0', '*', true],
  // prereleases only match when a comparator names the same version tuple
  ['1.3.0-beta.1', '^1.2.0', false],
  ['1.3.0-beta.1', '>=1.3.0-beta.0', true],
  ['1.3.0-beta.1', '*', false],
];

for (const [version, range, expected] of TABLE) {
  test(`satisfies(${version}, "${range}") is ${expected}`, () => {
    assert.equal(satisfies(version, range), expected);
  });
}

test('unsupported ranges throw RangeError', () => {
  for (const bad of ['', '   ', '1.x', '1.2', '^1.2', '~1', '>=1.0', '1.0.0 || 2.0.0', '1.0.0 - 2.0.0', '^1.0.0 <2.0.0', '>= 1.0.0', 'latest', 'x', '>=', '^', '~>1.0.0']) {
    assert.equal(isSupportedRange(bad), false, `"${bad}"`);
    assert.throws(() => satisfies('1.0.0', bad), RangeError, `"${bad}"`);
  }
});

test('invalid version throws TypeError', () => {
  assert.throws(() => satisfies('1.0', '^1.0.0'), TypeError);
});
