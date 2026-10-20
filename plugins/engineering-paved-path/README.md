# engineering-paved-path

Engineering knowledge for TypeScript web projects, packaged as skills. They load on demand
(each `description` lists its triggers), so installing the plugin costs nothing until a task matches.
The plugin has no agents, hooks, MCP servers or scripts that run on their own.

## Skills

| Skill | Use it for | Notes |
|---|---|---|
| `fastify-best-practices` | Building, configuring and debugging Fastify servers: routes, plugins, schemas, hooks, errors, Pino logging, testing with `inject()`, deployment | Vendored from `mcollina/skills` (MIT); 19 rule files |
| `onion-architecture` | Backend layering: which ring a file belongs to, import direction, ports, repositories, transactions, SDK adapters | Includes `assets/dependency-cruiser.cjs`, an **example** config to copy and edit |
| `frontend-architecture` | React + Next.js App Router: where components, hooks, constants, helpers, data fetching and providers live; how to split a component | Six topic references |
| `security` | Input handling, SSRF, SQL, child processes, secrets and logs, CI, LLM output handling, and a CRITICAL / WARNING rating scale for findings | Stack-independent |

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

### Left out for licensing reasons

These skills were considered for 1.0.0 and **excluded** because no license permitting redistribution
could be established (NFR-2 of `docs/specs/sdd-plugins.md`):

- `next-best-practices` - upstream `vercel-labs/next-skills` has no license file (GitHub reports none) and has
  since removed the skill and moved Next.js guidance into `vercel/next.js`.
- `react-best-practices` and `react-testing-library` - the earliest public copy found is
  `burnjohn/quick-blog` (in its Claude skills folder), which has no license; no other origin was found. Both can be
  added in a later release once the author's permission or a license is confirmed.

## Links

- [CHANGELOG.md](CHANGELOG.md)
- [COMPATIBILITY.md](COMPATIBILITY.md)
