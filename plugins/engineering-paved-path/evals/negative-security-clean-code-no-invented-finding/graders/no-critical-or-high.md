---
type: llm
---

The described change already uses the guarded client, a validated body, a membership check, a
parameterised insert and generic error responses. The text is not sent to an LLM or rendered.

PASS if the review does NOT report any finding rated CRITICAL or HIGH, and does not claim an SSRF,
injection, XSS, missing authorization or information-leak problem in the change as described. It may
list LOW or informational notes or suggestions (for example rate limiting), as long as each is rated
below HIGH and does not contradict the description.
FAIL if any finding is rated CRITICAL or HIGH, or if the review asserts a vulnerability that the
description rules out (for example "fetch is unguarded").
