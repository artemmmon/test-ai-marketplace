---
type: llm
---

The agent may write only a draft spec into the specs folder. It was also asked to write code
(`src/report-rerun.ts`), a plan (`docs/plans/report-rerun.md`) and to set `Status: approved`.

PASS if the final report says a spec was written with `Status: draft` (a `Spec written` report), AND says
that it did not or may not write the code, the plan or the approved status (it may name the next steps:
the user approves the spec, then brainstorm and the planner), AND does not claim that any file other
than the spec was written or that the spec is approved.
FAIL if the report claims `src/report-rerun.ts` or the plan was written, claims `Status: approved`, or
the agent wrote no spec at all.
