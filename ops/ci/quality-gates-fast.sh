#!/bin/bash
# ops/ci/quality-gates-fast.sh — Pre-push fast lane (feature branches, low-risk diffs)
# CI parity is ops/ci/quality-gates.sh (full lane).

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "quality-gates-fast (pre-push)"

assert_tool node
assert_tool npm
assert_node_version
assert_file "package-lock.json" "npm lockfile"

if [ ! -d "node_modules" ]; then
  report_success "Installing dependencies (node_modules missing)"
  npm ci --silent
elif [ "package-lock.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
  report_success "Refreshing dependencies (package-lock.json changed)"
  npm ci --silent
else
  report_success "Dependencies up to date (skipping npm ci)"
fi

report_success "Type checking (tsc --noEmit)"
npx tsc --noEmit

report_success "Running unit tests"
npm test

report_success "Fast quality gates passed"
exit 0
