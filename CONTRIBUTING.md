# Contributing

This repository is a Claude Code plugin marketplace plus the tooling around it. It holds four plugins
(`engineering-paved-path`, `research-tools`, `architecture-review`, `sdd-engineering`), the catalog site in `site/`,
the checks in `scripts/`, and the evals. The reasons behind the structure are in
[docs/specs/sdd-plugins.md](docs/specs/sdd-plugins.md); the site is described in [docs/specs/site.md](docs/specs/site.md).

Related documents:

- [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md): rules for writing skills, agents, hooks and `userConfig`.
- [docs/RELEASES.md](docs/RELEASES.md): versions, tags and the release procedure.
- [docs/SECURITY.md](docs/SECURITY.md): reporting a vulnerability and what plugin code is allowed to do.
- [docs/COST-BASELINE.md](docs/COST-BASELINE.md): the measured cost of one `sdd-engineering` run and how to re-measure it.
- [evals/README.md](evals/README.md): how to run the behaviour tests.

## Requirements

- Node 20 or newer for the root scripts (they have no dependencies and need no `npm install`). The site needs Node 20.19
  or newer; CI uses Node 22.
- Claude Code 2.1.269 or newer for `claude plugin validate`, `claude plugin tag` and `claude plugin eval`.
- git, and the `gh` CLI if you want to open pull requests from the terminal.

## Repository layout

```
.claude-plugin/marketplace.json     the catalog (one entry per plugin, sorted by name)
plugins/<kebab-name>/               one self-contained folder per plugin
  .claude-plugin/plugin.json        manifest only; nothing else goes in .claude-plugin/
  skills/<name>/SKILL.md
  agents/<name>.md
  hooks/hooks.json  scripts/        only when the plugin needs them
  README.md  CHANGELOG.md  COMPATIBILITY.md
  evals/                            eval cases, only for plugins without dependencies
evals/<plugin>/                     eval cases for plugins that have dependencies
scripts/                            marketplace checks and the catalog index generator
site/                               the catalog site (Vite + React)
docs/                               specs and contributor documents
```

## Add a plugin

1. Create `plugins/<name>/`. The name is kebab-case and must not start with `claude-`, `anthropic-` or `cc-plugin-`.
   Put real files in it: no symlinks and no `..` in any path. A plugin is copied into the cache on its own, so
   anything outside its folder is lost.
