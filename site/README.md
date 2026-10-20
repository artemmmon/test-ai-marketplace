# Catalog site

Static catalog for the `test-ai-marketplace` Claude Code marketplace: search plugins and their skills, agents, commands, hooks and MCP servers, read them and copy the install command. It lives in `site/` so that it stays separate from the marketplace itself (`plugins/`, `.claude-plugin/`, `scripts/`).

- Spec: [`docs/specs/site.md`](../docs/specs/site.md)
- Design: [`docs/design/`](../docs/design/) (the `.dc.html` boards are the visual reference)
- Target URL: https://artemmmon.github.io/test-ai-marketplace/

Stack: React + TypeScript + Vite, hash routing (`react-router` `HashRouter`), MiniSearch, marked + DOMPurify (lazy chunk), self-hosted fonts from `@fontsource-variable` (JetBrains Mono, Schibsted Grotesk). No backend, no analytics, no CDN.

## Run

Node 20.19 or newer (CI uses Node 22).

The catalog data is generated, not committed. Run the generator from the repository root **before** `dev` or `build`:

```sh
npm run build:index    # repo root: validate the catalog, write site/public/{index,catalog,releases,stats}.json, llms.txt, feed.xml, bodies/
cd site
npm ci
npm run dev       # http://localhost:5173/test-ai-marketplace/
npm run build     # typecheck + vite build + scripts/check-dist.mjs → site/dist/
npm run preview   # http://localhost:4173/test-ai-marketplace/ (serves site/dist)
npm test          # Vitest: query parsing, the golden search set (spec FR-91) and the i18n guards; needs no generated data
```

`npm run dev` and `npm run build` first run `scripts/require-data.mjs`, which stops with a message if the generated files are missing; `scripts/check-dist.mjs` repeats the check on `dist/`. `npm run build:index:fixtures` (repo root) writes the fictitious demo catalog instead.

## Routes

| Hash | Screen |
|---|---|
| `#/` | redirects to `#/search` |
| `#/search?q=&type=&plugin=&tag=&sort=` | search with filters; the URL is the state, so links can be shared |
| `#/plugin/<name>?tab=` | plugin page: install, dependencies, contents, README, changelog |
| `#/artifact/<plugin>:<type>:<name>` | one component; `#/artifact/<plugin>:<name>` redirects when unambiguous |
| `#/whats-new?plugin=&release=` | releases feed |
| `#/getting-started` | how to add the marketplace and install a plugin |
| anything else | 404 |

`What's new` and the 404 page are not in the design boards; they reuse the same tokens and components (narrow column of the Getting started board, empty-state layout of the EmptyCatalog board).

## Data

The site reads, relative to `import.meta.env.BASE_URL`:

- `index.json` once per session (search index, spec §4.3);
- `bodies/<plugin>/…` on demand (README, CHANGELOG, COMPATIBILITY, skill/agent/command bodies, hooks/MCP JSON);
- `releases.json` on What's new and the plugin changelog; `stats.json` is shipped for agents and future use.

`scripts/build-index.mjs` (repo root) writes these files and `catalog.json`, `llms.txt`, `feed.xml` into `site/public/`. They are gitignored (spec FR-73), so a fresh checkout has to run `npm run build:index` first (see Run). The catalog's only source is `.claude-plugin/marketplace.json` and `plugins/`; tools and skills used to develop the marketplace (for example `.claude/`) are never catalog content. With an empty `plugins[]` the site shows the empty-catalog state from the design.

The fictitious demo data from spec §12.1 (four lab plugins and one external plugin) lives in `site/test-fixtures/` and is used only by the unit tests (`src/search/search.test.ts`, golden query set). It is not copied into the build. `scripts/__fixtures__/` in the repo root is the file tree the generator turns into the same demo catalog.

## Base path

GitHub Pages serves a project site from `/test-ai-marketplace/`, so `vite.config.ts` sets `base: '/test-ai-marketplace/'`. Every data URL goes through `asset()` in `src/data/catalog.ts` (`BASE_URL + path`); `index.html` uses `%BASE_URL%` for files in `public/`. There are no root-absolute paths. Routing uses the hash, so Pages needs no `404.html` fallback.

