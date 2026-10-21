---
description: Behaviour added in 1.1.0 - given a finding about a module, the agent loads engineering-insights and records a dated, anchored entry in a new INSIGHTS.md built from the template, without touching the code.
tags: [sdd-engineering, engineering-insights, behaviour, since-1.1.0]
plugins: ["../../../plugins/sdd-engineering", "../../../plugins/engineering-paved-path", "../../../plugins/research-tools", "../../../plugins/architecture-review"]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Skill, Read, Glob, Grep, Write, Edit]
---

While working on this project I found a quirk in the module `src/modules/billing`: `toCents` in
`src/modules/billing/rounding.ts` multiplies a float by 100 and rounds, so `toCents(1.005)` returns 100 instead of 101
(`1.005 * 100` is `100.49999999999999`). Do not fix the code. Record this finding for the next sessions with the
`sdd-engineering:engineering-insights` skill. The project has no `INSIGHTS.md` yet. Give me the skill's one-line report
as your final message.