2. Write `.claude-plugin/plugin.json`. Fields used in this repository:

   | Field | Rule |
   |---|---|
   | `name` | Required. Must equal the `name` of the marketplace entry and be kebab-case. |
   | `version` | Required, `x.y.z`. The only place a version lives: the `marketplace.json` entry does not repeat it. |
   | `description`, `author`, `license`, `keywords` | Set on every plugin (`license` is `MIT`). |
   | `dependencies` | Optional array of `{ "name": "<plugin>", "version": "<range>" }`. See below. |
   | `userConfig` | Optional. See [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md#userconfig). |

3. Add the components: `skills/<name>/SKILL.md`, `agents/<name>.md`, and `hooks/hooks.json` plus `scripts/` if needed.
   Check the authoring rules in [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) first.
4. Add the three required documents: `README.md` (what the plugin does, who it is for, install, what it runs),
   `CHANGELOG.md` (Keep a Changelog, with an `## [Unreleased]` section on top and a `## [x.y.z] - YYYY-MM-DD` heading
   per release) and `COMPATIBILITY.md` (a `Minimum Claude Code version: <x.y.z>` line, the dependency list with
   ranges, and notes).
5. Register it: add an entry to `plugins[]` in `.claude-plugin/marketplace.json` with `name`,
   `"source": "./plugins/<name>"`, `description`, `keywords` and `category`. Keep the array sorted by name.
6. Add the plugin to the table in the root [README.md](README.md).
7. Add eval cases (see [Evals](#evals)).

### Dependencies and ranges

A plugin lists the plugins it needs in `dependencies`, each with a semver range, for example
`{ "name": "engineering-paved-path", "version": "^1.0.0" }`. Claude Code installs the highest git tag
`<plugin>--v<version>` that satisfies the range, so every dependency needs release tags (see
[docs/RELEASES.md](docs/RELEASES.md)).

- Supported range forms are `1.2.3`, `^1.2.3`, `~1.2.3`, `>=1.2.3`, `>1.2.3`, `<=1.2.3`, `<1.2.3`, a combination such as
  `>=1.0.0 <2.0.0`, and `*`. The checks reject anything else.
- Use `^<major>.<minor>.<patch>` of the version you tested against.
- The dependency must exist in this marketplace, its current `version` must satisfy the range, and the graph must have
  no cycles. Dependencies point from the consumer to the provider only.
- Reference a dependency's components by scoped name (`research-tools:researcher`) and only for plugins listed in
  `dependencies`. A declared dependency that is never referenced produces a warning.

### Where a skill belongs

- A skill lives in exactly one plugin. Do not duplicate it; other plugins use it through a dependency.
- Knowledge about the stack, architecture, tests or security that agents of several plugins need, or that a person
  needs without the SDD workflow, goes in `engineering-paved-path`.
- Workflow skills (`run-plan`, `workflow-retro`, `spec-authoring`) and the agents of the SDD route go in
  `sdd-engineering`.
- A skill goes in the plugin whose agents or route use it and that other plugins do not need. When another plugin starts
  needing it, move it to `engineering-paved-path` instead of copying it.
- `engineering-paved-path` has skills only: no agents, hooks or MCP servers. Scripts are allowed only as examples that a
  skill asks you to run.

## Change a plugin

- Bump `version` in `plugin.json` for every change to plugin content. Without a bump users keep their cached copy and
  never receive the new files. Bumping is part of a release, see [docs/RELEASES.md](docs/RELEASES.md).
- Add the change under `## [Unreleased]` in the plugin's `CHANGELOG.md`.
- Update `README.md` and `COMPATIBILITY.md` when behaviour, inputs, dependencies or the minimum Claude Code version
  change.
- A change that renames or removes a component, a `userConfig` key, an agent's output JSON, or changes the spec or
  plan format is a major change.

## Checks to run locally

Run them from the repository root.

```sh
npm test                               # unit tests of scripts/ and of the plugins' own scripts (plugins/**/*.test.mjs)
node scripts/check-marketplace.mjs .   # marketplace and plugin invariants (same as `npm run check`)
claude plugin validate .               # Claude Code's own validation of the marketplace
for d in plugins/*/; do claude plugin validate "$d"; done
node scripts/check-plugin-install.mjs  # test install of sdd-engineering in a throw-away profile, then `claude plugin list --json`
```

`check-marketplace.mjs` checks what `claude plugin validate` does not:

- `marketplace.json` is sorted, names are unique and valid, the entry name equals the `plugin.json` name, and a local
  `source` stays inside `./plugins/`. External sources must be pinned by `sha` or `ref`.
- `plugin.json` has a valid `version`; dependency ranges are supported, point at plugins in the catalog, are satisfied by
  their current version, and form no cycle.
- Every plugin has `README.md`, `CHANGELOG.md` and `COMPATIBILITY.md`; the newest changelog version equals
  `plugin.json` `version`; the changelog has at least one `## [x.y.z]` release heading.
- Skill folders contain `SKILL.md` with `name` equal to the folder name and a `description`; agent files have a
  `description`.
- Agents do not set `hooks`, `mcpServers` or `permissionMode` in frontmatter (Claude Code ignores them).
- No symlinks and no `..` path segments in a plugin.
- A scoped reference such as `research-tools:researcher` is only used for declared dependencies.
- Forbidden content in plugin files: the name of the project the plugins were extracted from, `server/` and `client/`
  paths, `.claude/skills/` and `.claude/hooks/` paths, `pnpm` commands, and a required `INSIGHTS.md` or `AGENTS.md`
  (they may only be mentioned as optional: "if it exists").
- Release tags `<plugin>--v<version>` exist for every plugin another plugin depends on. This is a warning by default and
  an error with `--require-tags`.

Warnings are printed to stderr and do not fail the run; errors do.

`check-plugin-install.mjs` adds the checkout as a marketplace in a throw-away `CLAUDE_CONFIG_DIR`, installs
`sdd-engineering` (`--plugin <name>` for another one), runs `claude plugin list --json` and exits 1 if any plugin entry
has `errors` or `errorDetails` (for example `dependency-unsatisfied` or `dependency-version-unsatisfied`, a dependency
range that the installed version does not satisfy), if the install itself is refused (`range-conflict`,
`no-matching-tag`), or if the plugin and its dependencies are not all listed, enabled and at their `plugin.json`
versions. It needs `claude` on the PATH but no login or API key. It reads no release tags: Claude Code consults them only
for GitHub sources, so `node scripts/check-plugin-install.mjs artemmmon/test-ai-marketplace` (the published `main`, with
its tags) is the way to test that form by hand.

### Catalog data and the site

The site data is generated from `marketplace.json` and `plugins/` and is not committed. After changing plugin metadata,
documents or the site, check that it still builds:

```sh
node scripts/build-index.mjs           # same checks first, then writes site/public/{index,catalog,releases,stats}.json, ...
cd site
npm ci
npm run typecheck && npm test          # site tests
npm run build                          # typecheck, vite build, dist checks -> site/dist/
npm run preview                        # http://localhost:4173/test-ai-marketplace/
```

`node scripts/build-index.mjs --fixture ...` (`npm run build:index:fixtures`) generates fictitious demo data; never
deploy it. Do not commit generated files or `site/dist/`.

### Try a plugin in Claude Code

```sh
claude --plugin-dir plugins/engineering-paved-path --plugin-dir plugins/research-tools \
       --plugin-dir plugins/architecture-review --plugin-dir plugins/sdd-engineering
```

or add the working copy as a marketplace (`claude plugin marketplace add ./`), install, try, and remove it again with
`claude plugin marketplace remove test-ai-marketplace`.

### Evals

Evals are behaviour tests read by `claude plugin eval`. They make real model calls, so run them when you change a
skill, an agent or a hook, not on every edit. Where the cases live and the exact commands are in
[evals/README.md](evals/README.md). In short:

- A plugin without dependencies keeps its cases in `plugins/<name>/evals/`.
- A plugin with dependencies keeps its cases in `evals/<name>/`, because the eval sandbox loads only the plugins the
  case names.
- A case is a directory with `prompt.md`, `graders/*.md` and, if it needs files, `case.yaml` and `fixture.sh`.

```sh
claude plugin eval . --tag architecture-review --model sonnet --trust-plugin --no-publish   # from the repo root
```

## Branches, commits and pull requests

The rules are in [CLAUDE.md](CLAUDE.md):

- Never commit or push directly to `main`. Create one branch per task, push it, and open a pull request into `main`.
- Do not reuse `dev`.
- A pull request is merged only when the maintainer asks for it.

Branch names follow `<type>/<short-description>` (seen in the history: `feat/sdd-plugins`, `ci/validate-workflow`,
`docs/translate-site-spec`, `feat/build-index`).

Commit messages follow Conventional Commits: `<type>(<scope>): <summary>`, lowercase, imperative, no trailing period.
Types in use: `feat`, `fix`, `docs`, `ci`, `refactor`, `chore`. The scope is the plugin or area (`sdd-engineering`,
`engineering-paved-path`, `site`, `index`, `pages`, `specs`, `evals`, `check-marketplace`), for example:

```
feat(sdd-engineering): add the workflow-retro skill
fix(engineering-paved-path): replace project-specific examples with generic ones
ci: add the validate workflow for marketplace and plugin checks
docs(specs): translate the site spec to English
```

Keep commits small and focused. Pull requests are merged with a merge commit.

## What CI runs

| Workflow | Trigger | Jobs |
|---|---|---|
| `.github/workflows/validate.yml` | pull requests and pushes to `main` that touch `.claude-plugin/`, `plugins/`, `scripts/` or the workflow itself; manual | `invariants`: `node scripts/check-marketplace.mjs .` with full git history; `claude`: installs Claude Code and runs `claude plugin validate .` and `claude plugin validate` on every `plugins/*/` folder; `install`: installs Claude Code and runs `node scripts/check-plugin-install.mjs` |
| `.github/workflows/pages.yml` | pull requests into `main`, pushes to `main`, manual | `checks`: fails if generated files are tracked, runs `npm test` at the root, then typecheck and tests in `site/`; `build`: `node scripts/build-index.mjs`, `vite build`, `check-dist.mjs`; `deploy` (not on pull requests): publishes `site/dist` to GitHub Pages |

Pushing a tag does not start any workflow. After a release the Pages workflow is run by hand, see
[docs/RELEASES.md](docs/RELEASES.md).

Evals are not run in CI.
