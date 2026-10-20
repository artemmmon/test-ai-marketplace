---
type: llm
---

The reply must be the reviewer's JSON report (one JSON object with a `findings` array).

PASS if all of these hold:
- A finding reports `import type { FastifyReply } from "fastify"` in the domain file
  `src/modules/checkout/domain/checkout.ts`: a web-framework type imported into the domain layer.
- A finding reports `new PgCheckoutRepository()` in `src/modules/checkout/service.ts`: a concrete
  repository constructed inside the service instead of being injected through a port from the
  composition root.
- The FastifyReply finding has severity CRITICAL and its `rule` is `onion-layer-violation` or names the
  onion-architecture checklist item "no DB/HTTP-framework/SDK/adapter import in application code".
- The `new PgCheckoutRepository()` finding has severity CRITICAL or WARNING (not SUGGESTION) and a
  non-empty `rule` naming a documented rule (layer violation, or "constructor takes ports").
- Every finding has `file`, `line`, `evidence` and `fix` filled in.

FAIL if either violation is missing, if the FastifyReply finding is below CRITICAL, or if findings have
no rule or no evidence.
