#!/bin/bash
# ops/ci/playwright.sh — Playwright E2E lane (CI/local parity)
#
# Server startup lives in tests/playwright.config.ts (`webServer`), not here, so
# this script and .github/workflows/playwright.yml cannot drift apart the way
# they did before issue #688. The workflow calls this script; this script only
# prepares the toolchain and hands off to Playwright.

set -euo pipefail

source "$(dirname "$0")/lib.sh"

report_lane_start "playwright e2e"

assert_tool node
assert_tool npm
assert_node_version

npm ci --silent

# Bundled Chromium — the projects no longer pin `channel: 'chrome'`, so branded
# Google Chrome is not required (issue #692 step 4).
npx playwright install chromium --with-deps

# Keep the whole lane on one origin. The config defaults to this value too; the
# explicit export documents the contract and lets an override flow through.
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:8788}"

# Playwright's webServer block builds dist/, applies local D1 migrations and
# starts the Worker (scripts/e2e-webserver.sh), then tears it down afterwards.
npm run test:e2e:fullstack
