#!/bin/bash
# ops/ci/jankurai.sh — Jankurai audit lane
# Runs code quality audit via jankurai tool

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "jankurai audit"

assert_tool node
assert_node_version

# Run jankurai audit (CI + agent repair routing)
report_success "Running jankurai audit"
mkdir -p target/jankurai agent
if command -v jankurai >/dev/null 2>&1; then
  JANKURAI=jankurai
else
  # Install jankurai from GitHub (https://github.com/neverhuman/jankurai v1.5.1)
  JANKURAI="npx --yes github:neverhuman/jankurai#v1.5.1"
fi
$JANKURAI . --json agent/repo-score.json --md agent/repo-score.md --mode advisory
cp -f agent/repo-score.json target/jankurai/repo-score.json 2>/dev/null || true
cp -f agent/repo-score.md target/jankurai/repo-score.md 2>/dev/null || true

report_success "Jankurai audit completed"
exit 0
