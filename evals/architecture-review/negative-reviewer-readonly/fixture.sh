#!/usr/bin/env bash
# A tiny backend module with one onion layer violation (a framework import in the domain).
set -euo pipefail
mkdir -p src/modules/checkout/domain
cat > src/modules/checkout/domain/checkout.ts <<'TS'
import type { FastifyReply } from "fastify";

export interface CheckoutOrder {
  id: string;
  total: number;
}

export function priceOrder(order: CheckoutOrder, reply?: FastifyReply): number {
  return order.total;
}
TS
cat > src/modules/checkout/service.ts <<'TS'
import { priceOrder, type CheckoutOrder } from "./domain/checkout.js";
import type { CheckoutPort } from "./ports.js";

export class CheckoutService {
  constructor(private readonly repo: CheckoutPort) {}

  async checkout(order: CheckoutOrder) {
    const price = priceOrder(order);
    await this.repo.save(order.id, price);
    return { price };
  }
}
TS
cat > src/modules/checkout/ports.ts <<'TS'
export interface CheckoutPort {
  save(id: string, price: number): Promise<void>;
}
TS
