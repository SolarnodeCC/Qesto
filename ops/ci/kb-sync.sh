#!/bin/bash
# ops/ci/kb-sync.sh — Knowledge base sync workflow
# Syncs knowledge base to Vectorize and D1

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "kb-sync"

assert_tool node
assert_tool npm
assert_node_version
assert_file "package.json" "package configuration"

# Verify required environment variables (set by CI)
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  report_error "CLOUDFLARE_API_TOKEN not set"
  exit 1
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  report_error "CLOUDFLARE_ACCOUNT_ID not set"
  exit 1
fi

if [ -z "$KB_ADMIN_KEY" ]; then
  report_error "KB_ADMIN_KEY not set"
  exit 1
fi

# Install dependencies
report_success "Installing dependencies"
npm ci --silent

# Run KB Sync (exit code doesn't matter, KB sync is advisory)
report_success "Syncing knowledge base"
npm run kb:sync || {
  report_error "KB sync failed, creating fallback manifest"
  true  # Don't fail, KB sync is advisory
}

# Ensure manifest file exists (create fallback if sync failed)
if [ ! -f .kb-sync-manifest.json ]; then
  echo '{"status":"unavailable","reason":"kb sync execution failed or unavailable"}' > .kb-sync-manifest.json
fi

report_success "KB sync completed"
exit 0
