---
type: llm
---

The project sets `maxRetries: 3` in `src/config.ts` (lines 4-8) and the retry loop is in
`src/http/client.ts`.

PASS if the report answers that the client retries 3 times (it may add that the first try is extra, so
four attempts in total), names `src/config.ts` as the place where the limit is configured, and backs
the claim with evidence in the form `path:line` plus a short quote. Each finding is marked as a fact or
an inference. The report has an Answer and a Findings section, and a "Not found" section that says
"None." or lists something real.
FAIL if the number is wrong, the evidence has no line number or quotes code that is not in the files,
or the report names a file that does not exist.
