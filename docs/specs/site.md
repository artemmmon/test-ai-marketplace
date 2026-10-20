# Specification: static catalog site for `test-ai-marketplace`

| | |
|---|---|
| Status | Draft v1 — basis for design (Claude Design) and implementation |
| Date | 2026-10-19 |
| Repo | https://github.com/artemmmon/test-ai-marketplace (branch `main`) |
| Target URL | `https://artemmmon.github.io/test-ai-marketplace/` |
| Context | GoIT, L08 "Hands-On Lab — Cost Surgery", step 6 |

Notation: **FR-n** — functional requirement, **NFR-n** — non-functional requirement, **US-n** — user scenario, **A-n** — assumption, **Q-n** — open question. The word "MUST" denotes a mandatory MVP requirement, "SHOULD" a recommendation.

## Table of contents

1. [Goal, non-goals, audience, scenarios](#1-goal-non-goals-audience-scenarios)
2. [Prerequisites and constraints](#2-prerequisites-and-constraints)
3. [Architecture](#3-architecture)
4. [Data model](#4-data-model)
5. [Search](#5-search)
6. [Screens and components](#6-screens-and-components)
7. [Non-functional requirements](#7-non-functional-requirements)
8. [Build and deploy](#8-build-and-deploy)
9. [Testing and acceptance](#9-testing-and-acceptance)
10. [Phasing](#10-phasing)
11. [Assumptions and open questions](#11-assumptions-and-open-questions)
12. [Appendices](#12-appendices)

---

## 0. Repo state: "as is" vs "to be"

| Item | As is | To be (this specification) |
|---|---|---|
| `.claude-plugin/marketplace.json` | `name: test-ai-marketplace`, `owner.name: artemmmon`, `plugins: []` | No schema changes; filled with plugins separately from the site |
| `plugins/` | only `.gitkeep` | `plugins/<name>/…` following the structure from `README.md` |
| `scripts/check-marketplace.mjs` | a self-contained, dependency-free Node ESM script (sort/dup/name regex/hidden Unicode/pinning external/`plugin.json` name+version/SKILL.md frontmatter `name`) | a thin CLI wrapper over the shared module `scripts/lib/marketplace.mjs` (FR-12) |
| `scripts/build-index.mjs` | absent | site data generator (§3, §4) |
| `package.json` in the root | absent | with npm scripts, **no dependencies** (FR-14) |
| `site/` | absent | React + TypeScript + Vite application |
| `.github/workflows/` | absent | `build.yml` (reusable), `ci.yml` (PR), `pages.yml` (deploy) |
| `.gitignore` | `.DS_Store`, `node_modules/` | + generated files (FR-73) |
| Repo visibility | private (`README.md` describes `gh auth setup-git`) | public — a user action, a prerequisite for deploy (§2) |

Because the catalog is empty, the design and tests rely on **fictitious fixtures** (§12.1). The site MUST also work correctly with an empty real catalog (FR-55).

---

## 1. Goal, non-goals, audience, scenarios

### 1.1 Goal

Give people and agents **discovery** for marketplace plugins: find a plugin or a nested component (skill, agent, command, hook, MCP), read its full content and copy the exact install command. Installation itself stays in Claude Code (chat `/plugin …` or CLI `claude plugin …`).

### 1.2 Non-goals

- Backend, API, databases, server-side rendering.
- Ratings, comments, download/install counters, analytics, accounts, login.
- Installing from the browser (the button only copies the command).
- Checkout and code indexing of external plugins.
- Semantic/embedding search.
- SEO indexing of individual pages (hash routing, see NFR-30).
- UI localization (the UI is in English).

### 1.3 Audience

| Audience | Needs |
|---|---|
| Claude Code developer-user (UA/EN) | find a skill for a task, assess the risk (does it execute code?), copy the command |
| Marketplace maintainer (repo owner) | see that the catalog is valid and deployed; share links |
| AI agent | machine-readable catalog `catalog.json` + `llms.txt` |
| Security reviewer | read hooks, `.mcp.json`, `bin/` before installing |

### 1.4 User scenarios

Key scenarios (Given/When/Then). Results are given for the fixtures from §12.1.

**US-1. "мені треба скіл для код-рев'ю" ("I need a skill for code review", UA).**
- Given the site is loaded with fixtures,
- When the user types `мені треба скіл для код-рев'ю` ("I need a skill for code review") into search,
- Then the first result is the skill `engineering-paved-path:code-review`; the boilerplate phrase `мені треба` ("I need") and the stop word `для` ("for") are ignored; the word `скіл` ("skill") is recognized as type `skill` (boost + chip "Only skills", FR-38); `code-review` is highlighted in the name.

**US-2. "I need a skill for code review" (EN).**
- Given the same setup,
- When the query is `I need a skill for code review`,
- Then the top-1 result is the same skill as in US-1.

**US-3. Plugin details.**
- Given the user is on the `sdd-engineering` plugin card,
- When they click **View**,
- Then `#/plugin/sdd-engineering` opens with `version` = `1.0.0` (as in `plugin.json`), three dependencies (`engineering-paved-path ^1.0.0`, `research-tools ^1.0.0`, `architecture-review ^1.0.0`) with status "satisfied" and the resolved version, the composition by type, the README and the changelog.

**US-4. Copy install.**
- Given the card or page of the plugin `engineering-paved-path`,
- When the user clicks **Copy install** (mode "In chat"),
- Then exactly `/plugin install engineering-paved-path@test-ai-marketplace` is placed on the clipboard (no trailing whitespace), a toast "Copied" appears and a screen reader announcement is made.
- And in mode "In terminal" with scope `user`, `claude plugin install engineering-paved-path@test-ai-marketplace --scope user` is copied.

**US-5. Deep-link.**
- Given the user has filtered the search (`q=review`, `type=skill`),
- When they copy the URL and open it in a new tab,
- Then the URL looks like `…/test-ai-marketplace/#/search?q=review&type=skill`, and the search state (query, filters, results) is restored.

**US-6. What's new.** Given the fixtures contain releases, When the user opens `#/whats-new`, Then they see a feed of releases (newest first) with version, date, tag `<plugin>--v<semver>` and the notes from `CHANGELOG.md`, plus a link to the Atom feed `feed.xml`.

**US-7. First run.** Given a new user, When they open `#/getting-started`, Then they see the steps: add the marketplace, install a plugin, update; every command has a Copy button.

**US-8. An agent reads the catalog.** Given an agent knows the site URL, When it fetches `llms.txt`, Then it finds links to `catalog.json` and the full texts of the components (`bodies/…`) with absolute URLs; `catalog.json` contains `schemaVersion`.

**US-9. Security check.** Given a plugin has hooks, When the user opens its page, Then they see the "Executes code" warning in the header, on the Hooks tab and on the cards; the content of `hooks.json` is shown as formatted JSON before installing.

**US-10. A maintainer breaks the catalog.** Given a PR where the `plugin.json` name does not match the entry in `marketplace.json`, When CI runs, Then the `validate` job fails, `build-index`/`build-site` do not run, and no deploy happens after such a state is merged.

**US-11. Report an issue.** Given the user is on an artifact page, When they click "Report an issue", Then `github.com/artemmmon/test-ai-marketplace/issues/new` opens in a new tab with a prefilled title `[<id>] ` and a label (FR-60).

---

## 2. Prerequisites and constraints

- **P-1. The repo is public.** GitHub Pages for a private repo requires a paid plan, and raw links to files and `issues/new` must be available anonymously. Making the repo public is a user action before the first deploy. After that, the "Install" section of `README.md` (about `gh auth setup-git`) should be simplified — a separate task, not part of the site.
- **P-2. Static only.** GitHub Pages serves files from `site/dist`. No server routes, redirect rules or headers (CSP only via `<meta>`).
- **P-3. Base path** `/test-ai-marketplace/` (Vite `base`). All resource and data URLs are built from `import.meta.env.BASE_URL` (FR-71).
- **P-4. Hash routing** (`#/…`), because Pages does not support an SPA fallback without `404.html` hacks.
- **P-5. No GitHub API requests from the browser** (rate limit, CORS, privacy). All data is baked into JSON in CI. The browser makes requests only to its own origin (+ images from `raw.githubusercontent.com`, FR-64).
- **P-6. Data freshness = the last deploy.** The site shows the state of `main` at build time; the generation date and commit SHA are visible in the footer.
- **P-7.** Pages settings: *Settings → Pages → Source: GitHub Actions*.

---

## 3. Architecture

### 3.1 Data flow

```
repo (main)
 ├─ .claude-plugin/marketplace.json
 ├─ plugins/<name>/{.claude-plugin/plugin.json, README.md, CHANGELOG.md,
 │                   COMPATIBILITY.md, skills/*/SKILL.md, agents/*.md,
 │                   commands/*.md, hooks/hooks.json, .mcp.json, bin/*}
 ├─ git tags <plugin>--v<semver>
 │
 ▼  node scripts/build-index.mjs   (1) validate via scripts/lib/marketplace.mjs → fail = exit 1
 │                                 (2) extract → normalize → resolve deps → releases
 ▼
site/public/  index.json  catalog.json  releases.json  stats.json
              llms.txt    feed.xml      bodies/<plugin>/…
 │
 ▼  vite build (site/)  → site/dist/  (public/* is copied as is)
 │
 ▼  actions/upload-pages-artifact → actions/deploy-pages
 │
 ▼  browser: fetch index.json (once) → MiniSearch in memory → UI
             fetch bodies/… only when details are opened (lazy)
```

### 3.2 Directory structure (to be)

```
.claude-plugin/marketplace.json
package.json                      # root, no dependencies (FR-14)
scripts/
  check-marketplace.mjs           # CLI wrapper over lib/marketplace.mjs
  build-index.mjs                 # generator CLI
  lib/
    marketplace.mjs               # load + validate (shared with check-marketplace)
    frontmatter.mjs               # zero-dep parser for a YAML subset (FR-16)
    semver.mjs                    # parse/compare/satisfies (FR-23)
    changelog.mjs                 # CHANGELOG.md parser (FR-26)
    emit/*.mjs                    # index, catalog, releases, stats, llms, feed
  __fixtures__/repo/              # fictitious marketplace for tests and demo (§12.1)
  __fixtures__/tags.json          # fictitious git tags for tests
  test/*.test.mjs                 # node:test
site/
  package.json  vite.config.ts  tsconfig.json  index.html
  public/                         # JSON/bodies are generated here (gitignored), + static favicon, theme-init.js
  src/
    main.tsx  App.tsx  routes/  components/  data/  search/
    search/synonyms.json  search/stopwords.ts  search/stem-uk.ts  search/query.ts
    types/index.ts                # TS types from §4 (source of truth for the frontend)
  scripts/check-dist.mjs          # checks base path and dist contents (FR-72)
  e2e/*.spec.ts                   # Playwright smoke
docs/specs/site.md                # this document
.github/workflows/build.yml  ci.yml  pages.yml
```

### 3.3 Generator and validator

- **FR-12.** The logic of `check-marketplace.mjs` is moved into `scripts/lib/marketplace.mjs` with the API `loadMarketplace(root)` → normalized plugin records and `validate(root)` → `{ errors: string[], warnings: Warning[] }`. `check-marketplace.mjs` keeps the same CLI contract (argument `[marketplace-root]`, exit 1 on errors, message `marketplace invariants ok (N plugins)`). Existing checks are not weakened.
- **FR-13.** As its first step, `build-index.mjs` calls `validate()`; if `errors.length > 0` it prints the errors and exits with code 1, **writing no files**. Accordingly, CI has nothing to deploy (US-10).
- **FR-14.** `build-index.mjs` and `scripts/lib/*` are Node ESM **without npm dependencies** (only `node:*`), so that `npm run build:index` works without `npm ci` in the root, as in the lab. Minimum Node version is 20.
- **FR-15.** CLI: `node scripts/build-index.mjs [--root <dir>] [--out <dir>] [--tags-file <json>] [--now <iso>] [--commit <sha>] [--fixture]`. Defaults: `--root .`, `--out site/public`, tags from `git for-each-ref refs/tags`, `now` = current time, `commit` = `$GITHUB_SHA` or `git rev-parse HEAD`. `--fixture` sets `fixture: true` in the metadata (FR-72). Before writing, the generator deletes only its own outputs (the list from FR-73), not the whole `site/public`.
- **FR-16.** Frontmatter is parsed by a zero-dep parser of a YAML subset: `key: scalar` (unquoted string, `"…"`, `'…'`, number, `true/false`), inline list `[a, b]`, block list `- a`, folded/literal `>`/`|`. Anything else → a parse error with the file and line (see FR-19).
- **FR-17.** Warnings are printed to stdout, and in GitHub Actions additionally as `::warning file=<path>::<msg>`; errors as `::error …`.

### 3.4 What the generator reads

| Source | Purpose |
|---|---|
| `marketplace.json` | list of plugins, `source`, external metadata, `owner`, marketplace `name` |
| `plugins/<p>/.claude-plugin/plugin.json` | `name`, `version`, `description`, `keywords`, `author`, `license`, `homepage`, `repository`, `dependencies` |
| `plugins/<p>/README.md` | body of the plugin page + search |
| `plugins/<p>/CHANGELOG.md` | plugin changelog, `releases.json`, `feed.xml` |
| `plugins/<p>/COMPATIBILITY.md` | compatibility block: markdown body + extracted minimum Claude Code version (A-3) |
| `skills/*/SKILL.md`, `agents/*.md`, `commands/*.md` | frontmatter + body |
| `hooks/hooks.json`, `.mcp.json` | events / servers + raw JSON |
| `bin/*` | file names only (content is not rendered) |
| git tags `<plugin>--v<semver>` | release dates and links to tags |

### 3.5 Validation rules: fail vs warn

- **FR-19.** The table below is normative. "fail" = an error in `validate()`/the generator, exit 1. "warn" = continue, use the fallback.

| Condition | Reaction | Fallback |
|---|---|---|
| Any error from the current `check-marketplace.mjs` | fail | — |
| Invalid JSON (`plugin.json`, `hooks.json`, `.mcp.json`) | fail | — |
| Frontmatter does not parse (FR-16) | fail | — |
| `SKILL.md` without `description` | fail | — |
| `agents/*.md` without `description` | fail | — |
| Component name does not match `^[a-z0-9][a-z0-9-]{0,63}$` | fail | — |
| Duplicate `id` (FR-21) | fail | — |
| `dependencies[]`: the dependency is in the catalog, but its version does not satisfy the range | fail | — |
| `dependencies[]`: unsupported range syntax (FR-23) | fail | — |
| Cycle in dependencies | fail | — |
| Local plugin without `version` in `plugin.json` | fail | — (README requires a version bump) |
| `agents/*.md` without `name` | warn | name from the file name |
| `commands/*.md` without `description` | warn | first non-empty line of the body, ≤ 160 characters |
| Dependency missing from the catalog | warn | `status: "not-in-catalog"` |
| No `README.md` / `CHANGELOG.md` / `COMPATIBILITY.md` | warn | "Not provided" section |
| `COMPATIBILITY.md` without a recognized `Claude Code <range>` line | warn | `claudeCode: null`, the body is still shown |
| `CHANGELOG.md`: a `## …` heading is not recognized | warn | the section is skipped |
| Newest version in the changelog ≠ `plugin.json` `version` | warn | — |
| Tag `<p>--v<x>` without a changelog section, or a tag for an unknown plugin | warn | release with `notesMarkdown: ""` / the tag is ignored |
| `hooks.json` without a `hooks` object | warn | `events: []` |
| `.mcp.json` without an `mcpServers` object | warn | `servers: []` |
| `plugin.json` has the keys `hooks`, `mcpServers`, `commands`, `agents`, `skills` (inline/custom paths) | warn | `executesCode: true` for `hooks`/`mcpServers`; the content is not indexed (A-6) |

---

## 4. Data model

### 4.1 Identifiers and slugs

- **FR-20.** A plugin's `name` is as in `marketplace.json` (already validated by `NAME_RE`). A component's `name`: skill — the directory name (= frontmatter `name`), agent — frontmatter `name` or the file name without `.md`, command — the file name without `.md`, hook — the constant `hooks`, MCP — the constant `mcp-servers`.
- **FR-21.** `id`:
  - plugin: `<plugin>` (e.g. `sdd-engineering`);
  - component: `<plugin>:<type>:<name>` (e.g. `engineering-paved-path:skill:react-best-practices`). The type is needed in the id because a skill and a command can have the same name.
  - `qualifiedName` (displayed, namespaced): plugin — `<plugin>`, component — `<plugin>:<name>` (e.g. `engineering-paved-path:react-best-practices`).
- **FR-22.** The id is stable: it depends only on the plugin name, the type and the component name, not on file order or version. URL: `#/plugin/<plugin>`, `#/artifact/<id>`. The colon in the hash is not encoded. Body files: `bodies/<plugin>/<type>/<name>.md` (for hook/MCP — `.json`), `bodies/<plugin>/README.md`, `bodies/<plugin>/CHANGELOG.md`, `bodies/<plugin>/COMPATIBILITY.md` (no colons in file names — Windows compatibility).

### 4.2 Dependencies and semver

- **FR-23.** `dependencies` in `plugin.json`: an array of `{ "name": string, "version": string }`, where `version` is a semver range. Supported subset: exact `1.2.3`, `^1.2.3`, `~1.2.3`, `>=1.2.3`, `>=1.0.0 <2.0.0` (space = AND), `*`. Anything else → fail (FR-19).
- **FR-24.** For each dependency the generator computes `resolvedVersion` and `status`, and for each plugin `usedBy` (reverse dependencies). The UI builds the transitive tree from this data.

### 4.3 TypeScript types of `index.json` (normative)

```ts
// site/src/types/index.ts
export type ArtifactType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type ComponentType = Exclude<ArtifactType, 'plugin'>;

export interface IndexFile {
  schemaVersion: '1.0';
  generatedAt: string;          // ISO 8601 UTC
  commit: string;               // 40-character SHA
  fixture: boolean;             // true if built with --fixture
  marketplace: MarketplaceInfo;
  items: IndexItem[];           // sorted: plugins by name, then components by id
}

export interface MarketplaceInfo {
  name: string;                 // "test-ai-marketplace"
  description: string;
  owner: { name: string; email?: string; url?: string };
  repo: { slug: string; url: string; defaultBranch: string }; // "artemmmon/test-ai-marketplace"
  siteUrl: string;              // "https://artemmmon.github.io/test-ai-marketplace/"
  addCommands: { chat: string; cli: string };
  // chat: "/plugin marketplace add artemmmon/test-ai-marketplace"
  // cli:  "claude plugin marketplace add artemmmon/test-ai-marketplace"
}

export interface InstallCommands {
  chat: string;        // "/plugin install <plugin>@test-ai-marketplace"
  cliProject: string;  // "claude plugin install <plugin>@test-ai-marketplace --scope project"
  cliUser: string;     // "claude plugin install <plugin>@test-ai-marketplace --scope user"
}

interface BaseItem {
  id: string;
  type: ArtifactType;
  name: string;
  qualifiedName: string;
  plugin: string;               // for a plugin = name
  version: string | null;       // plugin version; null only for external without version
  description: string;          // in English, plain text
  keywords: string[];           // lower-case, unique; tags for the filter
  path: string | null;          // repo-relative path to the file/directory; null for external
  bodyRef: string | null;       // relative to BASE_URL, e.g. "bodies/p/skill/x.md"
  bodyFormat: 'markdown' | 'json' | null;
  searchText: string;           // plain text of the body (no markdown/frontmatter), ≤ 8000 characters
  source: 'local' | 'external';
  executesCode: boolean;
  installCommands: InstallCommands; // component → the commands of its plugin
  updatedAt: string | null;     // date of the plugin's last release (YYYY-MM-DD)
}

export interface PluginItem extends BaseItem {
  type: 'plugin';
  owner: { name: string; email?: string; url?: string } | null; // plugin.json author → fallback marketplace owner
  license: string | null;
  homepage: string | null;
  repository: string | null;
  compatibility: Compatibility | null;
  dependencies: Dependency[];
  usedBy: string[];                                   // plugin names
  components: Record<ComponentType, string[]>;        // component ids by type
  bin: string[];                                      // file names in bin/
  readmeRef: string | null;
  changelogRef: string | null;
  latestRelease: { version: string; date: string | null; tag: string | null } | null;
  external: ExternalSource | null;                    // only for source: 'external'
}

export interface ExternalSource {
  kind: 'github' | 'git-subdir' | 'url';
  url: string;                  // link for humans (github → https://github.com/<repo>)
  ref: string | null;
  sha: string | null;
  path: string | null;          // for git-subdir
}

export interface Compatibility {
  claudeCode: string | null;    // semver range extracted from COMPATIBILITY.md by the template `Claude Code <range>`, e.g. ">=2.1.110"
  bodyRef: string | null;       // bodies/<plugin>/COMPATIBILITY.md — full text (markdown), lazy
}

export interface Dependency {
  name: string;
  range: string;                // as in plugin.json
  resolvedVersion: string | null;
  status: 'satisfied' | 'not-in-catalog';
}

export interface SkillItem extends BaseItem {
  type: 'skill';
  frontmatter: Record<string, unknown>; // the entire frontmatter for the table
  files: string[];              // other files of the skill directory, repo-relative
}

export interface AgentItem extends BaseItem {
  type: 'agent';
  tools: string[] | null;       // from frontmatter `tools` (comma-separated string or list); null = not specified
  model: string | null;
  frontmatter: Record<string, unknown>;
}

export interface CommandItem extends BaseItem {
  type: 'command';
  argumentHint: string | null;  // frontmatter `argument-hint`
  frontmatter: Record<string, unknown>;
}

export interface HookItem extends BaseItem {
  type: 'hook';
  events: string[];             // keys of the `hooks` object in hooks.json
  executesCode: true;
}

export interface McpItem extends BaseItem {
  type: 'mcp';
  servers: Array<{
    name: string;
    transport: 'stdio' | 'http' | 'sse' | 'unknown';
    command: string | null;     // for stdio
    url: string | null;         // for http/sse
  }>;
  executesCode: true;
}

export type IndexItem = PluginItem | SkillItem | AgentItem | CommandItem | HookItem | McpItem;
```

Filling rules:

- **FR-25.**
  - Plugin `description`: `plugin.json` → fallback `marketplace.json`. `keywords` = the union of both, lower-case. Components inherit the plugin's `keywords`, plus their own from frontmatter `keywords`/`tags` (if present). For MCP, the server names are added to `keywords`.
  - Plugin `executesCode` = there is a hook artifact OR an MCP artifact OR `bin.length > 0` OR rule A-6 triggered.
  - GitHub links are not stored: the UI builds `${repo.url}/blob/${commit}/${path}` (file) or `/tree/` (directory).
  - External: only the metadata from `marketplace.json` is indexed (`name`, `description`, `keywords`, `source`, `version` if present). `components` are empty, `bodyRef`/`readmeRef`/`changelogRef` = null, `executesCode: false` (unknown; the UI shows "Not indexed", FR-52), `path: null`.

### 4.4 `releases.json`

- **FR-26.** Sources: `CHANGELOG.md` (Keep a Changelog format) + git tags `<plugin>--v<semver>`. Recognized headings: `## [1.2.0] - 2026-09-30`, `## 1.2.0 - 2026-09-30`, `## [1.2.0]` (regex `^##\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?(?:\s+[-–]\s+(\d{4}-\d{2}-\d{2}))?\s*$`); `## [Unreleased]` is skipped. A release = a (plugin, version) pair from the union of both sources. Date: from the changelog, otherwise the tag date (`creatordate`). Sorting: date desc, then semver desc, then plugin asc.

```ts
export interface ReleasesFile {
  schemaVersion: '1.0';
  generatedAt: string;
  commit: string;
  releases: Release[];
}
export interface Release {
  id: string;                   // "<plugin>@<version>"
  plugin: string;
  version: string;
  date: string | null;          // YYYY-MM-DD
  tag: string | null;           // "<plugin>--v<version>" if the tag exists
  commit: string | null;        // SHA the tag points to
  notesMarkdown: string;        // changelog section without the heading; "" if none
  origin: 'changelog+tag' | 'changelog' | 'tag';
}
```

### 4.5 `stats.json`

```ts
export interface StatsFile {
  schemaVersion: '1.0';
  generatedAt: string;
  commit: string;
  counts: {
    plugins: number; pluginsLocal: number; pluginsExternal: number;
    skills: number; agents: number; commands: number;
    hooks: number;        // number of hook artifacts (= plugins with hooks.json)
    hookEvents: number;   // sum of events.length
    mcp: number;          // number of MCP servers (sum of servers.length)
    releases: number;
  };
}
```

### 4.6 `catalog.json` (machine-readable catalog)

- **FR-27.** A stable public schema for agents; `schemaVersion` is the semver of the schema: adding fields → minor, removing/renaming/changing a type → major. All URLs are absolute (from `siteUrl`). No `searchText` and no full bodies (links only).

```ts
export interface Catalog {
  schemaVersion: '1.0.0';
  generatedAt: string;
  commit: string;
  marketplace: {
    name: string; description: string;
    owner: { name: string };
    repository: string;           // https://github.com/artemmmon/test-ai-marketplace
    siteUrl: string;
    addCommands: { chat: string; cli: string };
  };
  plugins: Array<{
    name: string;
    version: string | null;
    description: string;
    keywords: string[];
    source: 'local' | 'external';
    sourceUrl: string;            // GitHub tree for local, ExternalSource.url for external
    executesCode: boolean | null; // null for external (unknown)
    dependencies: Array<{ name: string; range: string }>;
    install: InstallCommands;
    pageUrl: string;              // <siteUrl>#/plugin/<name>
    readmeUrl: string | null;
    components: Array<{
      id: string; type: ComponentType; name: string; qualifiedName: string;
      description: string;
      bodyUrl: string | null;     // <siteUrl>bodies/...
      pageUrl: string;            // <siteUrl>#/artifact/<id>
    }>;
  }>;
}
```

### 4.7 `llms.txt`

- **FR-28.** Format per the llms.txt convention: `# <marketplace name>`, a blockquote with the description, a paragraph with installation instructions, a `## Catalog` section with a link to `catalog.json`, a `## Plugins` section — one line per plugin `- [<name>](<pageUrl>): <description> (v<version>)`, below it nested lines for the components with links to `bodyUrl`. A `## Optional` section — `releases.json`, `feed.xml`. Example — §12.2.

### 4.8 `feed.xml`

- **FR-29.** Atom 1.0. `feed/id` = `siteUrl`; `title` = `<marketplace name> — releases`; `link rel="self"` = `<siteUrl>feed.xml`; `link rel="alternate"` = `<siteUrl>#/whats-new`; `updated` = the date of the newest release (or `generatedAt`). Up to 50 entries from `releases.json`: `id` = `<siteUrl>#/whats-new?release=<plugin>@<version>`, `title` = `<plugin> v<version>`, `link` = `<siteUrl>#/plugin/<plugin>`, `updated` = the release date (T00:00:00Z), `content type="text"` = `notesMarkdown`. All strings are XML-escaped.

---

## 5. Search

### 5.1 Engine and documents

- **FR-30.** Search runs in the browser with MiniSearch over all `items` from `index.json` (plugins are documents too). The index is built once after `index.json` is loaded and lives in memory.
- **FR-31.** Fields and weights (boost): `name` ×6, `qualifiedName` ×4, `keywords` ×3, `description` ×2, `plugin` ×1.5, `searchText` ×1. `searchText` contains the README (for a plugin) or the body of SKILL.md / agent / command (for components), so the requirement "search over README and SKILL.md" is met without loading `bodies/`.
- **FR-32.** Default settings: `prefix: true` for terms of length ≥ 2; `fuzzy: 0.2` only for terms of length ≥ 5 (i.e. at most 1 edit for 5–9 characters); `combineWith: 'AND'` between term groups, with a fallback to `OR` if AND gave 0 results (the UI shows the label "Showing partial matches").

### 5.2 Query processing pipeline

`site/src/search/query.ts` exports the pure function `parseQuery(raw: string): ParsedQuery` (unit-tested separately, FR-90):

```ts
interface ParsedQuery {
  raw: string;
  detectedType: ArtifactType | null;
  groups: string[][];   // each group = a term + synonyms (OR inside, AND between groups)
  highlightTerms: string[];
  exactName: string | null;
}
```

- **FR-33. Normalization:** truncate to 200 characters; NFKC; lower-case; `ё→е` is not needed; apostrophes `' ’ ʼ ‘ \`` inside a word are removed (`рев'ю` → `ревю`, i.e. "review"); `ґ` is preserved.
- **FR-34. Boilerplate phrases** at the start of the query are removed (regex, before tokenization), e.g.: UA `мені (треба|потрібен|потрібна|потрібно)` ("I need"), `шукаю` ("I am looking for"), `хочу` ("I want"), `чи є` ("is there"), `є щось для` ("is there something for"), `знайди` ("find"), `покажи` ("show"); EN `i need`, `i want`, `i'm looking for`, `looking for`, `is there`, `find me`, `show me`, `something for`, `a (skill|agent|command|plugin|tool) (for|to)`.
- **FR-35. Phrase synonyms** are applied before tokenization: multi-word entries from `synonyms.json` (e.g. `перевірка коду` ("code check"), `огляд коду` ("code overview"), `code review`) are replaced by the canonical term, the first element of the group.
- **FR-36. Tokenization:** split on `[^\p{L}\p{N}]+` (a hyphen separates: `code-review` → `code`, `review`); tokens shorter than 2 are dropped.
- **FR-37. Stop words** (`stopwords.ts`) are removed. Minimum EN set: `a an the for to of with in on and or me i my need want some any that which please find show how`; UA: `для з із зі в у на і й та що щоб як мені мене треба потрібно потрібен потрібна хочу якийсь щось будь ласка знайди покажи` (Ukrainian equivalents of: for, with/from, in, on, and, that, so that, how, to me, me, need (several forms), I want, some, something, please, find, show). If no tokens remain after removal, the tokens from before the removal are used.
- **FR-38. Type detection:** a token that matches (by prefix after normalization) one of the dictionaries is removed from the terms and sets `detectedType`. The Ukrainian entries are translations or transliterations of the English ones: `скіл*`, `скілл*`, `навичк*` = skill, `агент*` = agent, `субагент*` = subagent, `команд*` = command, `слеш` = slash, `хук*` = hook, `мсп`, `мцп` = mcp, `плагін*` = plugin.

  | Type | Words |
  |---|---|
  | `skill` | `skill*`, `скіл*`, `скілл*`, `навичк*` |
  | `agent` | `agent*`, `агент*`, `subagent*`, `субагент*` |
  | `command` | `command*`, `команд*`, `slash`, `слеш` |
  | `hook` | `hook*`, `хук*` |
  | `mcp` | `mcp`, `мсп`, `мцп` |
  | `plugin` | `plugin*`, `плагін*` |

  Behavior: if the `type` filter is not set in the URL, `detectedType` gives a ×2 boost to documents of that type (MiniSearch `boostDocument`) and shows the chip "Only <type>s" (a click sets the filter). If the query consisted only of a type word (`skills`, `хуки` ("hooks")), the filter is applied immediately and the query becomes empty. An explicit filter in the URL takes precedence over `detectedType`.
- **FR-39. Stemming** (for both indexing and the query, via MiniSearch `processTerm`): Latin tokens — the Porter stemmer (the npm package `stemmer` or a custom implementation — the implementer's choice); Cyrillic tokens — the light suffix stemmer `stem-uk.ts`: it strips the longest of the suffixes (`ування ання ення ами ями ові еві ого ому ими ій ий ою ею ам ям ах ях ом ем ів ти и і а я у ю о е ь`, i.e. Ukrainian noun, adjective and verb endings), provided that ≥ 3 characters remain. Prefix search (FR-32) compensates for the stemmer's inaccuracies.
- **FR-40. Synonyms:** `site/src/search/synonyms.json` in the repo, format:

  ```json
  {
    "version": 1,
    "groups": [
      ["review", "code-review", "code review", "ревю", "рев'ю", "перевірка коду", "огляд коду", "рецензія"],
      ["code", "код", "коду"],
      ["test", "testing", "tests", "тест", "тести", "тестування"],
      ["commit", "commits", "коміт", "коміти", "комміт"],
      ["deploy", "deployment", "деплой", "розгортання"],
      ["architecture", "архітектура", "adr"],
      ["spec", "specification", "специфікація", "спека", "sdd"],
      ["research", "дослідження", "ресерч", "пошук інформації"],
      ["react", "реакт"]
    ]
  }
  ```

  On load, all entries are run through the same pipeline (FR-33, FR-36, FR-39); every single-word query term is expanded to its group (the stemmed forms of all its members). The first element of a group is the canonical English term. The Ukrainian members of each group are translations or transliterations of that term (e.g. `ревю`, `рев'ю` "review"; `перевірка коду` "code check"; `огляд коду` "code overview"; `рецензія` "review (critique)"; `код`, `коду` "code"; `тест`, `тести`, `тестування` "test", "tests", "testing"; `коміт`, `коміти`, `комміт` "commit"; `деплой` "deploy"; `розгортання` "deployment"; `архітектура` "architecture"; `специфікація` "specification"; `спека` "spec" (colloquial); `дослідження` "research"; `ресерч` "research" (transliteration); `пошук інформації` "information search"; `реакт` "React"). Adding a synonym does not require code changes.
- **FR-41. Exact name match:** if the normalized query (without boilerplate phrases and the type word) equals `name`, `qualifiedName`, or `name` with hyphens replaced by spaces, that document gets a ×5 multiplier and is always first.

### 5.3 Results

- **FR-42. Empty query** → show **all** items (subject to filters), sorted by "Recently updated" (`updatedAt` desc, then `name`). Rationale: the catalog is small (tens of items), there is no popularity data and there will not be any (no analytics), so "popular" would be a fabrication; the full list is the best discovery.
- **FR-43. Sorting:** `relevance` (default for a non-empty `q`), `name` (A–Z by `qualifiedName`), `updated` (default for an empty `q`). The `sort` URL parameter is kept only if it differs from the default.
- **FR-44. Debounce** of 150 ms on input; search is synchronous and MUST take ≤ 50 ms for 500 documents (NFR-21).
- **FR-45. Limits:** up to 60 cards are rendered, then a "Show more" button (+60). The counter shows the full count.
- **FR-46. Highlighting:** the terms that produced a match (from MiniSearch `match` + `highlightTerms`, taking prefixes into account) are wrapped in `<mark>` in `qualifiedName` and `description`. If the match is only in `searchText`, the card shows a snippet "Matched in README/SKILL.md: …" (≤ 160 characters around the first match). Highlighting is done on escaped text, not via `innerHTML` from data.
- **FR-47. Nothing found:** the message "No results for "<q>"" + hints: (1) reset the filters (if any are active), (2) try English (if the query is in Cyrillic), (3) 3–5 tags with the most items as chips, (4) a "Request a plugin" link → Report an issue (FR-60) with title `[request] <q>`.

---

## 6. Screens and components

### 6.1 Routes

- **FR-50.**

  | Route | Screen | Parameters |
  |---|---|---|
  | `#/` | redirect → `#/search` | — |
  | `#/search` | Search | `q`, `type`, `plugin`, `tag`, `sort` |
  | `#/plugin/<name>` | Plugin page | `tab` (`skills\|agents\|commands\|hooks\|mcp\|bin`) |
  | `#/artifact/<id>` | Artifact page | — |
  | `#/whats-new` | What's new | `plugin`, `release` (anchor to a release) |
  | `#/getting-started` | Getting started | — |
  | other | 404 | — |

  - `type`, `tag` accept a comma-separated list (OR inside the parameter), `plugin` takes a single value; between parameters — AND. Unknown filter values are ignored (and removed from the URL via `replace`).
  - `#/artifact/<plugin>:<name>` (qualifiedName without the type) is resolved if unambiguous, with a `replace` redirect to the canonical id; otherwise — a page for choosing among several matches.
  - Router: `HashRouter` from `react-router` (or equivalent); the search state lives in the URL (single source of truth). Typing updates the URL via `replace` after the debounce; changing filters goes via `push` (Back returns the previous filter).
  - On a route change, focus moves to the page's `<h1>` and scroll goes to the top.

### 6.2 Global elements

**Header** (on all pages, sticky):
- Logo/name `test-ai-marketplace` → `#/search`.
- Global search field (on `/search` it is the same field as the main one; on other pages Enter leads to `#/search?q=…`). Placeholder `Search plugins, skills, agents…  (/)`. The `/` hotkey focuses the field (except when focus is already in an input field); `Esc` clears the field, a second `Esc` removes focus.
- Navigation: **Search**, **What's new**, **Getting started**.
- Theme switcher (sun/moon icon, `aria-label="Switch to light theme"`/`"…dark theme"`).
- GitHub icon → the repo.
- Mobile (< 640 px): the navigation collapses into a menu button; the search field is full width under the logo.

**Footer:** `Catalog generated <date> from <short SHA>` (SHA → commit on GitHub) · `catalog.json` · `llms.txt` · `feed.xml` · `Report an issue`.

**Skip link** "Skip to content" as the first element.

**Toast:** at the bottom center (mobile) / bottom right (desktop), 2 s, `role="status"` `aria-live="polite"`, texts: `Copied`, `Couldn't copy — press Ctrl/Cmd+C` (fallback, FR-59).

**Design tokens** (values are chosen by the designer, both themes MUST satisfy NFR-2): `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-contrast`, `--focus-ring`, `--mark-bg`, `--warning-bg`, `--warning-text`, `--danger`, `--success`, `--code-bg`, and also a `--type-<type>-bg/-fg` pair for each of the 6 types.

**TypeBadge** — text + icon + color (color is never the sole carrier of meaning). Suggested icons (Lucide names): plugin `package`, skill `sparkles`, agent `bot`, command `square-terminal`, hook `webhook`, mcp `plug`.

**Other badges:** `Executes code` (warning style, triangle icon, tooltip/`title`: "Contains hooks, MCP servers or bin/ executables that run outside Claude's permission rules. Review before installing."), `External` (neutral, tooltip "Metadata only — source code is not indexed"), `vX.Y.Z`.

**CopyButton** — a button with text (`Copy install` / `Copy`); after success, for 2 s the icon changes to a checkmark and the text to `Copied`; `aria-label` states what exactly is being copied.

### 6.3 The `/search` screen

**Purpose:** find an item in 1–2 queries.

**Data:** `index.json`.

**Layout (desktop ≥ 1024):** a search row across the full content width → below it a left filter column (240 px) + a right column: toolbar (counter `23 results` · detectedType chip · sort select) → card grid (2 columns at 1024–1439, 3 columns at ≥ 1440; content max-width 1280). Tablet: filters are a `Filters (n)` button that expands a panel above the grid; 2 columns. Mobile: 1 column, filters are a bottom sheet / full-screen panel. Wireframe — §12.3.

**Filters (FacetGroup):**
- **Type** — checkboxes for the 6 types with counters;
- **Plugin** — radio/list of plugins with counters (if > 8 — with a "Filter plugins" field);
- **Tag** — checkboxes, top 12 by frequency + "Show all".
Counters are computed for the current `q`, taking the other facets into account. Active filters are duplicated as chips above the grid with "×" and a `Clear all` button.

**Card (ArtifactCard)** — FR-51:
- row 1: TypeBadge · (External) · (Executes code);
- `qualifiedName` (a link to the page, highlighted) — `h3` heading;
- for a component: `in <plugin> · v<version>` (plugin is a link); for a plugin: the composition `3 skills · 1 agent · 1 command · hooks` and `Depends on 0/3 plugins`;
- `description` (clamped to 3 lines) with highlighting; a snippet of the body match (FR-46);
- tags (up to 4 + `+N`), a click on a tag sets the `tag` filter;
- actions: **Copy install** (copies `installCommands.chat`; tooltip for a component: "Installs the whole plugin <plugin>"), **View** (→ `#/artifact/<id>` or `#/plugin/<name>`), **GitHub** (icon; for external — `Source` → `external.url`).
- The whole card is not a single link (to avoid nesting interactive elements); hover/focus-within highlights the card.

**States:** loading (6 skeleton cards, counter `Loading catalog…`), error (FR-56), empty catalog (FR-55), nothing found (FR-47), partial matches (FR-32), results.

**a11y:** the field is `role="searchbox"` with a `<label>` (visually hidden); the results counter is an `aria-live="polite"` region, updated after the debounce (`23 results for "review"`); facets are `<fieldset><legend>`; the grid is a `<ul>` list.

### 6.4 The `/plugin/<name>` screen

**Purpose:** everything about a plugin for the "install or not" decision + installation.

**Data:** `PluginItem` + its components from `index.json`; `bodies/<p>/README.md`, `CHANGELOG.md` and the component bodies — lazy.

**Layout (desktop):** a header across the full width; below it the main column (≈ 2/3) and a right metadata sidebar (≈ 1/3, sticky). Mobile — everything in one column in this order: header → Install → metadata → the rest.

1. **Header:** breadcrumb `Search › <plugin>`; `h1` = name; TypeBadge Plugin, `v<version>`, External, Executes code; description; buttons **GitHub** (plugin tree) / **Source** (external), **Report an issue**.
2. **InstallBlock** (FR-52):
   - tab switcher `In chat` | `In terminal` (the choice is remembered in localStorage, with try/catch);
   - Step 1 "Add the marketplace (once)": `addCommands.chat` / `addCommands.cli` + Copy;
   - Step 2 "Install the plugin": `installCommands.chat` / for terminal — a segmented control for scope `project | user` (default `project`) and the corresponding `cliProject`/`cliUser` + Copy;
   - notes: "Installs the whole plugin with all its components."; if there are dependencies — "Dependencies are installed automatically: a, b, c." with links (A-12); if the plugin or any transitive dependency is `executesCode` — a warning banner listing the reasons (hooks / MCP / bin / dependency X).
3. **Metadata (sidebar):** Version, Owner, License, Compatibility (minimum Claude Code version, e.g. `>=2.1.110`; a "Details" link expands `COMPATIBILITY.md`; or "Not specified"), Source (local path / external kind+url+ref/sha), Latest release (version, date, tag → `/tree/<tag>`), Keywords (chips → `#/search?tag=`).
4. **Dependencies** (FR-53): a table/list: name (link), required range, resolved version, status (`Satisfied` — success, `Not in catalog` — warning); below it an expandable tree of transitive dependencies (a nested list with indentation; cycles are impossible because of FR-19); a **Used by** block — a list of plugins. Empty state: "No dependencies".
5. **Contents** (FR-54) — tabs by type with counters, empty tabs are hidden: `Skills (3)`, `Agents (1)`, `Commands (1)`, `Hooks`, `MCP (1)`, `bin/ (2)`. Each item is an accordion row: `qualifiedName`, description, an `Open page` link; expanding lazy-loads and renders the full body (markdown for skill/agent/command; formatted JSON for hooks/MCP). The Hooks, MCP, bin/ tabs have a permanent warning banner "This code runs on your machine outside Claude's permission rules. Read it before installing.". `bin/` is only a list of files with links to GitHub. For external — instead of tabs: "Contents are not indexed for external plugins. View the source →".
6. **README** — rendered markdown (lazy). Empty state: "No README provided".
7. **Changelog** — the last 3 releases are expanded, the rest are under `Show all releases`; each has an anchor, a link to `#/whats-new?plugin=<p>`.

**States:** loading (skeleton of the header and tabs), plugin not found (a 404 variant "Plugin "<name>" not found" + up to 3 closest by name), body load error (inline "Couldn't load README. Retry").

**a11y:** tabs follow the WAI-ARIA Tabs pattern (←/→ arrows, `aria-selected`); accordion — `button[aria-expanded]` + `aria-controls`; the dependencies table with `<th scope>`.

### 6.5 The `/artifact/<id>` screen

**Purpose:** read a single component in full, with the plugin context.

**Data:** an item from `index.json` + `bodyRef` (lazy).

**Layout:** breadcrumb `Search › <plugin> › <Type plural> › <name>`; `h1` = `qualifiedName`; TypeBadge, `in <plugin> v<version>`, Executes code; actions **Copy install** (the plugin's command + the caption "Installs the whole plugin"), **GitHub**, **Report an issue**. Then:
- for hook/MCP — a warning banner (as in FR-54);
- **Frontmatter table** (key → value; lists as chips) for skill/agent/command; for an agent — `tools` ("Not specified" if null) and `model` are highlighted; for a command — `argument-hint`; for a hook — the list of `events`; for MCP — a table of servers (name, transport, command/url);
- the body: markdown (FR-63) or JSON in `<pre><code>` with a Copy button;
- for a skill — a list of `files` with links to GitHub;
- "More from <plugin>" — up to 6 other components of the plugin (compact cards).
Mobile — one column, the frontmatter table becomes a "key: value" list.

**States:** body loading (skeleton), id not found (a 404 variant "Artifact not found" + a search by the last segment of the id), body error (Retry).

### 6.6 The `/whats-new` screen

**Purpose:** what has changed in the catalog.

**Data:** `releases.json` (lazy, on the first opening of the screen).

**Layout:** `h1` What's new; on the right `Subscribe (Atom)` → `feed.xml`; a filter select "All plugins / <plugin>"; a feed grouped by month; an item: `<plugin> v<version>` (→ plugin page), date, tag (→ `/tree/<tag>`) or an `untagged` badge, rendered notes (empty → "No release notes"). `?release=<id>` scrolls to and highlights the item.

**States:** loading, error, empty ("No releases yet").

### 6.7 The `/getting-started` screen

**Purpose:** from zero to an installed plugin. Static content in code (commands are filled in from `marketplace` in `index.json`). Sections (each command is a CodeBlock with Copy, the `In chat` / `In terminal` switcher is shared with InstallBlock):

1. **Add the marketplace** — `/plugin marketplace add artemmmon/test-ai-marketplace` | `claude plugin marketplace add artemmmon/test-ai-marketplace`.
2. **Find a plugin** — a link to `#/search`; explanation: skills, agents, commands are part of plugins; **the whole plugin is installed, not an individual skill**; namespaced names `<plugin>:<name>`.
3. **Install** — `/plugin install <plugin>@test-ai-marketplace` | `claude plugin install <plugin>@test-ai-marketplace --scope project|user`; briefly: `project` — for the current project, `user` — for all your projects.
4. **Check what's installed** — `claude plugin list --json`.
5. **Update** — `claude plugin marketplace update test-ai-marketplace` (or `/plugin marketplace update test-ai-marketplace` in chat), then `/reload-plugins`. Note (from the repo README): auto-update for third-party marketplaces is disabled by default and unreliable — update manually; a new version arrives only after a `version` bump in the plugin.
6. **Security** — hooks, MCP servers and `bin/` run with your permissions outside Claude's permission rules; read them on the plugin page before installing.
7. **For agents** — links to `llms.txt` and `catalog.json`.

### 6.8 404 and global states

- **FR-55. Empty catalog** (`items.length === 0`, the current real state): on `/search`, instead of the grid — "The catalog is empty. No plugins have been published yet." + links `Getting started` and `How to add a plugin` (README on GitHub). Facets are hidden; `/whats-new` — "No releases yet".
- **FR-56. `index.json` load error:** a full-screen state "Couldn't load the catalog" + `Retry` + a link to the repo; the error is logged to the console.
- **FR-57. 404** for an unknown route: "Page not found" + a link to Search; the search field in the header is active.
- **FR-58. Loading:** skeletons, no full-screen spinners; `aria-busy="true"` on the container.
- **FR-59. Copying:** `navigator.clipboard.writeText`; on failure — show the command in a selected `readonly` field (select the text) + the toast `Couldn't copy — press Ctrl/Cmd+C`. The copied string MUST equal the `installCommands`/`addCommands` field byte for byte.
- **FR-60. Report an issue:** a link `https://github.com/artemmmon/test-ai-marketplace/issues/new?title=<t>&labels=site-feedback&body=<b>` (everything through `encodeURIComponent`), `target="_blank" rel="noopener noreferrer"`. Title: global `[site] `, plugin `[<plugin>] `, artifact `[<id>] `, plugin request `[request] <q>`. Body: the page URL, the catalog commit SHA, empty sections `What happened` / `Expected`. The label `site-feedback` SHOULD be created in the repo (A-7, A-14).

### 6.9 Markdown rendering

- **FR-61.** Markdown → HTML via `marked` (GFM), the result → `DOMPurify.sanitize` (default profile, without `style`, without `<iframe>`/`<form>`), and only then into the DOM. `marked` and `DOMPurify` are loaded as a separate lazy chunk (not needed for `/search`).
- **FR-62.** Links: external (`http(s)://`) — `target="_blank" rel="noopener noreferrer"`; relative (`./references/x.md`) — rewritten to `${repo.url}/blob/${commit}/<resolved path>`; `#section` anchors — on click `scrollIntoView` to the heading with the matching `id` (headings get slug ids), without changing the hash (the hash is taken by the router); `javascript:` and other schemes are removed by DOMPurify.
- **FR-63.** Code blocks — `<pre><code>` in a monospace font with horizontal scroll and a Copy button; syntax highlighting is not part of the MVP.
- **FR-64.** Relative images → `https://raw.githubusercontent.com/artemmmon/test-ai-marketplace/<commit>/<path>`; `loading="lazy"`, `alt` from the markdown.

---

## 7. Non-functional requirements

### 7.1 Accessibility

- **NFR-1.** WCAG 2.1 AA. Lighthouse Accessibility ≥ 95 on `/search`, `/plugin/<name>`, `/artifact/<id>` in both themes (fixtures).
- **NFR-2.** Text contrast ≥ 4.5:1 (large text and UI components, focus ring ≥ 3:1) in both themes, including `<mark>`, type badges and warning banners.
- **NFR-3.** All functionality is available from the keyboard; visible focus (`:focus-visible`), logical Tab order; the `/` hotkey (FR in §6.2); tabs/accordions follow WAI-ARIA patterns; skip link.
- **NFR-4.** Search results, the toast and loading state changes are announced via `aria-live="polite"`; icon buttons have `aria-label`; decorative icons are `aria-hidden`.
- **NFR-5.** `prefers-reduced-motion: reduce` disables transition animations, the skeleton shimmer and smooth scrolling.
- **NFR-6.** Touch targets ≥ 44×44 px on mobile.

### 7.2 Theme

- **NFR-10.** Dark-first: on the first visit the theme is `dark` (A-5). A dark/light switcher; the choice is stored in `localStorage` under the key `tam-theme` (all accesses in try/catch, no errors in private mode). The theme is applied via the `data-theme` attribute on `<html>` before the first render through the external `public/theme-init.js` (no inline script, NFR-41), to avoid a flash.

### 7.3 Responsiveness

- **NFR-15.** Breakpoints: `sm` < 640, `md` 640–1023, `lg` 1024–1439, `xl` ≥ 1440. Mobile-first CSS. No horizontal page scroll at a width of 320 px (except `<pre>` and tables in their own scroll container). Side padding is 16 px on mobile.
- Mobile checklist: a header with collapsed navigation; filters as a full-screen panel with a `Show N results` button; cards in 1 column; InstallBlock before the metadata; the contents tabs scroll horizontally; the frontmatter table → a list.

### 7.4 Performance

- **NFR-20.** Budgets (gzip): initial JS ≤ 150 KB (React, router, MiniSearch, the application); the markdown lazy chunk (marked + DOMPurify) ≤ 40 KB; CSS ≤ 30 KB; `index.json` ≤ 250 KB for 200 items (limited by `searchText` ≤ 8000 characters, FR-25). Checked in `check-dist.mjs` (warn when JS/CSS is exceeded, fail at > 1.5× the budget).
- **NFR-21.** `index.json` is loaded once per session (a shared Promise cache); bodies — on demand, cached in memory; `releases.json` — only on `/whats-new` and for a plugin's changelog. Search ≤ 50 ms per query at 500 documents.
- **NFR-22.** Lighthouse Performance (mobile) ≥ 90 on `/search` with fixtures.
- **NFR-23.** Support: the last 2 versions of Chrome, Edge, Firefox, Safari (desktop and mobile).

### 7.5 Security

- **NFR-40.** Any HTML from data goes through FR-61; text fields (`name`, `description`, frontmatter) are rendered as React text, without `dangerouslySetInnerHTML`. `dangerouslySetInnerHTML` is allowed only for the DOMPurify output.
- **NFR-41.** No inline scripts (neither from data nor in `index.html`). CSP via `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://raw.githubusercontent.com data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`. (`frame-ancestors` does not work via meta — a Pages limitation.) If a library requires relaxing it, this is recorded in the Q list with a justification.
- **NFR-42.** All external links use `rel="noopener noreferrer"`. No third-party scripts, CDN fonts or trackers.
- **NFR-43.** The generator does not execute plugin code and makes no network requests; external plugins are not cloned.

### 7.6 SEO and i18n

- **NFR-30.** Limitation: content behind `#/…` is not indexed by search engines as separate pages. At a minimum — static `<title>`, `<meta name="description">` in `index.html`; `document.title` is updated on every route (`<name> — test-ai-marketplace`). Prerender is future work.
- **NFR-31.** UI texts are in English, collected in a single module `site/src/strings.ts`. Artifact descriptions are in English (a decision). Queries — UA/EN (§5).

---

## 8. Build and deploy

### 8.1 npm scripts

- **FR-70.**

  Root (`package.json`, `"type": "module"`, `"private": true`, `"engines": {"node": ">=20"}`, no dependencies):

  | Script | Command |
  |---|---|
  | `check` | `node scripts/check-marketplace.mjs` |
  | `build:index` | `node scripts/build-index.mjs` |
  | `build:index:fixtures` | `node scripts/build-index.mjs --root scripts/__fixtures__/repo --tags-file scripts/__fixtures__/tags.json --fixture` |
  | `test` | `node --test scripts/test/` |
  | `dev` | `npm run build:index && npm --prefix site run dev` |

  `site/package.json` (dependencies: `react`, `react-dom`, `react-router`, `minisearch`, `marked`, `dompurify`, a Porter stemmer; devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@playwright/test`):

  | Script | Command |
  |---|---|
  | `dev` | `vite` (http://localhost:5173/test-ai-marketplace/) |
  | `build` | `tsc -b && vite build && node scripts/check-dist.mjs` |
  | `preview` | `vite preview` (http://localhost:4173/test-ai-marketplace/) |
  | `test` | `vitest run` |
  | `test:e2e` | `playwright test` (starts `preview` via `webServer`) |
  | `typecheck` | `tsc -b --noEmit` |

  Local check (as in the lab): `npm run build:index; cd site && npm ci && npm run build && npm run preview`. With an empty real catalog this yields FR-55; for the demo — `npm run build:index:fixtures` instead of `build:index`.

- **FR-71.** `vite.config.ts`: `base: '/test-ai-marketplace/'`. All data fetches: `` `${import.meta.env.BASE_URL}index.json` `` and so on; no absolute `/…` paths in the code.
- **FR-72.** `site/scripts/check-dist.mjs` checks after the build: (1) all `src`/`href` in `dist/index.html` start with `/test-ai-marketplace/`; (2) there is no `fetch("/` or `fetch('/` in `dist/assets/*.js`; (3) `dist/` contains `index.json`, `catalog.json`, `releases.json`, `stats.json`, `llms.txt`, `feed.xml`; (4) the NFR-20 budgets; (5) if the env `REQUIRE_REAL_DATA=1` is set — `index.json.fixture === false` (so fixtures never reach Pages).
- **FR-73.** `.gitignore` is extended with: `site/dist/`, `site/public/index.json`, `site/public/catalog.json`, `site/public/releases.json`, `site/public/stats.json`, `site/public/llms.txt`, `site/public/feed.xml`, `site/public/bodies/`, `site/node_modules/`, `site/test-results/`, `site/playwright-report/`. The CI step `git ls-files site/dist site/public/*.json site/public/bodies` MUST return an empty result, otherwise fail.

### 8.2 Workflows

- **FR-74. `.github/workflows/build.yml`** — reusable (`on: workflow_call`, input `deploy: boolean`), jobs:
  1. **validate** — checkout; `actions/setup-node` (Node 22, `cache: npm`, `cache-dependency-path: site/package-lock.json`); `npm run check`; `npm test`; the FR-73 check. (`claude plugin validate .` is not run in CI, see A-13; it remains a local step.)
  2. **build-index** (`needs: validate`) — checkout with `fetch-depth: 0` (history and tags for releases); `npm run build:index`; `actions/upload-artifact` → `site-data` (the generated files from `site/public`).
  3. **build-site** (`needs: build-index`) — checkout; setup-node with cache; `actions/download-artifact` `site-data` → `site/public`; `cd site && npm ci && npm run typecheck && npm test && npm run build` with `REQUIRE_REAL_DATA=1`; if `deploy` — `actions/configure-pages` + `actions/upload-pages-artifact` (`path: site/dist`), otherwise `actions/upload-artifact` `site-dist` (for manual inspection, retention 7 days).
  4. **e2e** (`needs: validate`, in parallel with build-index) — `npm run build:index:fixtures`; `cd site && npm ci && npx playwright install --with-deps chromium && npm run build && npm run test:e2e` (without `REQUIRE_REAL_DATA`).
- **FR-75. `.github/workflows/ci.yml`** — `on: pull_request` (to `main`); `permissions: contents: read`; `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`; `uses: ./.github/workflows/build.yml` with `deploy: false`.
- **FR-76. `.github/workflows/pages.yml`** — `on: push` to `main`, `push` of tags `*--v*` (updates releases), `workflow_dispatch`; `concurrency: { group: pages, cancel-in-progress: false }`; job `build` → `uses: ./.github/workflows/build.yml` with `deploy: true` (`permissions: contents: read`); job **deploy** (`needs: build`, condition `github.ref == 'refs/heads/main'` or a tag): `permissions: pages: write, id-token: write`; `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`; `actions/deploy-pages` (`id: deployment`).
- **FR-77.** Actions are pinned to the major version current at implementation time. Any failure in `validate`, `build-index`, `build-site` or `e2e` blocks the deploy (deploy depends on build, and build on validate; e2e is included in the deploy `needs` through the reusable workflow).

---

## 9. Testing and acceptance

### 9.1 Unit: generator (`scripts/test/*.test.mjs`, `node:test`)

- **FR-80.** On `scripts/__fixtures__/repo` (the structure from §12.1) with `--now 2026-10-19T12:00:00Z --commit a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 --tags-file …`:
  - the output `index.json` matches the stored golden file `scripts/__fixtures__/expected/index.json` (determinism: identical inputs → byte-for-byte identical output);
  - for every local plugin, `version` and `dependencies` equal the values from `plugin.json`;
  - `usedBy`, `resolvedVersion`, `executesCode`, `components` — as in §12.1;
  - `stats.json` counts = the actual counts;
  - `releases.json`: order, dates, `origin`; `feed.xml` is valid XML (parses), entries = releases;
  - `catalog.json` has `schemaVersion` and only absolute URLs;
  - every `bodyRef` points to an existing file.
- **FR-81.** Negative cases (each is a separate minimal fixture catalog, exit 1 and the error text are expected): every "fail" row of the FR-19 table; and one check for each "warn" (exit 0 + the warning text).
- **FR-82.** After the refactoring `check-marketplace.mjs` produces the same output on the same inputs as before (a regression test on fixtures + on the current empty `marketplace.json`: `marketplace invariants ok (0 plugins)`).
- **FR-83.** `semver.mjs`: a `satisfies(version, range)` table for all forms of FR-23; `changelog.mjs`: all heading formats of FR-26.

### 9.2 Unit: search (`site/src/search/*.test.ts`, Vitest)

- **FR-90.** `parseQuery`: boilerplate phrases, stop words, apostrophes, type detection, synonym expansion (a table "input → `ParsedQuery`").
- **FR-91. Golden set** (on `site/src/fixtures/index.json` = a copy of the golden file from FR-80). "top-k ∋ X" means that X is among the first k:

  | # | Query | Expectation |
  |---|---|---|
  | 1 | `мені треба скіл для код-рев'ю` ("I need a skill for code review") | top-1 = `engineering-paved-path:skill:code-review`; `detectedType = skill` |
  | 2 | `I need a skill for code review` | top-1 = `engineering-paved-path:skill:code-review` |
  | 3 | `перевірка коду` ("code check") | top-3 ∋ `engineering-paved-path:skill:code-review` |
  | 4 | `react` | top-1 = `engineering-paved-path:skill:react-best-practices` |
  | 5 | `engineering-paved-path:react-best-practices` | top-1 = `engineering-paved-path:skill:react-best-practices` (FR-41) |
  | 6 | `агент для архітектури` ("an agent for architecture") | top-1 = `architecture-review:agent:architecture-reviewer` |
  | 7 | `коміт` ("commit") | top-1 = `engineering-paved-path:skill:commit-conventions` |
  | 8 | `специфікація` ("specification") | top-3 ∋ `sdd-engineering:skill:spec-writing` |
  | 9 | `дослідження` ("research") | top-3 ∋ `research-tools` (plugin) or its skill `web-research` |
  | 10 | `sdd` | top-3 ∋ `sdd-engineering` (plugin) |
  | 11 | `architecture-review` | top-2 = {`architecture-review` (plugin), `architecture-review:skill:architecture-review`} |
  | 12 | `reviw` (one typo) | top-3 ∋ `engineering-paved-path:skill:code-review` |
  | 13 | `хуки` ("hooks") | filter `type=hook`; results = only `engineering-paved-path:hook:hooks` |
  | 14 | `mcp` | filter `type=mcp`; results = only `research-tools:mcp:mcp-servers` |
  | 15 | `kubernetes` | 0 results → the FR-47 state |
  | 16 | `` (empty) | all 21 items, sorted by `updated` |

### 9.3 E2E / smoke (Playwright, `site/e2e/smoke.spec.ts`, on `preview` with fixtures)

- **FR-95.**
  1. Open `/test-ai-marketplace/#/search`, type `code review` → the card `engineering-paved-path:code-review` is visible; type `sdd-engineering` → the plugin card is first (both the plugin and its nested skill are found).
  2. After typing, the URL contains `#/search?q=`; a reload restores the results (US-5).
  3. On the `engineering-paved-path` card click Copy install → `navigator.clipboard.readText()` (with the `clipboard-read` permission) === `/plugin install engineering-paved-path@test-ai-marketplace`; the toast `Copied` is visible.
  4. `#/plugin/sdd-engineering`: the displayed version === `version` from `scripts/__fixtures__/repo/plugins/sdd-engineering/.claude-plugin/plugin.json` (the test reads the file); the dependency list === `dependencies` from the same file (names and ranges); switch to In terminal + `user` → Copy → `claude plugin install sdd-engineering@test-ai-marketplace --scope user`.
  5. `#/artifact/engineering-paved-path:hook:hooks` — the warning "runs on your machine" and the JSON are visible.
  6. `#/nope` → 404; `#/plugin/unknown` → "Plugin "unknown" not found".
  7. The `/` key focuses the search; there are no errors in the console; there are no requests outside the origin (except raw.githubusercontent.com).
- **FR-96.** Manual check before hand-in: `npm run build:index` on the real (empty) catalog → `preview` shows FR-55 without errors.

### 9.4 Lab checklist (step 6)

| Lab requirement | Where in the specification | Verification |
|---|---|---|
| CLI = installation, UI = discovery (find, read, copy) | §1.1, FR-51, FR-52 | US-1…US-4 |
| The document fixes routes, index fields, search, the detail page | FR-50, §4, §5, §6.4–6.5 | this file |
| No backend, ratings, download counter | §1.2 | — |
| `scripts/build-index.mjs` reads marketplace.json, manifests, README, changelog, compatibility, frontmatter → `site/public/`: index.json, releases.json, stats.json, bodies/ | §3.4, §4 | FR-80 |
| React + TS + Vite, hash routes `/search`, `/plugin/<name>`, `/artifact/<id>`, `/whats-new`, `/getting-started` | FR-50, FR-70 | FR-95 |
| MiniSearch over name, description, keywords, README, SKILL.md; marked + sanitization | FR-30, FR-31, FR-61 | FR-91 |
| Plugin page: version, owner, compatibility, dependencies, composition, `/plugin install <plugin>@<marketplace>` (+ CLI `--scope`) | §6.4 | FR-95.4 |
| Locally: `npm run build:index; cd site && npm ci && npm run build && npm run preview` | FR-70 | FR-96 |
| Generated JSON and `site/dist/` are not committed | FR-73 | CI step of FR-73 |
| The PR workflow builds the index and the frontend; `pages.yml` publishes after merge via upload-pages-artifact + deploy-pages, `pages: write`, `id-token: write`; a separate build job for the index; base `/test-ai-marketplace/` | FR-74…FR-77, FR-71 | green CI, FR-72 |
| The plugin and its nested skills are found; version/dependencies = manifest; Copy install gives the correct command | FR-91, FR-95 | FR-95.1–4 |
| Dependencies (name + semver range), namespaced components, dependency graph/list | FR-21, FR-23, FR-53 | FR-80, FR-95.4 |
| Tags `<plugin>--v<semver>`, releases.json and /whats-new from CHANGELOG.md and tags | FR-26, §6.6 | FR-80 |

---

## 10. Phasing

**MVP** (everything in this specification): search + cards; type/plugin/tag filters + deep links; a plugin page with the full content of local plugins; an artifact page; `catalog.json` + `llms.txt`; changelog, `/whats-new`, `releases.json`, `feed.xml`; `stats.json`; `/getting-started`; dark/light theme; CI + Pages.

**Future work (explicitly deferred):**

| What | Why not in the MVP |
|---|---|
| Semantic/embedding search | with tens of artifacts, MiniSearch + synonyms is enough; can be added later as vectors precomputed in CI. |
| Comments (giscus etc.) | contradicts a purely reference site; requires GitHub Discussions and a third-party script (CSP). |
| Ratings, install counter | requires writes and state storage (backend + authentication); Claude Code does not report installs to us, and a static site cannot count them. |
| Analytics | requires a third-party collector or our own backend; privacy. |
| PWA / offline | small gain for a reference site; a service worker complicates data invalidation after a deploy. |
| Plugin comparison | the value appears with a larger number of plugins. |
| Syntax highlighting, prerender for SEO, UI localization | not needed for the lab acceptance. |

---

## 11. Assumptions and open questions

### 11.1 Assumptions (chosen defaults)

- **A-1.** The marketplace name for commands is taken from `marketplace.json` `name` (`test-ai-marketplace`), and the source for `marketplace add` is `owner/repo` from `GITHUB_REPOSITORY` or `git remote get-url origin` (`artemmmon/test-ai-marketplace`).
- **A-2.** `dependencies` in `plugin.json` is an array of `{name, version}` (as in the lab text); other forms (an object map) → fail with an explanation.
- **A-3.** A plugin's compatibility is taken from `plugins/<p>/COMPATIBILITY.md` (as in the lab, step 4: "In COMPATIBILITY.md we record Claude Code >=2.1.110" — translated from the Ukrainian lab text). The generator extracts the minimum version from it by the template `Claude Code <range>` and puts the full text into `bodies/<plugin>/COMPATIBILITY.md` (the `Compatibility` schema, §4.3); for a skill, the frontmatter field `compatibility` is additionally shown, if present.
- **A-4.** The changelog format is Keep a Changelog (FR-26).
- **A-5.** The first visit gets the dark theme regardless of `prefers-color-scheme` (dark-first); the user's choice is stored.
- **A-6.** Inline/custom component paths in `plugin.json` are not indexed in the MVP (warn), but `hooks`/`mcpServers` mark the plugin as `executesCode`.
- **A-7.** The label for issues is `site-feedback`; GitHub may ignore `labels` in the URL for users without triage rights, so the type of the report is duplicated by a prefix in the title.
- **A-8.** Copy install on a card copies the "in chat" variant (`/plugin install …`), because that is the install command from the lab text; the CLI variant is available on the plugin page.
- **A-9.** The generator is zero-dep (FR-14), therefore frontmatter is limited to a YAML subset (FR-16).
- **A-10.** E2E is Playwright (Chromium) in CI; frontend unit tests are Vitest.
- **A-11.** The site URL is the default `https://artemmmon.github.io/test-ai-marketplace/`, without a custom domain.

### 11.2 Questions closed by the lab text or accepted as recommended

- **A-12 (was Q-2). Dependencies are installed automatically.** Lab, step 10: "The built-in installer automatically installs dependencies and lists them in the result" (translated from the Ukrainian lab text). Therefore the Install block does not ask to install dependencies manually, but only lists them; verification is `claude plugin list --json` without `dependency-unsatisfied`, `range-conflict`, `no-matching-tag`.
- **A-13 (was Q-3). `claude plugin validate .` is not run in CI.** The lab mentions the command as a local check (steps 5 and 7), but does not say that it must be installed on the runner; the `--strict` flag does not exist. CI relies on its own `scripts/lib/marketplace.mjs`. Adding the CLI to the runner is future work. Accepted as recommended.
- **A-14 (was Q-4). The `site-feedback` label.** The lab does not define this; we keep `site-feedback` (A-7), the title prefix works even without the label. The label must be created in the repo by the repo owner. Accepted as recommended.
- **Q-1 closed in A-3:** compatibility is a separate `COMPATIBILITY.md` in the plugin root.

### 11.3 Open questions

None.
---

## 12. Appendices

### 12.1 Fixtures: example `index.json` (FICTITIOUS DATA)

> **This is an invented example for design and tests.** The repo currently contains none of these plugins. The data reproduces the expected structure of the real plugins from the lab. The same catalog MUST exist as a file tree `scripts/__fixtures__/repo/` (the golden file is generated from this tree, FR-80), and a copy of the result in `site/src/fixtures/index.json`. `searchText` is abbreviated.

Fixtures composition:

| Plugin | Version | Dependencies | Components | executesCode |
|---|---|---|---|---|
| `engineering-paved-path` | 1.2.0 | — | skills `react-best-practices`, `code-review`, `commit-conventions`; agent `code-reviewer`; command `review-pr`; hooks (`PreToolUse`, `PostToolUse`) | yes (hooks) |
| `research-tools` | 1.0.1 | — | skills `web-research`, `literature-review`; agent `researcher`; MCP `docs-fetch` | yes (MCP) |
| `architecture-review` | 1.0.0 | `engineering-paved-path ^1.0.0` | skills `architecture-review`, `adr-writing`; agent `architecture-reviewer` | no |
| `sdd-engineering` | 1.0.0 | `engineering-paved-path ^1.0.0`, `research-tools ^1.0.0`, `architecture-review ^1.0.0` | skills `spec-writing`, `sdd-workflow`; agent `spec-reviewer`; command `spec` | no (but its dependencies do) |

Fictitious tags (`scripts/__fixtures__/tags.json`): `engineering-paved-path--v1.0.0` (2026-08-01), `engineering-paved-path--v1.2.0` (2026-09-30), `research-tools--v1.0.1` (2026-09-12), `architecture-review--v1.0.0` (2026-09-20), `sdd-engineering--v1.0.0` (2026-10-10).

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-10-19T12:00:00Z",
  "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  "fixture": true,
  "marketplace": {
    "name": "test-ai-marketplace",
    "description": "Personal Claude Code plugin marketplace — plugins extracted from DevDigest",
    "owner": { "name": "artemmmon" },
    "repo": { "slug": "artemmmon/test-ai-marketplace", "url": "https://github.com/artemmmon/test-ai-marketplace", "defaultBranch": "main" },
    "siteUrl": "https://artemmmon.github.io/test-ai-marketplace/",
    "addCommands": {
      "chat": "/plugin marketplace add artemmmon/test-ai-marketplace",
      "cli": "claude plugin marketplace add artemmmon/test-ai-marketplace"
    }
  },
  "items": [
    {
      "id": "architecture-review", "type": "plugin", "name": "architecture-review", "qualifiedName": "architecture-review",
      "plugin": "architecture-review", "version": "1.0.0",
      "description": "Architecture review workflow: ADRs, trade-off analysis and a reviewer agent.",
      "keywords": ["architecture", "adr", "review"],
      "path": "plugins/architecture-review", "bodyRef": "bodies/architecture-review/README.md", "bodyFormat": "markdown",
      "searchText": "Architecture review. Write ADRs, compare options, review designs against the paved path…",
      "source": "local", "executesCode": false,
      "installCommands": {
        "chat": "/plugin install architecture-review@test-ai-marketplace",
        "cliProject": "claude plugin install architecture-review@test-ai-marketplace --scope project",
        "cliUser": "claude plugin install architecture-review@test-ai-marketplace --scope user"
      },
      "updatedAt": "2026-09-20",
      "owner": { "name": "artemmmon" }, "license": "MIT", "homepage": null, "repository": null,
      "compatibility": null,
      "dependencies": [ { "name": "engineering-paved-path", "range": "^1.0.0", "resolvedVersion": "1.2.0", "status": "satisfied" } ],
      "usedBy": ["sdd-engineering"],
      "components": {
        "skill": ["architecture-review:skill:adr-writing", "architecture-review:skill:architecture-review"],
        "agent": ["architecture-review:agent:architecture-reviewer"],
        "command": [], "hook": [], "mcp": []
      },
      "bin": [],
      "readmeRef": "bodies/architecture-review/README.md", "changelogRef": "bodies/architecture-review/CHANGELOG.md",
      "latestRelease": { "version": "1.0.0", "date": "2026-09-20", "tag": "architecture-review--v1.0.0" },
      "external": null
    },
    {
      "id": "engineering-paved-path", "type": "plugin", "name": "engineering-paved-path", "qualifiedName": "engineering-paved-path",
      "plugin": "engineering-paved-path", "version": "1.2.0",
      "description": "Team engineering conventions: React best practices, code review, commit conventions and guard hooks.",
      "keywords": ["engineering", "react", "review", "conventions"],
      "path": "plugins/engineering-paved-path", "bodyRef": "bodies/engineering-paved-path/README.md", "bodyFormat": "markdown",
      "searchText": "Engineering paved path. Opinionated defaults for React projects, code review checklists, conventional commits…",
      "source": "local", "executesCode": true,
      "installCommands": {
        "chat": "/plugin install engineering-paved-path@test-ai-marketplace",
        "cliProject": "claude plugin install engineering-paved-path@test-ai-marketplace --scope project",
        "cliUser": "claude plugin install engineering-paved-path@test-ai-marketplace --scope user"
      },
      "updatedAt": "2026-09-30",
      "owner": { "name": "artemmmon" }, "license": "MIT", "homepage": null, "repository": null,
      "compatibility": { "claudeCode": ">=2.1.110", "bodyRef": "bodies/engineering-paved-path/COMPATIBILITY.md" },
      "dependencies": [],
      "usedBy": ["architecture-review", "sdd-engineering"],
      "components": {
        "skill": ["engineering-paved-path:skill:code-review", "engineering-paved-path:skill:commit-conventions", "engineering-paved-path:skill:react-best-practices"],
        "agent": ["engineering-paved-path:agent:code-reviewer"],
        "command": ["engineering-paved-path:command:review-pr"],
        "hook": ["engineering-paved-path:hook:hooks"],
        "mcp": []
      },
      "bin": [],
      "readmeRef": "bodies/engineering-paved-path/README.md", "changelogRef": "bodies/engineering-paved-path/CHANGELOG.md",
      "latestRelease": { "version": "1.2.0", "date": "2026-09-30", "tag": "engineering-paved-path--v1.2.0" },
      "external": null
    },
    {
      "id": "research-tools", "type": "plugin", "name": "research-tools", "qualifiedName": "research-tools",
      "plugin": "research-tools", "version": "1.0.1",
      "description": "Web and literature research skills with a docs-fetching MCP server.",
      "keywords": ["research", "docs", "web"],
      "path": "plugins/research-tools", "bodyRef": "bodies/research-tools/README.md", "bodyFormat": "markdown",
      "searchText": "Research tools. Search the web, summarize sources, fetch library docs via MCP…",
      "source": "local", "executesCode": true,
      "installCommands": {
        "chat": "/plugin install research-tools@test-ai-marketplace",
        "cliProject": "claude plugin install research-tools@test-ai-marketplace --scope project",
        "cliUser": "claude plugin install research-tools@test-ai-marketplace --scope user"
      },
      "updatedAt": "2026-09-12",
      "owner": { "name": "artemmmon" }, "license": "MIT", "homepage": null, "repository": null,
      "compatibility": null,
      "dependencies": [],
      "usedBy": ["sdd-engineering"],
      "components": {
        "skill": ["research-tools:skill:literature-review", "research-tools:skill:web-research"],
        "agent": ["research-tools:agent:researcher"],
        "command": [], "hook": [],
        "mcp": ["research-tools:mcp:mcp-servers"]
      },
      "bin": [],
      "readmeRef": "bodies/research-tools/README.md", "changelogRef": "bodies/research-tools/CHANGELOG.md",
      "latestRelease": { "version": "1.0.1", "date": "2026-09-12", "tag": "research-tools--v1.0.1" },
      "external": null
    },
    {
      "id": "sdd-engineering", "type": "plugin", "name": "sdd-engineering", "qualifiedName": "sdd-engineering",
      "plugin": "sdd-engineering", "version": "1.0.0",
      "description": "Spec-driven development: write specs, plan, review — built on the paved path, research and architecture plugins.",
      "keywords": ["sdd", "spec", "planning"],
      "path": "plugins/sdd-engineering", "bodyRef": "bodies/sdd-engineering/README.md", "bodyFormat": "markdown",
      "searchText": "SDD engineering. From idea to spec to plan to implementation with review gates…",
      "source": "local", "executesCode": false,
      "installCommands": {
        "chat": "/plugin install sdd-engineering@test-ai-marketplace",
        "cliProject": "claude plugin install sdd-engineering@test-ai-marketplace --scope project",
        "cliUser": "claude plugin install sdd-engineering@test-ai-marketplace --scope user"
      },
      "updatedAt": "2026-10-10",
      "owner": { "name": "artemmmon" }, "license": "MIT", "homepage": null, "repository": null,
      "compatibility": { "claudeCode": ">=2.1.110", "bodyRef": "bodies/sdd-engineering/COMPATIBILITY.md" },
      "dependencies": [
        { "name": "engineering-paved-path", "range": "^1.0.0", "resolvedVersion": "1.2.0", "status": "satisfied" },
        { "name": "research-tools", "range": "^1.0.0", "resolvedVersion": "1.0.1", "status": "satisfied" },
        { "name": "architecture-review", "range": "^1.0.0", "resolvedVersion": "1.0.0", "status": "satisfied" }
      ],
      "usedBy": [],
      "components": {
        "skill": ["sdd-engineering:skill:sdd-workflow", "sdd-engineering:skill:spec-writing"],
        "agent": ["sdd-engineering:agent:spec-reviewer"],
        "command": ["sdd-engineering:command:spec"],
        "hook": [], "mcp": []
      },
      "bin": [],
      "readmeRef": "bodies/sdd-engineering/README.md", "changelogRef": "bodies/sdd-engineering/CHANGELOG.md",
      "latestRelease": { "version": "1.0.0", "date": "2026-10-10", "tag": "sdd-engineering--v1.0.0" },
      "external": null
    },

    {
      "id": "architecture-review:agent:architecture-reviewer", "type": "agent", "name": "architecture-reviewer",
      "qualifiedName": "architecture-review:architecture-reviewer", "plugin": "architecture-review", "version": "1.0.0",
      "description": "Reviews a proposed architecture for risks, trade-offs and missing ADRs.",
      "keywords": ["architecture", "adr", "review"],
      "path": "plugins/architecture-review/agents/architecture-reviewer.md",
      "bodyRef": "bodies/architecture-review/agent/architecture-reviewer.md", "bodyFormat": "markdown",
      "searchText": "You are an architecture reviewer…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install architecture-review@test-ai-marketplace", "cliProject": "claude plugin install architecture-review@test-ai-marketplace --scope project", "cliUser": "claude plugin install architecture-review@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-20",
      "tools": ["Read", "Grep", "Glob"], "model": "opus",
      "frontmatter": { "name": "architecture-reviewer", "description": "Reviews a proposed architecture for risks, trade-offs and missing ADRs.", "tools": "Read, Grep, Glob", "model": "opus" }
    },
    {
      "id": "architecture-review:skill:adr-writing", "type": "skill", "name": "adr-writing",
      "qualifiedName": "architecture-review:adr-writing", "plugin": "architecture-review", "version": "1.0.0",
      "description": "Write Architecture Decision Records with context, options and consequences.",
      "keywords": ["architecture", "adr", "review", "documentation"],
      "path": "plugins/architecture-review/skills/adr-writing/SKILL.md",
      "bodyRef": "bodies/architecture-review/skill/adr-writing.md", "bodyFormat": "markdown",
      "searchText": "ADR writing. Use when a significant technical decision is made…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install architecture-review@test-ai-marketplace", "cliProject": "claude plugin install architecture-review@test-ai-marketplace --scope project", "cliUser": "claude plugin install architecture-review@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-20",
      "frontmatter": { "name": "adr-writing", "description": "Write Architecture Decision Records with context, options and consequences." },
      "files": ["plugins/architecture-review/skills/adr-writing/templates/adr.md"]
    },
    {
      "id": "architecture-review:skill:architecture-review", "type": "skill", "name": "architecture-review",
      "qualifiedName": "architecture-review:architecture-review", "plugin": "architecture-review", "version": "1.0.0",
      "description": "Run a structured architecture review: context, quality attributes, risks, recommendations.",
      "keywords": ["architecture", "adr", "review"],
      "path": "plugins/architecture-review/skills/architecture-review/SKILL.md",
      "bodyRef": "bodies/architecture-review/skill/architecture-review.md", "bodyFormat": "markdown",
      "searchText": "Architecture review checklist…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install architecture-review@test-ai-marketplace", "cliProject": "claude plugin install architecture-review@test-ai-marketplace --scope project", "cliUser": "claude plugin install architecture-review@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-20",
      "frontmatter": { "name": "architecture-review", "description": "Run a structured architecture review: context, quality attributes, risks, recommendations." },
      "files": []
    },
    {
      "id": "engineering-paved-path:agent:code-reviewer", "type": "agent", "name": "code-reviewer",
      "qualifiedName": "engineering-paved-path:code-reviewer", "plugin": "engineering-paved-path", "version": "1.2.0",
      "description": "Reviews a diff against the team's paved-path conventions and reports blocking issues first.",
      "keywords": ["engineering", "react", "review", "conventions"],
      "path": "plugins/engineering-paved-path/agents/code-reviewer.md",
      "bodyRef": "bodies/engineering-paved-path/agent/code-reviewer.md", "bodyFormat": "markdown",
      "searchText": "You are a senior reviewer…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install engineering-paved-path@test-ai-marketplace", "cliProject": "claude plugin install engineering-paved-path@test-ai-marketplace --scope project", "cliUser": "claude plugin install engineering-paved-path@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-30",
      "tools": ["Read", "Grep", "Glob", "Bash"], "model": null,
      "frontmatter": { "name": "code-reviewer", "description": "Reviews a diff against the team's paved-path conventions and reports blocking issues first.", "tools": "Read, Grep, Glob, Bash" }
    },
    {
      "id": "engineering-paved-path:command:review-pr", "type": "command", "name": "review-pr",
      "qualifiedName": "engineering-paved-path:review-pr", "plugin": "engineering-paved-path", "version": "1.2.0",
      "description": "Review the current pull request with the code-reviewer agent.",
      "keywords": ["engineering", "react", "review", "conventions"],
      "path": "plugins/engineering-paved-path/commands/review-pr.md",
      "bodyRef": "bodies/engineering-paved-path/command/review-pr.md", "bodyFormat": "markdown",
      "searchText": "Review PR $ARGUMENTS…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install engineering-paved-path@test-ai-marketplace", "cliProject": "claude plugin install engineering-paved-path@test-ai-marketplace --scope project", "cliUser": "claude plugin install engineering-paved-path@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-30",
      "argumentHint": "[pr-number]",
      "frontmatter": { "description": "Review the current pull request with the code-reviewer agent.", "argument-hint": "[pr-number]" }
    },
    {
      "id": "engineering-paved-path:hook:hooks", "type": "hook", "name": "hooks",
      "qualifiedName": "engineering-paved-path:hooks", "plugin": "engineering-paved-path", "version": "1.2.0",
      "description": "Guard hooks: block edits to generated files and run the formatter after edits.",
      "keywords": ["engineering", "react", "review", "conventions"],
      "path": "plugins/engineering-paved-path/hooks/hooks.json",
      "bodyRef": "bodies/engineering-paved-path/hook/hooks.json", "bodyFormat": "json",
      "searchText": "PreToolUse PostToolUse", "source": "local", "executesCode": true,
      "installCommands": { "chat": "/plugin install engineering-paved-path@test-ai-marketplace", "cliProject": "claude plugin install engineering-paved-path@test-ai-marketplace --scope project", "cliUser": "claude plugin install engineering-paved-path@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-30",
      "events": ["PreToolUse", "PostToolUse"]
    },
    {
      "id": "engineering-paved-path:skill:code-review", "type": "skill", "name": "code-review",
      "qualifiedName": "engineering-paved-path:code-review", "plugin": "engineering-paved-path", "version": "1.2.0",
      "description": "Code review checklist for pull requests: correctness, tests, security, readability.",
      "keywords": ["engineering", "react", "review", "conventions", "pull-request"],
      "path": "plugins/engineering-paved-path/skills/code-review/SKILL.md",
      "bodyRef": "bodies/engineering-paved-path/skill/code-review.md", "bodyFormat": "markdown",
      "searchText": "Code review. Use when reviewing a pull request or a diff…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install engineering-paved-path@test-ai-marketplace", "cliProject": "claude plugin install engineering-paved-path@test-ai-marketplace --scope project", "cliUser": "claude plugin install engineering-paved-path@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-30",
      "frontmatter": { "name": "code-review", "description": "Code review checklist for pull requests: correctness, tests, security, readability." },
      "files": ["plugins/engineering-paved-path/skills/code-review/checklist.md"]
    },
    {
      "id": "engineering-paved-path:skill:commit-conventions", "type": "skill", "name": "commit-conventions",
      "qualifiedName": "engineering-paved-path:commit-conventions", "plugin": "engineering-paved-path", "version": "1.2.0",
      "description": "Write Conventional Commits messages and split changes into atomic commits.",
      "keywords": ["engineering", "react", "review", "conventions", "git", "commit"],
      "path": "plugins/engineering-paved-path/skills/commit-conventions/SKILL.md",
      "bodyRef": "bodies/engineering-paved-path/skill/commit-conventions.md", "bodyFormat": "markdown",
      "searchText": "Commit conventions. feat, fix, chore…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install engineering-paved-path@test-ai-marketplace", "cliProject": "claude plugin install engineering-paved-path@test-ai-marketplace --scope project", "cliUser": "claude plugin install engineering-paved-path@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-30",
      "frontmatter": { "name": "commit-conventions", "description": "Write Conventional Commits messages and split changes into atomic commits." },
      "files": []
    },
    {
      "id": "engineering-paved-path:skill:react-best-practices", "type": "skill", "name": "react-best-practices",
      "qualifiedName": "engineering-paved-path:react-best-practices", "plugin": "engineering-paved-path", "version": "1.2.0",
      "description": "React and TypeScript conventions: components, hooks, state, accessibility and performance.",
      "keywords": ["engineering", "react", "review", "conventions", "typescript", "frontend"],
      "path": "plugins/engineering-paved-path/skills/react-best-practices/SKILL.md",
      "bodyRef": "bodies/engineering-paved-path/skill/react-best-practices.md", "bodyFormat": "markdown",
      "searchText": "React best practices. Prefer function components…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install engineering-paved-path@test-ai-marketplace", "cliProject": "claude plugin install engineering-paved-path@test-ai-marketplace --scope project", "cliUser": "claude plugin install engineering-paved-path@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-30",
      "frontmatter": { "name": "react-best-practices", "description": "React and TypeScript conventions: components, hooks, state, accessibility and performance." },
      "files": ["plugins/engineering-paved-path/skills/react-best-practices/references/hooks.md"]
    },
    {
      "id": "research-tools:agent:researcher", "type": "agent", "name": "researcher",
      "qualifiedName": "research-tools:researcher", "plugin": "research-tools", "version": "1.0.1",
      "description": "Researches a question across web sources and returns a cited summary.",
      "keywords": ["research", "docs", "web"],
      "path": "plugins/research-tools/agents/researcher.md",
      "bodyRef": "bodies/research-tools/agent/researcher.md", "bodyFormat": "markdown",
      "searchText": "You are a research assistant…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install research-tools@test-ai-marketplace", "cliProject": "claude plugin install research-tools@test-ai-marketplace --scope project", "cliUser": "claude plugin install research-tools@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-12",
      "tools": ["WebSearch", "WebFetch", "Read"], "model": "sonnet",
      "frontmatter": { "name": "researcher", "description": "Researches a question across web sources and returns a cited summary.", "tools": ["WebSearch", "WebFetch", "Read"], "model": "sonnet" }
    },
    {
      "id": "research-tools:mcp:mcp-servers", "type": "mcp", "name": "mcp-servers",
      "qualifiedName": "research-tools:mcp-servers", "plugin": "research-tools", "version": "1.0.1",
      "description": "MCP servers: docs-fetch.",
      "keywords": ["research", "docs", "web", "docs-fetch"],
      "path": "plugins/research-tools/.mcp.json",
      "bodyRef": "bodies/research-tools/mcp/mcp-servers.json", "bodyFormat": "json",
      "searchText": "docs-fetch", "source": "local", "executesCode": true,
      "installCommands": { "chat": "/plugin install research-tools@test-ai-marketplace", "cliProject": "claude plugin install research-tools@test-ai-marketplace --scope project", "cliUser": "claude plugin install research-tools@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-12",
      "servers": [ { "name": "docs-fetch", "transport": "stdio", "command": "node", "url": null } ]
    },
    {
      "id": "research-tools:skill:literature-review", "type": "skill", "name": "literature-review",
      "qualifiedName": "research-tools:literature-review", "plugin": "research-tools", "version": "1.0.1",
      "description": "Survey papers and articles on a topic and synthesize findings into a literature review.",
      "keywords": ["research", "docs", "web", "papers"],
      "path": "plugins/research-tools/skills/literature-review/SKILL.md",
      "bodyRef": "bodies/research-tools/skill/literature-review.md", "bodyFormat": "markdown",
      "searchText": "Literature review. Collect sources, extract claims…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install research-tools@test-ai-marketplace", "cliProject": "claude plugin install research-tools@test-ai-marketplace --scope project", "cliUser": "claude plugin install research-tools@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-12",
      "frontmatter": { "name": "literature-review", "description": "Survey papers and articles on a topic and synthesize findings into a literature review." },
      "files": []
    },
    {
      "id": "research-tools:skill:web-research", "type": "skill", "name": "web-research",
      "qualifiedName": "research-tools:web-research", "plugin": "research-tools", "version": "1.0.1",
      "description": "Research a question on the web, cross-check sources and cite them.",
      "keywords": ["research", "docs", "web"],
      "path": "plugins/research-tools/skills/web-research/SKILL.md",
      "bodyRef": "bodies/research-tools/skill/web-research.md", "bodyFormat": "markdown",
      "searchText": "Web research. Plan queries, open sources…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install research-tools@test-ai-marketplace", "cliProject": "claude plugin install research-tools@test-ai-marketplace --scope project", "cliUser": "claude plugin install research-tools@test-ai-marketplace --scope user" },
      "updatedAt": "2026-09-12",
      "frontmatter": { "name": "web-research", "description": "Research a question on the web, cross-check sources and cite them." },
      "files": []
    },
    {
      "id": "sdd-engineering:agent:spec-reviewer", "type": "agent", "name": "spec-reviewer",
      "qualifiedName": "sdd-engineering:spec-reviewer", "plugin": "sdd-engineering", "version": "1.0.0",
      "description": "Reviews a specification for testable requirements, gaps and contradictions.",
      "keywords": ["sdd", "spec", "planning", "review"],
      "path": "plugins/sdd-engineering/agents/spec-reviewer.md",
      "bodyRef": "bodies/sdd-engineering/agent/spec-reviewer.md", "bodyFormat": "markdown",
      "searchText": "You review specifications…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install sdd-engineering@test-ai-marketplace", "cliProject": "claude plugin install sdd-engineering@test-ai-marketplace --scope project", "cliUser": "claude plugin install sdd-engineering@test-ai-marketplace --scope user" },
      "updatedAt": "2026-10-10",
      "tools": null, "model": null,
      "frontmatter": { "name": "spec-reviewer", "description": "Reviews a specification for testable requirements, gaps and contradictions." }
    },
    {
      "id": "sdd-engineering:command:spec", "type": "command", "name": "spec",
      "qualifiedName": "sdd-engineering:spec", "plugin": "sdd-engineering", "version": "1.0.0",
      "description": "Start a new specification from a one-line idea.",
      "keywords": ["sdd", "spec", "planning"],
      "path": "plugins/sdd-engineering/commands/spec.md",
      "bodyRef": "bodies/sdd-engineering/command/spec.md", "bodyFormat": "markdown",
      "searchText": "Create a spec for $ARGUMENTS…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install sdd-engineering@test-ai-marketplace", "cliProject": "claude plugin install sdd-engineering@test-ai-marketplace --scope project", "cliUser": "claude plugin install sdd-engineering@test-ai-marketplace --scope user" },
      "updatedAt": "2026-10-10",
      "argumentHint": "<idea>",
      "frontmatter": { "description": "Start a new specification from a one-line idea.", "argument-hint": "<idea>" }
    },
    {
      "id": "sdd-engineering:skill:sdd-workflow", "type": "skill", "name": "sdd-workflow",
      "qualifiedName": "sdd-engineering:sdd-workflow", "plugin": "sdd-engineering", "version": "1.0.0",
      "description": "Spec-driven development workflow: spec, plan, tasks, implementation, review gates.",
      "keywords": ["sdd", "spec", "planning", "workflow"],
      "path": "plugins/sdd-engineering/skills/sdd-workflow/SKILL.md",
      "bodyRef": "bodies/sdd-engineering/skill/sdd-workflow.md", "bodyFormat": "markdown",
      "searchText": "SDD workflow. Phase 1: specify…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install sdd-engineering@test-ai-marketplace", "cliProject": "claude plugin install sdd-engineering@test-ai-marketplace --scope project", "cliUser": "claude plugin install sdd-engineering@test-ai-marketplace --scope user" },
      "updatedAt": "2026-10-10",
      "frontmatter": { "name": "sdd-workflow", "description": "Spec-driven development workflow: spec, plan, tasks, implementation, review gates." },
      "files": []
    },
    {
      "id": "sdd-engineering:skill:spec-writing", "type": "skill", "name": "spec-writing",
      "qualifiedName": "sdd-engineering:spec-writing", "plugin": "sdd-engineering", "version": "1.0.0",
      "description": "Write a testable specification with numbered requirements and Given/When/Then criteria.",
      "keywords": ["sdd", "spec", "planning", "requirements"],
      "path": "plugins/sdd-engineering/skills/spec-writing/SKILL.md",
      "bodyRef": "bodies/sdd-engineering/skill/spec-writing.md", "bodyFormat": "markdown",
      "searchText": "Spec writing. Number every requirement…", "source": "local", "executesCode": false,
      "installCommands": { "chat": "/plugin install sdd-engineering@test-ai-marketplace", "cliProject": "claude plugin install sdd-engineering@test-ai-marketplace --scope project", "cliUser": "claude plugin install sdd-engineering@test-ai-marketplace --scope user" },
      "updatedAt": "2026-10-10",
      "frontmatter": { "name": "spec-writing", "description": "Write a testable specification with numbered requirements and Given/When/Then criteria." },
      "files": []
    }
  ]
}
```

An additional fixture for the **External** state (not part of the 21 items of the golden set; a separate file `site/src/fixtures/index.external.json` for design):

```json
{
  "id": "community-linters", "type": "plugin", "name": "community-linters", "qualifiedName": "community-linters",
  "plugin": "community-linters", "version": null,
  "description": "Linting skills maintained by a third party.",
  "keywords": ["lint", "quality"],
  "path": null, "bodyRef": null, "bodyFormat": null, "searchText": "", "source": "external", "executesCode": false,
  "installCommands": { "chat": "/plugin install community-linters@test-ai-marketplace", "cliProject": "claude plugin install community-linters@test-ai-marketplace --scope project", "cliUser": "claude plugin install community-linters@test-ai-marketplace --scope user" },
  "updatedAt": null, "owner": null, "license": null, "homepage": null, "repository": null, "compatibility": null,
  "dependencies": [], "usedBy": [],
  "components": { "skill": [], "agent": [], "command": [], "hook": [], "mcp": [] },
  "bin": [], "readmeRef": null, "changelogRef": null, "latestRelease": null,
  "external": { "kind": "github", "url": "https://github.com/example/community-linters", "ref": "v0.3.0", "sha": null, "path": null }
}
```

Fragments of the corresponding `releases.json` and `stats.json` (fixtures):

```json
{ "schemaVersion": "1.0", "generatedAt": "2026-10-19T12:00:00Z", "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  "releases": [
    { "id": "sdd-engineering@1.0.0", "plugin": "sdd-engineering", "version": "1.0.0", "date": "2026-10-10", "tag": "sdd-engineering--v1.0.0", "commit": "…", "notesMarkdown": "### Added\n- Initial release: spec-writing, sdd-workflow, spec-reviewer, /spec.", "origin": "changelog+tag" },
    { "id": "engineering-paved-path@1.2.0", "plugin": "engineering-paved-path", "version": "1.2.0", "date": "2026-09-30", "tag": "engineering-paved-path--v1.2.0", "commit": "…", "notesMarkdown": "### Added\n- commit-conventions skill.\n### Changed\n- code-review checklist covers security.", "origin": "changelog+tag" }
  ] }
```

```json
{ "schemaVersion": "1.0", "generatedAt": "2026-10-19T12:00:00Z", "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  "counts": { "plugins": 4, "pluginsLocal": 4, "pluginsExternal": 0, "skills": 9, "agents": 4, "commands": 2, "hooks": 1, "hookEvents": 2, "mcp": 1, "releases": 6 } }
```

(6 releases = 5 tags + `engineering-paved-path` 1.1.0, which exists only in the changelog, `origin: "changelog"`.)

### 12.2 Example `llms.txt` (fixtures)

```markdown
# test-ai-marketplace

> Personal Claude Code plugin marketplace — plugins extracted from DevDigest. Plugins bundle skills, agents, commands, hooks and MCP servers. Installing a plugin installs all of its components.

Add the marketplace: `claude plugin marketplace add artemmmon/test-ai-marketplace` (chat: `/plugin marketplace add artemmmon/test-ai-marketplace`).
Install a plugin: `claude plugin install <plugin>@test-ai-marketplace --scope project|user` (chat: `/plugin install <plugin>@test-ai-marketplace`).
Plugins marked "executes code" contain hooks, MCP servers or bin/ executables.

## Catalog

- [catalog.json](https://artemmmon.github.io/test-ai-marketplace/catalog.json): machine-readable catalog, schemaVersion 1.0.0

## Plugins

- [architecture-review](https://artemmmon.github.io/test-ai-marketplace/#/plugin/architecture-review): Architecture review workflow: ADRs, trade-off analysis and a reviewer agent. (v1.0.0; depends on engineering-paved-path ^1.0.0)
  - [skill architecture-review:adr-writing](https://artemmmon.github.io/test-ai-marketplace/bodies/architecture-review/skill/adr-writing.md): Write Architecture Decision Records with context, options and consequences.
  - [skill architecture-review:architecture-review](https://artemmmon.github.io/test-ai-marketplace/bodies/architecture-review/skill/architecture-review.md): Run a structured architecture review.
  - [agent architecture-review:architecture-reviewer](https://artemmmon.github.io/test-ai-marketplace/bodies/architecture-review/agent/architecture-reviewer.md): Reviews a proposed architecture for risks, trade-offs and missing ADRs.
- [engineering-paved-path](https://artemmmon.github.io/test-ai-marketplace/#/plugin/engineering-paved-path): Team engineering conventions: React best practices, code review, commit conventions and guard hooks. (v1.2.0; executes code: hooks)
  - [skill engineering-paved-path:code-review](https://artemmmon.github.io/test-ai-marketplace/bodies/engineering-paved-path/skill/code-review.md): Code review checklist for pull requests.
  - …
- [research-tools](https://artemmmon.github.io/test-ai-marketplace/#/plugin/research-tools): Web and literature research skills with a docs-fetching MCP server. (v1.0.1; executes code: MCP)
  - …
- [sdd-engineering](https://artemmmon.github.io/test-ai-marketplace/#/plugin/sdd-engineering): Spec-driven development. (v1.0.0; depends on engineering-paved-path ^1.0.0, research-tools ^1.0.0, architecture-review ^1.0.0)
  - …

## Optional

- [releases.json](https://artemmmon.github.io/test-ai-marketplace/releases.json): release history
- [feed.xml](https://artemmmon.github.io/test-ai-marketplace/feed.xml): Atom feed of releases
```

(The real file has no "…" — all components are listed.)

### 12.3 Wireframes (ASCII)

**`/search` — desktop (≥ 1024)**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [■] test-ai-marketplace   [ Search plugins, skills, agents…      (/) ]  Search  What's new  Getting started  [☾] [GH] │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 мені треба скіл для код-рев'ю                                        [×] │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│ FILTERS           │ 3 results for "мені треба скіл для код-рев'ю"                │
│                   │ [Only skills ✓?]  Active: (none)          Sort: [Relevance ▾]│
│ Type              │ ┌──────────────────────────┐ ┌──────────────────────────┐    │
│ [x] Skill     (2) │ │ [✦ Skill]                │ │ [✦ Skill]                │    │
│ [ ] Agent     (1) │ │ engineering-paved-path:  │ │ research-tools:          │    │
│ [ ] Command   (1) │ │ «code-review»            │ │ literature-«review»      │    │
│ [ ] Plugin    (1) │ │ in engineering-paved-path│ │ in research-tools ·v1.0.1│    │
│ [ ] Hook      (0) │ │ · v1.2.0                 │ │ Survey papers and…       │    │
│ [ ] MCP       (0) │ │ Code «review» checklist  │ │ #research #papers        │    │
│                   │ │ for pull requests: …     │ │                          │    │
│ Plugin            │ │ #review #pull-request +2 │ │                          │    │
│ ( ) All           │ │ [Copy install] [View] [GH]│ │ [Copy install][View][GH] │    │
│ ( ) engineering…  │ └──────────────────────────┘ └──────────────────────────┘    │
│ ( ) research-tools│ ┌──────────────────────────┐                                 │
│                   │ │ [⚙ Agent]                │                                 │
│ Tag               │ │ engineering-paved-path:  │                                 │
│ [ ] review    (3) │ │ code-reviewer            │                                 │
│ [ ] react     (1) │ │ …                        │                                 │
│ Show all          │ └──────────────────────────┘                                 │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Catalog generated 2026-10-19 from a1b2c3d · catalog.json · llms.txt · feed.xml · Report an issue │
└──────────────────────────────────────────────────────────────────────────────────┘
«…» = <mark> highlighting
```

**`/search` — mobile (< 640)**

```
┌─────────────────────────────┐
│ [■] test-ai-marketplace [≡] │
│ [ 🔍 code review       [×] ]│
├─────────────────────────────┤
│ 3 results     [Filters (1)] │
│ Sort: [Relevance ▾]         │
│ ┌─────────────────────────┐ │
│ │ [✦ Skill]               │ │
│ │ engineering-paved-path: │ │
│ │ «code-review»           │ │
│ │ in engineering-paved-   │ │
│ │ path · v1.2.0           │ │
│ │ Code «review» checklist │ │
│ │ for pull requests…      │ │
│ │ #review #pull-request   │ │
│ │ [Copy install] [View] ⧉ │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ …                       │ │
└─────────────────────────────┘
```

**`/plugin/<name>` — desktop**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ header                                                                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Search › sdd-engineering                                                         │
│ sdd-engineering                       [▣ Plugin] [v1.0.0]                        │
│ Spec-driven development: write specs, plan, review — built on …                  │
│ [GitHub] [Report an issue]                                                       │
├───────────────────────────────────────────────────────┬──────────────────────────┤
│ INSTALL                     ( In chat | In terminal ) │ Version   1.0.0          │
│ 1  Add the marketplace (once)                         │ Owner     artemmmon      │
│    ┌───────────────────────────────────────┐ [Copy]   │ License   MIT            │
│    │ /plugin marketplace add artemmmon/…   │          │ Compat.   Not specified  │
│    └───────────────────────────────────────┘          │ Source    plugins/sdd-…  │
│ 2  Install the plugin              [project|user]*    │ Released  1.0.0 · 2026-  │
│    ┌───────────────────────────────────────┐ [Copy]   │           10-10 · tag ↗  │
│    │ /plugin install sdd-engineering@test-…│          │ Keywords  #sdd #spec …   │
│    └───────────────────────────────────────┘          │                          │
│ Installs the whole plugin with all its components.    │ (*scope: terminal only)  │
│ ⚠ Dependencies execute code: engineering-paved-path   │                          │
│   (hooks), research-tools (MCP)                       │                          │
├───────────────────────────────────────────────────────┤                          │
│ DEPENDENCIES                                          │                          │
│ Name                     Required  Resolved  Status   │                          │
│ engineering-paved-path   ^1.0.0    1.2.0     ✓ Satisfied                          │
│ research-tools           ^1.0.0    1.0.1     ✓ Satisfied                          │
│ architecture-review      ^1.0.0    1.0.0     ✓ Satisfied                          │
│ ▸ Dependency tree                                     │                          │
│   sdd-engineering                                     │                          │
│   ├─ engineering-paved-path 1.2.0                     │                          │
│   ├─ research-tools 1.0.1                             │                          │
│   └─ architecture-review 1.0.0                        │                          │
│      └─ engineering-paved-path 1.2.0                  │                          │
│ Used by: —                                            │                          │
├───────────────────────────────────────────────────────┤                          │
│ CONTENTS  [Skills (2)] [Agents (1)] [Commands (1)]    │                          │
│ ▸ sdd-engineering:sdd-workflow   Spec-driven dev…  ↗  │                          │
│ ▾ sdd-engineering:spec-writing   Write a testable… ↗  │                          │
│   ┌─────────────────────────────────────────────────┐ │                          │
│   │ (rendered SKILL.md)                             │ │                          │
│   └─────────────────────────────────────────────────┘ │                          │
├───────────────────────────────────────────────────────┤                          │
│ README  (rendered markdown)                           │                          │
├───────────────────────────────────────────────────────┤                          │
│ CHANGELOG   1.0.0 · 2026-10-10 · …   [Show all releases]                          │
└───────────────────────────────────────────────────────┴──────────────────────────┘
```

**`/artifact/<id>` — desktop (abridged)**

```
Search › engineering-paved-path › Hooks › hooks
engineering-paved-path:hooks   [⚓ Hook] [⚠ Executes code]   in engineering-paved-path v1.2.0
[Copy install]  [GitHub]  [Report an issue]          Installs the whole plugin
┌ ⚠ This code runs on your machine outside Claude's permission rules. Read it before installing. ┐
Events: PreToolUse · PostToolUse
┌──────────────────────────────────────────── hooks.json ─────────── [Copy] ┐
│ { "hooks": { "PreToolUse": [ … ] } }                                      │
└───────────────────────────────────────────────────────────────────────────┘
More from engineering-paved-path: [code-review] [react-best-practices] [code-reviewer] …
```