`scripts/check-dist.mjs` runs after `vite build` and fails the build if `dist/index.html` references a path outside the base, if a bundle calls `fetch("/…")` or mentions Google Fonts, or if the data files are missing. It also checks the gzip budgets from NFR-20 and that all six generated data files made it into `dist/`. With `REQUIRE_REAL_DATA=1` it fails on fixture data.

The production build gets a `Content-Security-Policy` meta tag (spec NFR-41): scripts, styles, fonts and data only from the same origin. Assets are never inlined as `data:` URIs for that reason. The theme is applied before first paint by `public/theme-init.js` (external, because inline scripts are blocked); the choice is stored in `localStorage` key `tam-theme`, dark by default.

## Translations

All UI text lives in one file, `src/i18n/en.ts`, grouped by screen or component (`header`, `search`, `plugin`, `badges`, `toast`, `common`, ...). Components never contain copy: they call `t('group.key')` or `plural('group.key', count)` from `src/i18n`. The UI is English only; localization is a non-goal (spec §1), so there is no language switcher, but `messages` in `src/i18n/index.ts` is the single place that points at the active table.

Adding a string:

1. Add it to `src/i18n/en.ts` under the right group. Values are plain strings. `{name}` is an interpolation placeholder: `t('card.viewLabel', { name })`. Plurals are `{ one, other }` objects read with `plural(key, count)`; `{count}` is filled in automatically. Rich text with inline code or links is split into fragments (`beforeBin`, `afterBin`, ...) that the component joins around the element, so the file has no JSX or HTML.
2. Use it: `t('...')` takes only existing keys and the params its placeholders require, so a typo is a TypeScript error (`npm run typecheck`).

Stays in code: technical literals (CSS classes, routes, storage keys, URL templates, command syntax such as `claude plugin install <plugin>@<marketplace>`, file names, ids), the brand name `test-ai-marketplace`, and anything that comes from the catalog JSON or README Markdown (that is content). The search stemmer, stop words and synonyms in `src/search/` are search data, not UI text.

Guards (run by `npm test`):

- `src/i18n/no-hardcoded-text.test.ts` parses every `.tsx` in `components/`, `routes/`, `app/` and `App.tsx`, and fails with `file:line` for JSX text with letters, a literal in `title`, `aria-label`, `aria-description`, `placeholder`, `alt` or `label`, a literal child expression such as `{'Hello'}`, and a literal message passed to `toast`/`show`-style calls. Its small `ALLOWED_TEXT` list holds technical tokens only (the brand name, `bin/`). It uses the TypeScript 7 `typescript/unstable/*` syntax tree API, because TypeScript 7 no longer ships `ts.createSourceFile`.
- `src/i18n/unused-messages.test.ts` fails on a message nobody uses, on HTML/JSX inside a message, and on plural forms with different placeholders.
- `src/i18n/index.test.ts` covers `t`/`plural` and checks that wrong keys and missing params do not compile.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` has three jobs, `checks` (typecheck, site tests, root script tests), `build` (`node scripts/build-index.mjs`, `vite build`, `check-dist.mjs`) and `deploy`:

- pull request into `main`: `checks` and `build` (check only, nothing is published);
- push to `main`, a pushed release tag `<plugin>--v<version>` or a manual run: the same build from `main`, then `actions/configure-pages`, `actions/upload-pages-artifact` (`site/dist`) and `actions/deploy-pages`.

The repository owner has to do two things before the first deploy:

1. Make the repository public (Pages on a private repo needs a paid plan).
2. Settings → Pages → Source: **GitHub Actions**.

Optionally create the `site-feedback` label used by "Report an issue" links.

## Not done yet

- `catalog.json`, `llms.txt` and `feed.xml` are generated and deployed, but the site does not link to them yet (footer, Getting started "For agents" block, What's new "Subscribe" button). Restore the links when the design adds them.
- Playwright e2e smoke tests (spec FR-95) and the separate `build.yml` / `ci.yml` / `validate.yml` workflows from spec §8.2.
- Tablet layout and the mobile filter panel were not designed; both use a full-screen filter panel below 1024 px.
