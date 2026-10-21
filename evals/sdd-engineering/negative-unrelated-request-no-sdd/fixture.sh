#!/usr/bin/env bash
# A tiny project with a small off-by-one bug in one helper. No specs, no plans.
set -euo pipefail
mkdir -p src
cat > src/pagination.ts <<'TS'
export interface Page {
  page: number;
  pageSize: number;
  total: number;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.floor(total / pageSize);
}

export function pageOffset(page: Page): number {
  return (page.page - 1) * page.pageSize;
}
TS
cat > README.md <<'MD'
# pager

Small pagination helpers.
MD
