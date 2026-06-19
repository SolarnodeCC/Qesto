#!/bin/bash
# scripts/install-git-hooks.sh — Enable repo-local pre-push quality gates
# Safe to re-run. Configures core.hooksPath and marks hooks executable.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOOKS_DIR="ops/git-hooks"
PRE_PUSH="${HOOKS_DIR}/pre-push"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: not a git repository ($ROOT)" >&2
  exit 1
fi

if [ ! -f "$PRE_PUSH" ]; then
  echo "error: missing $PRE_PUSH" >&2
  exit 1
fi

echo "→ Configuring core.hooksPath = $HOOKS_DIR (local)"
git config --local core.hooksPath "$HOOKS_DIR"

echo "→ Marking hooks executable"
chmod +x "$PRE_PUSH" "${HOOKS_DIR}/lib.sh" "${HOOKS_DIR}/env.sh" 2>/dev/null || true
if git update-index --chmod=+x "$PRE_PUSH" 2>/dev/null; then
  echo "  git index: +x $PRE_PUSH"
fi

current="$(git config --local --get core.hooksPath || true)"
if [ "$current" != "$HOOKS_DIR" ]; then
  echo "error: core.hooksPath is '$current', expected '$HOOKS_DIR'" >&2
  exit 1
fi

echo ""
echo "✓ Git hooks installed."
echo ""
echo "  Pre-push lanes (automatic):"
echo "    full — push to main/master, or trust/AI paths touched (CI parity)"
echo "    fast — feature branches, low-risk diffs (tsc + npm test)"
echo "    skip — knowledge-base / docs only"
echo ""
echo "  Verify:  just doctor"
echo "  Dry run: bash scripts/test-pre-push-hook.sh"
echo ""
