// Tests for check-marketplace.mjs. Each case builds a throwaway marketplace in a temp dir and runs
// the script against it. Run with: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-marketplace.mjs');

function write(root, rel, content) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

// Creates plugins/<name> with every required file; `files` adds or overrides files, null deletes none.
function addPlugin(root, name, { version = '1.0.0', manifest = {}, changelog, files = {} } = {}) {
  const base = `plugins/${name}`;
  write(root, `${base}/.claude-plugin/plugin.json`, JSON.stringify({ name, version, ...manifest }, null, 2));
  const docs = {
    'README.md': `# ${name}\n`,
    'CHANGELOG.md': changelog ?? `# Changelog\n\n## [Unreleased]\n\n## [${version}] - 2026-10-20\n`,
    'COMPATIBILITY.md': 'Minimum Claude Code version: TBD\n',
    ...files,
  };
  for (const [rel, content] of Object.entries(docs)) if (content !== null) write(root, `${base}/${rel}`, content);
}

function fixture({ marketplace, plugins = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-marketplace-'));
  write(root, '.claude-plugin/marketplace.json', JSON.stringify(marketplace ?? { name: 'm', owner: { name: 'o' }, plugins: [] }));
  for (const [name, options] of Object.entries(plugins)) addPlugin(root, name, options);
  return root;
}

function run(root, ...flags) {
  const r = spawnSync(process.execPath, [script, root, ...flags], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function check(setup, expect) {
  const root = fixture(setup);
  try {
    expect(run(root), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const registered = (...names) => ({
  name: 'm',
  owner: { name: 'o' },
  plugins: names.map((name) => ({ name, source: `./plugins/${name}` })),
});
const dep = (name, version) => ({ dependencies: [{ name, version }] });

test('empty marketplace passes', () => {
  check({}, (r) => {
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /marketplace invariants ok/);
  });
});

test('valid registered plugins with a satisfied dependency pass', () => {
  check(
    { marketplace: registered('app', 'lib'), plugins: { app: { manifest: dep('lib', '^1.0.0') }, lib: { version: '1.2.3' } } },
    (r) => assert.equal(r.code, 0, r.err),
  );
});

test('existing invariants: sort, duplicates, name, version mismatch, unpinned external source', () => {
  check(
    {
      marketplace: {
        name: 'm',
        owner: { name: 'o' },
        plugins: [
          { name: 'b', source: './plugins/b' },
          { name: 'a', source: './plugins/a', version: '9.9.9' },
          { name: 'a', source: './plugins/a' },
          { name: 'Bad_Name', source: { source: 'github', repo: 'x/y' } },
        ],
      },
      plugins: { a: {}, b: {} },
    },
    (r) => {
      assert.equal(r.code, 1);
      assert.match(r.err, /sorted by name/);
      assert.match(r.err, /duplicate plugin name "a"/);
      assert.match(r.err, /version 9\.9\.9 in marketplace\.json/);
      assert.match(r.err, /"Bad_Name": name must match/);
      assert.match(r.err, /must be pinned by sha or ref/);
    },
  );
});

test('skill frontmatter name must equal the directory name', () => {
  check({ plugins: { plug: { files: { 'skills/good/SKILL.md': '---\nname: good\n---\n', 'skills/bad/SKILL.md': '---\nname: other\n---\n' } } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /frontmatter name "other" must equal "bad"/);
    assert.doesNotMatch(r.err, /"good"/);
  });
});

test('plugin folders that are not registered are validated too', () => {
  check({ plugins: { plug: { files: { 'README.md': null } } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /"plug": README\.md is missing/);
  });
  check({ plugins: { plug: { manifest: { name: 'other' } } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /plugin\.json name is "other", expected "plug"/);
  });
});

test('missing plugin.json is reported', () => {
  const root = fixture();
  try {
    mkdirSync(join(root, 'plugins/empty'), { recursive: true });
    const r = run(root);
    assert.equal(r.code, 1);
    assert.match(r.err, /plugin\.json is missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reserved name prefixes are rejected', () => {
  check({ plugins: { 'claude-tools': {} } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /must not start with claude-/);
  });
});

test('docs: README, CHANGELOG and COMPATIBILITY are required', () => {
  check({ plugins: { plug: { files: { 'CHANGELOG.md': null, 'COMPATIBILITY.md': null } } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /CHANGELOG\.md is missing/);
    assert.match(r.err, /COMPATIBILITY\.md is missing/);
  });
});

test('newest CHANGELOG version must equal plugin.json version', () => {
  check({ plugins: { plug: { version: '1.1.0', changelog: '## [Unreleased]\n\n## [1.0.0] - 2026-10-20\n' } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /newest CHANGELOG version 1\.0\.0 != plugin\.json version 1\.1\.0/);
  });
  // order in the file does not matter: the highest version is the newest
  check({ plugins: { plug: { version: '1.1.0', changelog: '## [1.0.0] - 2026-01-01\n\n## [1.1.0] - 2026-02-01\n' } } }, (r) => assert.equal(r.code, 0, r.err));
  check({ plugins: { plug: { changelog: '# Changelog\n\n## [Unreleased]\n' } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /no "## \[x\.y\.z\] - date" release heading/);
  });
});

test('dependency on an unknown plugin fails', () => {
  check({ plugins: { app: { manifest: dep('ghost', '^1.0.0') } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /dependency "ghost" is not a plugin of this marketplace/);
  });
});

test('dependency ranges: ^ ~ >= = and exact', () => {
  const cases = [
    ['1.2.3', '1.2.3', true],
    ['1.2.4', '1.2.3', false],
    ['1.2.3', '=1.2.3', true],
    ['1.2.3', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['0.9.0', '^1.0.0', false],
    ['0.2.5', '^0.2.1', true],
    ['0.3.0', '^0.2.1', false],
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
    ['1.2.9', '~1.2.3', true],
    ['1.3.0', '~1.2.3', false],
    ['1.2.2', '~1.2.3', false],
    ['1.9.0', '~1', true],
    ['3.0.0', '>=2.1.0', true],
    ['2.0.9', '>=2.1.0', false],
    ['1.5.0', '>=1.0.0 <2.0.0', true],
    ['2.0.0', '>=1.0.0 <2.0.0', false],
    ['1.0.0', '^1', true],
    ['1.4.0', '1.x', true],
  ];
  for (const [version, range, ok] of cases) {
    check({ plugins: { app: { manifest: dep('lib', range) }, lib: { version } } }, (r) => {
      assert.equal(r.code, ok ? 0 : 1, `${version} vs ${range}: ${r.err}`);
      if (!ok) assert.match(r.err, /is not satisfied by its version/);
    });
  }
});

test('an unsupported range is an error', () => {
  check({ plugins: { app: { manifest: dep('lib', 'latest') }, lib: {} } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /range "latest" is not understood/);
  });
});

test('a dependency without a range is a warning, not an error', () => {
  check({ plugins: { app: { manifest: { dependencies: ['lib'] } }, lib: {} } }, (r) => {
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /has no version range/);
  });
});

test('dependency cycles fail', () => {
  check({ plugins: { a: { manifest: dep('b', '^1.0.0') }, b: { manifest: dep('c', '^1.0.0') }, c: { manifest: dep('a', '^1.0.0') } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /dependency cycle: (a -> b -> c -> a|b -> c -> a -> b|c -> a -> b -> c)/);
  });
  check({ plugins: { a: { manifest: dep('a', '^1.0.0') } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /dependency cycle: a -> a/);
  });
});

test('tags: warning by default, error with --require-tags, nothing outside git', () => {
  const root = fixture({ plugins: { app: { manifest: dep('lib', '^1.0.0') }, lib: {} } });
  try {
    // not a git repository: skipped
    let r = run(root);
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(r.err, /git tag/);

    const git = (...a) => spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
    git('init', '-q');
    git('commit', '-q', '--allow-empty', '-m', 'init');
    r = run(root);
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /git tag "lib--v1\.0\.0" does not exist/);
    assert.doesNotMatch(r.err, /app--v/, 'only plugins that something depends on need a tag');

    r = run(root, '--require-tags');
    assert.equal(r.code, 1);
    assert.match(r.err, /git tag "lib--v1\.0\.0" does not exist/);

    git('tag', 'lib--v1.0.0');
    r = run(root, '--require-tags');
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(r.err, /git tag/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('agents: hooks, mcpServers and permissionMode frontmatter are rejected', () => {
  const agent = (extra) => `---\nname: a\ndescription: d\ntools: Read\n${extra}\n---\nBody mentioning hooks: and mcpServers: is fine.\n`;
  check(
    {
      plugins: {
        p: {
          files: {
            'agents/ok.md': agent('model: sonnet'),
            'agents/h.md': agent('hooks:\n  PreToolUse: []'),
            'agents/m.md': agent('mcpServers:\n  x: {}'),
            'agents/pm.md': agent('permissionMode: acceptEdits'),
          },
        },
      },
    },
    (r) => {
      assert.equal(r.code, 1);
      assert.match(r.err, /agents\/h\.md: frontmatter "hooks"/);
      assert.match(r.err, /agents\/m\.md: frontmatter "mcpServers"/);
      assert.match(r.err, /agents\/pm\.md: frontmatter "permissionMode"/);
      assert.doesNotMatch(r.err, /agents\/ok\.md/);
    },
  );
});

test('forbidden strings (FR-28) are rejected anywhere in a plugin', () => {
  const bad = {
    'skills/x/SKILL.md': '---\nname: x\n---\nSee server/src/app.ts and client/src.\nRun pnpm test, then ./scripts/check-changed.sh.\nUses reviewer-core and routing.json.\nLoad .claude/skills/x and $CLAUDE_PROJECT_DIR/.claude/hooks/y.\nUse the DevDigest layout.\n',
  };
  check({ plugins: { plug: { files: bad } } }, (r) => {
    assert.equal(r.code, 1);
    for (const what of ['"DevDigest"', 'path "server/"', 'path "client/"', '"reviewer-core"', '"routing.json"', '"check-changed.sh"', 'a "pnpm ..." command', 'path ".claude/skills/"', '"$CLAUDE_PROJECT_DIR/.claude/"']) {
      assert.ok(r.err.includes(`forbidden ${what}`), what);
    }
  });
});

test('forbidden strings: harmless look-alikes pass', () => {
  const fine = '---\nname: x\n---\nNot paths: `observer/`, `reclient/` and https://example.com/Server/#x.\nThe pnpm-workspace.yaml file is just a name.\n';
  check({ plugins: { plug: { files: { 'skills/x/SKILL.md': fine } } } }, (r) => assert.equal(r.code, 0, r.err));
});

test('the source project must not be named anywhere, README Sources sections included', () => {
  const readme = '# p\n\nExtracted from DevDigest.\n\n## Sources\n\nOrigin: DevDigest.\n\n## Other\n\nfine\n';
  check({ plugins: { plug: { files: { 'README.md': readme } } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /README\.md:3: forbidden "DevDigest"/);
    assert.match(r.err, /README\.md:7: forbidden "DevDigest"/, 'no Sources exemption any more');
    assert.doesNotMatch(r.err, /README\.md:11:/);
  });
});

test('every spelling of the source project is banned in every text file type', () => {
  const files = {
    'skills/x/SKILL.md': '---\nname: x\n---\nok\nthe dev-digest repo\n',
    'agents/a.md': '---\nname: a\n---\nA Dev Digest example\n',
    'hooks/hooks.json': '{ "note": "DEVDIGEST" }\n',
    'scripts/s.mjs': "// see https://github.com/artemmmon/dev-digest/blob/main/x\n",
    'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-10-20\n\n- Extracted from devdigest.\n',
    'skills/x/data.txt': 'line one\nDev  Digest\n',
  };
  check({ plugins: { plug: { files } } }, (r) => {
    assert.equal(r.code, 1);
    for (const where of ['SKILL\\.md:5', 'a\\.md:4', 'hooks\\.json:1', 's\\.mjs:1', 'CHANGELOG\\.md:7']) {
      assert.match(r.err, new RegExp(`${where}: forbidden "DevDigest"`), where);
    }
    assert.doesNotMatch(r.err, /data\.txt/, 'two spaces is not one of the listed spellings');
  });
});

test("this marketplace's own install command is allowed", () => {
  const readme = '# p\n\n```\nclaude plugin marketplace add artemmmon/test-ai-marketplace\nclaude plugin install p@test-ai-marketplace\n```\n';
  check({ plugins: { plug: { files: { 'README.md': readme } } } }, (r) => assert.equal(r.code, 0, r.err));
});

test('dependencies: a scoped reference to another plugin needs a dependency', () => {
  const files = {
    'agents/a.md': '---\nname: a\n---\nCall `lib:helper` and also lib:helper again, plus other-lib:thing.\n',
    'skills/s/SKILL.md': '---\nname: s\n---\nLoad lib:rules first.\n',
    'hooks/hooks.json': '{ "command": "lib:hook" }\n',
    'scripts/run.mjs': "// calls lib:script\n",
    'README.md': '# app\n\nUses `lib:readme`.\n',
  };
  check({ plugins: { app: { files }, lib: {}, 'other-lib': {} } }, (r) => {
    assert.equal(r.code, 1);
    for (const ref of ['lib:helper', 'lib:rules', 'lib:hook', 'lib:script', 'lib:readme', 'other-lib:thing']) {
      assert.match(r.err, new RegExp(`"app": uses ${ref} but ${ref.split(':')[0]} is not in dependencies`), ref);
    }
    assert.equal(r.err.split('uses lib:helper').length, 2, 'a repeated reference is reported once');
  });
});

test('dependencies: a declared dependency satisfies scoped references; own name and look-alikes are ignored', () => {
  const files = {
    'agents/a.md': '---\nname: a\n---\nCall `lib:helper`. Own: app:thing. Not scoped: lib: helper, mylib:x, lib-extra:y, http://lib:8080 is a port.\n',
  };
  check({ plugins: { app: { files, manifest: dep('lib', '^1.0.0') }, lib: {} } }, (r) => {
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(r.err, /never referenced/);
  });
});

test('dependencies: files outside agents, skills, hooks, scripts and README are not scanned', () => {
  check({ plugins: { app: { files: { 'COMPATIBILITY.md': 'Needs lib:helper.\n', 'skills/s/SKILL.md': '---\nname: s\n---\nplain\n', 'skills/s/assets/x.mjs': '// lib:helper\n', 'docs/n.md': 'lib:helper\n' } }, lib: {} } }, (r) => assert.equal(r.code, 0, r.err));
});

test('dependencies: a declared but never referenced dependency is only a warning', () => {
  check({ plugins: { app: { manifest: dep('lib', '^1.0.0'), files: { 'README.md': '# app\n\nMentions lib without a scope.\n' } }, lib: {} } }, (r) => {
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /"app": dependency "lib" is declared but never referenced as lib:<component>/);
  });
});

test('dependencies: a string dependency entry also counts', () => {
  check({ plugins: { app: { manifest: { dependencies: ['lib'] }, files: { 'agents/a.md': '---\nname: a\n---\nlib:helper\n' } }, lib: {} } }, (r) => {
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(r.err, /uses lib:helper/);
  });
});

test('INSIGHTS.md and AGENTS.md may be mentioned only as optional', () => {
  check({ plugins: { plug: { files: { 'agents/a.md': '---\nname: a\n---\nRead INSIGHTS.md first.\nRead AGENTS.md if it exists.\n' } } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /a\.md:4: INSIGHTS\.md\/AGENTS\.md must be optional/);
    assert.doesNotMatch(r.err, /a\.md:5:/);
  });
});

test('symlinks inside a plugin are rejected', () => {
  const root = fixture({ plugins: { plug: {} } });
  try {
    symlinkSync('/etc/hosts', join(root, 'plugins/plug/link.txt'));
    const r = run(root);
    assert.equal(r.code, 1);
    assert.match(r.err, /link\.txt is a symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('".." segments in plugin.json component paths and marketplace sources are rejected', () => {
  check({ plugins: { plug: { manifest: { skills: '../shared/skills', agents: ['./agents', './../x'], hooks: { cmd: '${CLAUDE_PLUGIN_ROOT}/../x.sh' } } } } }, (r) => {
    assert.equal(r.code, 1);
    assert.match(r.err, /"skills" contains a "\.\." path segment: \.\.\/shared\/skills/);
    assert.match(r.err, /"agents" contains a "\.\." path segment: \.\/\.\.\/x/);
    assert.match(r.err, /"hooks" contains a "\.\." path segment/);
  });
  check(
    { marketplace: { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'plug', source: './plugins/../plugins/plug' }] }, plugins: { plug: {} } },
    (r) => {
      assert.equal(r.code, 1);
      assert.match(r.err, /source "\.\/plugins\/\.\.\/plugins\/plug" contains a "\.\." path segment/);
    },
  );
  // a file name that merely contains two dots is fine
  check({ plugins: { plug: { manifest: { skills: './skills/a..b' } } } }, (r) => assert.equal(r.code, 0, r.err));
});
