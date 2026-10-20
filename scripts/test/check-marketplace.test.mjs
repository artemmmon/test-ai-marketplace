// check-marketplace.mjs after the refactoring into scripts/lib/marketplace.mjs: same CLI contract,
// same output as before on the same inputs (FR-12, FR-82).
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { CASES } from './check-cases.mjs';
import { cleanupTemp, makeRepo, minimalRepo, runScript } from './helpers.mjs';

after(cleanupTemp);

describe('exact output of the checks that existed before the refactoring', () => {
  for (const c of CASES) {
    test(c.name, () => {
      const root = makeRepo(c.files);
      const r = runScript('check-marketplace.mjs', [root]);
      const expected = typeof c.stderr === 'function' ? c.stderr(root) : c.stderr;
      if (expected === null) {
        assert.deepEqual([r.status, r.stdout, r.stderr], [0, 'marketplace invariants ok (1 plugins)\n', '']);
      } else {
        assert.deepEqual([r.status, r.stdout, r.stderr], [1, '', expected]);
      }
    });
  }

  test('defaults to the current directory', () => {
    const r = runScript('check-marketplace.mjs', [], { cwd: minimalRepo() });
    assert.deepEqual([r.status, r.stdout], [0, 'marketplace invariants ok (1 plugins)\n']);
  });
});


test('an empty catalog says "marketplace invariants ok (0 plugins)"', () => {
  const root = makeRepo({ '.claude-plugin/marketplace.json': { name: 'test-ai-marketplace', owner: { name: 'artemmmon' }, description: 'Empty', plugins: [] }, 'plugins/.gitkeep': '' });
  const r = runScript('check-marketplace.mjs', [root]);
  assert.deepEqual([r.status, r.stdout, r.stderr], [0, 'marketplace invariants ok (0 plugins)\n', '']);
});
