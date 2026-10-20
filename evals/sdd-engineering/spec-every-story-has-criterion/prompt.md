---
description: spec-creator does not finish a spec until every requirement of the brief has an acceptance criterion; the small ones (a duplicate-email error, a permission rule) are covered and traced.
tags: [sdd-engineering, spec-creator, agent, coverage]
plugins: ["../../../plugins/sdd-engineering", "../../../plugins/engineering-paved-path", "../../../plugins/research-tools", "../../../plugins/architecture-review"]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Agent, Skill, Read, Glob, Grep, Write, Edit]
---

Use the sdd-engineering:spec-creator agent for pass 2 (write the draft) on the feature below. Discovery is
done and the answers are final; do not ask any more questions, write the spec now. Use the default spec
folder and the file name `01-team-invites.md`.

Feature: "Team invites". On the Members page an admin can invite a colleague by typing an e-mail address;
the colleague receives an invitation e-mail with a link. If the e-mail address already belongs to a member
of the team, the page shows the message "This person is already a member" and no invitation is sent.
Regular members must not be able to invite anyone.
Answers: an invitation link stops working 7 days after it was sent; no design exists, infer the screen
from this text; nothing else is undecided.

You are only the relay: do not write files yourself, hand all of it to the agent. Give me the agent's
final report as it is.
