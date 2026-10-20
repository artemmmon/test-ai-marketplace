// The emitters against the fixture catalog (spec §12.1) and small hand-made inputs.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { generate, readTagsFile } from '../build-index.mjs';
import { buildCatalog } from '../lib/emit/catalog.mjs';
import { buildFeed, xmlEscape } from '../lib/emit/feed.mjs';
import { buildLlms } from '../lib/emit/llms.mjs';
import { buildStats } from '../lib/emit/stats.mjs';
import { computeReleases, latestRelease } from '../lib/releases.mjs';
import { markdownToPlainText, firstLine, truncate } from '../lib/text.mjs';
import { cleanupTemp, FIXTURE_COMMIT, FIXTURE_NOW, FIXTURE_REPO, FIXTURE_SLUG, FIXTURE_TAGS, minimalRepo } from './helpers.mjs';

after(cleanupTemp);

let fx; // generate() result on the fixture catalog
let index;
let catalog;
let releasesFile;
let stats;
before(() => {
  fx = generate({ root: FIXTURE_REPO, tags: readTagsFile(FIXTURE_TAGS), now: FIXTURE_NOW, commit: FIXTURE_COMMIT, fixture: true, slug: FIXTURE_SLUG, env: {} });
  assert.deepEqual(fx.errors, []);
  const read = (f) => JSON.parse(fx.files.get(f));
  index = read('index.json');
  catalog = read('catalog.json');
  releasesFile = read('releases.json');
  stats = read('stats.json');
});

const byId = (id) => index.items.find((i) => i.id === id);

