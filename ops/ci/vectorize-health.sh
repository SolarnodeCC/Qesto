#!/bin/bash
# ops/ci/vectorize-health.sh — Vectorize health lane (parity with
# .github/workflows/vectorize-health.yml).
#
# Read-only visibility into the live Vectorize indexes (qesto-kb-production,
# qesto-help, qesto-decisions): prints each index's live dimension and vector
# count and FAILS if the KB index is empty while KB files exist, or a dimension
# != bge-m3 (1024) — i.e. retrieval is silently broken.
#
# Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment; they
# reach live indexes, so this lane cannot run offline.

set -euo pipefail

source "$(dirname "$0")/lib.sh"

report_lane_start "vectorize health"

assert_tool node
assert_tool npm
assert_node_version

for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  if [ -z "${!var:-}" ]; then
    report_error "$var is not set — this lane queries live Vectorize indexes"
    exit 1
  fi
done

npm ci --silent
npm run kb:health
