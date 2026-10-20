---
description: A diff that follows the layering rules must produce no CRITICAL finding and no invented ones.
tags: [architecture-review, architecture-reviewer, json, precision]
plugins: ["../../../plugins/architecture-review", "../../../plugins/engineering-paved-path"]
max_turns: 25
allowed_tools: [Agent, Skill, Read, Glob, Grep]
---

Use the architecture-review:architecture-reviewer agent with this input, and give me the JSON report it
returns as your final message, unchanged.

mode: diff

The change to review is the unified diff below. It is not a commit in this checkout and its files are not
on disk, so there is no base to compare against and git cannot show it. Read the change from this
message. Return the JSON report your instructions describe.

```diff
diff --git a/src/modules/invoices/domain.ts b/src/modules/invoices/domain.ts
new file mode 100644
index 0000000..aaaaaaa
--- /dev/null
+++ b/src/modules/invoices/domain.ts
@@ -0,0 +1,12 @@
+export interface Invoice {
+  id: string;
+  netCents: number;
+  vatPercent: number;
+}
+
+export function grossCents(invoice: Invoice): number {
+  return Math.round(invoice.netCents * (1 + invoice.vatPercent / 100));
+}

diff --git a/src/modules/invoices/ports.ts b/src/modules/invoices/ports.ts
new file mode 100644
index 0000000..bbbbbbb
--- /dev/null
+++ b/src/modules/invoices/ports.ts
@@ -0,0 +1,5 @@
+import type { Invoice } from "./domain.js";
+
+export interface InvoiceStore {
+  findById(id: string): Promise<Invoice | null>;
+}

diff --git a/src/modules/invoices/service.ts b/src/modules/invoices/service.ts
new file mode 100644
index 0000000..ccccccc
--- /dev/null
+++ b/src/modules/invoices/service.ts
@@ -0,0 +1,14 @@
+import { grossCents } from "./domain.js";
+import type { InvoiceStore } from "./ports.js";
+
+export class InvoiceService {
+  constructor(private readonly store: InvoiceStore) {}
+
+  async gross(id: string): Promise<number | null> {
+    const invoice = await this.store.findById(id);
+    return invoice ? grossCents(invoice) : null;
+  }
+}

diff --git a/src/modules/invoices/routes.ts b/src/modules/invoices/routes.ts
new file mode 100644
index 0000000..ddddddd
--- /dev/null
+++ b/src/modules/invoices/routes.ts
@@ -0,0 +1,22 @@
+import type { FastifyInstance } from "fastify";
+import { z } from "zod";
+import { InvoiceService } from "./service.js";
+import type { Container } from "../../platform/container.js";
+
+const params = z.object({ id: z.string().min(1) });
+
+export async function invoiceRoutes(app: FastifyInstance, container: Container) {
+  const service = new InvoiceService(container.invoiceStore);
+  app.get("/invoices/:id/gross", { schema: { params } }, async (req, reply) => {
+    const { id } = params.parse(req.params);
+    const gross = await service.gross(id);
+    if (gross === null) return reply.code(404).send({ error: "not found" });
+    return { gross };
+  });
+}
```
