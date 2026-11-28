#!/bin/bash
# ADR-0009 PII log gate — blocks raw error objects passed to console.* outside
# lib/log.ts. Raw errors carry messages/stacks that can embed emails, tokens or
# participant text; use safeLogContext / logBestEffort / logEvent instead.
#
# Covers console.error / console.warn / console.log, trailing `, err` style
# arguments (any common error variable name) and `${err}` template interpolation,
# across functions/, worker/ and workers/.
# Usage: bash scripts/check-pii-log.sh
set -euo pipefail

ERR_NAMES='(err|error|e|ex|exc)'

violations=$(grep -rnE "console\.(error|warn|log)\(" functions/ worker/ workers/ \
  --include="*.ts" \
  | grep -v "lib/log\.ts" \
  | grep -E ",\s*${ERR_NAMES}\s*\)|\\\$\{\s*${ERR_NAMES}\s*\}|\(\s*${ERR_NAMES}\s*\)\s*;?\s*$" \
  || true)

if [ -n "$violations" ]; then
  echo "ERROR: Raw error objects passed to console.* (ADR-0009 violation):"
  echo "$violations"
  exit 1
fi
echo "OK: No raw console.*(err) violations found"
