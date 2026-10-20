# engineering-paved-path

Engineering knowledge for TypeScript web projects, packaged as seven skills: Fastify, React, Next.js, React Testing
Library, backend (onion) architecture, frontend architecture and application security. A skill loads only when a
task matches its description, so until then only the short descriptions are in Claude's context. Install the plugin
once and Claude applies the same conventions whenever it writes, reviews or refactors that kind of code. You can
also call any skill yourself with a slash command, and other agents use them as their rulebook.

The plugin has no agents, hooks, MCP servers or scripts that run on their own.

## What you get

| Skill | Use it for | Notes |
|---|---|---|
| `fastify-best-practices` | Building, configuring and debugging Fastify servers: routes, plugins, schemas, hooks, errors, Pino logging, testing with `inject()`, deployment | Vendored from `mcollina/skills` (MIT); 19 rule files |
| `onion-architecture` | Backend layering: which ring a file belongs to, import direction, ports, repositories, transactions, SDK adapters, job handlers | Includes `assets/dependency-cruiser.cjs`, an **example** config to copy and edit |
| `frontend-architecture` | React + Next.js App Router: where components, hooks, constants, helpers, data fetching and providers live; how to split a component; import boundaries and naming | Six topic references |
| `security` | Where attacker-controlled data enters, how to handle it (input, SSRF, SQL, child processes, paths, secrets and logs, CI, LLM prompts and output), and a CRITICAL / WARNING rating scale for findings | Stack-independent |
| `react-best-practices` | Writing, reviewing and refactoring React components, hooks and state: derived state, effects, keys, rendering, accessibility | Rules carry CRITICAL / HIGH / MEDIUM severity; **no confirmed license** (see Licensing notice) |
| `next-best-practices` | Next.js App Router: file conventions, Server and Client Component boundaries, async APIs, metadata, route handlers, images, fonts, hydration errors | Model-invoked only (not in the `/` menu); 19 reference files; **no confirmed license** (see Licensing notice) |
| `react-testing-library` | Testing React components and hooks with React Testing Library and Vitest: queries, `userEvent`, async patterns, mocking, user-flow tests | **No confirmed license** (see Licensing notice) |

How the architecture skills are built: each has a short `SKILL.md` with the rules and a "where does X go?" table,
and `references/` files that are read only when a task needs them. `onion-architecture` and `frontend-architecture`
cite the public articles they are based on in `references/sources.md`.

## Install

```sh
claude plugin marketplace add artemmmon/test-ai-marketplace
claude plugin install engineering-paved-path@test-ai-marketplace
```

The plugin has no dependencies. Dependencies of *other* plugins are installed automatically, so you usually get this
plugin without asking when you install `architecture-review` or `sdd-engineering`. To update later, see the root
README of the marketplace (`/plugin marketplace update test-ai-marketplace`, then `/reload-plugins`).

## How to use it

**Just work.** Describe the task and Claude loads the matching skill by itself:

```
Add a GET /orders/:id route to the Fastify API with response validation and a 404 when the order is missing.
```

```
Where should the discount calculation live: in the component, in a hook, or somewhere else?
```

```
Review this change for security problems: it adds an endpoint that fetches a URL supplied by the user.
```

**Call a skill yourself.** Type `/engineering-paved-path:<skill>`, optionally followed by what you want:

```
/engineering-paved-path:security review the diff of my branch
/engineering-paved-path:frontend-architecture split components/OrderTable.tsx
/engineering-paved-path:onion-architecture where does the retry logic for the payment SDK belong?
/engineering-paved-path:react-testing-library write a user-flow test for the checkout form
```

`next-best-practices` is the exception: it has `user-invocable: false`, so it is not a `/` command and not in the `/`
menu. Claude loads it when the task is Next.js work, and agents load it through the Skill tool.

**From agents and other skills**, use the scoped name, because plugin components are namespaced:
`engineering-paved-path:onion-architecture`. In an agent's frontmatter, `skills: [engineering-paved-path:security]`
preloads the skill into that agent.

### Run the architecture check

