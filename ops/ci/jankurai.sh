#!/bin/bash
# ops/ci/jankurai.sh — Jankurai audit lane
# Runs code quality audit via jankurai tool

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "jankurai audit"

assert_tool node
assert_node_version

# Run jankurai audit
report_success "Running jankurai audit"
mkdir -p target/jankurai
npx jankurai . --mode advisory

report_success "Jankurai audit completed"
exit 0
