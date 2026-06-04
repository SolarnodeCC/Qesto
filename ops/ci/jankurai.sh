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

# Install jankurai globally if not already available
if ! command -v jankurai >/dev/null 2>&1; then
  report_success "Installing jankurai from GitHub"
  npm install -g "git+https://github.com/neverhuman/jankurai.git#v1.5.1" || {
    report_error "Failed to install jankurai"
    mkdir -p target/jankurai
    exit 0  # Don't fail the entire workflow, jankurai is advisory
  }
fi

# Run jankurai (exit code doesn't matter, it's advisory)
jankurai . --json agent/repo-score.json --md agent/repo-score.md || true

# Copy results if available
cp -f agent/repo-score.json target/jankurai/repo-score.json 2>/dev/null || true
cp -f agent/repo-score.md target/jankurai/repo-score.md 2>/dev/null || true

# Create empty reports if jankurai failed
[ -f target/jankurai/repo-score.json ] || echo '{"status":"unavailable"}' > target/jankurai/repo-score.json
[ -f target/jankurai/repo-score.md ] || echo '# Jankurai Report\nUnavailable in this CI run' > target/jankurai/repo-score.md

report_success "Jankurai audit completed"
exit 0
