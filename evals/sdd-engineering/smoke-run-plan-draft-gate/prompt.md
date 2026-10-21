---
description: Smoke - run-plan on a draft spec starts no later stage. Deterministic grader only, no judge.
tags: [sdd-engineering, smoke]
plugins: ["../../../plugins/sdd-engineering", "../../../plugins/engineering-paved-path", "../../../plugins/research-tools", "../../../plugins/architecture-review"]
max_turns: 15
allowed_tools: [Agent, Skill, Read, Glob, Grep]
---

/sdd-engineering:run-plan specs/10-report-rerun.md
