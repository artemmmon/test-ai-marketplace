# engineering-paved-path

Engineering knowledge for TypeScript web projects (Fastify, React, Next.js, testing, architecture, security), packaged as skills. They load on demand
(each `description` lists its triggers), so installing the plugin costs nothing until a task matches.
The plugin has no agents, hooks, MCP servers or scripts that run on their own.

## Licensing notice

Three skills in this plugin, `next-best-practices`, `react-best-practices` and `react-testing-library`, are included
**without a confirmed upstream license**. We could not find the original authors' license terms, so they are here for
**test and lab use only** in this test marketplace. They are **not covered by the MIT license** of this plugin; each
of them has a `LICENSE-NOTICE.md` in its folder with what is known about its origin. Do not rely on them for
production use or redistribution without checking the rights yourself. If you are the rights holder and want one of
them removed, contact the marketplace maintainer and it will be removed on request.

## Skills

| Skill | Use it for | Notes |
|---|---|---|
| `fastify-best-practices` | Building, configuring and debugging Fastify servers: routes, plugins, schemas, hooks, errors, Pino logging, testing with `inject()`, deployment | Vendored from `mcollina/skills` (MIT); 19 rule files |
| `onion-architecture` | Backend layering: which ring a file belongs to, import direction, ports, repositories, transactions, SDK adapters | Includes `assets/dependency-cruiser.cjs`, an **example** config to copy and edit |
| `frontend-architecture` | React + Next.js App Router: where components, hooks, constants, helpers, data fetching and providers live; how to split a component | Six topic references |
| `security` | Input handling, SSRF, SQL, child processes, secrets and logs, CI, LLM output handling, and a CRITICAL / WARNING rating scale for findings | Stack-independent |
| `react-best-practices` | Writing, reviewing and refactoring React components, hooks and state: derived state, effects, keys, rendering, accessibility | Rules carry CRITICAL / HIGH / MEDIUM severity; **no confirmed license** (see Licensing notice) |
| `next-best-practices` | Next.js App Router: file conventions, Server and Client Component boundaries, async APIs, metadata, route handlers, images, fonts, hydration errors | Model-invoked only (not in the `/` menu); 19 reference files; **no confirmed license** (see Licensing notice) |
| `react-testing-library` | Testing React components and hooks with React Testing Library and Vitest: queries, `userEvent`, async patterns, mocking, user-flow tests | **No confirmed license** (see Licensing notice) |

## How to call them

- **Users:** type `/engineering-paved-path:<skill>`, for example `/engineering-paved-path:security`.
  Claude also loads a skill by itself when the task matches its description.
- **Agents and other skills:** refer to the scoped name `engineering-paved-path:<skill>`
  (for example `engineering-paved-path:onion-architecture`), because plugin components are namespaced.

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install engineering-paved-path@test-ai-marketplace
```

## Example config, not a gate

`onion-architecture/assets/dependency-cruiser.cjs` is an example. Nothing runs it for you: copy it into
your project, edit its `LAYOUT` block to your folders, and run it yourself (it needs `dependency-cruiser`).

## Sources

| Skill | Origin | License |
|---|---|---|
| `fastify-best-practices` | https://github.com/mcollina/skills (`skills/fastify`), vendored snapshot, copyright (c) 2026 Matteo Collina | MIT; the full text is in `skills/fastify-best-practices/LICENSE` |
| `onion-architecture` | Original work, extracted from the DevDigest project; cites public articles listed in `references/sources.md` | MIT (plugin license) |
| `frontend-architecture` | Original work, extracted from the DevDigest project; cites public articles listed in `references/sources.md` | MIT (plugin license) |
| `security` | Original work, extracted from the DevDigest project; cites the OWASP and vendor documents listed in the skill | MIT (plugin license) |
| `next-best-practices` | Snapshot of the skill from https://github.com/vercel-labs/next-skills; that repository has no license file, and the skill later moved into `vercel/next.js` | **Not established**; test use only, see `skills/next-best-practices/LICENSE-NOTICE.md` |
| `react-best-practices` | Origin unconfirmed; the earliest public copy found is in the Claude skills folder of https://github.com/burnjohn/quick-blog, which has no license | **Not established**; test use only, see `skills/react-best-practices/LICENSE-NOTICE.md` |
| `react-testing-library` | Origin unconfirmed; the earliest public copy found is in the Claude skills folder of https://github.com/burnjohn/quick-blog, which has no license | **Not established**; test use only, see `skills/react-testing-library/LICENSE-NOTICE.md` |

The last three skills are included for test and lab use despite the missing license (see the Licensing notice at the top)
and will be removed on request of the rights holder.

## Links

- [CHANGELOG.md](CHANGELOG.md)
- [COMPATIBILITY.md](COMPATIBILITY.md)
