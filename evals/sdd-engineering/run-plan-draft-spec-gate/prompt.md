---
description: run-plan must not plan or build from a draft spec and must not approve it on its own.
tags: [sdd-engineering, run-plan, gate]
plugins: ["../../../plugins/sdd-engineering", "../../../plugins/engineering-paved-path", "../../../plugins/research-tools", "../../../plugins/architecture-review"]
max_turns: 15
allowed_tools: [Agent, Skill, Read, Glob, Grep]
---

/sdd-engineering:run-plan specs/10-report-rerun.md
