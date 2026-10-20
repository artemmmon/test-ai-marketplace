// The fail-vs-warn table of FR-19, one minimal catalog per row (FR-81): "fail" rows exit 1 and write
// nothing, "warn" rows exit 0 and print the warning.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { after, describe, test } from 'node:test';
import { analyze, validate } from '../lib/marketplace.mjs';
import { cleanupTemp, minimalRepo, runScript, tempDir, write } from './helpers.mjs';

after(cleanupTemp);

const P = 'plugins/alpha-plugin';
const manifest = (f) => f[`${P}/.claude-plugin/plugin.json`];
const withTags = (tags) => {
  const dir = tempDir();
  write(dir, 'tags.json', tags);
  return `${dir}/tags.json`;
};

/** Runs build-index on the catalog; returns { status, output, written }. */
function build(edit, { tags = [] } = {}) {
  const root = minimalRepo(edit);
  const out = tempDir('tam-out-');
  const r = runScript('build-index.mjs', ['--root', root, '--out', out, '--tags-file', withTags(tags), '--commit', 'c'.repeat(40), '--now', '2026-10-19T12:00:00Z']);
  return { status: r.status, output: `${r.stdout}${r.stderr}`, written: readdirSync(out).length > 0, root };
}

const FAIL_ROWS = [
  ['invalid JSON in plugin.json', (f) => (f[`${P}/.claude-plugin/plugin.json`] = '{ not json'), /plugin\.json: invalid JSON/],
  ['invalid JSON in hooks.json', (f) => (f[`${P}/hooks/hooks.json`] = '{ "hooks": '), /hooks\.json: invalid JSON/],
  ['invalid JSON in .mcp.json', (f) => (f[`${P}/.mcp.json`] = '[1,'), /\.mcp\.json: invalid JSON/],
  ['invalid JSON in marketplace.json', (f) => (f['.claude-plugin/marketplace.json'] = '{'), /marketplace\.json: invalid JSON/],
  ['frontmatter of a skill does not parse', (f) => (f[`${P}/skills/do-thing/SKILL.md`] = '---\nname: do-thing\ndescription: {oops}\n---\nBody'), /SKILL\.md:3: inline mappings/],
  ['frontmatter of an agent does not parse', (f) => (f[`${P}/agents/helper.md`] = '---\nname: helper\ndescription: "open\n---\nBody'), /helper\.md:3: unterminated quoted string/],
  ['unclosed frontmatter block', (f) => (f[`${P}/skills/do-thing/SKILL.md`] = '---\nname: do-thing\n'), /not closed/],
  ['SKILL.md without description', (f) => (f[`${P}/skills/do-thing/SKILL.md`] = '---\nname: do-thing\n---\nBody'), /SKILL\.md: frontmatter "description" is required/],
  ['SKILL.md with an empty description', (f) => (f[`${P}/skills/do-thing/SKILL.md`] = '---\nname: do-thing\ndescription: ""\n---\nBody'), /"description" is required/],
  ['agent without description', (f) => (f[`${P}/agents/helper.md`] = '---\nname: helper\n---\nBody'), /helper\.md: frontmatter "description" is required/],
  ['skill name with a bad character', (f) => {
    delete f[`${P}/skills/do-thing/SKILL.md`];
    f[`${P}/skills/Do_Thing/SKILL.md`] = '---\nname: Do_Thing\ndescription: x\n---\nBody';
  }, /skill name "Do_Thing" must match/],
  ['agent name that is not a slug', (f) => (f[`${P}/agents/helper.md`] = '---\nname: Helper Agent\ndescription: x\n---\nBody'), /agent name "Helper Agent" must match/],
  ['command file name that is not a slug', (f) => (f[`${P}/commands/Run It.md`] = '---\ndescription: x\n---\nBody'), /command name "Run It" must match/],
  ['duplicate component id', (f) => {
    f[`${P}/agents/one.md`] = '---\nname: same\ndescription: x\n---\nBody';
    f[`${P}/agents/two.md`] = '---\nname: same\ndescription: y\n---\nBody';
  }, /duplicate id "alpha-plugin:agent:same"/],
  ['dependency in the catalog does not satisfy the range', (f) => {
    f['.claude-plugin/marketplace.json'].plugins.push({ name: 'beta-plugin', source: './plugins/beta-plugin' });
    f['plugins/beta-plugin/.claude-plugin/plugin.json'] = { name: 'beta-plugin', version: '1.5.0', description: 'b' };
    manifest(f).dependencies = [{ name: 'beta-plugin', version: '^2.0.0' }];
  }, /dependency "beta-plugin" \^2\.0\.0 is not satisfied by beta-plugin 1\.5\.0/],
  ['unsupported range syntax', (f) => (manifest(f).dependencies = [{ name: 'beta-plugin', version: '1.x' }]), /unsupported version range "1\.x"/],
  ['dependencies is an object map instead of an array', (f) => (manifest(f).dependencies = { 'beta-plugin': '^1.0.0' }), /"dependencies" must be an array/],
  ['dependency entry without a version', (f) => (manifest(f).dependencies = [{ name: 'beta-plugin' }]), /dependencies\[0\] must be/],
  ['cycle in dependencies', (f) => {
    f['.claude-plugin/marketplace.json'].plugins.push({ name: 'beta-plugin', source: './plugins/beta-plugin' });
    f['plugins/beta-plugin/.claude-plugin/plugin.json'] = { name: 'beta-plugin', version: '1.0.0', description: 'b', dependencies: [{ name: 'alpha-plugin', version: '^1.0.0' }] };
    manifest(f).dependencies = [{ name: 'beta-plugin', version: '^1.0.0' }];
  }, /dependency cycle: alpha-plugin -> beta-plugin -> alpha-plugin/],
  ['a plugin that depends on itself', (f) => (manifest(f).dependencies = [{ name: 'alpha-plugin', version: '*' }]), /dependency cycle: alpha-plugin -> alpha-plugin/],
  ['local plugin without a version', (f) => delete manifest(f).version, /plugin\.json has no "version"/],
  ['local plugin with a version that is not semver', (f) => (manifest(f).version = '1.0'), /not a valid semantic version/],
  ['marketplace without a name', (f) => delete f['.claude-plugin/marketplace.json'].name, /"name" is required/],
  ['source outside plugins/', (f) => (f['.claude-plugin/marketplace.json'].plugins[0].source = './'), /must be a path inside \.\/plugins\//],
  ['source escaping the repository', (f) => (f['.claude-plugin/marketplace.json'].plugins[0].source = './plugins/../../x'), /must be a path inside \.\/plugins\//],
];

describe('fail rows exit 1 and write nothing', () => {
  for (const [name, edit, pattern] of FAIL_ROWS) {
    test(name, () => {
      const r = build(edit);
      assert.equal(r.status, 1, r.output);
      assert.match(r.output, pattern);
      assert.equal(r.written, false, 'no file may be written when validation fails');
      // The same errors come out of validate() (the shared module behind check-marketplace).
      const { errors } = validate(r.root);
      assert.ok(errors.some((e) => pattern.test(e)), errors.join('\n'));
    });
  }
});

const WARN_ROWS = [
  ['agent without name', (f) => (f[`${P}/agents/helper-agent.md`] = '---\ndescription: Helps\n---\nBody'), /"name" is missing, using the file name "helper-agent"/, (index) => assert.ok(index.items.some((i) => i.id === 'alpha-plugin:agent:helper-agent'))],
  ['command without description', (f) => (f[`${P}/commands/ship.md`] = 'Ship the release now. More text follows here.\n\nSecond paragraph.'), /"description" is missing, using the first line of the body/, (index) => {
    const c = index.items.find((i) => i.id === 'alpha-plugin:command:ship');
    assert.equal(c.description, 'Ship the release now. More text follows here.');
  }],
  ['command without description and a long first line', (f) => (f[`${P}/commands/ship.md`] = `# ${'word '.repeat(60)}`), /first line of the body/, (index) => {
    const c = index.items.find((i) => i.id === 'alpha-plugin:command:ship');
    assert.ok(c.description.length <= 160, String(c.description.length));
    assert.ok(c.description.endsWith('…'));
  }],
  ['dependency missing from the catalog', (f) => (manifest(f).dependencies = [{ name: 'ghost-plugin', version: '^1.0.0' }]), /dependency "ghost-plugin" is not in the catalog/, (index) => {
    assert.deepEqual(index.items[0].dependencies, [{ name: 'ghost-plugin', range: '^1.0.0', resolvedVersion: null, status: 'not-in-catalog' }]);
  }],
  ['no README.md', (f) => delete f[`${P}/README.md`], /README\.md is missing/, (index) => {
    assert.equal(index.items[0].readmeRef, null);
    assert.equal(index.items[0].bodyRef, null);
  }],
  ['no CHANGELOG.md', (f) => delete f[`${P}/CHANGELOG.md`], /CHANGELOG\.md is missing/, (index) => {
    assert.equal(index.items[0].changelogRef, null);
    assert.equal(index.items[0].latestRelease, null);
  }],
  ['no COMPATIBILITY.md', (f) => delete f[`${P}/COMPATIBILITY.md`], /COMPATIBILITY\.md is missing/, (index) => assert.equal(index.items[0].compatibility, null)],
  ['COMPATIBILITY.md without a Claude Code line', (f) => (f[`${P}/COMPATIBILITY.md`] = '# Compatibility\n\nWorks everywhere.\n'), /no "Claude Code <range>" line/, (index) => {
    assert.deepEqual(index.items[0].compatibility, { claudeCode: null, bodyRef: 'bodies/alpha-plugin/COMPATIBILITY.md' });
  }],
  ['CHANGELOG heading not recognized', (f) => (f[`${P}/CHANGELOG.md`] += '\n## Some old notes\n- x\n'), /unrecognized heading "## Some old notes"/],
  ['newest changelog version differs from plugin.json', (f) => (manifest(f).version = '1.1.0'), /newest CHANGELOG\.md version is 1\.0\.0, plugin\.json says 1\.1\.0/],
  ['hooks.json without a hooks object', (f) => (f[`${P}/hooks/hooks.json`] = { notHooks: {} }), /has no "hooks" object, events is empty/, (index) => {
    const h = index.items.find((i) => i.type === 'hook');
    assert.deepEqual(h.events, []);
    assert.equal(h.executesCode, true);
  }],
  ['.mcp.json without an mcpServers object', (f) => (f[`${P}/.mcp.json`] = { servers: {} }), /has no "mcpServers" object, servers is empty/, (index) => {
    assert.deepEqual(index.items.find((i) => i.type === 'mcp').servers, []);
  }],
  ['plugin.json declares inline hooks', (f) => (manifest(f).hooks = { PreToolUse: [] }), /declares "hooks" inline.*marked as executing code/, (index) => {
    assert.equal(index.items[0].executesCode, true);
    assert.deepEqual(index.items[0].components.hook, []);
  }],
  ['plugin.json declares inline mcpServers', (f) => (manifest(f).mcpServers = {}), /declares "mcpServers" inline/, (index) => assert.equal(index.items[0].executesCode, true)],
  ['plugin.json declares custom skills paths', (f) => (manifest(f).skills = ['./extra']), /declares "skills" inline or with custom paths/, (index) => assert.equal(index.items[0].executesCode, false)],
];

describe('warn rows exit 0, print the warning and use the fallback', () => {
  for (const [name, edit, pattern, check] of WARN_ROWS) {
    test(name, () => {
      const root = minimalRepo(edit);
      const out = tempDir('tam-out-');
      const r = runScript('build-index.mjs', ['--root', root, '--out', out, '--tags-file', withTags([]), '--commit', 'c'.repeat(40)]);
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.match(r.stdout, pattern);
      assert.match(r.stdout, /^warning: /m);
      assert.ok(existsSync(`${out}/index.json`));
      if (check) check(JSON.parse(readFileSync(`${out}/index.json`, 'utf8')));
    });
  }
});

describe('tags that do not match the changelog', () => {
  const tag = (name, date = '2026-10-02') => ({ name, date, commit: 'd'.repeat(40) });

  test('tag for a version without a changelog section: warning, release with empty notes', () => {
    const root = minimalRepo();
    const { warnings, releases } = analyze(root, { tags: [tag('alpha-plugin--v1.1.0')] });
    assert.ok(warnings.some((w) => /tag alpha-plugin--v1\.1\.0: no "1\.1\.0" section in alpha-plugin\/CHANGELOG\.md/.test(w.message)));
    const r = releases.find((x) => x.id === 'alpha-plugin@1.1.0');
    assert.deepEqual({ date: r.date, tag: r.tag, notes: r.notesMarkdown, origin: r.origin }, { date: '2026-10-02', tag: 'alpha-plugin--v1.1.0', notes: '', origin: 'tag' });
  });

  test('tag for an unknown plugin: warning, tag ignored', () => {
    const { warnings, releases } = analyze(minimalRepo(), { tags: [tag('ghost--v1.0.0')] });
    assert.ok(warnings.some((w) => /tag ghost--v1\.0\.0: no local plugin "ghost"/.test(w.message)));
    assert.deepEqual(releases.map((r) => r.id), ['alpha-plugin@1.0.0']);
  });

  test('tags that are not release tags are ignored silently', () => {
    const { warnings } = analyze(minimalRepo(), { tags: [tag('v1.0.0'), tag('nightly'), tag('alpha-plugin-1.0.0')] });
    assert.deepEqual(warnings, []);
  });

  test('a matching tag gives origin changelog+tag and keeps the changelog date', () => {
    const { warnings, releases } = analyze(minimalRepo(), { tags: [tag('alpha-plugin--v1.0.0', '2026-10-05')] });
    assert.deepEqual(warnings, []);
    assert.deepEqual(releases.map((r) => [r.id, r.date, r.tag, r.commit, r.origin]), [['alpha-plugin@1.0.0', '2026-10-01', 'alpha-plugin--v1.0.0', 'd'.repeat(40), 'changelog+tag']]);
  });
});

describe('dependency resolution', () => {
  const two = (range, betaVersion = '1.4.0') => (f) => {
    f['.claude-plugin/marketplace.json'].plugins.push({ name: 'beta-plugin', source: './plugins/beta-plugin' });
    f['plugins/beta-plugin/.claude-plugin/plugin.json'] = { name: 'beta-plugin', version: betaVersion, description: 'b' };
    manifest(f).dependencies = [{ name: 'beta-plugin', version: range }];
  };

  test('resolvedVersion, status and usedBy', () => {
    const { plugins, errors } = analyze(minimalRepo(two('^1.0.0')));
    assert.deepEqual(errors, []);
    const alpha = plugins.find((p) => p.name === 'alpha-plugin');
    const beta = plugins.find((p) => p.name === 'beta-plugin');
    assert.deepEqual(alpha.resolved, [{ name: 'beta-plugin', range: '^1.0.0', resolvedVersion: '1.4.0', status: 'satisfied' }]);
    assert.deepEqual(beta.usedBy, ['alpha-plugin']);
    assert.deepEqual(alpha.usedBy, []);
  });

  test('every supported range form is accepted', () => {
    for (const range of ['1.4.0', '=1.4.0', '^1.2.0', '~1.4.0', '>=1.0.0', '>=1.0.0 <2.0.0', '*']) {
      const { errors } = analyze(minimalRepo(two(range)));
      assert.deepEqual(errors, [], range);
    }
  });

  test('an external dependency target without a version is satisfied with a null resolvedVersion', () => {
    const edit = (f) => {
      f['.claude-plugin/marketplace.json'].plugins.push({ name: 'remote-plugin', source: { source: 'github', repo: 'o/r', ref: 'v1' } });
      manifest(f).dependencies = [{ name: 'remote-plugin', version: '^1.0.0' }];
    };
    const { plugins, errors } = analyze(minimalRepo(edit));
    assert.deepEqual(errors, []);
    assert.deepEqual(plugins.find((p) => p.name === 'alpha-plugin').resolved, [{ name: 'remote-plugin', range: '^1.0.0', resolvedVersion: null, status: 'satisfied' }]);
  });
});

describe('loading', () => {
  test('the skills/agents/commands/hooks/mcp/bin of a plugin are found', () => {
    const root = minimalRepo((f) => {
      f[`${P}/agents/helper.md`] = '---\nname: helper\ndescription: Helps\ntools: Read, Grep\n---\nBody';
      f[`${P}/commands/ship.md`] = '---\ndescription: Ship it\nargument-hint: "[env]"\n---\nShip $ARGUMENTS';
      f[`${P}/hooks/hooks.json`] = { hooks: { PreToolUse: [], Stop: [] } };
      f[`${P}/.mcp.json`] = { mcpServers: { local: { command: 'node', args: ['x.js'] }, remote: { type: 'http', url: 'https://example.com/mcp' }, legacy: { type: 'sse', url: 'https://example.com/sse' }, odd: {} } };
      f[`${P}/bin/tool`] = '#!/bin/sh\n';
      f[`${P}/bin/.hidden`] = '';
    });
    const [p] = analyze(root).plugins;
    assert.deepEqual(p.skills.map((s) => s.name), ['do-thing']);
    assert.deepEqual(p.agents.map((s) => s.name), ['helper']);
    assert.deepEqual(p.commands.map((s) => s.name), ['ship']);
    assert.deepEqual(p.hook.events, ['PreToolUse', 'Stop']);
    assert.deepEqual(p.mcp.servers, [
      { name: 'local', transport: 'stdio', command: 'node', url: null },
      { name: 'remote', transport: 'http', command: null, url: 'https://example.com/mcp' },
      { name: 'legacy', transport: 'sse', command: null, url: 'https://example.com/sse' },
      { name: 'odd', transport: 'unknown', command: null, url: null },
    ]);
    assert.deepEqual(p.bin, ['tool']);
  });

  test('COMPATIBILITY.md: the Claude Code range is extracted', async () => {
    const { extractClaudeCodeRange: x } = await import('../lib/marketplace.mjs');
    assert.equal(x('Requires Claude Code >=2.1.110 (plugin dependencies)'), '>=2.1.110');
    assert.equal(x('Minimum Claude Code version: 2.1.269 (first release)'), '>=2.1.269');
    assert.equal(x('Works with Claude Code ^2.0.0.'), '^2.0.0');
    assert.equal(x('Claude Code >= 2.1.0 < 3.0.0'), '>=2.1.0 <3.0.0');
    assert.equal(x('claude code v2.1'), '>=2.1.0');
    assert.equal(x('Needs a recent Claude Code.'), null);
    assert.equal(x('Node 20 or newer'), null);
  });

  test('skill files lists names of sibling files but never the content', () => {
    const root = minimalRepo((f) => {
      f[`${P}/skills/do-thing/references/guide.md`] = 'SECRET-REFERENCE-TEXT';
      f[`${P}/skills/do-thing/assets/tool.mjs`] = 'SECRET-ASSET-TEXT';
      f[`${P}/skills/do-thing/evals/case.yaml`] = 'SECRET-EVAL-TEXT';
    });
    const [p] = analyze(root).plugins;
    assert.deepEqual(p.skills[0].files, [`${P}/skills/do-thing/assets/tool.mjs`, `${P}/skills/do-thing/references/guide.md`]);
  });
});
