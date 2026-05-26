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

# Run KB Sync
report_success "Syncing knowledge base"
npm run kb:sync

report_success "KB sync completed"
exit 0
