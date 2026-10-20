import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChangelog } from '../lib/changelog.mjs';

const summary = (text) => parseChangelog(text).sections.map((s) => [s.version, s.date]);

test('recognizes every heading format of FR-26', () => {
  const text = [
    '# Changelog',
    '## [1.2.0] - 2026-09-30',
    'a',
    '## 1.1.0 - 2026-08-20',
    'b',
    '## [1.0.1]',
    'c',
    '## v1.0.0 – 2026-08-01', // en dash, v prefix
    'd',
    '## [1.0.0-rc.1] - 2026-07-01',
    'e',
  ].join('\n');
  assert.deepEqual(summary(text), [
    ['1.2.0', '2026-09-30'],
    ['1.1.0', '2026-08-20'],
    ['1.0.1', null],
    ['1.0.0', '2026-08-01'],
    ['1.0.0-rc.1', '2026-07-01'],
  ]);
});

test('[Unreleased] is skipped silently', () => {
  const r = parseChangelog('## [Unreleased]\n\n- later\n\n## [1.0.0] - 2026-01-01\n\n- first\n');
  assert.deepEqual(r.sections.map((s) => s.version), ['1.0.0']);
  assert.deepEqual(r.skipped, []);
  assert.equal(r.sections[0].notesMarkdown, '- first');
});

test('unrecognized headings are reported and their content is dropped', () => {
  const r = parseChangelog('## [1.0.0] - 2026-01-01\n- a\n\n## Version one point one\n- b\n\n## [1.2.0] - 01/02/2026\n- c\n');
  assert.deepEqual(r.sections.map((s) => s.version), ['1.0.0']);
  assert.equal(r.sections[0].notesMarkdown, '- a');
  assert.deepEqual(r.skipped.map((s) => [s.line, s.heading, s.reason]), [
    [4, '## Version one point one', 'unrecognized heading'],
    [7, '## [1.2.0] - 01/02/2026', 'unrecognized heading'],
  ]);
});

test('notes: without the heading, trimmed, subheadings (###) kept', () => {
  const r = parseChangelog('# Changelog\n\n## [1.2.0] - 2026-09-30\n\n### Added\n- one\n\n### Changed\n- two\n\n\n## [1.1.0] - 2026-08-20\n- old\n');
  assert.equal(r.sections[0].notesMarkdown, '### Added\n- one\n\n### Changed\n- two');
  assert.equal(r.sections[1].notesMarkdown, '- old');
  assert.equal(r.sections[0].line, 3);
});

test('a ## line inside a code fence is not a heading', () => {
  const r = parseChangelog('## [1.0.0] - 2026-01-01\n\n```md\n## [9.9.9] - 2030-01-01\n```\n\ntext\n');
  assert.deepEqual(r.sections.map((s) => s.version), ['1.0.0']);
  assert.match(r.sections[0].notesMarkdown, /9\.9\.9/);
});

test('trailing link reference definitions are not part of the last release', () => {
  const r = parseChangelog('## [1.0.0] - 2026-01-01\n- first\n\n[1.0.0]: https://example.com/releases/1.0.0\n[Unreleased]: https://example.com/compare/1.0.0...HEAD\n');
  assert.equal(r.sections[0].notesMarkdown, '- first');
});

test('duplicate versions: the first wins, the second is reported', () => {
  const r = parseChangelog('## [1.0.0] - 2026-01-01\n- a\n## [1.0.0] - 2026-02-02\n- b\n');
  assert.equal(r.sections.length, 1);
  assert.equal(r.sections[0].notesMarkdown, '- a');
  assert.deepEqual(r.skipped.map((s) => s.reason), ['duplicate version']);
});

test('CRLF input and empty input', () => {
  assert.deepEqual(summary('## [1.0.0] - 2026-01-01\r\n- a\r\n'), [['1.0.0', '2026-01-01']]);
  assert.deepEqual(parseChangelog('').sections, []);
});

test('level-3 headings and non-heading text are not releases', () => {
  assert.deepEqual(parseChangelog('### 1.0.0\n#### [1.0.0]\ntext ## 1.0.0\n').sections, []);
});
