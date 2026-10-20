---
description: Two layering violations in a diff must be found, rated CRITICAL and tied to a documented rule.
tags: [architecture-review, architecture-reviewer, json, regression]
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
diff --git a/src/modules/checkout/domain/checkout.ts b/src/modules/checkout/domain/checkout.ts
index 1111111..2222222 100644
--- a/src/modules/checkout/domain/checkout.ts
+++ b/src/modules/checkout/domain/checkout.ts
@@ -1,5 +1,6 @@
+import type { FastifyReply } from "fastify";
 export interface CheckoutOrder {
   id: string;
   total: number;
 }

-export function priceOrder(order: CheckoutOrder): number {
+export function priceOrder(order: CheckoutOrder, reply?: FastifyReply): number {
   return order.total;
 }

diff --git a/src/modules/checkout/service.ts b/src/modules/checkout/service.ts
index 3333333..4444444 100644
--- a/src/modules/checkout/service.ts
+++ b/src/modules/checkout/service.ts
@@ -1,10 +1,14 @@
 import { priceOrder } from "./domain/checkout.js";
+import { PgCheckoutRepository } from "./repository.js";

 export class CheckoutService {
+  private repo = new PgCheckoutRepository();
+
   async checkout(order: { id: string; total: number }) {
     const price = priceOrder(order);
+    await this.repo.save(order.id, price);
     return { price };
   }
 }
```
