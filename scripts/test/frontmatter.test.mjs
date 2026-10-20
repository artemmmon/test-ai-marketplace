import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FrontmatterError, parseFrontmatter } from '../lib/frontmatter.mjs';

const fm = (lines) => parseFrontmatter(`---\n${lines.join('\n')}\n---\nBody\n`);
const data = (lines) => fm(lines).data;
const fails = (lines, pattern, line) => {
  assert.throws(
    () => fm(lines),
    (e) => e instanceof FrontmatterError && pattern.test(e.message) && (line === undefined || e.line === line),
    `expected a FrontmatterError matching ${pattern}`,
  );
};

test('no frontmatter block: empty data, whole text is the body', () => {
  const r = parseFrontmatter('# Title\n\ntext');
  assert.deepEqual(r.data, {});
  assert.equal(r.body, '# Title\n\ntext');
  assert.equal(r.hasFrontmatter, false);
});

test('splits data and body, handles CRLF and BOM', () => {
  const r = parseFrontmatter('﻿---\r\nname: a\r\n---\r\n\r\nBody\r\n');
  assert.deepEqual(r.data, { name: 'a' });
  assert.equal(r.body, '\nBody\n');
  assert.equal(r.hasFrontmatter, true);
});

test('scalars: plain, quoted, numbers, booleans, null', () => {
  assert.deepEqual(
    data(['a: hello world', 'b: "quoted: text"', "c: 'it''s'", 'd: 42', 'e: -1.5', 'f: true', 'g: False', 'h: null', 'i: ~', 'j: 1.0.0', 'k: 007', 'l:']),
    { a: 'hello world', b: 'quoted: text', c: "it's", d: 42, e: -1.5, f: true, g: false, h: null, i: null, j: '1.0.0', k: '007', l: null },
  );
});

test('double-quoted escapes', () => {
  assert.deepEqual(data(['a: "say \\"hi\\" \\\\ \\n \\u00e9 \\x41"']), { a: 'say "hi" \\ \n é A' });
});

test('real-world argument-hint with brackets and escaped quotes', () => {
  const v = data(['argument-hint: "[spec.md | plan.md] [\\"requirements text\\"] [--only spec|plan]"'])['argument-hint'];
  assert.equal(v, '[spec.md | plan.md] ["requirements text"] [--only spec|plan]');
});

test('a plain scalar may contain colons without a space, dashes, arrows and unicode', () => {
  assert.deepEqual(data(['description: The /sdd-engineering:run-plan command - spec -> plan, — done']), {
    description: 'The /sdd-engineering:run-plan command - spec -> plan, — done',
  });
});

test('trailing comments are dropped from plain and quoted values; # inside a word stays', () => {
  assert.deepEqual(data(['a: value # note', 'b: "q" # note', 'c: issue#12']), { a: 'value', b: 'q', c: 'issue#12' });
});

test('comment and blank lines are ignored', () => {
  assert.deepEqual(data(['# header', '', 'a: 1', '  # indented comment', 'b: 2']), { a: 1, b: 2 });
});

test('inline lists', () => {
  assert.deepEqual(data(['a: [x, y, z]', 'b: []', 'c: ["a, b", \'c\', 3]', 'd: [engineering-paved-path:onion-architecture, sdd-engineering:spec-authoring]']), {
    a: ['x', 'y', 'z'],
    b: [],
    c: ['a, b', 'c', 3],
    d: ['engineering-paved-path:onion-architecture', 'sdd-engineering:spec-authoring'],
  });
});

test('block lists, indented or not', () => {
  assert.deepEqual(data(['a:', '  - one', '  - "two"', 'b:', '- x', '- y', 'c: after']), { a: ['one', 'two'], b: ['x', 'y'], c: 'after' });
});

test('folded and literal block scalars with chomping', () => {
  assert.deepEqual(data(['a: >', '  line one', '  line two', '', '  para two', 'b: |', '  keep', '  lines', 'c: >-', '  folded', '  stripped', 'd: after']), {
    a: 'line one line two\npara two\n',
    b: 'keep\nlines\n',
    c: 'folded stripped',
    d: 'after',
  });
});

test('plain scalars continue on more indented lines', () => {
  assert.deepEqual(data(['description: first part', '  second part', '  third part', 'name: x']), { description: 'first part second part third part', name: 'x' });
});

test('nested mapping (used by `metadata:` in real skills)', () => {
  assert.deepEqual(data(['name: fastify', 'metadata:', '  tags: fastify, nodejs, api', '  owner: team', 'description: after']), {
    name: 'fastify',
    metadata: { tags: 'fastify, nodejs, api', owner: 'team' },
    description: 'after',
  });
});

test('errors carry the file line (the first frontmatter line is line 2)', () => {
  fails(['a: 1', 'not a mapping line'], /unsupported line/, 3);
  fails(['a: 1', 'a: 2'], /duplicate key "a"/, 3);
  fails(['a: "open'], /unterminated quoted string/, 2);
  fails(['a: [x, y'], /not closed/, 2);
  fails(['a: {x: 1}'], /inline mappings/, 2);
  fails(['a: &anchor x'], /unsupported YAML syntax/, 2);
  fails(['a: !tag x'], /unsupported YAML syntax/, 2);
  fails(['a: *alias'], /unsupported YAML syntax/, 2);
  fails(['a: [[x]]'], /nested|unexpected text after the list/, 2);
  fails(['a:', '  - name: x'], /mappings inside lists/, 3);
  fails(['a: 1', '\tb: 2'], /tabs/, 3);
  fails(['  a: 1'], /unexpected indentation/, 2);
  fails(['a: "x" junk'], /unexpected text after the quoted string/, 2);
  fails(['a: "bad \\q"'], /unknown escape/, 2);
});

test('unclosed frontmatter block', () => {
  assert.throws(() => parseFrontmatter('---\nname: a\n\nBody without end'), (e) => e instanceof FrontmatterError && e.line === 1 && /not closed/.test(e.message));
});

test('keys with dots, dashes and underscores', () => {
  assert.deepEqual(data(['argument-hint: x', 'disable-model-invocation: true', 'my_key.sub: 1']), {
    'argument-hint': 'x',
    'disable-model-invocation': true,
    'my_key.sub': 1,
  });
});

test('every SKILL.md / agent frontmatter shape of the real plugins parses', () => {
  const real = [
    'name: brainstorm',
    'description: Use after the spec is approved (or straight away for a fix that has no spec), before implementation-planner. Compares ways to build it.',
    'tools: Read, Grep, Glob, Bash, WebSearch',
    'disallowedTools: NotebookEdit, Agent',
    'model: sonnet',
    'skills: [engineering-paved-path:onion-architecture, engineering-paved-path:frontend-architecture]',
  ];
  const d = data(real);
  assert.equal(d.model, 'sonnet');
  assert.deepEqual(d.skills, ['engineering-paved-path:onion-architecture', 'engineering-paved-path:frontend-architecture']);
});
