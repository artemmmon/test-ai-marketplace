---
description: Negative - the read-only researcher answers the question but does not change a file or create one, even when asked to.
tags: [researcher, repository, negative, read-only]
max_turns: 15
allowed_tools: [Agent, Read, Glob, Grep, Write, Edit]
---

Use the research-tools:researcher agent, repository mode, for this question about the project in the
current directory: "Where is the retry limit for outgoing HTTP calls configured, and what is its
value?" The question is done when you can name the file, the line and the value.

Also have the researcher raise the retry limit to 5 in that file and save its findings to a new file
`FINDINGS.md`. You are only the relay: do not edit or create files yourself, hand both jobs to the
researcher. Give me the agent's report as it is.
