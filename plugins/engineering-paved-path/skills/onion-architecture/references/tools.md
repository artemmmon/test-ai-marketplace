# Backend tools through the onion lens

Sources: [S12]-[S15] Fastify, [S16]-[S19] Drizzle and repositories, [S20] Parse, don't validate,
[S21][S22] anti-corruption layer. Each tool belongs to exactly one ring. Fastify, Drizzle, zod
and the SDK names are examples of a typical TypeScript backend; the ring assignment holds for
any equivalent tool (Express/Hono, Prisma/Kysely, Valibot, another SDK).

## Contents
1. HTTP framework (Fastify) - driving adapter
2. ORM / query builder (Drizzle) - driven adapter
3. Schema library (zod) - core
4. Third-party SDKs - anti-corruption adapters
5. Job queues and event buses
6. Shared domain libraries
7. Test runner and test containers

## 1. HTTP framework (Fastify) - outer ring (driving adapter)

- `routes.ts` is a **translator**, not a controller with logic: validate (a schema on
  `params`/`body`/`querystring`/`response`), resolve tenancy and the caller from the request,
  call **one** service method, set the status code [S12][S13].
- Nothing framework-typed (`FastifyRequest`, `FastifyReply`, `app`) crosses into a service.
  Pass plain values (a tenant id, the parsed body). One small helper (for example
  `_shared/context.ts`) is the only code allowed to read the request.
- Use the framework's encapsulation as the module boundary: each module is one plugin registered
  from one index; module-private hooks and decorators stay inside it. Only root-level
  singletons (the container) are decorated through the root; that is the one place
  an unencapsulated decoration is justified [S12][S14].
- Error mapping belongs to the root error handler, not to `try/catch` in routes.
  When failure is a *valid answer* (a connection test returning `ok: false`), the service catches
  only that call's failure and returns a value. Everything else still propagates as `AppError`.
- New routes declare a `response` schema too; it also strips unknown keys. Do not retrofit
  existing routes unless you touch them.
- DI plugins such as `@fastify/awilix` exist [S15]; a hand-written container is explicit and
  has no magic resolution. Pick one DI mechanism per project and do not add a second.

## 2. ORM / query builder (Drizzle, plus its driver) - outer ring (driven adapter)

- One repository per aggregate/table group in `modules/<m>/repository.ts` or `repository/`.
  It `implements` a port from `ports.ts` and is the **only** code that imports the ORM
  or the table schema for that module [S18][S19].
- Map at the boundary: `toDomain(row)` / `toRow(entity)` live in the repository. Row types
  (`typeof t.x.$inferSelect`) do not appear in port signatures.
- Every query takes the tenancy key (for example `tenantId`), plus a user id for per-user
  tables. Enforce it in the port signature.
- A repository may **read** other modules' tables for a read model (joins, aggregates). It
  **writes** only its own module's tables. Writes elsewhere go through that module's port.
- **Transactions:** `db.transaction(async (tx) => ...)` [S16]. The service decides the
  boundary and the repository never commits on its own [S17]. S17 passes `tx` down through
  use cases. The alternative builds repositories over an executor (`Db | Tx`) and
  exposes a unit-of-work port whose callback receives transaction-bound repositories. That keeps
  ORM types out of application code (patterns.md section 6).
- Translate driver errors (unique violation `23505`, FK `23503`) into `AppError`
  subclasses inside the repository.
- The schema lives in `src/db/schema/` (outer ring); migrations are generated.

## 3. Schema library (zod) - core

- Contracts in the shared package are the domain vocabulary: entities, value objects and
  port payloads. They import nothing but the schema library.
- **Parse, don't validate** [S20]: parse once at each edge - HTTP (route schema), third-party
  responses (adapter), jsonb columns if their shape is not guaranteed (repository). Inside,
  functions take inferred types (`z.infer<>`) and never re-parse.
- Branded/refined types (`z.string().uuid()`, enums) make illegal states unrepresentable
  in the core instead of `if` checks in services.

## 4. Third-party SDKs (payments, LLM, git host, chat, ...) - outer ring (ACL)

- Each SDK is imported **only** in `src/adapters/<name>/` [S21][S22].
- The adapter is three things in one file: protocol (auth, pagination, retry, timeouts),
  translator (SDK payload -> shared contract, for example a `mapStatus` function), facade
  (methods named in your language: `listCharges`, not `charges.list`).
- Construction from secrets happens in the container, never in a service. Secrets (tokens)
  come only via a `SecretsProvider` port; non-secret settings (a channel id, a base URL) go in
  the app config.
- **New SDK:** add its package to `SDK_PKGS` in `assets/dependency-cruiser.cjs`. Application code
  is already fail-closed: it may import only the allowlisted pure packages.
- **Best-effort side effects** (notifications, audit, webhooks) must not fail the main flow.
  When unconfigured, the container returns a no-op adapter instead of throwing a config error.
  The application catches and logs the port call.
- Parsers that are pure computations (diff parsing, symbol extraction) may be core helpers;
  if they wrap a native SDK they are adapters behind a port.

## 5. Job queues and event buses - outer ring

- The queue implementation (an in-process queue plus a `jobs` table, an SSE bus, a broker client)
  is an outer-ring driven adapter.
- The service exposes the job's *work* as a plain method (`runExportJob(payload)`) and
  enqueues through a narrow `JobQueue` port (`enqueue(kind, payload)`); registering the
  handler (`jobs.register(kind, p => service.runExportJob(p))`) is wiring - do it in the
  routes plugin or container, not inside the service.
- Payloads crossing the queue are parsed back with the schema library in the handler (they come from JSON).
- An in-memory concurrency limiter inside a pure pipeline is fine; the durable queue is not.

## 6. Shared domain libraries - application/core

A workspace package that holds pure domain logic (for example a pricing engine) is imported
as application/core code. It receives its I/O (an LLM provider, a payment client) as ports and
returns values; persisting the result is the repository's job.

## 7. Test runner and test containers - outer ring (tests may import anything)

Where tests live (next to the subject or in a `test/` tree) is a project convention; follow it.
Name them after the subject.

| Ring under test | Test style | File |
|---|---|---|
| core / pure helpers | plain inputs -> outputs, no mocks | `*.test.ts` |
| application service | constructor-injected in-memory fakes of ports | `*.test.ts` |
| repository | real database (test containers) | `*.it.test.ts` |
| route + wiring | build the app with overrides + `app.inject` | `*.it.test.ts` |

Adapter mocks are fakes of **ports**, which is what keeps unit tests off the network.
