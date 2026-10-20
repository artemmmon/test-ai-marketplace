---
description: A new backend endpoint must be placed by ring - port, repository, service, thin route, composition root.
tags: [onion-architecture, design]
max_turns: 8
allowed_tools: [Skill, Read, Glob, Grep]
---

Plan, without writing all the code, how to add `GET /repos/:id/stats` to a TypeScript backend that uses
Fastify, Drizzle and zod. It returns the repository's pull-request count and the total review cost in
USD. The layout is `src/modules/<module>/{routes,service,ports,repository}.ts`, the composition root is
`src/platform/container.ts`, and `src/modules/pulls/cost.ts` already holds a pure function `sumCost(items)`.

List the files you would touch, what goes into each, which tests you would write and which check you
would run at the end.
