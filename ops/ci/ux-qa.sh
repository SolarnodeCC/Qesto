#!/bin/bash
# ops/ci/ux-qa.sh — Rendered UX proof lane (Playwright smoke)
set -e
source "$(dirname "$0")/lib.sh"

report_lane_start "ux-qa"
assert_tool node
assert_node_version

report_success "Installing dependencies"
npm ci --silent

report_success "Production build (required for e2e)"
npm run build

report_success "Playwright rendered UX (SPA public routes)"
if [ -f "tests/playwright.config.ts" ]; then
  npx playwright install chromium --with-deps
  npx playwright test --config tests/playwright.config.ts --project=spa-chrome
else
  report_error "tests/playwright.config.ts missing"
  exit 1
fi

report_success "UX QA lane passed"
exit 0
