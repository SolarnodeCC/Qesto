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

# Run Help Sync (exit code doesn't matter, help sync is advisory)
report_success "Syncing help documentation"
npm run help:sync || {
  report_error "Help sync failed, creating fallback manifest"
  true  # Don't fail, help sync is advisory
}

# Ensure manifest file exists (create fallback if sync failed)
if [ ! -f .help-sync-manifest.json ]; then
  echo '{"status":"unavailable","reason":"help sync execution failed or unavailable"}' > .help-sync-manifest.json
fi

report_success "Help sync completed"
exit 0
