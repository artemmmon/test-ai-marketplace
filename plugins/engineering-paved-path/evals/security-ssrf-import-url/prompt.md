---
description: A route that fetches a user-supplied URL is SSRF unless it goes through the project's guard.
tags: [security, ssrf]
max_turns: 8
allowed_tools: [Skill, Read, Glob, Grep]
---

Review this change to a Node.js API. A new route `POST /specs/import` takes `{ url }` in the request body,
and the service loads it with `const res = await fetch(body.url); const text = await res.text();` before
saving the text as a project spec. The project already has a guarded outbound client, `SafeHttpFetcher`
(exposed as `container.httpFetcher`), which the existing skill-import feature uses through a port.

List your findings with a severity each.
