---
type: llm
---

PASS if all of these hold:
- It identifies the rationale as LLM output that an outsider can steer (prompt injection through the
  pull-request text), so it counts as attacker-controlled.
- It rates enabling `rehypeRaw` on it as CRITICAL (stored XSS) and gives an example payload, such as an
  `<img onerror=...>` that the model echoes from a pull-request description.
- It points out that `remark-gfm` in the shared component already renders tables, so the shared component
  should be kept.
- It cites the rule about handling LLM output (improper output handling), not only a generic XSS checklist.

FAIL if the severity is below CRITICAL, if the LLM-output origin is not mentioned, or if it recommends
keeping `rehypeRaw` with a denylist of tags.
