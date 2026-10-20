---
type: llm
---

The reply must be the reviewer's JSON report (one JSON object).

The change follows the layering rules: a pure domain function, a port, a service that receives the port
through its constructor, and a thin route that builds the service from the container.

PASS if the report has no finding with severity CRITICAL, reports `"checks": []` (or equivalent) and
explains in `not_checked` that no mechanical checks were configured, and any finding it does list has a
rule, a file, a line and a quoted evidence. An empty `findings` array is the best result; a couple of
SUGGESTION or WARNING items about real structure are acceptable.
FAIL if it reports any CRITICAL finding, invents a violation (for example claims the service imports an
ORM), or lists findings without evidence.
