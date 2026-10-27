#!/bin/bash
# ops/ci/nightly-perf.sh — DO stress + optional k6 load lane (DD-18, #891).
#
# The workflow (.github/workflows/nightly-perf.yml) only calls this script, so
# local runs and CI cannot drift (HLT-042 CI-local parity).
#   bash ops/ci/nightly-perf.sh stress
#   LOAD_TEST_BASE_URL=https://staging.example bash ops/ci/nightly-perf.sh load
set -euo pipefail
source "$(dirname "$0")/lib.sh"

lane="${1:-stress}"
case "$lane" in
  stress)
    report_lane_start "nightly-perf:stress"
    npm ci --silent
    npm run test:stress
    ;;
  load)
    report_lane_start "nightly-perf:load"
    if [ -z "${LOAD_TEST_BASE_URL:-}" ]; then
      echo "LOAD_TEST_BASE_URL unset — refusing to guess a target (never production)." >&2
      exit 1
    fi
    # Official k6 image, version-pinned; no third-party action needed.
    docker run --rm -v "$PWD/tests/load:/scripts:ro" grafana/k6:0.54.0 \
      run /scripts/k6-smoke.js -e BASE_URL="$LOAD_TEST_BASE_URL"
    ;;
  *)
    echo "usage: $0 stress|load" >&2
    exit 2
    ;;
esac
report_success "nightly-perf:$lane passed"
