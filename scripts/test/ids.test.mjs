import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPONENT_NAME_RE, TAG_RE, addCommands, byString, componentBodyRef, componentId, installCommands, pluginDocRef, qualifiedName, uniqueLower } from '../lib/ids.mjs';

test('component id and qualified name (FR-21)', () => {
  assert.equal(componentId('engineering-paved-path', 'skill', 'react-best-practices'), 'engineering-paved-path:skill:react-best-practices');
  assert.equal(qualifiedName('engineering-paved-path', 'react-best-practices'), 'engineering-paved-path:react-best-practices');
  // The type is part of the id because a skill and a command may share a name.
  assert.notEqual(componentId('p', 'skill', 'spec'), componentId('p', 'command', 'spec'));
});

test('body refs have no colons and the right extension (FR-22)', () => {
  assert.equal(componentBodyRef('p', 'skill', 'x'), 'bodies/p/skill/x.md');
  assert.equal(componentBodyRef('p', 'agent', 'x'), 'bodies/p/agent/x.md');
  assert.equal(componentBodyRef('p', 'command', 'x'), 'bodies/p/command/x.md');
  assert.equal(componentBodyRef('p', 'hook', 'hooks'), 'bodies/p/hook/hooks.json');
  assert.equal(componentBodyRef('p', 'mcp', 'mcp-servers'), 'bodies/p/mcp/mcp-servers.json');
  assert.equal(pluginDocRef('p', 'README.md'), 'bodies/p/README.md');
  assert.ok(!componentBodyRef('p', 'skill', 'x').includes(':'));
});

test('component name rule: ^[a-z0-9][a-z0-9-]{0,63}$', () => {
  for (const ok of ['a', 'code-review', '0day', 'a'.repeat(64)]) assert.ok(COMPONENT_NAME_RE.test(ok), ok);
  for (const bad of ['', '-a', 'A', 'a_b', 'a b', 'a.b', 'a:b', 'a'.repeat(65), 'é']) assert.ok(!COMPONENT_NAME_RE.test(bad), bad);
});

test('install and add commands', () => {
  assert.deepEqual(installCommands('engineering-paved-path', 'test-ai-marketplace'), {
    chat: '/plugin install engineering-paved-path@test-ai-marketplace',
    cliProject: 'claude plugin install engineering-paved-path@test-ai-marketplace --scope project',
    cliUser: 'claude plugin install engineering-paved-path@test-ai-marketplace --scope user',
  });
  assert.deepEqual(addCommands('o/r'), { chat: '/plugin marketplace add o/r', cli: 'claude plugin marketplace add o/r' });
});

test('release tag pattern <plugin>--v<semver>', () => {
  assert.deepEqual(TAG_RE.exec('sdd-engineering--v1.0.0').slice(1), ['sdd-engineering', '1.0.0']);
  assert.deepEqual(TAG_RE.exec('a-b--v2.1.0-rc.1').slice(1), ['a-b', '2.1.0-rc.1']);
  for (const bad of ['v1.0.0', 'plugin-v1.0.0', 'plugin--1.0.0', 'plugin--v1.0']) assert.equal(TAG_RE.exec(bad), null, bad);
});

test('byString is locale independent; uniqueLower keeps first-seen order', () => {
  assert.deepEqual(['b', 'B', 'a', 'Z'].sort(byString), ['B', 'Z', 'a', 'b']);
  assert.deepEqual(uniqueLower(['React', 'review'], ['REVIEW', ' docs ', ''], undefined, [null].filter(Boolean)), ['react', 'review', 'docs']);
});