`onion-architecture/assets/dependency-cruiser.cjs` is an example, not a gate: nothing runs it for you. Copy it into
your backend package, edit the `LAYOUT` block at the top to match your folders and the package lists to match your
SDKs, and run it yourself (it needs `dependency-cruiser` as a dev dependency; the skill asks before installing it):

```sh
npx depcruise src --config dependency-cruiser.cjs --output-type err
```

The skill documents nine rules; the check sees imports only, so logic in a route or a missing transaction still
needs the skill's review checklist.

## Inputs and configuration

There are no settings. The skills adapt to the project in front of them: they read your project's `CLAUDE.md` or
`AGENTS.md` if it has one, treat the folder names in their examples (`src/modules/<m>/`, `features/<f>/`) as an
example layout, and say that the project's own conventions win over generic advice.

## Dependencies

None. Other plugins of this marketplace depend on this one: `architecture-review` preloads `onion-architecture`
and `frontend-architecture` as the rubric of its reviewer, and `sdd-engineering` preloads `security` for its spec
writer and uses the architecture skills when it plans.

## What it deliberately does not do

- It does not run anything by itself: no hooks, no scripts, no background checks.
- It does not cover query tuning, migrations or table design (use an ORM or database skill), or UI performance
  tuning beyond the rules in the React and Next.js skills.
- It is not tied to one project layout. The architecture skills describe rings and import directions; the folder
  names are examples to map onto yours.
- `security` is a rulebook for writing and reviewing code, not a scanner. A finding is reported only when the
  attacker-controlled input and a reachable path can be stated.

## Requirements

Claude Code 2.1.269 or newer. `dependency-cruiser` is needed only if you run the example architecture check.

## License

MIT for the plugin and for the original skills (`onion-architecture`, `frontend-architecture`, `security`).
`fastify-best-practices` keeps its own MIT `LICENSE`. Three skills have no confirmed upstream license, see below.

## Licensing notice

Three skills in this plugin, `next-best-practices`, `react-best-practices` and `react-testing-library`, are included
**without a confirmed upstream license**. We could not find the original authors' license terms, so they are here for
**test and lab use only** in this test marketplace. They are **not covered by the MIT license** of this plugin; each
of them has a `LICENSE-NOTICE.md` in its folder with what is known about its origin. Do not rely on them for
production use or redistribution without checking the rights yourself. If you are the rights holder and want one of
them removed, contact the marketplace maintainer and it will be removed on request.

## Sources

| Skill | Origin | License |
|---|---|---|
| `fastify-best-practices` | https://github.com/mcollina/skills (`skills/fastify`), vendored snapshot, copyright (c) 2026 Matteo Collina | MIT; the full text is in `skills/fastify-best-practices/LICENSE` |
| `onion-architecture` | Original work; cites public articles listed in `references/sources.md` | MIT (plugin license) |
| `frontend-architecture` | Original work; cites public articles listed in `references/sources.md` | MIT (plugin license) |
| `security` | Original work; cites the OWASP and vendor documents listed in the skill | MIT (plugin license) |
| `next-best-practices` | Snapshot of the skill from https://github.com/vercel-labs/next-skills; that repository has no license file, and the skill later moved into `vercel/next.js` | **Not established**; test use only, see `skills/next-best-practices/LICENSE-NOTICE.md` |
| `react-best-practices` | Origin unconfirmed; the earliest public copy found is in the Claude skills folder of https://github.com/burnjohn/quick-blog, which has no license | **Not established**; test use only, see `skills/react-best-practices/LICENSE-NOTICE.md` |
| `react-testing-library` | Origin unconfirmed; the earliest public copy found is in the Claude skills folder of https://github.com/burnjohn/quick-blog, which has no license | **Not established**; test use only, see `skills/react-testing-library/LICENSE-NOTICE.md` |

The last three skills are included for test and lab use despite the missing license (see the Licensing notice above)
and will be removed on request of the rights holder.

## Links

- [CHANGELOG.md](CHANGELOG.md)
- [COMPATIBILITY.md](COMPATIBILITY.md)
