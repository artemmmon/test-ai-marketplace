#!/usr/bin/env bash
# A tiny project with one billing helper that has a float-rounding quirk. No INSIGHTS.md anywhere.
set -euo pipefail
mkdir -p src/modules/billing
cat > src/modules/billing/rounding.ts <<'TS'
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
TS
cat > README.md <<'MD'
# shop

Small shop backend.
MD
