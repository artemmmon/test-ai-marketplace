# Code shapes

Sources: [S5] sliced onion, [S7][S11] ports and adapters, [S9] composition root,
[S16][S17] transactions, [S18][S19] repositories, [S21] anti-corruption layer.
Sketches use a typical TypeScript ESM style (`.js` import suffixes, a shared contracts package imported as
`@app/shared`, an `AppError` family). Names and paths are illustrative: adapt them to your project,
don't paste blindly.

## Contents
1. Port (core)
2. Repository implements the port (driven adapter)
3. Service (application)
4. Wiring (composition root / route plugin)
5. Thin route (driving adapter)
6. Unit of work over `db.transaction`
7. Anti-corruption adapter for an SDK
8. Service test with in-memory fakes
9. Before → after: `modules/orders/routes.ts`

## 1. Port (core) — `modules/repos/ports.ts` [S7][S11]

```ts
import type { Repo } from '@app/shared';

export interface NewRepo { workspaceId: string; owner: string; name: string; createdBy: string }

export interface RepoStore {
  findByFullName(workspaceId: string, fullName: string): Promise<Repo | undefined>;
  insert(input: NewRepo): Promise<Repo>;
  setClonePath(repoId: string, path: string): Promise<void>;
}

/** Types used only by this port live beside it; shared entities go in domain.ts / the shared contracts. */

/** Enqueue side of platform/jobs.ts — the service never sees p-queue. */
export interface JobQueue { enqueue(kind: string, payload: unknown): Promise<{ id: string }> }
```

## 2. Repository implements the port (driven adapter) [S18][S19]

```ts
import { and, eq } from 'drizzle-orm';
import type { Repo } from '@app/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { NewRepo, RepoStore } from './ports.js';

type RepoRow = typeof t.repos.$inferSelect; // not exported

const toDomain = (r: RepoRow): Repo => ({ id: r.id, owner: r.owner, name: r.name, /* … */ });

export class DrizzleRepoStore implements RepoStore {
  constructor(private db: Db) {}

  async findByFullName(workspaceId: string, fullName: string) {
    const [row] = await this.db.select().from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, fullName)));
    return row && toDomain(row);
  }
  // insert / setClonePath …
}
```

## 3. Service (application) — ports in, domain out [S9]

```ts
import type { GitClient, SecretsProvider } from '@app/shared';
import { NotFoundError } from '../../platform/errors.js';
import type { JobQueue, RepoStore } from './ports.js';

export interface RepoServiceDeps { repos: RepoStore; git: GitClient; secrets: SecretsProvider; jobs: JobQueue }

export class RepoService {
  constructor(private deps: RepoServiceDeps) {}

  async runCloneJob(p: CloneJobPayload): Promise<void> {
    const { path } = await this.deps.git.clone({ owner: p.owner, name: p.name }, p.url, { depth: 1 });
    await this.deps.repos.setClonePath(p.repoId, path);
  }
}
```

## 4. Wiring (composition root / route plugin) [S9]

```ts
// platform/container.ts
get reposStore(): RepoStore { return (this._reposStore ??= new DrizzleRepoStore(this.db)); }

// modules/repos/routes.ts — the only module file that sees the Container
const c = app.container;
const service = new RepoService({ repos: c.reposStore, git: c.git, secrets: c.secrets, jobs: c.jobs });
c.jobs.register(CLONE_JOB_KIND, (p) => service.runCloneJob(CloneJobPayload.parse(p)));
```

## 5. Thin route (driving adapter) [S12]

```ts
app.post('/repos', { schema: { body: RepoInput, response: { 200: Repo, 201: Repo } } }, async (req, reply) => {
  const { workspaceId, userId } = await getContext(app.container, req);
  const { repo, created } = await service.add(workspaceId, userId, req.body.url);
  return reply.status(created ? 201 : 200).send(repo);
});
```

## 6. Unit of work over `db.transaction` [S16][S17]

```ts
// ports.ts (core)
export interface ReviewStores { reviews: ReviewStore; findings: FindingStore }
export interface UnitOfWork { run<T>(work: (s: ReviewStores) => Promise<T>): Promise<T> }

// repository/uow.ts (outer)
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private db: Db) {}
  run<T>(work: (s: ReviewStores) => Promise<T>) {
    return this.db.transaction((tx: Tx) =>
      work({ reviews: new DrizzleReviewStore(tx), findings: new DrizzleFindingStore(tx) }));
  }
}
// service: await this.deps.uow.run(async ({ reviews, findings }) => { … });
```

Stores take `Db | Tx` in the constructor, so the same class works inside and outside a transaction.

## 7. Anti-corruption adapter for an SDK [S21]

```ts
// adapters/github/octokit.ts — Octokit types stop here
async listPullRequests(repo: RepoRef): Promise<PrMeta[]> {
  try {
    const res = await withRetry(() => this.octokit.rest.pulls.list({ owner: repo.owner, repo: repo.name, state: 'all' }));
    return res.data.map((pr) => ({ number: pr.number, title: pr.title, status: mapStatus(pr.state, !!pr.merged_at), /* … */ }));
  } catch (err) {
    throw new ExternalServiceError('GitHub: list pull requests failed', { cause: String(err) });
  }
}
```

## 8. Service test with in-memory fakes [S11]

```ts
class InMemoryRepoStore implements RepoStore { rows = new Map<string, Repo>(); /* … */ }

it('persists the clone path', async () => {
  const repos = new InMemoryRepoStore();
  const service = new RepoService({ repos, git: new MockGitClient(), secrets: new MockSecretsProvider(), jobs: { enqueue: async () => ({ id: 'j1' }) } });
  await service.runCloneJob({ repoId: 'r1', owner: 'o', name: 'n', url: 'https://github.com/o/n' });
  expect(repos.rows.get('r1')?.clone_path).toBeDefined();
});
```

No `(service as any).repo = …`, no DB, no network.

## 9. Before → after: `modules/orders/routes.ts` [S5]

Before: the route handler imports the ORM and the schema, selects the customer, calls the payment
SDK, upserts `orders` rows and computes statuses. HTTP, persistence, the SDK and business rules
sit in one ring.

After:
- `orders/ports.ts` — `OrderStore` (`listForCustomer`, `upsertMany`, `getDetail`).
- `orders/repository.ts` — `SqlOrderStore implements OrderStore` (all the current queries).
- `orders/service.ts` — `OrderService({ orders, customers, payments })`: `syncAndList(tenantId, customerId)`
  uses the `PaymentsClient` port and `OrderStore`, plus the existing pure helpers (`status.ts`, `totals.ts`).
- `orders/routes.ts` — schema -> request context -> `service.syncAndList` -> reply.
- The SDK client is resolved in the container and passed in, or wrapped as a lazy
  `() => Promise<PaymentsClient>` port so the route stays synchronous at plugin build time.
