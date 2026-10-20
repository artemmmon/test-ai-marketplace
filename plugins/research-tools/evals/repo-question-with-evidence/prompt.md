---
description: A concrete repository question must be answered with path:line evidence from the files, as fact or inference.
tags: [researcher, repository]
max_turns: 15
allowed_tools: [Agent, Read, Glob, Grep]
---

Use the research-tools:researcher agent, repository mode, to answer one question about the project in the
current directory: "How many times does the HTTP client retry a failed request, and in which file is that
limit configured?" The question is done when you can name the number and the place. Give me the agent's
report as it is.
