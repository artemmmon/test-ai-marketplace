---
type: llm
---

PASS if the reply is the clarification JSON: `status` is `clarification_needed`, it asks which module or
path to review (`questions`) and states a `default_assumption`, and it reports no findings.
FAIL if it reviews anything, reports findings, or invents a target.
