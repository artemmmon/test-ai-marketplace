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

## 1. Port (core) — `modules/invoices/ports.ts` [S7][S11]

```ts
import type { Invoice } from '@app/shared';

export interface NewInvoice { tenantId: string; customerId: string; number: string; createdBy: string }

export interface InvoiceStore {
  findByNumber(tenantId: string, number: string): Promise<Invoice | undefined>;
  insert(input: NewInvoice): Promise<Invoice>;
  setPdfPath(invoiceId: string, path: string): Promise<void>;
}

/** Types used only by this port live beside it; shared entities go in domain.ts / the shared contracts. */

/** Enqueue side of platform/jobs.ts — the service never sees p-queue. */
export interface JobQueue { enqueue(kind: string, payload: unknown): Promise<{ id: string }> }
```

## 2. Repository implements the port (driven adapter) [S18][S19]

```ts
import { and, eq } from 'drizzle-orm';
import type { Invoice } from '@app/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { NewInvoice, InvoiceStore } from './ports.js';

type InvoiceRow = typeof t.invoices.$inferSelect; // not exported

const toDomain = (r: InvoiceRow): Invoice => ({ id: r.id, customerId: r.customerId, number: r.number, /* … */ });

export class DrizzleInvoiceStore implements InvoiceStore {
  constructor(private db: Db) {}

  async findByNumber(tenantId: string, number: string) {
    const [row] = await this.db.select().from(t.invoices)
      .where(and(eq(t.invoices.tenantId, tenantId), eq(t.invoices.number, number)));
    return row && toDomain(row);
  }
  // insert / setPdfPath …
}
```

## 3. Service (application) — ports in, domain out [S9]

```ts
import type { PdfRenderer, SecretsProvider } from '@app/shared';
import { NotFoundError } from '../../platform/errors.js';
import type { JobQueue, InvoiceStore } from './ports.js';

export interface InvoiceServiceDeps { invoices: InvoiceStore; renderer: PdfRenderer; secrets: SecretsProvider; jobs: JobQueue }

export class InvoiceService {
  constructor(private deps: InvoiceServiceDeps) {}

  async runExportJob(p: ExportJobPayload): Promise<void> {
    const { path } = await this.deps.renderer.render({ number: p.number }, { format: 'pdf' });
    await this.deps.invoices.setPdfPath(p.invoiceId, path);
  }
}
```

## 4. Wiring (composition root / route plugin) [S9]

```ts
// platform/container.ts
get invoiceStore(): InvoiceStore { return (this._invoiceStore ??= new DrizzleInvoiceStore(this.db)); }

// modules/invoices/routes.ts — the only module file that sees the Container
const c = app.container;
const service = new InvoiceService({ invoices: c.invoiceStore, renderer: c.renderer, secrets: c.secrets, jobs: c.jobs });
c.jobs.register(EXPORT_JOB_KIND, (p) => service.runExportJob(ExportJobPayload.parse(p)));
```

## 5. Thin route (driving adapter) [S12]

```ts
app.post('/invoices', { schema: { body: InvoiceInput, response: { 200: Invoice, 201: Invoice } } }, async (req, reply) => {
  const { tenantId, userId } = await getContext(app.container, req);
  const { invoice, created } = await service.add(tenantId, userId, req.body);
  return reply.status(created ? 201 : 200).send(invoice);
});
```

## 6. Unit of work over `db.transaction` [S16][S17]

```ts
// ports.ts (core)
export interface InvoiceStores { invoices: InvoiceStore; lines: LineStore }
export interface UnitOfWork { run<T>(work: (s: InvoiceStores) => Promise<T>): Promise<T> }

// repository/uow.ts (outer)
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private db: Db) {}
  run<T>(work: (s: InvoiceStores) => Promise<T>) {
    return this.db.transaction((tx: Tx) =>
      work({ invoices: new DrizzleInvoiceStore(tx), lines: new DrizzleLineStore(tx) }));
  }
}
// service: await this.deps.uow.run(async ({ invoices, lines }) => { … });
```

Stores take `Db | Tx` in the constructor, so the same class works inside and outside a transaction.

## 7. Anti-corruption adapter for an SDK [S21]

```ts
// adapters/payments/client.ts — the payment SDK's types stop here
async listCharges(customer: CustomerRef): Promise<ChargeMeta[]> {
  try {
    const res = await withRetry(() => this.sdk.charges.list({ customer: customer.externalId, limit: 100 }));
    return res.data.map((c) => ({ id: c.id, amount: c.amount, status: mapStatus(c.status, !!c.refunded), /* … */ }));
  } catch (err) {
    throw new ExternalServiceError('Payments: list charges failed', { cause: String(err) });
  }
}
```

## 8. Service test with in-memory fakes [S11]

```ts
class InMemoryInvoiceStore implements InvoiceStore { rows = new Map<string, Invoice>(); /* … */ }

it('persists the PDF path', async () => {
  const invoices = new InMemoryInvoiceStore();
  const service = new InvoiceService({ invoices, renderer: new FakePdfRenderer(), secrets: new FakeSecretsProvider(), jobs: { enqueue: async () => ({ id: 'j1' }) } });
  await service.runExportJob({ invoiceId: 'i1', number: 'INV-1' });
  expect(invoices.rows.get('i1')?.pdfPath).toBeDefined();
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
