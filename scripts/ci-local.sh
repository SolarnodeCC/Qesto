#!/bin/bash
# scripts/ci-local.sh — Local CI runner (parity with .github/workflows)

set -e

source "$(dirname "$(dirname "$0")")/ops/ci/lib.sh"

LANE=${1:-quality-gates}

case "$LANE" in
  quality-gates|check)
    report_lane_start "quality-gates"
    bash ops/ci/quality-gates.sh
    ;;

  contracts)
    report_lane_start "contract drift"
    npx tsx scripts/check-contract-drift.ts
    ;;

  secret-scan|security)
    report_lane_start "secret-scan"
    bash ops/ci/secret-scan.sh
    bash ops/ci/supply-chain.sh
    ;;

  jankurai|score)
    report_lane_start "jankurai"
    bash ops/ci/jankurai.sh
    ;;

  playwright|e2e)
    report_lane_start "playwright"
    bash ops/ci/playwright.sh
    ;;

  full|verify)
    report_lane_start "full"
    bash ops/ci/quality-gates.sh
    bash ops/ci/secret-scan.sh
    npx tsx scripts/check-contract-drift.ts
    npm run build
    ;;

  doctor)
    bash scripts/ci-doctor.sh
    ;;

  *)
    echo "Usage: bash scripts/ci-local.sh [quality-gates|contracts|secret-scan|jankurai|playwright|full|doctor]"
    exit 1
    ;;
esac

report_success "CI lane '$LANE' passed"
