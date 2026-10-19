# Catalog site

Static catalog for the `test-ai-marketplace` Claude Code marketplace: search plugins and their skills, agents, commands, hooks and MCP servers, read them and copy the install command. It lives in `site/` so that it stays separate from the marketplace itself (`plugins/`, `.claude-plugin/`, `scripts/`).

- Spec: [`docs/specs/site.md`](../docs/specs/site.md)
- Design: [`docs/design/`](../docs/design/) (the `.dc.html` boards are the visual reference)
- Target URL: https://artemmmon.github.io/test-ai-marketplace/

Stack: React + TypeScript + Vite, hash routing (`react-router` `HashRouter`), MiniSearch, marked + DOMPurify (lazy chunk), self-hosted fonts from `@fontsource-variable` (JetBrains Mono, Schibsted Grotesk). No backend, no analytics, no CDN.

## Run

Node 20.19 or newer (CI uses Node 22).

```sh
cd site
npm ci
npm run dev       # http://localhost:5173/test-ai-marketplace/
npm run build     # typecheck + vite build + scripts/check-dist.mjs → site/dist/
npm run preview   # http://localhost:4173/test-ai-marketplace/ (serves site/dist)
npm test          # Vitest: query parsing and the golden search set (spec FR-91)
```

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

## Data and fixtures

The site reads, relative to `import.meta.env.BASE_URL`:

- `index.json` once per session (search index, spec §4.3);
- `bodies/<plugin>/…` on demand (README, CHANGELOG, COMPATIBILITY, skill/agent/command bodies, hooks/MCP JSON);
- `releases.json` on What's new and the plugin changelog; `stats.json` is shipped for agents and future use.

`scripts/build-index.mjs` does not exist yet, so `site/public/` holds **fictitious demo fixtures** taken from spec §12.1: four lab plugins (`engineering-paved-path`, `research-tools`, `architecture-review`, `sdd-engineering`) and one external plugin (`community-linters`). `index.json` has `"fixture": true`, and while it does the UI shows the banner "Demo data — the real catalog is not indexed yet". Commit SHAs and GitHub links in the fixtures point at commits and tags that do not exist.

If `index.json` contains no plugins, the search page shows the empty-catalog state from the design.

When the generator lands it will write the same files into `site/public/` and they should become gitignored (spec FR-73); delete the fixtures then.

## Base path

GitHub Pages serves a project site from `/test-ai-marketplace/`, so `vite.config.ts` sets `base: '/test-ai-marketplace/'`. Every data URL goes through `asset()` in `src/data/catalog.ts` (`BASE_URL + path`); `index.html` uses `%BASE_URL%` for files in `public/`. There are no root-absolute paths. Routing uses the hash, so Pages needs no `404.html` fallback.

`scripts/check-dist.mjs` runs after `vite build` and fails the build if `dist/index.html` references a path outside the base, if a bundle calls `fetch("/…")` or mentions Google Fonts, or if the data files are missing. It also checks the gzip budgets from NFR-20. With `REQUIRE_REAL_DATA=1` it fails on fixture data (for later, once real data exists).

The production build gets a `Content-Security-Policy` meta tag (spec NFR-41): scripts, styles, fonts and data only from the same origin. Assets are never inlined as `data:` URIs for that reason. The theme is applied before first paint by `public/theme-init.js` (external, because inline scripts are blocked); the choice is stored in `localStorage` key `tam-theme`, dark by default.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml`:

- pull request into `main`: `npm ci`, `npm test`, `npm run build` (check only);
- push to `main` or manual run: the same build, then `actions/configure-pages`, `actions/upload-pages-artifact` (`site/dist`) and `actions/deploy-pages`.

The repository owner has to do two things before the first deploy:

1. Make the repository public (Pages on a private repo needs a paid plan).
2. Settings → Pages → Source: **GitHub Actions**.

Optionally create the `site-feedback` label used by "Report an issue" links.

## Not done yet

- `scripts/build-index.mjs` and real data from `marketplace.json` and `plugins/` (the next lab step); until then the fixtures are deployed.
- Releases from git tags (`releases.json` is a hand-written fixture).
- `catalog.json`, `llms.txt` and `feed.xml`: not generated yet, so the site does not link to them (footer, Getting started "For agents" block, What's new "Subscribe" button). Restore the links when `build-index` produces the files.
- Playwright e2e smoke tests (spec FR-95) and the separate `build.yml` / `ci.yml` workflows from spec §8.2.
- Tablet layout and the mobile filter panel were not designed; both use a full-screen filter panel below 1024 px.
