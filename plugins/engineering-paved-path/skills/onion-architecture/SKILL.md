---
name: onion-architecture
description: Onion Architecture rules for a TypeScript/Node backend (HTTP framework such as Fastify, an ORM such as Drizzle, zod, third-party SDKs, a job queue) - which ring a file belongs to, which way imports may point, where a query, an SDK call, a job handler, a schema parse or a business rule lives, how services get their dependencies (ports via constructor), transactions, error mapping, and a runnable dependency-cruiser check. Use whenever creating or changing a backend module, adding a route, service, repository, adapter, job or third-party SDK, wiring a composition root or DI container, reviewing backend code, or answering "where does this belong?" on the server - even if the word "architecture" is never used. Not for client code (see frontend-architecture) or query tuning.
---

# Onion Architecture (TypeScript backend)

Decisions about **which ring code lives in and which way it may import**. Rules come from the sources in [references/sources.md](references/sources.md); `[S6]` marks source #6 there.

The folder names below (`src/modules/<m>/`, `src/adapters/`, `src/db/`, `src/platform/`, `src/shared/`) are an **example layout**. Map them onto your project's folders first; the rings and the import direction are what matters, not the names. Read the project's `CLAUDE.md`/`AGENTS.md` if it has one, and follow the folder scheme it already uses.

## The one rule

**Source-code dependencies point inward only.** An inner ring never names anything in an
outer ring - not a type, not a function, not a package [S1][S6].

| Ring | Example files | May import |
|---|---|---|
| **Core - domain** | `src/shared/*` contracts, `modules/<m>/domain.ts` | the schema library (zod), other core |
| **Core - ports** | shared `adapters.ts` port types, `modules/<m>/ports.ts` | domain |
| **Application** | `modules/<m>/service.ts`, pure helpers, domain libraries | core, the error module |
| **Outer ring** | driving adapters: `routes.ts`, job handlers - driven adapters: `repository(.ts\|/)`, `src/adapters/**` - plus `src/db/**`, `src/platform/**`, tests | anything inward |

`platform/container.ts` (or your equivalent) is the **composition root**: the only file that knows every ring [S2][S5][S9].

## Principles

1. **The database is in the outer ring.** ORM tables and row types stay in the
   repository; it returns domain types. *Why:* the schema changes without touching rules [S1][S18].
2. **Core declares ports; the outer ring implements them.** *Why:* dependency inversion is
   what turns layers into an onion [S1][S7].
3. **Services get narrow ports through the constructor** - never the whole container, never
   `new XRepository(db)` inside. *Why:* visible dependencies, fakes without hacks [S9][S11].
4. **Parse at the edge, trust inside.** Schemas on routes; adapters parse SDK payloads;
   core and application take typed values [S20].
5. **One anti-corruption layer per SDK.** SDK types never leave `src/adapters/<name>/`; the
   adapter owns retry, timeout, auth and translation to contracts [S21][S22].
6. **The application service owns the transaction boundary** [S17]; a unit-of-work port
   keeps the ORM's `tx` in the outer ring [S16] (why not pass `tx`: sources.md, Conflicts).
7. **Errors cross rings as one app error type** (`AppError` and subclasses). Driven adapters map SDK/database failures [S8].
8. **Modules are vertical slices** that meet only through `index.ts`/`types.ts` or a port
   in the container [S5].

## Where does X go?

| You need... | Put it in |
|---|---|
| business rule / calculation | `domain.ts` or a pure helper beside the service |
| new SQL query | module repository + a method on its port in `ports.ts` |
| external service (git host, LLM, chat, ...) | port in the shared ports + `src/adapters/<name>/`; payload types beside the port |
| new request field | schema in the shared contracts + route schema (and re-sync any generated client copy) |
| background work | service method; register the job handler in the route plugin |
| type mirroring a DB row | the repository file, never exported past the port |
| constant an adapter needs | core (shared contracts or `domain.ts`), not a module |

## Workflow: new or changed module (copy and tick off)

```
- [ ] 1. Domain types (schemas) + the port the service needs
- [ ] 2. Service against ports only; unit test with in-memory fakes
- [ ] 3. Driven adapter implements the port (repository / src/adapters), maps to domain
- [ ] 4. Wire it in the composition root; routes.ts builds the service from container parts
- [ ] 5. routes.ts stays thin: schema -> request context -> one service call -> status
- [ ] 6. Register the module in the app's module index; integration tests for repository + route
- [ ] 7. Run the Check below - zero new violations; if not, fix and re-run
```

Review checklist: no DB/HTTP-framework/SDK/`adapters/*` import in application code - no query or
business branch in `routes.ts` - schema on params/body/response - constructor takes ports, not the container - repository returns domain types -
SDK errors mapped to the app error type - transaction in the service - no cross-module internals or
cycles - generated contract copies re-synced.

## Check

[assets/dependency-cruiser.cjs](assets/dependency-cruiser.cjs) is an **example config** (nine rules, one `LAYOUT` block at the top). Copy it into the project, edit the `LAYOUT` constants and the package lists to match your folders and SDKs, then run it from the backend package root:

```bash
npx depcruise src --config dependency-cruiser.cjs --output-type err
```

Pass = `no dependency violations found`; exit != 0 = errors, each naming its rule. It sees **imports only**: logic in
routes or a missing transaction needs the checklist. Do not baseline existing violations; fix them or record them as debt the user agreed to. Needs `dependency-cruiser` as a dev dependency; ask before installing it.

## Read next

| When you are... | Read |
|---|---|
| Using the HTTP framework, ORM, schema library, an SDK, the job queue or writing tests | [tools.md](references/tools.md) |
| Writing a port, repository, service, unit of work, ACL adapter or fake | [patterns.md](references/patterns.md) |
| Checking why a rule exists or where sources disagree | [sources.md](references/sources.md) |

## Out of scope

- Queries, relations, migrations and table design - use an ORM/database skill.
- HTTP-framework plugins, hooks, security, performance (for Fastify: `fastify-best-practices`); client code - `frontend-architecture`.
