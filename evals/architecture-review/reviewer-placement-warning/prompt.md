---
description: A calculation written inline in a service is a placement WARNING; code style is not a finding.
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
diff --git a/src/modules/discounts/ports.ts b/src/modules/discounts/ports.ts
new file mode 100644
index 0000000..5555555
--- /dev/null
+++ b/src/modules/discounts/ports.ts
@@ -0,0 +1,9 @@
+export interface DiscountRecord {
+  code: string;
+  percent: number;
+}
+
+export interface DiscountStore {
+  findByCode(code: string): Promise<DiscountRecord | null>;
+  saveApplied(orderId: string, amount: number): Promise<void>;
+}

diff --git a/src/modules/discounts/service.ts b/src/modules/discounts/service.ts
new file mode 100644
index 0000000..6666666
--- /dev/null
+++ b/src/modules/discounts/service.ts
@@ -0,0 +1,35 @@
+import type { DiscountStore } from "./ports.js";
+
+export class DiscountService {
+  constructor(private readonly store: DiscountStore) {}
+
+  async applyDiscount(
+    orderId: string,
+    total: number,
+    code: string | null,
+    isVip: boolean,
+    isFirstOrder: boolean,
+    isBlackFriday: boolean,
+  ): Promise<number> {
+    let result = total;
+    if (code) {
+      const found = await this.store.findByCode(code);
+      if (found) {
+        if (isVip) {
+          if (isBlackFriday) {
+            result = total - (total * (found.percent + 15)) / 100;
+          } else {
+            result = total - (total * (found.percent + 7)) / 100;
+          }
+        } else if (isFirstOrder) {
+          result = total - total * 0.1;
+        } else {
+          result = total - (total * found.percent) / 100;
+        }
+      }
+    }
+    if (result < 0) result = 0;
+    await this.store.saveApplied(orderId, result);
+    return result;
+  }
+}
```
