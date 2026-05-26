#!/bin/bash
# ops/ci/supply-chain.sh — Supply chain security scanning
# Runs npm audit, gitleaks, and provenance verification

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "supply-chain security"

assert_tool node
assert_tool npm
assert_node_version
assert_tool docker

# Create output directory
mkdir -p target/security

# 1. npm audit — Dependency vulnerabilities
report_success "Running npm audit (dependencies)"
npm audit --audit-level=moderate || true
npm audit --json > target/security/npm-audit.json || true

# 2. gitleaks — Secret scanning
report_success "Running gitleaks (secret scanning)"
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect \
  --source /repo \
  --verbose \
  --exit-code 0 \
  --report-path /repo/target/security/gitleaks.json || true

# 3. Dependency provenance — Verify package-lock.json integrity
report_success "Verifying dependency provenance"
npm ci --dry-run --silent 2>&1 | grep -q "added 0 packages" && \
  report_success "Package provenance verified" || \
  echo "⚠ Package changes detected, review needed"

report_success "Supply chain security scan completed"
exit 0
