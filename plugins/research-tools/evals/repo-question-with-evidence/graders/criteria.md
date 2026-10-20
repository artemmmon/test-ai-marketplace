---
type: llm
---

The project sets `maxRetries: 3` in `src/config.ts` (line 5) and the retry loop is in
`src/http/client.ts`. The workspace root is a temporary directory, so a path may be absolute as long as
it ends in `src/config.ts` or `src/http/client.ts`.

PASS if the report's Answer says the client retries 3 times (it may add that the first try is extra, so
four attempts in total) and names `src/config.ts` as the place where the limit is configured, and the
evidence quotes `maxRetries: 3`.
FAIL if the number is wrong, the place is not `src/config.ts`, or the report names a file that is not
one of `src/config.ts`, `src/http/client.ts`, `docs/RESILIENCE.md`.
