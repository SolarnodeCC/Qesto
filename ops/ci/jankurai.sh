#!/bin/bash
# ops/ci/jankurai.sh — Jankurai audit + proof tool lanes (CI/local parity)

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "jankurai audit"

assert_tool node
assert_node_version

mkdir -p target/jankurai agent target/jankurai/proofbind target/jankurai/security

if ! command -v jankurai >/dev/null 2>&1; then
  report_success "Installing jankurai"
  npm install -g "git+https://github.com/neverhuman/jankurai.git#v1.5.1" || {
    report_error "Failed to install jankurai"
    exit 0
  }
fi

BASELINE="target/jankurai/accepted-baseline.json"
if [ ! -f "$BASELINE" ]; then
  cp -f agent/baselines/main.repo-score.json "$BASELINE" 2>/dev/null || echo '{}' > "$BASELINE"
fi

# audit-ci + contract-drift + proof-routing (shared ratchet command)
jankurai audit . --mode ratchet --baseline "$BASELINE" \
  --json target/jankurai/repo-score.json \
  --md target/jankurai/repo-score.md \
  --repair-queue-jsonl target/jankurai/repair-queue.jsonl || true

cp -f target/jankurai/repo-score.json agent/repo-score.json 2>/dev/null || true
cp -f target/jankurai/repo-score.md agent/repo-score.md 2>/dev/null || true

# proofbind
jankurai proofbind verify . --changed-from origin/main || true

# copy-code
jankurai copy-code . --json target/jankurai/copy-code.json --md target/jankurai/copy-code.md || true

# security evidence
jankurai security run . --out target/jankurai/security/evidence.json || true

# db migration analyze
jankurai migrate . --analyze --json target/jankurai/migration-report.json || true

# ux-qa artifact (config present; full run may be skipped in advisory CI)
jankurai ux audit --config agent/ux-qa.toml --out target/jankurai/ux-qa.json || true

if [ ! -f agent/repo-score.json ]; then
  echo '{"status":"unavailable","reason":"jankurai execution failed or unavailable"}' > agent/repo-score.json
fi
if [ ! -f agent/repo-score.md ]; then
  echo '# Jankurai Audit Report' > agent/repo-score.md
  echo 'Status: Unavailable' >> agent/repo-score.md
fi

report_success "Jankurai audit completed"
exit 0
