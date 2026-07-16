#!/usr/bin/env bash
# OPS-S99-CLOSEOUT-01 — smoke public /api/platform/* endpoints.
# Usage: bash scripts/smoke-platform-v7.sh [BASE_URL]
# Cross-platform: node scripts/smoke-platform-v7.mjs [BASE_URL]

set -euo pipefail
exec node "$(dirname "$0")/smoke-platform-v7.mjs" "${1:-https://qesto.cc}"
