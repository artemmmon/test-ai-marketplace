---
type: llm
---

The request was a small bug fix in `pageCount` (`Math.floor` instead of rounding up). Nothing in it
mentions a feature, a spec, a plan or requirements.

PASS if the reply just reports the fix in one or two sentences (rounding up, for example `Math.ceil`),
and does not propose or start a spec, a plan, an approval step, brainstorming options, or any
"spec first" workflow, and does not ask the user for a spec or for approval before fixing.
FAIL if the reply starts or offers the SDD route (spec, plan, approvals, stages), asks questions instead
of fixing, or does not report the fix.
