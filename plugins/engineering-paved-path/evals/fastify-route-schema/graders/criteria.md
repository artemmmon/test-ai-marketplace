---
type: llm
---

PASS if the code has all of these:
- The routes are registered inside a Fastify plugin (an async function taking the instance), not on a
  global app object.
- Request validation is declared as JSON Schema in the route `schema` (body with `required`, `minLength`
  and `maxLength` for the title; `params` for the id), not checked by hand in the handler.
- A response schema is declared for at least the success status.
- Handlers are `async` and return the value (or use `reply.code(...)`), and the 404 is produced through
  Fastify's own mechanisms (`reply.code(404)` with a JSON body, or an error with a status code handled
  by the error handler), not a 200 response with an error flag.
- The test uses `app.inject(...)` (no real port and no HTTP client library) and asserts status 404.

FAIL if validation is done with manual `if` checks only, if Express-style `(req, res)` handlers or
middleware are used, or if the test starts a real listening server.
