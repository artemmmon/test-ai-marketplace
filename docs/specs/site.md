# Специфікація: статичний каталог-сайт для `test-ai-marketplace`

| | |
|---|---|
| Статус | Draft v1 — основа для дизайну (Claude Design) і реалізації |
| Дата | 2026-10-19 |
| Репо | https://github.com/artemmmon/test-ai-marketplace (гілка `main`) |
| Цільовий URL | `https://artemmmon.github.io/test-ai-marketplace/` |
| Контекст | GoIT, L08 «Hands-On Lab — Cost Surgery», крок 6 |

Нотація: **FR-n** — функційна вимога, **NFR-n** — нефункційна, **US-n** — сценарій користувача, **A-n** — припущення, **Q-n** — відкрите питання. Слова «MUST / має» означають обов'язкову вимогу MVP, «SHOULD / бажано» — рекомендацію.

## Зміст

1. [Мета, не-цілі, аудиторія, сценарії](#1-мета-не-цілі-аудиторія-сценарії)
2. [Передумови й обмеження](#2-передумови-й-обмеження)
3. [Архітектура](#3-архітектура)
4. [Модель даних](#4-модель-даних)
5. [Пошук](#5-пошук)
6. [Екрани й компоненти](#6-екрани-й-компоненти)
7. [Нефункційні вимоги](#7-нефункційні-вимоги)
8. [Збірка й деплой](#8-збірка-й-деплой)
9. [Тестування й acceptance](#9-тестування-й-acceptance)
10. [Фазування](#10-фазування)
11. [Припущення й відкриті питання](#11-припущення-й-відкриті-питання)
12. [Додатки](#12-додатки)

---

## 0. Стан репо: «є зараз» vs «має бути»

| Елемент | Є зараз | Має бути (ця специфікація) |
|---|---|---|
| `.claude-plugin/marketplace.json` | `name: test-ai-marketplace`, `owner.name: artemmmon`, `plugins: []` | Без змін схеми; наповнюється плагінами окремо від сайту |
| `plugins/` | лише `.gitkeep` | `plugins/<name>/…` за структурою з `README.md` |
| `scripts/check-marketplace.mjs` | самодостатній Node ESM-скрипт без залежностей (sort/dup/name regex/hidden Unicode/pinning external/`plugin.json` name+version/SKILL.md frontmatter `name`) | тонка CLI-обгортка над спільним модулем `scripts/lib/marketplace.mjs` (FR-12) |
| `scripts/build-index.mjs` | немає | генератор даних сайту (§3, §4) |
| `package.json` у корені | немає | з npm-скриптами, **без залежностей** (FR-14) |
| `site/` | немає | React + TypeScript + Vite застосунок |
| `.github/workflows/` | немає | `build.yml` (reusable), `ci.yml` (PR), `pages.yml` (deploy) |
| `.gitignore` | `.DS_Store`, `node_modules/` | + згенеровані файли (FR-73) |
| Видимість репо | приватне (`README.md` описує `gh auth setup-git`) | публічне — дія користувача, передумова деплою (§2) |

Оскільки каталог порожній, дизайн і тести спираються на **фіктивні fixtures** (§12.1). Сайт MUST коректно працювати і з порожнім реальним каталогом (FR-55).

---

## 1. Мета, не-цілі, аудиторія, сценарії

### 1.1 Мета

Дати людям і агентам **discovery** для плагінів marketplace: знайти плагін або вкладений компонент (skill, agent, command, hook, MCP), прочитати його повний вміст і скопіювати точну команду встановлення. Встановлення лишається в Claude Code (chat `/plugin …` або CLI `claude plugin …`).

### 1.2 Не-цілі (non-goals)

- Backend, API, бази даних, серверний рендеринг.
- Рейтинги, коментарі, лічильники завантажень/встановлень, аналітика, акаунти, логін.
- Встановлення з браузера (кнопка лише копіює команду).
- Checkout і індексація коду зовнішніх плагінів.
- Семантичний/embedding-пошук.
- SEO-індексація окремих сторінок (hash routing, див. NFR-30).
- Локалізація UI (UI англійською).

### 1.3 Аудиторія

| Аудиторія | Що потрібно |
|---|---|
| Розробник-користувач Claude Code (UA/EN) | знайти skill під задачу, оцінити ризик (виконує код?), скопіювати команду |
| Мейнтейнер marketplace (власник репо) | бачити, що каталог валідний і задеплоєний; ділитися посиланнями |
| AI-агент | машиночитний каталог `catalog.json` + `llms.txt` |
| Рев'юер безпеки | прочитати hooks, `.mcp.json`, `bin/` до встановлення |

### 1.4 Сценарії користувача

Ключові сценарії (Given/When/Then). Результати наведені для fixtures з §12.1.

**US-1. «Мені треба скіл для код-рев'ю» (UA).**
- Given сайт завантажено з fixtures,
- When користувач вводить у пошук `мені треба скіл для код-рев'ю`,
- Then першим результатом є skill `engineering-paved-path:code-review`; шаблонна фраза «мені треба» і стоп-слово «для» ігноруються; слово «скіл» розпізнане як тип `skill` (буст + чип «Only skills», FR-38); у назві підсвічено `code-review`.

**US-2. «I need a skill for code review» (EN).**
- Given те саме,
- When запит `I need a skill for code review`,
- Then топ-1 — той самий skill, що в US-1.

**US-3. Деталі плагіна.**
- Given користувач на картці плагіна `sdd-engineering`,
- When натискає **View**,
- Then відкривається `#/plugin/sdd-engineering` з `version` = `1.0.0` (як у `plugin.json`), трьома залежностями (`engineering-paved-path ^1.0.0`, `research-tools ^1.0.0`, `architecture-review ^1.0.0`) зі статусом «satisfied» і resolved-версією, складом за типами, README і changelog.

**US-4. Copy install.**
- Given картка або сторінка плагіна `engineering-paved-path`,
- When користувач натискає **Copy install** (режим «In chat»),
- Then у буфер обміну потрапляє рівно `/plugin install engineering-paved-path@test-ai-marketplace` (без пробілів на кінцях), з'являється toast «Copied» і анонс для screen reader.
- And у режимі «In terminal» зі scope `user` копіюється `claude plugin install engineering-paved-path@test-ai-marketplace --scope user`.

**US-5. Deep-link.**
- Given користувач відфільтрував пошук (`q=review`, `type=skill`),
- When копіює URL і відкриває його в новій вкладці,
- Then URL має вигляд `…/test-ai-marketplace/#/search?q=review&type=skill`, і стан пошуку (рядок, фільтри, результати) відновлено.

**US-6. Що нового.** Given у fixtures є релізи, When користувач відкриває `#/whats-new`, Then бачить стрічку релізів (нові зверху) з версією, датою, тегом `<plugin>--v<semver>` і нотатками з `CHANGELOG.md`, а також посилання на Atom-фід `feed.xml`.

**US-7. Перший запуск.** Given новий користувач, When відкриває `#/getting-started`, Then бачить кроки: додати marketplace, встановити плагін, оновлювати; кожна команда має кнопку Copy.

**US-8. Агент читає каталог.** Given агент знає URL сайту, When завантажує `llms.txt`, Then знаходить посилання на `catalog.json` і повні тексти компонентів (`bodies/…`) з абсолютними URL; `catalog.json` містить `schemaVersion`.

**US-9. Перевірка безпеки.** Given плагін має hooks, When користувач відкриває його сторінку, Then бачить попередження «Executes code» у шапці, на вкладці Hooks і на картках; вміст `hooks.json` показано як форматований JSON до встановлення.

**US-10. Мейнтейнер ламає каталог.** Given PR, де `plugin.json` name не збігається з записом у `marketplace.json`, When запускається CI, Then job `validate` падає, `build-index`/`build-site` не запускаються, і після merge такого стану deploy не відбувається.

**US-11. Report an issue.** Given користувач на сторінці артефакту, When натискає «Report an issue», Then у новій вкладці відкривається `github.com/artemmmon/test-ai-marketplace/issues/new` з передзаповненим title `[<id>] ` і label (FR-60).

---

## 2. Передумови й обмеження

- **P-1. Репо публічне.** GitHub Pages для приватного репо потребує платного плану, а raw-посилання на файли й `issues/new` мають бути доступні анонімно. Зробити репо публічним — дія користувача до першого deploy. Розділ «Install» у `README.md` (про `gh auth setup-git`) після цього варто спростити — окрема задача, не частина сайту.
- **P-2. Лише статика.** GitHub Pages віддає файли з `site/dist`. Жодних серверних маршрутів, redirect-правил, заголовків (CSP лише через `<meta>`).
- **P-3. Base path** `/test-ai-marketplace/` (Vite `base`). Усі URL ресурсів і даних будуються від `import.meta.env.BASE_URL` (FR-71).
- **P-4. Hash routing** (`#/…`), бо Pages не підтримує SPA-fallback без `404.html`-хаків.
- **P-5. Жодних запитів до GitHub API з браузера** (rate limit, CORS, приватність). Усі дані запікаються в CI в JSON. Браузер робить запити лише до власного origin (+ зображення з `raw.githubusercontent.com`, FR-64).
- **P-6. Свіжість даних = останній deploy.** Сайт показує стан `main` на момент збірки; дата генерації й commit SHA видно у footer.
- **P-7.** Pages settings: *Settings → Pages → Source: GitHub Actions*.

---

## 3. Архітектура

### 3.1 Потік даних

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
 ▼  vite build (site/)  → site/dist/  (public/* копіюється як є)
 │
 ▼  actions/upload-pages-artifact → actions/deploy-pages
 │
 ▼  браузер: fetch index.json (1 раз) → MiniSearch у пам'яті → UI
             fetch bodies/… лише при відкритті деталей (lazy)
```

### 3.2 Структура директорій (має бути)

```
.claude-plugin/marketplace.json
package.json                      # root, без dependencies (FR-14)
scripts/
  check-marketplace.mjs           # CLI-обгортка над lib/marketplace.mjs
  build-index.mjs                 # CLI генератора
  lib/
    marketplace.mjs               # load + validate (спільне з check-marketplace)
    frontmatter.mjs               # zero-dep парсер підмножини YAML (FR-16)
    semver.mjs                    # parse/compare/satisfies (FR-23)
    changelog.mjs                 # парсер CHANGELOG.md (FR-26)
    emit/*.mjs                    # index, catalog, releases, stats, llms, feed
  __fixtures__/repo/              # фіктивний marketplace для тестів і демо (§12.1)
  __fixtures__/tags.json          # фіктивні git-теги для тестів
  test/*.test.mjs                 # node:test
site/
  package.json  vite.config.ts  tsconfig.json  index.html
  public/                         # тут генеруються JSON/bodies (gitignored), + статичні favicon, theme-init.js
  src/
    main.tsx  App.tsx  routes/  components/  data/  search/
    search/synonyms.json  search/stopwords.ts  search/stem-uk.ts  search/query.ts
    types/index.ts                # TS-типи з §4 (джерело правди для фронтенду)
  scripts/check-dist.mjs          # перевірка base path і вмісту dist (FR-72)
  e2e/*.spec.ts                   # Playwright smoke
docs/specs/site.md                # цей документ
.github/workflows/build.yml  ci.yml  pages.yml
```

### 3.3 Генератор і валідатор

- **FR-12.** Логіка `check-marketplace.mjs` виноситься в `scripts/lib/marketplace.mjs` з API `loadMarketplace(root)` → нормалізовані записи плагінів і `validate(root)` → `{ errors: string[], warnings: Warning[] }`. `check-marketplace.mjs` лишається з тим самим CLI-контрактом (аргумент `[marketplace-root]`, exit 1 при помилках, повідомлення `marketplace invariants ok (N plugins)`). Існуючі перевірки не послаблюються.
- **FR-13.** `build-index.mjs` першим кроком викликає `validate()`; при `errors.length > 0` друкує помилки й завершується з кодом 1, **не записуючи** жодного файлу. Відповідно CI не має що деплоїти (US-10).
- **FR-14.** `build-index.mjs` і `scripts/lib/*` — Node ESM **без npm-залежностей** (лише `node:*`), щоб `npm run build:index` працював без `npm ci` у корені, як у лабораторній. Мінімальна версія Node — 20.
- **FR-15.** CLI: `node scripts/build-index.mjs [--root <dir>] [--out <dir>] [--tags-file <json>] [--now <iso>] [--commit <sha>] [--fixture]`. Дефолти: `--root .`, `--out site/public`, теги з `git for-each-ref refs/tags`, `now` = поточний час, `commit` = `$GITHUB_SHA` або `git rev-parse HEAD`. `--fixture` ставить `fixture: true` у мета-даних (FR-72). Перед записом генератор видаляє лише власні виходи (список з FR-73), а не весь `site/public`.
- **FR-16.** Frontmatter парситься zero-dep парсером підмножини YAML: `key: scalar` (рядок без лапок, `"…"`, `'…'`, число, `true/false`), inline-список `[a, b]`, блочний список `- a`, folded/literal `>`/`|`. Будь-що інше → помилка парсингу з файлом і рядком (див. FR-19).
- **FR-17.** Попередження друкуються в stdout, а в GitHub Actions додатково як `::warning file=<path>::<msg>`; помилки — `::error …`.

### 3.4 Що генератор читає

| Джерело | Для чого |
|---|---|
| `marketplace.json` | список плагінів, `source`, метадані external, `owner`, `name` marketplace |
| `plugins/<p>/.claude-plugin/plugin.json` | `name`, `version`, `description`, `keywords`, `author`, `license`, `homepage`, `repository`, `dependencies` |
| `plugins/<p>/README.md` | тіло сторінки плагіна + пошук |
| `plugins/<p>/CHANGELOG.md` | changelog плагіна, `releases.json`, `feed.xml` |
| `plugins/<p>/COMPATIBILITY.md` | блок compatibility: markdown-тіло + витягнутий мінімум Claude Code (A-3) |
| `skills/*/SKILL.md`, `agents/*.md`, `commands/*.md` | frontmatter + тіло |
| `hooks/hooks.json`, `.mcp.json` | events / servers + сирий JSON |
| `bin/*` | лише список імен файлів (вміст не рендериться) |
| git-теги `<plugin>--v<semver>` | дати релізів і посилання на теги |

### 3.5 Правила валідації: fail vs warn

- **FR-19.** Таблиця нижче — нормативна. «fail» = помилка у `validate()`/генераторі, exit 1. «warn» = продовжити, використати fallback.

| Умова | Реакція | Fallback |
|---|---|---|
| Будь-яка помилка з поточного `check-marketplace.mjs` | fail | — |
| Невалідний JSON (`plugin.json`, `hooks.json`, `.mcp.json`) | fail | — |
| Frontmatter не парситься (FR-16) | fail | — |
| `SKILL.md` без `description` | fail | — |
| `agents/*.md` без `description` | fail | — |
| Ім'я компонента не відповідає `^[a-z0-9][a-z0-9-]{0,63}$` | fail | — |
| Дубль `id` (FR-21) | fail | — |
| `dependencies[]`: залежність є в каталозі, але її версія не задовольняє range | fail | — |
| `dependencies[]`: непідтримуваний синтаксис range (FR-23) | fail | — |
| Цикл у залежностях | fail | — |
| Локальний плагін без `version` у `plugin.json` | fail | — (README вимагає bump версії) |
| `agents/*.md` без `name` | warn | ім'я з імені файлу |
| `commands/*.md` без `description` | warn | перший непорожній рядок тіла, ≤ 160 символів |
| Залежність відсутня в каталозі | warn | `status: "not-in-catalog"` |
| Немає `README.md` / `CHANGELOG.md` / `COMPATIBILITY.md` | warn | секція «Not provided» |
| `COMPATIBILITY.md` без розпізнаного рядка `Claude Code <range>` | warn | `claudeCode: null`, тіло все одно показується |
| `CHANGELOG.md`: заголовок `## …` не розпізнано | warn | секцію пропущено |
| Найновіша версія в changelog ≠ `plugin.json` `version` | warn | — |
| Тег `<p>--v<x>` без секції в changelog, або тег для невідомого плагіна | warn | реліз з `notesMarkdown: ""` / тег ігнорується |
| `hooks.json` без об'єкта `hooks` | warn | `events: []` |
| `.mcp.json` без об'єкта `mcpServers` | warn | `servers: []` |
| `plugin.json` має ключі `hooks`, `mcpServers`, `commands`, `agents`, `skills` (inline/кастомні шляхи) | warn | `executesCode: true` для `hooks`/`mcpServers`; вміст не індексується (A-6) |

---

## 4. Модель даних

### 4.1 Ідентифікатори й slug-и

- **FR-20.** `name` плагіна — як у `marketplace.json` (вже валідується `NAME_RE`). `name` компонента: skill — ім'я директорії (= frontmatter `name`), agent — frontmatter `name` або ім'я файлу без `.md`, command — ім'я файлу без `.md`, hook — константа `hooks`, MCP — константа `mcp-servers`.
- **FR-21.** `id`:
  - плагін: `<plugin>` (напр. `sdd-engineering`);
  - компонент: `<plugin>:<type>:<name>` (напр. `engineering-paved-path:skill:react-best-practices`). Тип в id потрібен, бо skill і command можуть мати однакове ім'я.
  - `qualifiedName` (відображуване, namespaced): плагін — `<plugin>`, компонент — `<plugin>:<name>` (напр. `engineering-paved-path:react-best-practices`).
- **FR-22.** id стабільний: залежить лише від імені плагіна, типу та імені компонента, не від порядку файлів чи версії. URL: `#/plugin/<plugin>`, `#/artifact/<id>`. Двокрапка в hash не кодується. Файли тіл: `bodies/<plugin>/<type>/<name>.md` (для hook/MCP — `.json`), `bodies/<plugin>/README.md`, `bodies/<plugin>/CHANGELOG.md`, `bodies/<plugin>/COMPATIBILITY.md` (без двокрапок в іменах файлів — сумісність з Windows).

### 4.2 Залежності й semver

- **FR-23.** `dependencies` у `plugin.json`: масив `{ "name": string, "version": string }`, де `version` — semver-range. Підтримувана підмножина: точна `1.2.3`, `^1.2.3`, `~1.2.3`, `>=1.2.3`, `>=1.0.0 <2.0.0` (пробіл = AND), `*`. Інше → fail (FR-19).
- **FR-24.** Генератор обчислює для кожної залежності `resolvedVersion` і `status`, для кожного плагіна — `usedBy` (зворотні залежності). Транзитивне дерево будує UI з цих даних.

### 4.3 TypeScript-типи `index.json` (нормативні)

```ts
// site/src/types/index.ts
export type ArtifactType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type ComponentType = Exclude<ArtifactType, 'plugin'>;

export interface IndexFile {
  schemaVersion: '1.0';
  generatedAt: string;          // ISO 8601 UTC
  commit: string;               // 40-символьний SHA
  fixture: boolean;             // true, якщо зібрано з --fixture
  marketplace: MarketplaceInfo;
  items: IndexItem[];           // відсортовано: плагіни за name, потім компоненти за id
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
  plugin: string;               // для плагіна = name
  version: string | null;       // версія плагіна; null лише для external без version
  description: string;          // англійською, plain text
  keywords: string[];           // lower-case, унікальні; теги для фільтра
  path: string | null;          // repo-relative шлях до файлу/директорії; null для external
  bodyRef: string | null;       // відносно BASE_URL, напр. "bodies/p/skill/x.md"
  bodyFormat: 'markdown' | 'json' | null;
  searchText: string;           // plain text тіла (без markdown/frontmatter), ≤ 8000 символів
  source: 'local' | 'external';
  executesCode: boolean;
  installCommands: InstallCommands; // компонент → команди його плагіна
  updatedAt: string | null;     // дата останнього релізу плагіна (YYYY-MM-DD)
}

export interface PluginItem extends BaseItem {
  type: 'plugin';
  owner: { name: string; email?: string; url?: string } | null; // plugin.json author → fallback marketplace owner
  license: string | null;
  homepage: string | null;
  repository: string | null;
  compatibility: Compatibility | null;
  dependencies: Dependency[];
  usedBy: string[];                                   // імена плагінів
  components: Record<ComponentType, string[]>;        // id компонентів за типами
  bin: string[];                                      // імена файлів у bin/
  readmeRef: string | null;
  changelogRef: string | null;
  latestRelease: { version: string; date: string | null; tag: string | null } | null;
  external: ExternalSource | null;                    // лише для source: 'external'
}

export interface ExternalSource {
  kind: 'github' | 'git-subdir' | 'url';
  url: string;                  // посилання для людини (github → https://github.com/<repo>)
  ref: string | null;
  sha: string | null;
  path: string | null;          // для git-subdir
}

export interface Compatibility {
  claudeCode: string | null;    // semver-range, витягнутий з COMPATIBILITY.md за шаблоном `Claude Code <range>`, напр. ">=2.1.110"
  bodyRef: string | null;       // bodies/<plugin>/COMPATIBILITY.md — повний текст (markdown), lazy
}

export interface Dependency {
  name: string;
  range: string;                // як у plugin.json
  resolvedVersion: string | null;
  status: 'satisfied' | 'not-in-catalog';
}

export interface SkillItem extends BaseItem {
  type: 'skill';
  frontmatter: Record<string, unknown>; // увесь frontmatter для таблиці
  files: string[];              // інші файли директорії skill, repo-relative
}

export interface AgentItem extends BaseItem {
  type: 'agent';
  tools: string[] | null;       // з frontmatter `tools` (рядок через кому або список); null = не вказано
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
  events: string[];             // ключі об'єкта `hooks` у hooks.json
  executesCode: true;
}

export interface McpItem extends BaseItem {
  type: 'mcp';
  servers: Array<{
    name: string;
    transport: 'stdio' | 'http' | 'sse' | 'unknown';
    command: string | null;     // для stdio
    url: string | null;         // для http/sse
  }>;
  executesCode: true;
}

export type IndexItem = PluginItem | SkillItem | AgentItem | CommandItem | HookItem | McpItem;
```

Правила заповнення:

- **FR-25.**
  - `description` плагіна: `plugin.json` → fallback `marketplace.json`. `keywords` = об'єднання обох, lower-case. Компоненти успадковують `keywords` плагіна, плюс власні з frontmatter `keywords`/`tags` (якщо є). Для MCP до `keywords` додаються імена серверів.
  - `executesCode` плагіна = є hook-артефакт АБО MCP-артефакт АБО `bin.length > 0` АБО спрацювало правило A-6.
  - GitHub-посилання не зберігаються: UI будує `${repo.url}/blob/${commit}/${path}` (файл) або `/tree/` (директорія).
  - External: індексуються лише метадані з `marketplace.json` (`name`, `description`, `keywords`, `source`, `version` якщо є). `components` порожні, `bodyRef`/`readmeRef`/`changelogRef` = null, `executesCode: false` (невідомо; UI показує «Not indexed», FR-52), `path: null`.

### 4.4 `releases.json`

- **FR-26.** Джерела: `CHANGELOG.md` (формат Keep a Changelog) + git-теги `<plugin>--v<semver>`. Розпізнається заголовок `## [1.2.0] - 2026-09-30`, `## 1.2.0 - 2026-09-30`, `## [1.2.0]` (regex `^##\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?(?:\s+[-–]\s+(\d{4}-\d{2}-\d{2}))?\s*$`); `## [Unreleased]` пропускається. Реліз = пара (plugin, version) з об'єднання обох джерел. Дата: з changelog, інакше дата тегу (`creatordate`). Сортування: дата desc, потім semver desc, потім plugin asc.

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
  tag: string | null;           // "<plugin>--v<version>" якщо тег існує
  commit: string | null;        // SHA, на який вказує тег
  notesMarkdown: string;        // секція changelog без заголовка; "" якщо немає
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
    hooks: number;        // кількість hook-артефактів (= плагінів з hooks.json)
    hookEvents: number;   // сума events.length
    mcp: number;          // кількість MCP-серверів (сума servers.length)
    releases: number;
  };
}
```

### 4.6 `catalog.json` (машиночитний каталог)

- **FR-27.** Стабільна публічна схема для агентів; `schemaVersion` — semver схеми: додавання полів → minor, видалення/перейменування/зміна типу → major. Усі URL абсолютні (від `siteUrl`). Без `searchText` і без повних тіл (лише посилання).

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
    sourceUrl: string;            // GitHub tree для local, ExternalSource.url для external
    executesCode: boolean | null; // null для external (невідомо)
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

- **FR-28.** Формат за конвенцією llms.txt: `# <marketplace name>`, blockquote з описом, абзац з інструкцією встановлення, секція `## Catalog` з посиланням на `catalog.json`, секція `## Plugins` — по одному рядку на плагін `- [<name>](<pageUrl>): <description> (v<version>)`, під ним вкладені рядки компонентів з посиланнями на `bodyUrl`. Секція `## Optional` — `releases.json`, `feed.xml`. Приклад — §12.2.

### 4.8 `feed.xml`

- **FR-29.** Atom 1.0. `feed/id` = `siteUrl`; `title` = `<marketplace name> — releases`; `link rel="self"` = `<siteUrl>feed.xml`; `link rel="alternate"` = `<siteUrl>#/whats-new`; `updated` = дата найновішого релізу (або `generatedAt`). До 50 entries з `releases.json`: `id` = `<siteUrl>#/whats-new?release=<plugin>@<version>`, `title` = `<plugin> v<version>`, `link` = `<siteUrl>#/plugin/<plugin>`, `updated` = дата релізу (T00:00:00Z), `content type="text"` = `notesMarkdown`. XML-екранування всіх рядків.

---

## 5. Пошук

### 5.1 Рушій і документи

- **FR-30.** Пошук виконується в браузері MiniSearch по всіх `items` з `index.json` (плагіни теж є документами). Індекс будується один раз після завантаження `index.json` і живе в пам'яті.
- **FR-31.** Поля й ваги (boost): `name` ×6, `qualifiedName` ×4, `keywords` ×3, `description` ×2, `plugin` ×1.5, `searchText` ×1. `searchText` містить README (для плагіна) або тіло SKILL.md / agent / command (для компонентів), тож вимога «пошук по README і SKILL.md» виконана без завантаження `bodies/`.
- **FR-32.** Налаштування за замовчуванням: `prefix: true` для термів довжиною ≥ 2; `fuzzy: 0.2` лише для термів довжиною ≥ 5 (тобто максимум 1 правка для 5–9 символів); `combineWith: 'AND'` між групами термів, з fallback на `OR`, якщо AND дав 0 результатів (у UI — підпис «Showing partial matches»).

### 5.2 Конвеєр обробки запиту

`site/src/search/query.ts` експортує чисту функцію `parseQuery(raw: string): ParsedQuery` (unit-тестується окремо, FR-90):

```ts
interface ParsedQuery {
  raw: string;
  detectedType: ArtifactType | null;
  groups: string[][];   // кожна група = терм + синоніми (OR всередині, AND між групами)
  highlightTerms: string[];
  exactName: string | null;
}
```

- **FR-33. Нормалізація:** обрізати до 200 символів; NFKC; lower-case; `ё→е` не потрібно; апострофи `' ’ ʼ ‘ \`` усередині слова видаляються (`рев'ю` → `ревю`); `ґ` зберігається.
- **FR-34. Шаблонні фрази** на початку запиту видаляються (regex, до токенізації), напр.: UA `мені (треба|потрібен|потрібна|потрібно)`, `шукаю`, `хочу`, `чи є`, `є щось для`, `знайди`, `покажи`; EN `i need`, `i want`, `i'm looking for`, `looking for`, `is there`, `find me`, `show me`, `something for`, `a (skill|agent|command|plugin|tool) (for|to)`.
- **FR-35. Фразові синоніми** застосовуються до токенізації: багатослівні записи з `synonyms.json` (напр. `перевірка коду`, `огляд коду`, `code review`) замінюються на канонічний терм першого елемента групи.
- **FR-36. Токенізація:** split по `[^\p{L}\p{N}]+` (дефіс розділяє: `code-review` → `code`, `review`); токени довжиною < 2 відкидаються.
- **FR-37. Стоп-слова** (`stopwords.ts`) видаляються. Мінімальний набір EN: `a an the for to of with in on and or me i my need want some any that which please find show how`; UA: `для з із зі в у на і й та що щоб як мені мене треба потрібно потрібен потрібна хочу якийсь щось будь ласка знайди покажи`. Якщо після видалення не лишилося токенів — використовуються токени до видалення.
- **FR-38. Визначення типу:** токен, що збігається (за префіксом після нормалізації) з одним зі словників, видаляється з термів і задає `detectedType`:

  | Тип | Слова |
  |---|---|
  | `skill` | `skill*`, `скіл*`, `скілл*`, `навичк*` |
  | `agent` | `agent*`, `агент*`, `subagent*`, `субагент*` |
  | `command` | `command*`, `команд*`, `slash`, `слеш` |
  | `hook` | `hook*`, `хук*` |
  | `mcp` | `mcp`, `мсп`, `мцп` |
  | `plugin` | `plugin*`, `плагін*` |

  Поведінка: якщо фільтр `type` у URL не заданий — `detectedType` дає буст ×2 документам цього типу (MiniSearch `boostDocument`) і показує чип «Only <type>s» (клік ставить фільтр). Якщо запит складався лише зі слова типу (`skills`, `хуки`) — фільтр застосовується одразу, запит стає порожнім. Явний фільтр у URL має пріоритет над `detectedType`.
- **FR-39. Стемінг** (і для індексації, і для запиту, через MiniSearch `processTerm`): токени латиницею — Porter stemmer (npm-пакет `stemmer` або власна реалізація — на вибір імплементатора); кирилицею — легкий суфіксний стемер `stem-uk.ts`: відкидає найдовший із суфіксів (`ування ання ення ами ями ові еві ого ому ими ій ий ою ею ам ям ах ях ом ем ів ти и і а я у ю о е ь`) за умови, що лишається ≥ 3 символи. Prefix search (FR-32) компенсує неточності стемера.
- **FR-40. Синоніми:** `site/src/search/synonyms.json` у репо, формат:

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

  При завантаженні всі записи проганяються через той самий конвеєр (FR-33, FR-36, FR-39); кожен однослівний терм запиту розширюється до групи (стемовані форми всіх її членів). Перший елемент групи — канонічний англійський терм. Додавання синоніма не вимагає змін коду.
- **FR-41. Точний збіг імені:** якщо нормалізований запит (без шаблонних фраз і слова типу) дорівнює `name`, `qualifiedName` або `name` з дефісами, заміненими на пробіли, такий документ отримує множник ×5 і завжди стоїть першим.

### 5.3 Видача

- **FR-42. Порожній запит** → показати **всі** елементи (з урахуванням фільтрів), сортування «Recently updated» (`updatedAt` desc, потім `name`). Обґрунтування: каталог малий (десятки), даних про популярність немає й не буде (без аналітики), тож «popular» було б вигадкою; повний список і є найкращим discovery.
- **FR-43. Сортування:** `relevance` (дефолт при непорожньому `q`), `name` (A–Z за `qualifiedName`), `updated` (дефолт при порожньому `q`). Параметр `sort` у URL зберігається лише якщо відрізняється від дефолту.
- **FR-44. Debounce** 150 мс на введення; пошук синхронний і має займати ≤ 50 мс для 500 документів (NFR-21).
- **FR-45. Ліміти:** рендериться до 60 карток, далі кнопка «Show more» (+60). Лічильник показує повну кількість.
- **FR-46. Підсвітка:** терми, що дали збіг (з MiniSearch `match` + `highlightTerms`, з урахуванням префіксів), обгортаються в `<mark>` у `qualifiedName` і `description`. Якщо збіг лише в `searchText` — картка показує сніпет «Matched in README/SKILL.md: …» (≤ 160 символів навколо першого збігу). Підсвітка робиться на екранованому тексті, не через `innerHTML` з даних.
- **FR-47. Нічого не знайдено:** повідомлення «No results for "<q>"» + підказки: (1) скинути фільтри (якщо є активні), (2) спробувати англійською (якщо запит кирилицею), (3) 3–5 тегів з найбільшою кількістю елементів як чипи, (4) посилання «Request a plugin» → Report an issue (FR-60) з title `[request] <q>`.

---

## 6. Екрани й компоненти

### 6.1 Routes

- **FR-50.**

  | Route | Екран | Параметри |
  |---|---|---|
  | `#/` | redirect → `#/search` | — |
  | `#/search` | Search | `q`, `type`, `plugin`, `tag`, `sort` |
  | `#/plugin/<name>` | Plugin page | `tab` (`skills\|agents\|commands\|hooks\|mcp\|bin`) |
  | `#/artifact/<id>` | Artifact page | — |
  | `#/whats-new` | What's new | `plugin`, `release` (якір до релізу) |
  | `#/getting-started` | Getting started | — |
  | інше | 404 | — |

  - `type`, `tag` приймають список через кому (OR всередині параметра), `plugin` — одне значення; між параметрами — AND. Невідомі значення фільтрів ігноруються (і прибираються з URL через `replace`).
  - `#/artifact/<plugin>:<name>` (qualifiedName без типу) резолвиться, якщо однозначний, з `replace`-redirect на канонічний id; інакше — сторінка вибору з кількох збігів.
  - Роутер: `HashRouter` з `react-router` (або еквівалент); стан пошуку живе в URL (single source of truth). Введення тексту оновлює URL через `replace` після debounce; зміна фільтрів — через `push` (Back повертає попередній фільтр).
  - При зміні route фокус переходить на `<h1>` сторінки, scroll — нагору.

### 6.2 Глобальні елементи

**Header** (на всіх сторінках, sticky):
- Логотип/назва `test-ai-marketplace` → `#/search`.
- Глобальне поле пошуку (на `/search` — це те саме поле, що й основне; на інших сторінках Enter веде на `#/search?q=…`). Плейсхолдер `Search plugins, skills, agents…  (/)`. Хоткей `/` фокусує поле (крім випадку, коли фокус уже в полі вводу); `Esc` очищає поле, повторний `Esc` знімає фокус.
- Навігація: **Search**, **What's new**, **Getting started**.
- Перемикач теми (іконка сонце/місяць, `aria-label="Switch to light theme"`/`"…dark theme"`).
- Іконка GitHub → репо.
- Mobile (< 640 px): навігація ховається в меню-кнопку; поле пошуку — повна ширина під логотипом.

**Footer:** `Catalog generated <date> from <short SHA>` (SHA → commit на GitHub) · `catalog.json` · `llms.txt` · `feed.xml` · `Report an issue`.

**Skip link** «Skip to content» першим елементом.

**Toast:** унизу по центру (mobile) / внизу справа (desktop), 2 с, `role="status"` `aria-live="polite"`, тексти: `Copied`, `Couldn't copy — press Ctrl/Cmd+C` (fallback, FR-59).

**Design tokens** (значення обирає дизайнер, обидві теми мають виконувати NFR-2): `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-contrast`, `--focus-ring`, `--mark-bg`, `--warning-bg`, `--warning-text`, `--danger`, `--success`, `--code-bg`, а також по парі `--type-<type>-bg/-fg` для 6 типів.

**TypeBadge** — текст + іконка + колір (колір ніколи не єдиний носій сенсу). Пропозиція іконок (Lucide-назви): plugin `package`, skill `sparkles`, agent `bot`, command `square-terminal`, hook `webhook`, mcp `plug`.

**Інші бейджі:** `Executes code` (warning-стиль, іконка трикутника, tooltip/`title`: «Contains hooks, MCP servers or bin/ executables that run outside Claude's permission rules. Review before installing.»), `External` (нейтральний, tooltip «Metadata only — source code is not indexed»), `vX.Y.Z`.

**CopyButton** — кнопка з текстом (`Copy install` / `Copy`), після успіху на 2 с змінює іконку на галочку й текст на `Copied`; `aria-label` містить, що саме копіюється.

### 6.3 Екран `/search`

**Призначення:** знайти елемент за 1–2 запити.

**Дані:** `index.json`.

**Компонування (desktop ≥ 1024):** рядок пошуку на всю ширину контенту → під ним ліва колонка фільтрів (240 px) + права колонка: тулбар (лічильник `23 results` · чип detectedType · сортування select) → сітка карток (2 колонки 1024–1439, 3 колонки ≥ 1440; max-width контенту 1280). Tablet: фільтри — кнопка `Filters (n)`, що розкриває панель над сіткою; 2 колонки. Mobile: 1 колонка, фільтри — bottom sheet / повноекранна панель. Wireframe — §12.3.

**Фільтри (FacetGroup):**
- **Type** — checkbox-и 6 типів з лічильниками;
- **Plugin** — radio/список плагінів з лічильниками (якщо > 8 — з полем «Filter plugins»);
- **Tag** — checkbox-и, топ-12 за частотою + «Show all».
Лічильники рахуються для поточного `q` з урахуванням інших фасетів. Активні фільтри дублюються чипами над сіткою з «×» і кнопкою `Clear all`.

**Картка (ArtifactCard)** — FR-51:
- рядок 1: TypeBadge · (External) · (Executes code);
- `qualifiedName` (посилання на сторінку, з підсвіткою) — заголовок `h3`;
- для компонента: `in <plugin> · v<version>` (plugin — посилання); для плагіна: склад `3 skills · 1 agent · 1 command · hooks` і `Depends on 0/3 plugins`;
- `description` (clamp 3 рядки) з підсвіткою; сніпет збігу з тіла (FR-46);
- теги (до 4 + `+N`), клік по тегу ставить фільтр `tag`;
- дії: **Copy install** (копіює `installCommands.chat`; tooltip для компонента: «Installs the whole plugin <plugin>»), **View** (→ `#/artifact/<id>` або `#/plugin/<name>`), **GitHub** (іконка; для external — `Source` → `external.url`).
- Уся картка не є одним посиланням (щоб не вкладати інтерактивні елементи); hover/focus-within підсвічує картку.

**Стани:** loading (6 skeleton-карток, лічильник `Loading catalog…`), error (FR-56), порожній каталог (FR-55), нічого не знайдено (FR-47), часткові збіги (FR-32), результати.

**a11y:** поле — `role="searchbox"` з `<label>` (візуально прихованим); лічильник результатів — регіон `aria-live="polite"`, оновлюється після debounce (`23 results for "review"`); фасети — `<fieldset><legend>`; сітка — список `<ul>`.

### 6.4 Екран `/plugin/<name>`

**Призначення:** все про плагін для рішення «ставити чи ні» + встановлення.

**Дані:** `PluginItem` + його компоненти з `index.json`; `bodies/<p>/README.md`, `CHANGELOG.md` і тіла компонентів — lazy.

**Компонування (desktop):** шапка на всю ширину; нижче — основна колонка (≈ 2/3) і права бокова панель метаданих (≈ 1/3, sticky). Mobile — все в одну колонку в порядку: шапка → Install → метадані → решта.

1. **Шапка:** breadcrumb `Search › <plugin>`; `h1` = name; TypeBadge Plugin, `v<version>`, External, Executes code; description; кнопки **GitHub** (tree плагіна) / **Source** (external), **Report an issue**.
2. **InstallBlock** (FR-52):
   - перемикач-tabs `In chat` | `In terminal` (вибір запам'ятовується в localStorage, з try/catch);
   - Крок 1 «Add the marketplace (once)»: `addCommands.chat` / `addCommands.cli` + Copy;
   - Крок 2 «Install the plugin»: `installCommands.chat` / для terminal — segmented control scope `project | user` (дефолт `project`) і відповідний `cliProject`/`cliUser` + Copy;
   - примітки: «Installs the whole plugin with all its components.»; якщо є залежності — «Dependencies are installed automatically: a, b, c.» з посиланнями (A-12); якщо плагін або будь-яка транзитивна залежність `executesCode` — warning-банер з переліком причин (hooks / MCP / bin / dependency X).
3. **Метадані (sidebar):** Version, Owner, License, Compatibility (мінімальна версія Claude Code, напр. `>=2.1.110`; посилання «Details» розкриває `COMPATIBILITY.md`; або «Not specified»), Source (local path / external kind+url+ref/sha), Latest release (версія, дата, тег → `/tree/<tag>`), Keywords (чипи → `#/search?tag=`).
4. **Dependencies** (FR-53): таблиця/список: name (посилання), required range, resolved version, статус (`Satisfied` — success, `Not in catalog` — warning); під нею розгортуване дерево транзитивних залежностей (вкладений список з відступами, цикли неможливі через FR-19); блок **Used by** — список плагінів. Порожній стан: «No dependencies».
5. **Contents** (FR-54) — tabs за типами з лічильниками, порожні таби приховані: `Skills (3)`, `Agents (1)`, `Commands (1)`, `Hooks`, `MCP (1)`, `bin/ (2)`. Кожен елемент — accordion-рядок: `qualifiedName`, description, посилання `Open page`; розкриття lazy-завантажує й рендерить повне тіло (markdown для skill/agent/command; форматований JSON для hooks/MCP). Таби Hooks, MCP, bin/ мають постійний warning-банер «This code runs on your machine outside Claude's permission rules. Read it before installing.». `bin/` — лише список файлів з посиланнями на GitHub. Для external — замість табів: «Contents are not indexed for external plugins. View the source →».
6. **README** — відрендерений markdown (lazy). Порожній стан: «No README provided».
7. **Changelog** — останні 3 релізи розгорнуті, решта під `Show all releases`; кожен з якорем, посилання на `#/whats-new?plugin=<p>`.

**Стани:** loading (skeleton шапки й табів), плагін не знайдено (404-варіант «Plugin "<name>" not found» + до 3 найближчих за іменем), помилка завантаження тіла (inline «Couldn't load README. Retry»).

**a11y:** tabs за WAI-ARIA Tabs pattern (стрілки ←/→, `aria-selected`); accordion — `button[aria-expanded]` + `aria-controls`; таблиця залежностей з `<th scope>`.

### 6.5 Екран `/artifact/<id>`

**Призначення:** прочитати один компонент повністю, з контекстом плагіна.

**Дані:** item з `index.json` + `bodyRef` (lazy).

**Компонування:** breadcrumb `Search › <plugin> › <Type plural> › <name>`; `h1` = `qualifiedName`; TypeBadge, `in <plugin> v<version>`, Executes code; дії **Copy install** (команда плагіна + підпис «Installs the whole plugin»), **GitHub**, **Report an issue**. Далі:
- для hook/MCP — warning-банер (як у FR-54);
- **Frontmatter table** (ключ → значення; списки як чипи) для skill/agent/command; для agent — виділені `tools` («Not specified» якщо null) і `model`; для command — `argument-hint`; для hook — список `events`; для MCP — таблиця servers (name, transport, command/url);
- тіло: markdown (FR-63) або JSON у `<pre><code>` з кнопкою Copy;
- для skill — список `files` з посиланнями на GitHub;
- «More from <plugin>» — до 6 інших компонентів плагіна (компактні картки).
Mobile — одна колонка, таблиця frontmatter стає списком «ключ: значення».

**Стани:** loading тіла (skeleton), id не знайдено (404-варіант «Artifact not found» + пошук за останнім сегментом id), помилка тіла (Retry).

### 6.6 Екран `/whats-new`

**Призначення:** що змінилося в каталозі.

**Дані:** `releases.json` (lazy, при першому відкритті екрана).

**Компонування:** `h1` What's new; праворуч `Subscribe (Atom)` → `feed.xml`; фільтр-select «All plugins / <plugin>»; стрічка, згрупована за місяцем; елемент: `<plugin> v<version>` (→ сторінка плагіна), дата, тег (→ `/tree/<tag>`) або бейдж `untagged`, відрендерені нотатки (порожні → «No release notes»). `?release=<id>` прокручує й підсвічує елемент.

**Стани:** loading, error, empty («No releases yet»).

### 6.7 Екран `/getting-started`

**Призначення:** від нуля до встановленого плагіна. Статичний контент у коді (команди підставляються з `marketplace` в `index.json`). Розділи (кожна команда — CodeBlock з Copy, перемикач `In chat` / `In terminal` спільний з InstallBlock):

1. **Add the marketplace** — `/plugin marketplace add artemmmon/test-ai-marketplace` | `claude plugin marketplace add artemmmon/test-ai-marketplace`.
2. **Find a plugin** — посилання на `#/search`; пояснення: skills, agents, commands входять до плагінів; **встановлюється весь плагін, а не окремий skill**; namespaced імена `<plugin>:<name>`.
3. **Install** — `/plugin install <plugin>@test-ai-marketplace` | `claude plugin install <plugin>@test-ai-marketplace --scope project|user`; коротко: `project` — для поточного проєкту, `user` — для всіх ваших проєктів.
4. **Check what's installed** — `claude plugin list --json`.
5. **Update** — `claude plugin marketplace update test-ai-marketplace` (або `/plugin marketplace update test-ai-marketplace` у чаті), потім `/reload-plugins`. Примітка (з README репо): auto-update для сторонніх marketplace за замовчуванням вимкнено і він ненадійний — оновлюйте вручну; нова версія приходить лише після bump `version` у плагіні.
6. **Security** — hooks, MCP-сервери та `bin/` виконуються з вашими правами поза permission rules Claude; читайте їх на сторінці плагіна перед встановленням.
7. **For agents** — посилання на `llms.txt` і `catalog.json`.

### 6.8 404 і глобальні стани

- **FR-55. Порожній каталог** (`items.length === 0`, поточний реальний стан): на `/search` замість сітки — «The catalog is empty. No plugins have been published yet.» + посилання `Getting started` і `How to add a plugin` (README на GitHub). Фасети приховані; `/whats-new` — «No releases yet».
- **FR-56. Помилка завантаження `index.json`:** повноекранний стан «Couldn't load the catalog» + `Retry` + посилання на репо; помилка логуються в console.
- **FR-57. 404** для невідомого route: «Page not found» + посилання на Search; поле пошуку в header активне.
- **FR-58. Loading:** skeleton-и, без спінерів на весь екран; `aria-busy="true"` на контейнері.
- **FR-59. Копіювання:** `navigator.clipboard.writeText`; при помилці — показати команду у виділеному `readonly` полі (виділити текст) + toast `Couldn't copy — press Ctrl/Cmd+C`. Скопійований рядок MUST дорівнювати полю з `installCommands`/`addCommands` байт-у-байт.
- **FR-60. Report an issue:** посилання `https://github.com/artemmmon/test-ai-marketplace/issues/new?title=<t>&labels=site-feedback&body=<b>` (усе через `encodeURIComponent`), `target="_blank" rel="noopener noreferrer"`. Title: глобально `[site] `, плагін `[<plugin>] `, артефакт `[<id>] `, запит плагіна `[request] <q>`. Body: URL сторінки, commit SHA каталогу, порожні розділи `What happened` / `Expected`. Label `site-feedback` бажано створити в репо (A-7, A-14).

### 6.9 Рендеринг markdown

- **FR-61.** Markdown → HTML через `marked` (GFM), результат → `DOMPurify.sanitize` (дефолтний профіль, без `style`, без `<iframe>`/`<form>`), лише потім у DOM. `marked` і `DOMPurify` вантажаться окремим lazy-chunk (не потрібні для `/search`).
- **FR-62.** Посилання: зовнішні (`http(s)://`) — `target="_blank" rel="noopener noreferrer"`; відносні (`./references/x.md`) — переписуються на `${repo.url}/blob/${commit}/<resolved path>`; якорі `#section` — на кліку `scrollIntoView` до заголовка з відповідним `id` (заголовки отримують slug-id), без зміни hash (hash зайнятий роутером); `javascript:` та інші схеми видаляються DOMPurify.
- **FR-63.** Блоки коду — `<pre><code>` моноширинним шрифтом з горизонтальним скролом і кнопкою Copy; підсвітка синтаксису не входить у MVP.
- **FR-64.** Відносні зображення → `https://raw.githubusercontent.com/artemmmon/test-ai-marketplace/<commit>/<path>`; `loading="lazy"`, `alt` з markdown.

---

## 7. Нефункційні вимоги

### 7.1 Доступність

- **NFR-1.** WCAG 2.1 AA. Lighthouse Accessibility ≥ 95 на `/search`, `/plugin/<name>`, `/artifact/<id>` в обох темах (fixtures).
- **NFR-2.** Контраст тексту ≥ 4.5:1 (великий текст і UI-компоненти, фокус-кільце ≥ 3:1) в обох темах, включно з `<mark>`, бейджами типів і warning-банерами.
- **NFR-3.** Уся функціональність доступна з клавіатури; видимий фокус (`:focus-visible`), логічний порядок Tab; хоткей `/` (FR в §6.2); tabs/accordions за WAI-ARIA patterns; skip link.
- **NFR-4.** Результати пошуку, toast і зміни стану завантаження анонсуються через `aria-live="polite"`; іконки-кнопки мають `aria-label`; декоративні іконки `aria-hidden`.
- **NFR-5.** `prefers-reduced-motion: reduce` вимикає анімації переходів, skeleton-shimmer і плавний scroll.
- **NFR-6.** Цілі для дотику ≥ 44×44 px на mobile.

### 7.2 Тема

- **NFR-10.** Dark-first: при першому візиті тема `dark` (A-5). Перемикач dark/light; вибір зберігається в `localStorage` ключ `tam-theme` (усі звернення в try/catch, без помилок у приватному режимі). Тема застосовується атрибутом `data-theme` на `<html>` до першого рендеру через зовнішній `public/theme-init.js` (без inline-скрипта, NFR-41), щоб не було спалаху.

### 7.3 Адаптивність

- **NFR-15.** Breakpoints: `sm` < 640, `md` 640–1023, `lg` 1024–1439, `xl` ≥ 1440. Mobile-first CSS. Без горизонтального скролу сторінки на ширині 320 px (крім `<pre>` і таблиць у власному скрол-контейнері). Бічні відступи 16 px на mobile.
- Mobile-перелік: header зі згорнутою навігацією; фільтри — повноекранна панель з кнопкою `Show N results`; картки в 1 колонку; InstallBlock перед метаданими; tabs складу — горизонтальний скрол; frontmatter-таблиця → список.

### 7.4 Продуктивність

- **NFR-20.** Бюджети (gzip): початковий JS ≤ 150 KB (React, router, MiniSearch, застосунок); lazy-chunk markdown (marked + DOMPurify) ≤ 40 KB; CSS ≤ 30 KB; `index.json` ≤ 250 KB для 200 елементів (обмежує `searchText` ≤ 8000 символів, FR-25). Перевіряється в `check-dist.mjs` (warn при перевищенні JS/CSS, fail при > 1.5× бюджету).
- **NFR-21.** `index.json` завантажується один раз за сесію (спільний Promise-кеш); тіла — на вимогу, кешуються в пам'яті; `releases.json` — лише на `/whats-new` і для changelog плагіна. Пошук ≤ 50 мс на запит при 500 документах.
- **NFR-22.** Lighthouse Performance (mobile) ≥ 90 на `/search` з fixtures.
- **NFR-23.** Підтримка: останні 2 версії Chrome, Edge, Firefox, Safari (desktop і mobile).

### 7.5 Безпека

- **NFR-40.** Будь-який HTML з даних проходить FR-61; текстові поля (`name`, `description`, frontmatter) рендеряться як текст React, без `dangerouslySetInnerHTML`. `dangerouslySetInnerHTML` дозволений лише для виходу DOMPurify.
- **NFR-41.** Жодних inline-скриптів (ні з даних, ні в `index.html`). CSP через `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://raw.githubusercontent.com data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`. (`frame-ancestors` через meta не працює — обмеження Pages.) Якщо бібліотека потребує послаблення — фіксується в Q-списку з обґрунтуванням.
- **NFR-42.** Усі зовнішні посилання `rel="noopener noreferrer"`. Жодних сторонніх скриптів, шрифтів з CDN, трекерів.
- **NFR-43.** Генератор не виконує код плагінів і не робить мережевих запитів; external плагіни не клонуються.

### 7.6 SEO та i18n

- **NFR-30.** Обмеження: вміст за `#/…` не індексується пошуковиками як окремі сторінки. Мінімум — статичні `<title>`, `<meta name="description">` в `index.html`; `document.title` оновлюється на кожному route (`<name> — test-ai-marketplace`). Prerender — future work.
- **NFR-31.** UI-тексти англійською, зібрані в одному модулі `site/src/strings.ts`. Описи артефактів — англійською (рішення). Запити — UA/EN (§5).

---

## 8. Збірка й деплой

### 8.1 npm-скрипти

- **FR-70.**

  Корінь (`package.json`, `"type": "module"`, `"private": true`, `"engines": {"node": ">=20"}`, без dependencies):

  | Скрипт | Команда |
  |---|---|
  | `check` | `node scripts/check-marketplace.mjs` |
  | `build:index` | `node scripts/build-index.mjs` |
  | `build:index:fixtures` | `node scripts/build-index.mjs --root scripts/__fixtures__/repo --tags-file scripts/__fixtures__/tags.json --fixture` |
  | `test` | `node --test scripts/test/` |
  | `dev` | `npm run build:index && npm --prefix site run dev` |

  `site/package.json` (dependencies: `react`, `react-dom`, `react-router`, `minisearch`, `marked`, `dompurify`, Porter-стемер; devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@playwright/test`):

  | Скрипт | Команда |
  |---|---|
  | `dev` | `vite` (http://localhost:5173/test-ai-marketplace/) |
  | `build` | `tsc -b && vite build && node scripts/check-dist.mjs` |
  | `preview` | `vite preview` (http://localhost:4173/test-ai-marketplace/) |
  | `test` | `vitest run` |
  | `test:e2e` | `playwright test` (запускає `preview` через `webServer`) |
  | `typecheck` | `tsc -b --noEmit` |

  Локальна перевірка (як у лабі): `npm run build:index; cd site && npm ci && npm run build && npm run preview`. З порожнім реальним каталогом це дає FR-55; для демо — `npm run build:index:fixtures` замість `build:index`.

- **FR-71.** `vite.config.ts`: `base: '/test-ai-marketplace/'`. Усі fetch даних: `` `${import.meta.env.BASE_URL}index.json` `` тощо; жодних абсолютних шляхів `/…` у коді.
- **FR-72.** `site/scripts/check-dist.mjs` після build перевіряє: (1) усі `src`/`href` у `dist/index.html` починаються з `/test-ai-marketplace/`; (2) у `dist/assets/*.js` немає `fetch("/` і `fetch('/`; (3) у `dist/` є `index.json`, `catalog.json`, `releases.json`, `stats.json`, `llms.txt`, `feed.xml`; (4) бюджети NFR-20; (5) якщо задано env `REQUIRE_REAL_DATA=1` — `index.json.fixture === false` (так fixtures ніколи не потраплять на Pages).
- **FR-73.** `.gitignore` доповнюється: `site/dist/`, `site/public/index.json`, `site/public/catalog.json`, `site/public/releases.json`, `site/public/stats.json`, `site/public/llms.txt`, `site/public/feed.xml`, `site/public/bodies/`, `site/node_modules/`, `site/test-results/`, `site/playwright-report/`. CI-крок `git ls-files site/dist site/public/*.json site/public/bodies` має повертати порожній результат, інакше fail.

### 8.2 Workflows

- **FR-74. `.github/workflows/build.yml`** — reusable (`on: workflow_call`, input `deploy: boolean`), jobs:
  1. **validate** — checkout; `actions/setup-node` (Node 22, `cache: npm`, `cache-dependency-path: site/package-lock.json`); `npm run check`; `npm test`; перевірка FR-73. (`claude plugin validate .` у CI не запускається, див. A-13; він лишається локальним кроком.)
  2. **build-index** (`needs: validate`) — checkout з `fetch-depth: 0` (історія й теги для releases); `npm run build:index`; `actions/upload-artifact` → `site-data` (згенеровані файли з `site/public`).
  3. **build-site** (`needs: build-index`) — checkout; setup-node з кешем; `actions/download-artifact` `site-data` → `site/public`; `cd site && npm ci && npm run typecheck && npm test && npm run build` з `REQUIRE_REAL_DATA=1`; якщо `deploy` — `actions/configure-pages` + `actions/upload-pages-artifact` (`path: site/dist`), інакше `actions/upload-artifact` `site-dist` (для ручного перегляду, retention 7 днів).
  4. **e2e** (`needs: validate`, паралельно з build-index) — `npm run build:index:fixtures`; `cd site && npm ci && npx playwright install --with-deps chromium && npm run build && npm run test:e2e` (без `REQUIRE_REAL_DATA`).
- **FR-75. `.github/workflows/ci.yml`** — `on: pull_request` (до `main`); `permissions: contents: read`; `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`; `uses: ./.github/workflows/build.yml` з `deploy: false`.
- **FR-76. `.github/workflows/pages.yml`** — `on: push` до `main`, `push` тегів `*--v*` (оновлює releases), `workflow_dispatch`; `concurrency: { group: pages, cancel-in-progress: false }`; job `build` → `uses: ./.github/workflows/build.yml` з `deploy: true` (`permissions: contents: read`); job **deploy** (`needs: build`, умова `github.ref == 'refs/heads/main'` або тег): `permissions: pages: write, id-token: write`; `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`; `actions/deploy-pages` (`id: deployment`).
- **FR-77.** Actions пінуються на мажорну версію, актуальну на момент реалізації. Будь-яка помилка в `validate`, `build-index`, `build-site` або `e2e` блокує deploy (deploy залежить від build, а build — від validate; e2e входить у `needs` deploy через reusable workflow).

---

## 9. Тестування й acceptance

### 9.1 Unit: генератор (`scripts/test/*.test.mjs`, `node:test`)

- **FR-80.** На `scripts/__fixtures__/repo` (структура §12.1) з `--now 2026-10-19T12:00:00Z --commit a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 --tags-file …`:
  - вихідний `index.json` збігається зі збереженим golden-файлом `scripts/__fixtures__/expected/index.json` (детермінованість: однакові входи → байт-у-байт однаковий вихід);
  - для кожного локального плагіна `version` і `dependencies` = значенням з `plugin.json`;
  - `usedBy`, `resolvedVersion`, `executesCode`, `components` — як у §12.1;
  - `stats.json` counts = фактичній кількості;
  - `releases.json`: порядок, дати, `origin`; `feed.xml` — валідний XML (парситься), entries = релізам;
  - `catalog.json` має `schemaVersion` і лише абсолютні URL;
  - кожен `bodyRef` вказує на існуючий файл.
- **FR-81.** Негативні кейси (кожен — окремий мінімальний fixture-каталог, очікується exit 1 і текст помилки): кожен рядок «fail» з таблиці FR-19; і одна перевірка на кожне «warn» (exit 0 + текст попередження).
- **FR-82.** `check-marketplace.mjs` після рефакторингу дає той самий вихід на тих самих входах, що й до нього (регресійний тест на fixtures + на поточному порожньому `marketplace.json`: `marketplace invariants ok (0 plugins)`).
- **FR-83.** `semver.mjs`: таблиця `satisfies(version, range)` для всіх форм FR-23; `changelog.mjs`: усі формати заголовків FR-26.

### 9.2 Unit: пошук (`site/src/search/*.test.ts`, Vitest)

- **FR-90.** `parseQuery`: шаблонні фрази, стоп-слова, апострофи, визначення типу, розширення синонімами (таблиця «вхід → `ParsedQuery`»).
- **FR-91. Золотий набір** (на `site/src/fixtures/index.json` = копія golden з FR-80). «top-k ∋ X» означає, що X серед перших k:

  | # | Запит | Очікування |
  |---|---|---|
  | 1 | `мені треба скіл для код-рев'ю` | top-1 = `engineering-paved-path:skill:code-review`; `detectedType = skill` |
  | 2 | `I need a skill for code review` | top-1 = `engineering-paved-path:skill:code-review` |
  | 3 | `перевірка коду` | top-3 ∋ `engineering-paved-path:skill:code-review` |
  | 4 | `react` | top-1 = `engineering-paved-path:skill:react-best-practices` |
  | 5 | `engineering-paved-path:react-best-practices` | top-1 = `engineering-paved-path:skill:react-best-practices` (FR-41) |
  | 6 | `агент для архітектури` | top-1 = `architecture-review:agent:architecture-reviewer` |
  | 7 | `коміт` | top-1 = `engineering-paved-path:skill:commit-conventions` |
  | 8 | `специфікація` | top-3 ∋ `sdd-engineering:skill:spec-writing` |
  | 9 | `дослідження` | top-3 ∋ `research-tools` (плагін) або його skill `web-research` |
  | 10 | `sdd` | top-3 ∋ `sdd-engineering` (плагін) |
  | 11 | `architecture-review` | top-2 = {`architecture-review` (плагін), `architecture-review:skill:architecture-review`} |
  | 12 | `reviw` (одна помилка) | top-3 ∋ `engineering-paved-path:skill:code-review` |
  | 13 | `хуки` | фільтр `type=hook`; результати = лише `engineering-paved-path:hook:hooks` |
  | 14 | `mcp` | фільтр `type=mcp`; результати = лише `research-tools:mcp:mcp-servers` |
  | 15 | `kubernetes` | 0 результатів → стан FR-47 |
  | 16 | `` (порожній) | усі 21 елементи, сортування `updated` |

### 9.3 E2E / smoke (Playwright, `site/e2e/smoke.spec.ts`, на `preview` з fixtures)

- **FR-95.**
  1. Відкрити `/test-ai-marketplace/#/search`, ввести `code review` → видно картку `engineering-paved-path:code-review`; ввести `sdd-engineering` → картка плагіна першою (плагін і вкладений skill знаходяться).
  2. URL після введення містить `#/search?q=`; reload відновлює результати (US-5).
  3. На картці `engineering-paved-path` натиснути Copy install → `navigator.clipboard.readText()` (з дозволом `clipboard-read`) === `/plugin install engineering-paved-path@test-ai-marketplace`; видно toast `Copied`.
  4. `#/plugin/sdd-engineering`: відображена версія === `version` з `scripts/__fixtures__/repo/plugins/sdd-engineering/.claude-plugin/plugin.json` (тест читає файл); список залежностей === `dependencies` з того ж файлу (імена й ranges); перемкнути In terminal + `user` → Copy → `claude plugin install sdd-engineering@test-ai-marketplace --scope user`.
  5. `#/artifact/engineering-paved-path:hook:hooks` — видно warning «runs on your machine» і JSON.
  6. `#/nope` → 404; `#/plugin/unknown` → «Plugin "unknown" not found».
  7. Клавіша `/` фокусує пошук; у консолі немає помилок; немає запитів поза origin (крім raw.githubusercontent.com).
- **FR-96.** Ручна перевірка перед здачею: `npm run build:index` на реальному (порожньому) каталозі → `preview` показує FR-55 без помилок.

### 9.4 Чек-лист лабораторної (крок 6)

| Вимога лаби | Де в специфікації | Перевірка |
|---|---|---|
| CLI = встановлення, UI = discovery (знайти, прочитати, скопіювати) | §1.1, FR-51, FR-52 | US-1…US-4 |
| Документ фіксує routes, поля індексу, пошук, detail page | FR-50, §4, §5, §6.4–6.5 | цей файл |
| Без backend, ratings, download counter | §1.2 | — |
| `scripts/build-index.mjs` читає marketplace.json, manifests, README, changelog, compatibility, frontmatter → `site/public/`: index.json, releases.json, stats.json, bodies/ | §3.4, §4 | FR-80 |
| React + TS + Vite, hash routes `/search`, `/plugin/<name>`, `/artifact/<id>`, `/whats-new`, `/getting-started` | FR-50, FR-70 | FR-95 |
| MiniSearch по name, description, keywords, README, SKILL.md; marked + санітизація | FR-30, FR-31, FR-61 | FR-91 |
| Сторінка плагіна: version, owner, compatibility, dependencies, склад, `/plugin install <plugin>@<marketplace>` (+ CLI `--scope`) | §6.4 | FR-95.4 |
| Локально: `npm run build:index; cd site && npm ci && npm run build && npm run preview` | FR-70 | FR-96 |
| Згенерований JSON і `site/dist/` не комітяться | FR-73 | CI-крок FR-73 |
| PR workflow збирає index і frontend; `pages.yml` після merge публікує через upload-pages-artifact + deploy-pages, `pages: write`, `id-token: write`; окремий build job для індексу; base `/test-ai-marketplace/` | FR-74…FR-77, FR-71 | зелений CI, FR-72 |
| Плагін і вкладені skills знаходяться; version/dependencies = manifest; Copy install — правильна команда | FR-91, FR-95 | FR-95.1–4 |
| Dependencies (name + semver-range), namespaced компоненти, граф/список залежностей | FR-21, FR-23, FR-53 | FR-80, FR-95.4 |
| Теги `<plugin>--v<semver>`, releases.json і /whats-new з CHANGELOG.md і тегів | FR-26, §6.6 | FR-80 |

---

## 10. Фазування

**MVP** (усе з цієї специфікації): пошук + картки; фільтри type/plugin/tag + deep-link; сторінка плагіна з повним вмістом локальних плагінів; сторінка артефакту; `catalog.json` + `llms.txt`; changelog, `/whats-new`, `releases.json`, `feed.xml`; `stats.json`; `/getting-started`; dark/light тема; CI + Pages.

**Future work (явно відкладено):**

| Що | Чому не в MVP |
|---|---|
| Семантичний/embedding-пошук | при десятках артефактів MiniSearch + синоніми достатньо; можна додати пізніше як попередньо обчислені вектори в CI. |
| Коментарі (giscus тощо) | суперечить «суто довідковому» сайту; потребує GitHub Discussions і стороннього скрипта (CSP). |
| Рейтинги, лічильник встановлень | потрібен запис і зберігання стану (backend + автентифікація); Claude Code не повідомляє нам про встановлення, а статичний сайт не може рахувати. |
| Аналітика | потрібен сторонній collector або власний backend; приватність. |
| PWA / offline | невеликий виграш для довідкового сайту; service worker ускладнює інвалідацію даних після deploy. |
| Порівняння плагінів | цінність з'являється при більшій кількості плагінів. |
| Підсвітка синтаксису, prerender для SEO, UI-локалізація | не потрібні для acceptance лаби. |

---

## 11. Припущення й відкриті питання

### 11.1 Припущення (обрані дефолти)

- **A-1.** Ім'я marketplace для команд береться з `marketplace.json` `name` (`test-ai-marketplace`), а джерело для `marketplace add` — `owner/repo` з `GITHUB_REPOSITORY` або `git remote get-url origin` (`artemmmon/test-ai-marketplace`).
- **A-2.** `dependencies` у `plugin.json` — масив `{name, version}` (як у тексті лаби); інші форми (об'єкт-мапа) → fail з поясненням.
- **A-3.** Compatibility плагіна береться з `plugins/<p>/COMPATIBILITY.md` (так у лабі, крок 4: «У COMPATIBILITY.md фіксуємо Claude Code >=2.1.110»). Генератор витягує з нього мінімальну версію за шаблоном `Claude Code <range>` і кладе повний текст у `bodies/<plugin>/COMPATIBILITY.md` (схема `Compatibility`, §4.3); для skill додатково показується frontmatter-поле `compatibility`, якщо є.
- **A-4.** Формат changelog — Keep a Changelog (FR-26).
- **A-5.** Перший візит — темна тема незалежно від `prefers-color-scheme` (dark-first); вибір користувача зберігається.
- **A-6.** Inline/кастомні шляхи компонентів у `plugin.json` у MVP не індексуються (warn), але `hooks`/`mcpServers` позначають плагін як `executesCode`.
- **A-7.** Label для issues — `site-feedback`; GitHub може ігнорувати `labels` у URL для користувачів без прав triage, тому тип звернення продубльовано префіксом у title.
- **A-8.** Copy install на картці копіює варіант «in chat» (`/plugin install …`), бо саме він є командою встановлення з тексту лаби; CLI-варіант доступний на сторінці плагіна.
- **A-9.** Генератор zero-dep (FR-14), тому frontmatter обмежено підмножиною YAML (FR-16).
- **A-10.** E2E — Playwright (Chromium) у CI; unit-тести фронтенду — Vitest.
- **A-11.** URL сайту — дефолтний `https://artemmmon.github.io/test-ai-marketplace/`, без custom domain.

### 11.2 Питання, закриті за текстом лаби або прийняті за рекомендацією

- **A-12 (було Q-2). Залежності встановлюються автоматично.** Лаба, крок 10: «Вбудований installer автоматично встановить dependencies і перелічить їх у результаті». Тому блок Install не просить встановлювати залежності вручну, а лише перелічує їх; перевірка — `claude plugin list --json` без `dependency-unsatisfied`, `range-conflict`, `no-matching-tag`.
- **A-13 (було Q-3). `claude plugin validate .` у CI не запускаємо.** Лаба згадує команду як локальну перевірку (кроки 5 і 7), але не каже, що її треба ставити в runner; прапор `--strict` не існує. CI покладається на власний `scripts/lib/marketplace.mjs`. Додавання CLI в runner — future work. Прийнято за рекомендацією.
- **A-14 (було Q-4). Label `site-feedback`.** Лаба цього не визначає; лишаємо `site-feedback` (A-7), префікс у title працює і без label. Створити label у репо має власник репо. Прийнято за рекомендацією.
- **Q-1 закрито в A-3:** compatibility — окремий `COMPATIBILITY.md` у корені плагіна.

### 11.3 Відкриті питання

Немає.
---

## 12. Додатки

### 12.1 Fixtures: приклад `index.json` (ФІКТИВНІ ДАНІ)

> **Це вигаданий приклад для дизайну й тестів.** У репо зараз немає жодного з цих плагінів. Дані відтворюють очікувану структуру реальних плагінів із лабораторної. Той самий каталог має існувати як файлове дерево `scripts/__fixtures__/repo/` (з цього дерева генерується golden-файл, FR-80), а копія результату — у `site/src/fixtures/index.json`. `searchText` скорочено.

Склад fixtures:

| Плагін | Версія | Залежності | Компоненти | executesCode |
|---|---|---|---|---|
| `engineering-paved-path` | 1.2.0 | — | skills `react-best-practices`, `code-review`, `commit-conventions`; agent `code-reviewer`; command `review-pr`; hooks (`PreToolUse`, `PostToolUse`) | так (hooks) |
| `research-tools` | 1.0.1 | — | skills `web-research`, `literature-review`; agent `researcher`; MCP `docs-fetch` | так (MCP) |
| `architecture-review` | 1.0.0 | `engineering-paved-path ^1.0.0` | skills `architecture-review`, `adr-writing`; agent `architecture-reviewer` | ні |
| `sdd-engineering` | 1.0.0 | `engineering-paved-path ^1.0.0`, `research-tools ^1.0.0`, `architecture-review ^1.0.0` | skills `spec-writing`, `sdd-workflow`; agent `spec-reviewer`; command `spec` | ні (але залежності — так) |

Фіктивні теги (`scripts/__fixtures__/tags.json`): `engineering-paved-path--v1.0.0` (2026-08-01), `engineering-paved-path--v1.2.0` (2026-09-30), `research-tools--v1.0.1` (2026-09-12), `architecture-review--v1.0.0` (2026-09-20), `sdd-engineering--v1.0.0` (2026-10-10).

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

Додатковий fixture для стану **External** (не входить у 21 елемент золотого набору; окремий файл `site/src/fixtures/index.external.json` для дизайну):

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

Фрагменти відповідних `releases.json` і `stats.json` (fixtures):

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

(6 релізів = 5 тегів + `engineering-paved-path` 1.1.0, що є лише в changelog, `origin: "changelog"`.)

### 12.2 Приклад `llms.txt` (fixtures)

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

(У реальному файлі «…» немає — перелічуються всі компоненти.)

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
«…» = <mark>-підсвітка
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
│ Installs the whole plugin with all its components.    │ (*scope лише в terminal) │
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

**`/artifact/<id>` — desktop (скорочено)**

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
