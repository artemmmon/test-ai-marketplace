# test-ai-marketplace

Personal [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugins/create-marketplace).
Plugins here are extracted from DevDigest (skills, agents). The catalogue is empty for now.

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install <plugin>@test-ai-marketplace
```

## Update

Auto-update is off by default for third-party marketplaces and is unreliable anyway. Update by hand:

```
/plugin marketplace update test-ai-marketplace
/reload-plugins
```

If a plugin still looks stale: `claude plugin uninstall <plugin>` then `claude plugin install <plugin>@test-ai-marketplace`.

## Layout

```
.claude-plugin/marketplace.json     the catalogue
plugins/<kebab-name>/               one isolated folder per plugin
  .claude-plugin/plugin.json        manifest only — nothing else goes in .claude-plugin/
  skills/<name>/SKILL.md
  agents/  commands/  hooks/hooks.json  .mcp.json
scripts/check-marketplace.mjs       invariants beyond `claude plugin validate`
```

## Add or release a plugin

1. Copy real files from DevDigest into `plugins/<name>/`. No symlinks and no `../` paths:
   each plugin is copied into the cache on its own, so anything outside its folder is lost.
2. Add an entry to `plugins[]` in `marketplace.json`, kept sorted by name, with
   `"source": "./plugins/<name>"`. The entry `name` must equal the `plugin.json` `name`.
   Names are kebab-case and must not start with `claude-`, `anthropic-` or `cc-plugin-`.
3. Put `version` in `plugin.json` only and bump it on every change — without a bump users
   never receive the new files.
4. Check:
   ```sh
   claude plugin validate .
   node scripts/check-marketplace.mjs
   ```
5. Test locally: `claude plugin marketplace add ./`, install the plugin, try it, then
   `claude plugin marketplace remove test-ai-marketplace`.
6. Commit, push, and optionally tag: `claude plugin tag plugins/<name> --push`.

External plugins (`github`, `git-subdir`, `url` sources) must be pinned by `sha` or `ref`.

## Local development

The catalog site lives in `site/`. Its data (`index.json`, `catalog.json`, `releases.json`, `stats.json`,
`llms.txt`, `feed.xml` and `bodies/`) is generated from `.claude-plugin/marketplace.json` and `plugins/` and is
**not committed**: generate it first, then build the site.

```sh
npm run build:index                   # validate the catalog, write the data into site/public/
cd site && npm ci && npm run build    # typecheck, vite build, dist checks -> site/dist/
npm run preview                       # http://localhost:4173/test-ai-marketplace/
```

- The root scripts need Node 20 or newer and no `npm install`; the site needs Node 20.19 or newer (CI uses Node 22).
- `npm run dev` in `site/` serves http://localhost:5173/test-ai-marketplace/ with the same data. Without a prior
  `npm run build:index` both `npm run dev` and `npm run build` stop with a message saying what to run first.
- `npm run build:index:fixtures` generates fictitious demo data from `scripts/__fixtures__/` instead of the real
  catalog (the site shows a demo banner); never deploy it.
- `npm run check` runs the marketplace invariants, `npm test` the tests of the scripts. `build:index` runs the
  same checks first and writes nothing if one fails.
- On GitHub, pull requests build the index and the site; `pages.yml` repeats the build after a merge to `main`
  and publishes `site/dist`. The generated files and `site/dist/` stay out of git.

## Security

A plugin runs with your privileges: hooks, MCP servers and `bin/` executables run outside
Claude's permission rules. Read `hooks/hooks.json`, `.mcp.json` and `bin/` of any plugin
before installing it.
