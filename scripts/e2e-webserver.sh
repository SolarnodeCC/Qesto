#!/usr/bin/env bash
# Prepare and serve the full E2E stack for Playwright's `webServer` block.
#
# Playwright owns server startup (tests/playwright.config.ts). This script makes
# the declared proof lane in agent/test-map.json — a bare
# `npx playwright test --config tests/playwright.config.ts` — able to pass
# standalone, by bringing up everything the specs need:
#   1. dist/ (Vite build)  2. local D1 schema + migrations  3. the Worker server
#
# Steps 1 and 2 are skipped when already satisfied so warm local runs stay fast;
# set E2E_FORCE_BUILD=1 to rebuild unconditionally.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f dist/index.html || "${E2E_FORCE_BUILD:-0}" == "1" ]]; then
  echo "e2e-webserver: building frontend…" >&2
  npm run build
else
  echo "e2e-webserver: reusing existing dist/ (E2E_FORCE_BUILD=1 to rebuild)" >&2
fi

# Idempotent: wrangler skips migrations already applied to the local SQLite file.
echo "e2e-webserver: applying local D1 migrations…" >&2
npm run e2e:db:local

exec bash scripts/e2e-serve-fullstack.sh
