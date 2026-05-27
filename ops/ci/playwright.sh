#!/bin/bash
# ops/ci/playwright.sh — Playwright E2E lane (CI/local parity)

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "playwright e2e"

assert_tool node
assert_tool npm
assert_node_version

npm ci --silent
npx playwright install chrome --with-deps
npm run build
npm run e2e:db:local

npm run e2e:serve:fullstack > wrangler-pages-dev.log 2>&1 &
echo $! > wrangler-pages-dev.pid

for i in {1..60}; do
  if curl --fail --silent http://localhost:8788/ > /dev/null; then
    break
  fi
  sleep 2
done

curl --fail --silent http://localhost:8788/ > /dev/null

npm run test:e2e:fullstack
EXIT=$?

if [ -f wrangler-pages-dev.pid ]; then
  kill "$(cat wrangler-pages-dev.pid)" 2>/dev/null || true
fi

exit $EXIT
