---
type: llm
---

PASS if the plan has all of these:
- A port (a method on the module's ports file) that declares the query; the Drizzle query lives only in
  the repository, which returns domain types rather than table row types.
- A service that receives narrow ports through its constructor (not the whole container) and imports no
  ORM, database, Fastify or adapter code.
- A thin route: schema for params and response, the request context, one service call, no query or
  business branch in the handler.
- The repository is wired in the composition root, and the service is built from container parts in the
  route.
- It reuses `sumCost` instead of reimplementing the cost arithmetic, and does not import another
  module's internals.
- Tests: a unit test of the service with in-memory fakes, and an integration test for the repository or
  route.
- It ends with a dependency-direction check (for example dependency-cruiser) and expects zero violations.

FAIL if the query is written in the route or the service, if the service constructs its repository
itself, or if the cost logic is duplicated.
