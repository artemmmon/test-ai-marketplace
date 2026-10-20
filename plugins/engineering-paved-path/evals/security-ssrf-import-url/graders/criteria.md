---
type: llm
---

PASS if all of these hold:
- The review rates the bare `fetch(body.url)` as CRITICAL (server-side request forgery) and states a
  triggering input, for example `http://169.254.169.254/` or `http://localhost:5432/`.
- It tells the author to reuse the existing `SafeHttpFetcher` through a port, as the skill import does,
  instead of writing a new URL filter.
- It says the fetched text is untrusted and must be fenced and labelled as data if it ever reaches an
  LLM prompt.
- It does not recommend fixes for a different stack (JWT, bcrypt, Express middleware, MongoDB).

FAIL if the severity is below CRITICAL, if no triggering input is named, if it proposes a hand-written
host denylist as the fix, or if it misses the SSRF altogether.
