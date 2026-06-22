#!/bin/bash
# scripts/test-pre-push-hook.sh — Simulate pre-push without pushing
# Usage: bash scripts/test-pre-push-hook.sh [fast|full|skip]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-}"
if [ -n "$MODE" ]; then
  export QESTO_PREPUSH_MODE="$MODE"
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
sha="$(git rev-parse HEAD)"
remote_ref="refs/heads/${branch}"

# Simulate push of current branch (new remote ref)
printf '%s %s %s %s\n' \
  "refs/heads/${branch}" \
  "$sha" \
  "$remote_ref" \
  "0000000000000000000000000000000000000000" \
  | bash ops/git-hooks/pre-push
