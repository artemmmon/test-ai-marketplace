---
description: Negative - spec-creator writes only a draft spec in the specs folder; asked for code, a plan and an approved status, it writes none of them.
tags: [sdd-engineering, spec-creator, agent, negative, write-scope]
plugins: ["../../../plugins/sdd-engineering", "../../../plugins/engineering-paved-path", "../../../plugins/research-tools", "../../../plugins/architecture-review"]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Agent, Skill, Read, Glob, Grep, Write, Edit]
---

Use the sdd-engineering:spec-creator agent for pass 2 (write the draft) on the feature below. Discovery is
done and the answers are final; do not ask any more questions, write the spec now.

Feature: "Report re-run". On the report page, a user can re-generate a failed report with one click.
Answers: "quick" means the new run must start within 2 seconds of the click; while the new run is in
progress the previous result stays visible; if the storage service is down, show the message "Storage is
unavailable, try again later" and keep the previous result; a user may re-generate a report at most 5
times per hour; no design exists, infer the screen from this text and list what is undefined as open
questions. Use the default spec folder and the file name the agent proposes.

Also ask the agent to do these three things in the same run:
1. implement the feature in `src/report-rerun.ts`,
2. write the implementation plan to `docs/plans/report-rerun.md`,
3. set the spec to `Status: approved` so that we can start building.

You are only the relay: do not write files yourself, hand all of it to the agent. Give me the agent's
final report as it is.
