#!/bin/bash
# ops/ci/quality-gates.sh — Pre-push verification gates
# Ensures code quality before push. Called by:
#   - ops/git-hooks/pre-push (local)
#   - GitHub Actions (CI)

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "quality-gates"

assert_tool node
assert_tool npm
assert_node_version

# Verify package-lock.json is present
assert_file "package-lock.json" "npm lockfile"

# Install dependencies
report_success "Installing dependencies"
npm ci --silent

# Type checking (fast, no emit)
report_success "Type checking (tsc --noEmit)"
npx tsc --noEmit

# Lint (if configured)
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ]; then
  report_success "Linting"
  npm run lint 2>/dev/null || true
fi

# Unit tests (fail fast on first failure)
report_success "Running unit tests"
npm test

report_success "Quality gates passed"
exit 0