describe('index.json on the fixtures', () => {
  test('header and marketplace info', () => {
    assert.equal(index.schemaVersion, '1.0');
    assert.equal(index.generatedAt, FIXTURE_NOW);
    assert.equal(index.commit, FIXTURE_COMMIT);
    assert.equal(index.fixture, true);
    assert.deepEqual(index.marketplace, {
      name: 'test-ai-marketplace',
      description: 'Personal Claude Code plugin marketplace — plugins extracted from DevDigest',
      owner: { name: 'artemmmon' },
      repo: { slug: 'artemmmon/test-ai-marketplace', url: 'https://github.com/artemmmon/test-ai-marketplace', defaultBranch: 'main' },
      siteUrl: 'https://artemmmon.github.io/test-ai-marketplace/',
      addCommands: { chat: '/plugin marketplace add artemmmon/test-ai-marketplace', cli: 'claude plugin marketplace add artemmmon/test-ai-marketplace' },
    });
  });

  test('items: plugins by name, then components by id; 4 plugins and 17 components', () => {
    const plugins = index.items.filter((i) => i.type === 'plugin').map((i) => i.id);
    assert.deepEqual(plugins, ['architecture-review', 'engineering-paved-path', 'research-tools', 'sdd-engineering']);
    assert.deepEqual(index.items.slice(0, 4).map((i) => i.id), plugins);
    const comps = index.items.slice(4).map((i) => i.id);
    assert.deepEqual(comps, [...comps].sort());
    assert.equal(comps.length, 17);
    assert.equal(new Set(index.items.map((i) => i.id)).size, 21);
  });

  test('versions and dependencies equal plugin.json; resolution, usedBy, executesCode', () => {
    for (const p of index.items.filter((i) => i.type === 'plugin')) {
      const manifest = JSON.parse(readFileSync(join(FIXTURE_REPO, p.path, '.claude-plugin/plugin.json'), 'utf8'));
      assert.equal(p.version, manifest.version);
      assert.deepEqual(p.dependencies.map((d) => [d.name, d.range]), (manifest.dependencies ?? []).map((d) => [d.name, d.version]));
    }
    assert.deepEqual(byId('sdd-engineering').dependencies, [
      { name: 'engineering-paved-path', range: '^1.0.0', resolvedVersion: '1.2.0', status: 'satisfied' },
      { name: 'research-tools', range: '^1.0.0', resolvedVersion: '1.0.1', status: 'satisfied' },
      { name: 'architecture-review', range: '^1.0.0', resolvedVersion: '1.0.0', status: 'satisfied' },
    ]);
    assert.deepEqual(byId('engineering-paved-path').usedBy, ['architecture-review', 'sdd-engineering']);
    assert.deepEqual(byId('research-tools').usedBy, ['sdd-engineering']);
    assert.deepEqual(byId('sdd-engineering').usedBy, []);
    const executes = Object.fromEntries(index.items.filter((i) => i.type === 'plugin').map((i) => [i.id, i.executesCode]));
    assert.deepEqual(executes, { 'architecture-review': false, 'engineering-paved-path': true, 'research-tools': true, 'sdd-engineering': false });
  });

  test('components by type (FR-21 ids)', () => {
    assert.deepEqual(byId('engineering-paved-path').components, {
      skill: ['engineering-paved-path:skill:code-review', 'engineering-paved-path:skill:commit-conventions', 'engineering-paved-path:skill:react-best-practices'],
      agent: ['engineering-paved-path:agent:code-reviewer'],
      command: ['engineering-paved-path:command:review-pr'],
      hook: ['engineering-paved-path:hook:hooks'],
      mcp: [],
    });
    assert.deepEqual(byId('research-tools').components.mcp, ['research-tools:mcp:mcp-servers']);
    assert.deepEqual(Object.keys(byId('sdd-engineering').components), ['skill', 'agent', 'command', 'hook', 'mcp']);
  });

  test('plugin fields: owner, license, compatibility, latest release, refs', () => {
    const p = byId('engineering-paved-path');
    assert.deepEqual(p.owner, { name: 'artemmmon' });
    assert.equal(p.license, 'MIT');
    assert.deepEqual(p.compatibility, { claudeCode: '>=2.1.110', bodyRef: 'bodies/engineering-paved-path/COMPATIBILITY.md' });
    assert.deepEqual(p.latestRelease, { version: '1.2.0', date: '2026-09-30', tag: 'engineering-paved-path--v1.2.0' });
    assert.equal(p.updatedAt, '2026-09-30');
    assert.equal(p.path, 'plugins/engineering-paved-path');
    assert.equal(p.bodyRef, 'bodies/engineering-paved-path/README.md');
    assert.equal(p.readmeRef, p.bodyRef);
    assert.equal(p.changelogRef, 'bodies/engineering-paved-path/CHANGELOG.md');
    assert.equal(byId('architecture-review').compatibility, null);
    assert.equal(p.external, null);
    assert.deepEqual(p.installCommands, {
      chat: '/plugin install engineering-paved-path@test-ai-marketplace',
      cliProject: 'claude plugin install engineering-paved-path@test-ai-marketplace --scope project',
      cliUser: 'claude plugin install engineering-paved-path@test-ai-marketplace --scope user',
    });
  });

  test('keywords: plugin.json + marketplace entry, lower-case, unique; components add their own', () => {
    assert.deepEqual(byId('engineering-paved-path').keywords, ['engineering', 'react', 'review', 'conventions']);
    assert.deepEqual(byId('engineering-paved-path:skill:code-review').keywords, ['engineering', 'react', 'review', 'conventions', 'pull-request']);
    assert.deepEqual(byId('research-tools:mcp:mcp-servers').keywords, ['research', 'docs', 'web', 'docs-fetch']);
  });

  test('skill: frontmatter, files, body ref, search text without markup', () => {
    const s = byId('engineering-paved-path:skill:code-review');
    assert.equal(s.name, 'code-review');
    assert.equal(s.qualifiedName, 'engineering-paved-path:code-review');
    assert.equal(s.path, 'plugins/engineering-paved-path/skills/code-review/SKILL.md');
    assert.equal(s.bodyRef, 'bodies/engineering-paved-path/skill/code-review.md');
    assert.equal(s.bodyFormat, 'markdown');
    assert.deepEqual(s.files, ['plugins/engineering-paved-path/skills/code-review/checklist.md']);
    assert.equal(s.frontmatter.name, 'code-review');
    assert.match(s.searchText, /^Code review Use when reviewing a pull request/);
    assert.doesNotMatch(s.searchText, /[#*`|]/);
    assert.equal(s.updatedAt, '2026-09-30');
    assert.equal(s.executesCode, false);
  });

  test('agent: tools as a comma-separated string or a list, model', () => {
    const a = byId('engineering-paved-path:agent:code-reviewer');
    assert.deepEqual([a.tools, a.model], [['Read', 'Grep', 'Glob', 'Bash'], null]);
    const r = byId('research-tools:agent:researcher');
    assert.deepEqual([r.tools, r.model], [['WebSearch', 'WebFetch', 'Read'], 'sonnet']);
    const n = byId('sdd-engineering:agent:spec-reviewer');
    assert.deepEqual([n.tools, n.model], [null, null]);
  });

  test('command, hook and mcp specifics', () => {
    assert.equal(byId('engineering-paved-path:command:review-pr').argumentHint, '[pr-number]');
    const h = byId('engineering-paved-path:hook:hooks');
    assert.deepEqual([h.events, h.executesCode, h.bodyFormat, h.bodyRef, h.name, h.qualifiedName], [['PreToolUse', 'PostToolUse'], true, 'json', 'bodies/engineering-paved-path/hook/hooks.json', 'hooks', 'engineering-paved-path:hooks']);
    const m = byId('research-tools:mcp:mcp-servers');
    assert.deepEqual([m.servers, m.executesCode, m.bodyRef, m.name], [[{ name: 'docs-fetch', transport: 'stdio', command: 'node', url: null }], true, 'bodies/research-tools/mcp/mcp-servers.json', 'mcp-servers']);
  });

  test('every bodyRef, readmeRef, changelogRef and compatibility ref points to a generated file', () => {
    const refs = [];
    for (const i of index.items) {
      for (const k of ['bodyRef', 'readmeRef', 'changelogRef']) if (i[k]) refs.push(i[k]);
      if (i.compatibility?.bodyRef) refs.push(i.compatibility.bodyRef);
    }
    assert.ok(refs.length >= 21);
    for (const ref of refs) assert.ok(fx.files.has(ref), `missing ${ref}`);
  });

  test('bodies: no frontmatter in markdown, raw JSON for hooks and mcp, docs verbatim', () => {
    const skill = fx.files.get('bodies/engineering-paved-path/skill/code-review.md');
    assert.ok(skill.startsWith('# Code review\n'), skill.slice(0, 40));
    assert.ok(skill.endsWith('\n') && !skill.endsWith('\n\n'));
    assert.equal(fx.files.get('bodies/engineering-paved-path/hook/hooks.json'), readFileSync(join(FIXTURE_REPO, 'plugins/engineering-paved-path/hooks/hooks.json'), 'utf8'));
    assert.equal(fx.files.get('bodies/sdd-engineering/CHANGELOG.md'), readFileSync(join(FIXTURE_REPO, 'plugins/sdd-engineering/CHANGELOG.md'), 'utf8'));
    assert.equal(fx.files.has('bodies/architecture-review/COMPATIBILITY.md'), false);
  });

  test('searchText is capped at 8000 characters', () => {
    const long = markdownToPlainText(`# T\n\n${'word '.repeat(5000)}`);
    assert.equal(long.length, 8000);
    assert.equal(truncate('a😀b', 2), 'a'); // never splits a surrogate pair
  });
});

describe('external plugins', () => {
  const root = () =>
    minimalRepo((f) => {
      f['.claude-plugin/marketplace.json'].plugins.push(
        { name: 'community-linters', source: { source: 'github', repo: 'example/community-linters', ref: 'v0.3.0' }, description: 'Linting skills.', keywords: ['Lint', 'quality'], version: '0.3.0' },
        { name: 'sub-plugin', source: { source: 'git-subdir', url: 'https://gitlab.com/x/y.git', path: 'pkg/p', sha: 'a'.repeat(40) } },
      );
      f['.claude-plugin/marketplace.json'].plugins.sort((a, b) => (a.name < b.name ? -1 : 1));
    });

  test('only the marketplace metadata is indexed (FR-25)', () => {
    const r = generate({ root: root(), tags: [], now: FIXTURE_NOW, commit: FIXTURE_COMMIT, slug: FIXTURE_SLUG, env: {} });
    assert.deepEqual(r.errors, []);
    const idx = JSON.parse(r.files.get('index.json'));
    const e = idx.items.find((i) => i.id === 'community-linters');
    assert.deepEqual(
      { ...e, installCommands: undefined },
      {
        id: 'community-linters', type: 'plugin', name: 'community-linters', qualifiedName: 'community-linters', plugin: 'community-linters', version: '0.3.0',
        description: 'Linting skills.', keywords: ['lint', 'quality'], path: null, bodyRef: null, bodyFormat: null, searchText: '', source: 'external', executesCode: false,
        installCommands: undefined, updatedAt: null, owner: null, license: null, homepage: null, repository: null, compatibility: null, dependencies: [], usedBy: [],
        components: { skill: [], agent: [], command: [], hook: [], mcp: [] }, bin: [], readmeRef: null, changelogRef: null, latestRelease: null,
        external: { kind: 'github', url: 'https://github.com/example/community-linters', ref: 'v0.3.0', sha: null, path: null },
      },
    );
    const sub = idx.items.find((i) => i.id === 'sub-plugin');
    assert.deepEqual([sub.version, sub.external], [null, { kind: 'git-subdir', url: 'https://gitlab.com/x/y.git', ref: null, sha: 'a'.repeat(40), path: 'pkg/p' }]);
    const st = JSON.parse(r.files.get('stats.json')).counts;
    assert.deepEqual([st.plugins, st.pluginsLocal, st.pluginsExternal], [3, 1, 2]);
    const cat = JSON.parse(r.files.get('catalog.json'));
    const ce = cat.plugins.find((p) => p.name === 'community-linters');
    assert.deepEqual([ce.executesCode, ce.sourceUrl, ce.readmeUrl, ce.components], [null, 'https://github.com/example/community-linters', null, []]);
    assert.match(r.files.get('llms.txt'), /- \[community-linters\]\(https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/#\/plugin\/community-linters\): Linting skills\. \(v0\.3\.0; external, not indexed\)/);
  });
});

describe('releases.json', () => {
  test('order, dates, origin and notes (6 releases = 5 tags + one changelog-only version)', () => {
    assert.equal(releasesFile.schemaVersion, '1.0');
    assert.equal(releasesFile.commit, FIXTURE_COMMIT);
    assert.deepEqual(
      releasesFile.releases.map((r) => [r.id, r.date, r.origin, r.tag]),
      [
        ['sdd-engineering@1.0.0', '2026-10-10', 'changelog+tag', 'sdd-engineering--v1.0.0'],
        ['engineering-paved-path@1.2.0', '2026-09-30', 'changelog+tag', 'engineering-paved-path--v1.2.0'],
        ['architecture-review@1.0.0', '2026-09-20', 'changelog+tag', 'architecture-review--v1.0.0'],
        ['research-tools@1.0.1', '2026-09-12', 'changelog+tag', 'research-tools--v1.0.1'],
        ['engineering-paved-path@1.1.0', '2026-08-20', 'changelog', null],
        ['engineering-paved-path@1.0.0', '2026-08-01', 'changelog+tag', 'engineering-paved-path--v1.0.0'],
      ],
    );
    const r = releasesFile.releases[1];
    assert.equal(r.commit, 'c3d4e5f60718293a4b5c6d7e8f9012345678a1b2');
    assert.equal(r.notesMarkdown, '### Added\n- `commit-conventions` skill.\n\n### Changed\n- `code-review` checklist covers security.');
    assert.equal(releasesFile.releases[4].commit, null);
  });

  test('sorting: date desc, then semver desc, then plugin asc; undated last; changelog date wins over the tag date', () => {
    const plugin = (name, sections) => ({ name, source: 'local', changelog: { sections: sections.map(([version, date]) => ({ version, date, notesMarkdown: '' })) } });
    const { releases } = computeReleases(
      [plugin('b-plugin', [['1.0.0', '2026-01-01'], ['1.0.0-rc.1', null]]), plugin('a-plugin', [['1.0.0', '2026-01-01'], ['1.10.0', '2026-01-01'], ['1.2.0', '2026-01-01']])],
      [{ name: 'b-plugin--v1.0.0-rc.1', date: '2025-12-01', commit: null }, { name: 'a-plugin--v1.2.0', date: '2030-01-01', commit: null }],
    );
    assert.deepEqual(releases.map((r) => r.id), ['a-plugin@1.10.0', 'a-plugin@1.2.0', 'a-plugin@1.0.0', 'b-plugin@1.0.0', 'b-plugin@1.0.0-rc.1']);
    assert.equal(releases.find((r) => r.id === 'a-plugin@1.2.0').date, '2026-01-01');
    assert.equal(releases.find((r) => r.id === 'b-plugin@1.0.0-rc.1').date, '2025-12-01'); // date from the tag when the changelog has none
  });

  test('latestRelease picks the highest version', () => {
    assert.equal(latestRelease(releasesFile.releases, 'engineering-paved-path').version, '1.2.0');
    assert.equal(latestRelease(releasesFile.releases, 'nobody'), null);
  });
});

describe('stats.json', () => {
  test('counts equal the actual counts of the fixtures', () => {
    assert.deepEqual(stats.counts, { plugins: 4, pluginsLocal: 4, pluginsExternal: 0, skills: 9, agents: 4, commands: 2, hooks: 1, hookEvents: 2, mcp: 1, releases: 6 });
    assert.deepEqual([stats.schemaVersion, stats.generatedAt, stats.commit], ['1.0', FIXTURE_NOW, FIXTURE_COMMIT]);
  });

  test('counts MCP servers (not artifacts) and hook events', () => {
    const fake = {
      generatedAt: 'g', commit: 'c',
      items: [
        { type: 'plugin', source: 'local' },
        { type: 'mcp', servers: [{}, {}, {}] },
        { type: 'mcp', servers: [{}] },
        { type: 'hook', events: ['a', 'b', 'c'] },
      ],
    };
    const c = buildStats({ index: fake, releases: [{}, {}] }).counts;
    assert.deepEqual([c.mcp, c.hooks, c.hookEvents, c.releases], [4, 1, 3, 2]);
  });
});

describe('catalog.json', () => {
  test('schemaVersion and only absolute URLs', () => {
    assert.equal(catalog.schemaVersion, '1.0.0');
    const urls = [];
    (function walk(o) {
      if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
          if (/Url$|^repository$/.test(k) && v !== null) urls.push(v);
          else walk(v);
        }
      }
    })(catalog);
    assert.ok(urls.length > 40);
    for (const u of urls) assert.match(u, /^https:\/\//, u);
    assert.ok(!JSON.stringify(catalog).includes('searchText'));
  });

  test('shape of a plugin entry', () => {
    const p = catalog.plugins.find((x) => x.name === 'sdd-engineering');
    assert.equal(p.pageUrl, 'https://artemmmon.github.io/test-ai-marketplace/#/plugin/sdd-engineering');
    assert.equal(p.sourceUrl, `https://github.com/artemmmon/test-ai-marketplace/tree/${FIXTURE_COMMIT}/plugins/sdd-engineering`);
    assert.equal(p.readmeUrl, 'https://artemmmon.github.io/test-ai-marketplace/bodies/sdd-engineering/README.md');
    assert.deepEqual(p.dependencies, [{ name: 'engineering-paved-path', range: '^1.0.0' }, { name: 'research-tools', range: '^1.0.0' }, { name: 'architecture-review', range: '^1.0.0' }]);
    assert.equal(p.install.chat, '/plugin install sdd-engineering@test-ai-marketplace');
    assert.equal(p.executesCode, false);
    assert.deepEqual(p.components[0], {
      id: 'sdd-engineering:skill:sdd-workflow', type: 'skill', name: 'sdd-workflow', qualifiedName: 'sdd-engineering:sdd-workflow',
      description: 'Spec-driven development workflow: spec, plan, tasks, implementation, review gates.',
      bodyUrl: 'https://artemmmon.github.io/test-ai-marketplace/bodies/sdd-engineering/skill/sdd-workflow.md',
      pageUrl: 'https://artemmmon.github.io/test-ai-marketplace/#/artifact/sdd-engineering:skill:sdd-workflow',
    });
    assert.equal(p.components.length, 4);
    assert.deepEqual(catalog.marketplace.owner, { name: 'artemmmon' });
    assert.equal(catalog.marketplace.repository, 'https://github.com/artemmmon/test-ai-marketplace');
  });

  test('the tree link falls back to the default branch without a commit', () => {
    const c = buildCatalog({ ...index, commit: '' });
    assert.match(c.plugins[0].sourceUrl, /\/tree\/main\/plugins\/architecture-review$/);
  });
});

describe('llms.txt', () => {
  const text = () => fx.files.get('llms.txt');

  test('structure of FR-28', () => {
    const lines = text().split('\n');
    assert.equal(lines[0], '# test-ai-marketplace');
    assert.match(lines[2], /^> Personal Claude Code plugin marketplace — plugins extracted from DevDigest\. Plugins bundle skills, agents, commands, hooks and MCP servers\. Installing a plugin installs all of its components\.$/);
    assert.deepEqual(lines.filter((l) => l.startsWith('## ')), ['## Catalog', '## Plugins', '## Optional']);
    assert.match(text(), /- \[catalog\.json\]\(https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/catalog\.json\): machine-readable catalog, schemaVersion 1\.0\.0/);
    assert.match(text(), /- \[feed\.xml\]\(https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/feed\.xml\): Atom feed of releases/);
    assert.ok(text().endsWith('\n'));
  });

  test('one line per plugin with version, executes-code and dependencies; nested component lines with body links', () => {
    assert.match(text(), /^- \[engineering-paved-path\]\(https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/#\/plugin\/engineering-paved-path\): .* \(v1\.2\.0; executes code: hooks\)$/m);
    assert.match(text(), /^- \[research-tools\]\(.*\): .* \(v1\.0\.1; executes code: MCP\)$/m);
    assert.match(text(), /^- \[sdd-engineering\]\(.*\): .* \(v1\.0\.0; depends on engineering-paved-path \^1\.0\.0, research-tools \^1\.0\.0, architecture-review \^1\.0\.0\)$/m);
    assert.match(text(), /^  - \[skill architecture-review:adr-writing\]\(https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/bodies\/architecture-review\/skill\/adr-writing\.md\): Write Architecture Decision Records/m);
    assert.match(text(), /^  - \[mcp research-tools:mcp-servers\]\(.*mcp-servers\.json\): MCP servers: docs-fetch\.$/m);
    assert.equal(text().match(/^ {2}- \[/gm).length, 17);
  });

  test('an empty catalog still produces a valid file', () => {
    const empty = buildLlms({ ...index, items: [] });
    assert.match(empty, /## Plugins\n\nNo plugins are published yet\.\n/);
  });
});

describe('feed.xml', () => {
  /** Minimal well-formedness check: balanced tags, only known entities, one root. */
  function assertWellFormed(xml) {
    const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
    const stack = [];
    for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<&]*")*)\s*(\/?)>/g)) {
      const [, close, name, , selfClose] = m;
      if (selfClose) continue;
      if (close) assert.equal(stack.pop(), name, `unbalanced </${name}>`);
      else stack.push(name);
    }
    assert.deepEqual(stack, []);
    assert.doesNotMatch(body.replace(/&(amp|lt|gt|quot|apos);/g, ''), /&/);
    assert.doesNotMatch(body.replace(/<[^>]*>/g, ''), /[<>]/);
  }

  test('valid Atom 1.0 with one entry per release', () => {
    const xml = fx.files.get('feed.xml');
    assertWellFormed(xml);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">'));
    assert.equal(xml.match(/<entry>/g).length, 6);
    assert.match(xml, /<id>https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/<\/id>/);
    assert.match(xml, /<title>test-ai-marketplace — releases<\/title>/);
    assert.match(xml, /<link rel="self" href="https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/feed\.xml"\/>/);
    assert.match(xml, /<link rel="alternate" href="https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/#\/whats-new"\/>/);
    assert.match(xml, /<updated>2026-10-10T00:00:00Z<\/updated>\n {2}<author>/);
    assert.match(xml, /<id>https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/#\/whats-new\?release=sdd-engineering@1\.0\.0<\/id>/);
    assert.match(xml, /<title>sdd-engineering v1\.0\.0<\/title>/);
    assert.match(xml, /<link href="https:\/\/artemmmon\.github\.io\/test-ai-marketplace\/#\/plugin\/sdd-engineering"\/>/);
    assert.match(xml, /<content type="text">### Added\n- Initial release/);
  });

  test('escapes XML, drops invalid control characters, caps at 50 entries, falls back to generatedAt', () => {
    assert.equal(xmlEscape('a & b < c > "d" \u0001\u000B'), 'a &amp; b &lt; c &gt; &quot;d&quot; ');
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `p@1.0.${i}`, plugin: 'p', version: `1.0.${i}`, date: null, notesMarkdown: i === 0 ? '<b>&</b>' : '' }));
    const xml = buildFeed({ index, releases: many });
    assertWellFormed(xml);
    assert.equal(xml.match(/<entry>/g).length, 50);
    assert.match(xml, new RegExp(`<updated>${FIXTURE_NOW}</updated>`));
    assert.match(xml, /&lt;b&gt;&amp;&lt;\/b&gt;/);
  });

  test('an empty release list is still a valid feed', () => {
    const xml = buildFeed({ index, releases: [] });
    assertWellFormed(xml);
    assert.equal(xml.includes('<entry>'), false);
  });
});

describe('plain text', () => {
  test('markdown becomes searchable plain text', () => {
    const md = '# Title\n\nSome **bold** and `code` with a [link](https://x.y) and ![alt text](img.png).\n\n| a | b |\n|---|---|\n| c | d |\n\n- item one\n1. item two\n\n> quote\n\n```js\nconst x = 1;\n```\n\n<div class="x">html</div>\n<!-- hidden -->';
    assert.equal(markdownToPlainText(md), 'Title Some bold and code with a link and alt text. a b c d item one item two quote const x = 1; html');
  });

  test('firstLine takes the first non-empty line without markup and caps it', () => {
    assert.equal(firstLine('\n\n## Review **PR** $ARGUMENTS\nmore'), 'Review PR $ARGUMENTS');
    assert.equal(firstLine('x'.repeat(200)).length, 160);
    assert.equal(firstLine('   \n'), '');
  });
});

test('the fixture catalog never leaks files outside the allowed inputs', () => {
  const all = [...fx.files.values()].join('\n');
  for (const marker of ['FIXTURE-PLUGIN-SCRIPT-MARKER', 'FIXTURE-PLUGIN-EVAL-MARKER', 'FIXTURE-SKILL-REFERENCE-MARKER', 'FIXTURE-DOCS-MARKER', 'FIXTURE-ROOT-EVAL-MARKER', 'FIXTURE-SITE-MARKER']) {
    assert.ok(!all.includes(marker), marker);
  }
  assert.ok(existsSync(join(FIXTURE_REPO, 'plugins/engineering-paved-path/scripts/format.sh')), 'the decoy files exist');
});
