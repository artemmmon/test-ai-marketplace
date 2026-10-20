---
description: A review request without a target must come back as a clarification, not a review.
tags: [architecture-review, architecture-reviewer, json, clarification]
plugins: ["../../../plugins/architecture-review", "../../../plugins/engineering-paved-path"]
max_turns: 12
allowed_tools: [Agent, Skill, Read, Glob, Grep]
---

Use the architecture-review:architecture-reviewer agent with exactly this input, and give me the JSON it
returns as your final message, unchanged.

mode: module
