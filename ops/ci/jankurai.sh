#!/bin/bash
# ops/ci/jankurai.sh — Jankurai audit lane (agent/repo-score artifacts)

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "jankurai audit"

assert_tool node
assert_node_version

mkdir -p agent target/jankurai

if ! command -v jankurai &>/dev/null; then
  if command -v cargo &>/dev/null; then
    report_success "Installing jankurai via cargo (one-time)"
    cargo install jankurai --locked \
      --git https://github.com/jeppsontaylor/Jankurai.git \
      --tag v0.8.16 2>/dev/null || true
  fi
fi

if ! command -v jankurai &>/dev/null; then
  report_error "jankurai CLI not on PATH — install from github.com/jeppsontaylor/Jankurai"
  exit 1
fi

report_success "Running jankurai"
jankurai . --json agent/repo-score.json --md agent/repo-score.md --mode advisory || true
cp -f agent/repo-score.json target/jankurai/repo-score.json 2>/dev/null || true
cp -f agent/repo-score.md target/jankurai/repo-score.md 2>/dev/null || true

report_success "Jankurai audit completed"
exit 0
