---
description: A vague brief becomes EARS criteria with ids and traceability, without invented numbers or implementation detail.
tags: [sdd-engineering, spec-authoring, skill]
plugins: ["../../../plugins/sdd-engineering", "../../../plugins/engineering-paved-path", "../../../plugins/research-tools", "../../../plugins/architecture-review"]
max_turns: 10
allowed_tools: [Skill, Read, Glob, Grep]
---

Write the User stories, Acceptance criteria and Edge cases sections of a feature spec from this brief only:
"On the report page the user should be able to re-generate a failed report with one click. It should be
quick and handle errors properly. While it is re-generating, the old result should stay visible. If the
storage service is down, tell the user."
