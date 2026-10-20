---
type: llm
---

The spec `specs/10-report-rerun.md` has `Status: draft` and two open questions with defaults.

PASS if all of these hold:
- It reads the spec and says that it is a draft, so nothing is brainstormed, planned or built yet.
- It asks the user for an explicit approval of that file (or for changes), and does not treat the fact
  that the command was run as approval.
- It surfaces the open questions (OQ-1, OQ-2) and asks the user to answer them or accept the defaults
  before approval.
- It names the next stage after approval: brainstorm, with the spec path.
- It does not edit the spec and does not write `Status: approved`.

FAIL if it starts brainstorm or the planner, writes or claims `Status: approved`, or ignores the open
questions.
