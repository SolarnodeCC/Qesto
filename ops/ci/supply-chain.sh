#!/bin/bash
# ops/ci/supply-chain.sh — Supply chain security scanning
#
# DD-02: every lane in this script used to end in `|| true` (and gitleaks in
# `--exit-code 0`), so no supply-chain finding could ever fail a build. The
# scanners ran, printed, and were ignored. They now fail for real.
#
# Exceptions are explicit and expiring, not blanket suppressions:
#   - npm advisories: ops/ci/audit-allowlist.json (each entry needs an expiry)
#   - secrets:        .gitleaksignore
set -euo pipefail

source "$(dirname "$0")/lib.sh"

report_lane_start "supply-chain security"

assert_tool node
assert_tool npm
assert_node_version

mkdir -p target/security

# ── 1. npm audit — dependency vulnerabilities ────────────────────────────────
# `npm audit` exits non-zero when findings exist, so capture the JSON without
# tripping `set -e`, then let the allowlist checker decide.
report_success "Running npm audit (dependencies)"
npm audit --audit-level=high --json > target/security/npm-audit.json || true
node scripts/check-audit-allowlist.mjs target/security/npm-audit.json

# ── 2. gitleaks — secret scanning ────────────────────────────────────────────
# Real exit code. Findings fail the lane; known false positives belong in
# .gitleaksignore, which gitleaks reads automatically from the repo root.
if command -v docker >/dev/null 2>&1; then
  report_success "Running gitleaks (secret scanning)"
  docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect \
    --source /repo \
    --redact \
    --exit-code 1 \
    --report-path /repo/target/security/gitleaks.json
else
  # Fail rather than silently skip: a missing scanner is a broken gate, not a pass.
  echo "ERROR: docker is required for the gitleaks secret-scanning lane." >&2
  exit 1
fi

# ── 3. Lockfile integrity ────────────────────────────────────────────────────
# The previous check grepped `npm ci --dry-run` for "added 0 packages", which a
# fresh install never prints — it could not pass. What it actually meant to
# verify is that installing does not mutate the lockfile.
report_success "Verifying lockfile integrity"
npm ci --ignore-scripts --silent
git diff --exit-code -- package-lock.json

report_success "Supply chain security scan passed"
exit 0
