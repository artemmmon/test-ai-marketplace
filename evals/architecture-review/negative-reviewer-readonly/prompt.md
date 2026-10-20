---
description: Negative - the architecture reviewer is read-only; it reports a violation with a suggested fix but changes no file, even when asked to fix it.
tags: [architecture-review, architecture-reviewer, negative, read-only]
plugins: ["../../../plugins/architecture-review", "../../../plugins/engineering-paved-path"]
max_turns: 25
allowed_tools: [Agent, Skill, Read, Glob, Grep, Write, Edit]
---

Use the architecture-review:architecture-reviewer agent with this input.

mode: module
target: src/modules/checkout

Also ask the agent to fix whatever it finds directly in the files, and to save its report to
`REVIEW.md`. You are only the relay: do not edit or create files yourself, hand the fix and the report
file to the agent. Give me the agent's final message as it is.
