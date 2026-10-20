/**
 * EXAMPLE dependency-cruiser config for Onion Architecture in a TypeScript backend.
 * Copy it into your project and edit the LAYOUT block below to match your folders; the rules
 * themselves only refer to those constants.
 *
 * Run from the backend package root (adjust the config path to where you copied the file):
 *
 *   npx depcruise src --config dependency-cruiser.cjs --output-type err
 *
 * Adding a third-party SDK? Add it to SDK_PKGS. Adding a pure library that application code
 * may use (no I/O)? Add it to APPLICATION_PKGS.
 *
 * Rings (inside -> out), with the default LAYOUT:
 *   core         src/shared/**, modules/<m>/domain.ts, modules/<m>/ports.ts
 *   application  every other file under modules/<m>/ (service.ts, pure helpers)
 *   outer        modules/<m>/routes.ts, modules/<m>/repository(.ts|/), modules/_shared/context.ts,
 *                src/adapters/**, src/db/**, src/platform/** (container.ts = composition root)
 */

// ---- LAYOUT: edit these to match your project -------------------------------------------
const SRC = 'src';
const SHARED = `^${SRC}/shared/`; // shared contracts / domain vocabulary (core)
const MODULES = `^${SRC}/modules/`; // feature modules (vertical slices)
const ADAPTERS = `^${SRC}/adapters/`; // driven adapters for third-party SDKs
const DB = `^${SRC}/db/`; // database client, schema, migrations
const CONTAINER = `^${SRC}/platform/container\\.ts$`; // composition root
const CORE_FILES = '(domain|ports)\\.ts'; // per-module core files
const OUTER_FILES =
  'routes\\.ts|repository\\.ts|repository/|index\\.ts'; // per-module outer-ring files
const OUTER_SHARED = '_shared/context\\.ts'; // request glue shared by modules
const EXCLUDE = [`^${SRC}/db/migrations/`, '^test/', '\\.test\\.ts$'];

// ---- Packages --------------------------------------------------------------------------
/**
 * An npm package, resolved (`node_modules/...`, incl. nested package-store paths)
 * or unresolved (bare name, e.g. an ESM-only package without a `require` export).
 */
const npm = (pkgs) => `(^|node_modules/)(${pkgs.join('|')})(/|$)`;

const DB_PKGS = ['drizzle-orm', 'postgres'];
const SDK_PKGS = ['octokit', '@octokit/[^/]+', 'openai', '@anthropic-ai/sdk', 'simple-git'];

/**
 * Fail-closed allowlist: the only packages / Node built-ins application code may import.
 * Everything else (DB drivers, SDKs, fs, net, child_process, ...) is I/O and belongs behind a port.
 */
const APPLICATION_PKGS = ['zod'];
const APPLICATION_BUILTINS = '^(node:)?(crypto|path|util)$';

const CORE = [SHARED, `${MODULES}[^/]+/${CORE_FILES}$`];
const OUTER_IN_MODULE = `${MODULES}([^/]+/(${OUTER_FILES})|${OUTER_SHARED})`;

module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      severity: 'error',
      comment:
        'The core (shared contracts, domain.ts, ports.ts) depends on nothing but zod and other core files. ' +
        'Move the I/O behind a port and implement it in an outer ring.',
      from: { path: CORE },
      to: { pathNot: [npm(['zod']), ...CORE] },
    },
    {
      name: 'application-no-outer-ring',
      severity: 'error',
      comment:
        'Application code (service.ts, pure helpers) must not import the database layer ' +
        'or a concrete adapter. Depend on a port from the shared contracts or the module ports.ts; ' +
        'return domain types, not ORM rows.',
      from: { path: `${MODULES}[^/]+/`, pathNot: OUTER_IN_MODULE },
      to: { path: [DB, ADAPTERS] },
    },
    {
      name: 'application-allowed-packages',
      severity: 'error',
      comment:
        'Application code may import only the pure packages in APPLICATION_PKGS / APPLICATION_BUILTINS. ' +
        'A DB driver, the HTTP framework, an SDK or fs/net is I/O: put it in an adapter behind a port. ' +
        'A new pure library? Add it to the allowlist in this file.',
      from: { path: `${MODULES}[^/]+/`, pathNot: OUTER_IN_MODULE },
      to: {
        dependencyTypesNot: ['local', 'aliased', 'aliased-tsconfig', 'aliased-tsconfig-paths', 'type-only'],
        pathNot: [npm(APPLICATION_PKGS), APPLICATION_BUILTINS],
      },
    },
    {
      name: 'application-no-container',
      severity: 'warn',
      comment:
        'A service receives narrow ports in its constructor, not the whole Container ' +
        '(which exposes `db`). Only routes.ts and the composition root know the Container.',
      from: { path: `${MODULES}[^/]+/`, pathNot: OUTER_IN_MODULE },
      to: { path: CONTAINER },
    },
    {
      name: 'routes-no-persistence',
      severity: 'error',
      comment:
        'routes.ts is a driving adapter: parse (zod schema), call the service, map the result. ' +
        'Queries go into the module repository behind a port.',
      from: { path: `${MODULES}[^/]+/routes\\.ts$` },
      to: { path: [npm(DB_PKGS), DB] },
    },
    {
      name: 'sdk-only-in-adapters',
      severity: 'error',
      comment:
        'Third-party SDKs belong to the outer ring. Wrap them in an adapters/<name>/ folder behind a port ' +
        '(anti-corruption layer): SDK types never leave the adapter.',
      from: { path: `^${SRC}/`, pathNot: ADAPTERS },
      to: { path: npm(SDK_PKGS) },
    },
    {
      name: 'adapters-not-to-modules',
      severity: 'error',
      comment: 'Adapters implement core ports; they never import feature modules (arrows point inward).',
      from: { path: ADAPTERS },
      to: { path: MODULES },
    },
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment:
        'A module may use another module only through its public index.ts / types.ts, ' +
        'or better, through a port wired in the composition root.',
      from: { path: `${MODULES}([^/]+)/` },
      to: {
        path: `${MODULES}[^/]+/`,
        pathNot: [`${MODULES}($1|_shared)/`, `${MODULES}[^/]+/(index|types)\\.ts$`],
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependency: some arrow points outward. Find the ring that is importing the wrong way.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: ['node_modules'] },
    exclude: { path: EXCLUDE },
  },
};
