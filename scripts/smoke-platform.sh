#!/usr/bin/env bash
# OPS-S99-CLOSEOUT-01 — smoke public /api/platform/* endpoints.
# Usage: bash scripts/smoke-platform.sh [BASE_URL]
# Cross-platform: node scripts/smoke-platform.mjs [BASE_URL]

set -euo pipefail
exec node "$(dirname "$0")/smoke-platform.mjs" "${1:-https://qesto.cc}"
