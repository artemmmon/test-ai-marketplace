#!/usr/bin/env bash
# Builds a tiny TypeScript service in the empty workspace. No network, no dependencies.
set -euo pipefail
mkdir -p src/http docs
cat > package.json <<'JSON'
{ "name": "orders-api", "version": "0.3.0", "type": "module" }
JSON
cat > src/config.ts <<'TS'
export const config = {
  port: 3000,
  http: {
    timeoutMs: 8000,
    maxRetries: 3,
    backoffMs: 250,
  },
  orders: {
    pageSize: 50,
  },
};
TS
cat > src/http/client.ts <<'TS'
import { config } from "../config.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.http.maxRetries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(config.http.timeoutMs) });
      if (res.ok) return res.json();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(config.http.backoffMs * 2 ** attempt);
  }
  throw lastError;
}
TS
cat > src/orders.ts <<'TS'
import { config } from "./config.js";
import { getJson } from "./http/client.js";

export async function listOrders(page: number) {
  return getJson(`https://billing.internal/orders?page=${page}&size=${config.orders.pageSize}`);
}
TS
cat > docs/RESILIENCE.md <<'MD'
# Resilience

Outgoing HTTP calls go through `src/http/client.ts`. A failed call is retried with exponential
backoff; the limits live in `src/config.ts`.
MD
