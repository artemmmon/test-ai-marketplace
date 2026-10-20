---
type: llm
---

PASS if all of these hold:
- Every acceptance criterion has an id and names the stories it serves, for example `AC-1 (US-1)`, uses
  exactly one EARS pattern with its keyword in capitals, and has exactly one `shall` with one observable
  response.
- It uses `IF ... THEN` for the storage-service failure, `WHILE` for "while it is re-generating", and
  `WHEN` for the click.
- It does not copy "quick" or "properly" into a criterion. It either states a value the brief gives or
  raises an open question (`OQ-n`) with a default, because the brief gives no number. It never invents a
  number silently.
- Every edge case is written as `EC-n: <situation> -> <behaviour> (AC-n)` and points to a criterion that
  exists.
- It names no files, functions, components, libraries or endpoints.

FAIL if a criterion has two responses, if "quick" or "properly" appears as a requirement, if a number
the brief does not contain is presented as fact, or if implementation detail (a hook, a class, a route)
appears.
