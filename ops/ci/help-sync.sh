#!/bin/bash
# ops/ci/help-sync.sh — Knowledge base help docs sync workflow
# Extracts help sync logic from .github/workflows/help-sync-on-merge.yml

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "help-sync"

assert_tool node
assert_tool npm
assert_node_version
assert_file "package.json" "package configuration"

# Install dependencies
report_success "Installing dependencies"
npm ci --silent

# Run Help Sync
report_success "Syncing help documentation"
npm run help:sync

report_success "Help sync completed"
exit 0
