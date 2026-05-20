#!/bin/bash
# ADR-0009 PII log gate — blocks raw console.error(err) calls outside lib/log.ts
# Usage: bash scripts/check-pii-log.sh
set -euo pipefail

violations=$(grep -rn "console\.error(" functions/ worker/ \
  --include="*.ts" \
  | grep -v "lib/log\.ts" \
  | grep -E ",\s*(err|error|e)\s*\)" \
  || true)

if [ -n "$violations" ]; then
  echo "ERROR: Raw console.error(err) calls found (ADR-0009 violation):"
  echo "$violations"
  exit 1
fi
echo "OK: No raw console.error(err) violations found"
