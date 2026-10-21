---
description: Smoke - the plugin set loads, spec-creator is dispatched for pass 1 and writes no file. Deterministic graders only, no judge.
tags: [sdd-engineering, smoke]
plugins: ["../../../plugins/sdd-engineering", "../../../plugins/engineering-paved-path", "../../../plugins/research-tools", "../../../plugins/architecture-review"]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Agent, Skill, Read, Glob, Grep]
---

Use the sdd-engineering:spec-creator agent for pass 1 only (discovery; it must write nothing yet) on this
feature, and give me its report as your final message, unchanged:

"On the report page the user should be able to re-generate a failed report with one click. It should be
quick and handle errors properly. While it is re-generating, the old result should stay visible. If the
storage service is down, tell the user."

There is no design for it and no other source: the brief above is all there is. The working directory is
a new project with no code yet.
