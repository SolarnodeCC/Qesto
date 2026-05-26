#!/bin/bash
# scripts/ci-local.sh — Local CI runner
# Runs the same verification lanes as GitHub Actions locally.
# Usage:
#   bash scripts/ci-local.sh quality-gates    # Pre-push checks
#   bash scripts/ci-local.sh full             # All checks

set -e

source "$(dirname "$(dirname "$0")")/ops/ci/lib.sh"

LANE=${1:-quality-gates}

case "$LANE" in
  quality-gates)
    report_lane_start "quality-gates (pre-push)"
    bash ops/ci/quality-gates.sh
    ;;

  full)
    report_lane_start "full (npm test + build)"
    bash ops/ci/quality-gates.sh
    report_success "Running build"
    npm run build
    ;;

  doctor)
    report_lane_start "environment check"
    bash scripts/ci-doctor.sh
    ;;

  *)
    echo "Usage: bash scripts/ci-local.sh [quality-gates|full|doctor]"
    echo ""
    echo "Lanes:"
    echo "  quality-gates  — Type check + tests (pre-push requirement)"
    echo "  full           — Quality gates + build (full CI simulation)"
    echo "  doctor         — Environment health check"
    exit 1
    ;;
esac

report_success "CI lane '$LANE' passed"
