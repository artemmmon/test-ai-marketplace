---
description: LLM output is attacker-steerable; enabling raw HTML in its renderer is stored XSS.
tags: [security, llm-output, xss]
max_turns: 8
allowed_tools: [Skill, Read, Glob, Grep]
---

Review this change to a React client. To show tables inside "rationale" text, the finding card now
renders `<ReactMarkdown rehypePlugins={[rehypeRaw]}>{finding.rationale}</ReactMarkdown>` instead of the
project's shared `Markdown` component (which already uses `remark-gfm`, so tables render there).
`finding.rationale` is written by an LLM that reads pull-request titles and descriptions written by
other people.

List your findings with a severity each.
