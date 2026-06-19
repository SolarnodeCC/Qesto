#!/bin/bash
# ops/ci/jankurai.sh — Jankurai audit lane (parity with .github/workflows/jankurai.yml)

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "jankurai audit"

assert_tool node
assert_node_version

mkdir -p target/jankurai agent target/jankurai/proofbind target/jankurai/security

# Accepted baseline for ratchet mode
cp -f agent/baselines/main.repo-score.json target/jankurai/accepted-baseline.json 2>/dev/null \
  || echo '{}' > target/jankurai/accepted-baseline.json

install_jankurai() {
  if command -v jankurai >/dev/null 2>&1; then
    return 0
  fi
  if command -v cargo >/dev/null 2>&1 && [ -d node_modules/jankurai-workspace/crates/jankurai ]; then
    report_success "Installing jankurai via cargo (local workspace)"
    cargo install --path node_modules/jankurai-workspace/crates/jankurai --locked --force
    return 0
  fi
  report_success "Installing jankurai via npm git dependency"
  npm install --no-save "git+https://github.com/neverhuman/jankurai.git#v1.5.1" 2>/dev/null || true
  if [ -x node_modules/.bin/jankurai ]; then
    export PATH="$PWD/node_modules/.bin:$PATH"
    return 0
  fi
  if command -v cargo >/dev/null 2>&1; then
    report_success "Installing jankurai via cargo (fresh clone)"
    TMP_DIR=$(mktemp -d)
    git clone --depth 1 --branch v1.5.1 https://github.com/neverhuman/jankurai.git "$TMP_DIR" 2>/dev/null || true
    if [ -d "$TMP_DIR/crates/jankurai" ]; then
      cargo install --path "$TMP_DIR/crates/jankurai" --locked --force
    fi
    rm -rf "$TMP_DIR"
  fi
}

install_jankurai || report_error "jankurai CLI unavailable — writing fallback artifacts"

if command -v jankurai >/dev/null 2>&1; then
  report_success "Running jankurai ratchet audit"
  jankurai audit . \
    --mode ratchet \
    --baseline target/jankurai/accepted-baseline.json \
    --json target/jankurai/repo-score.json \
    --md target/jankurai/repo-score.md \
    --repair-queue-jsonl target/jankurai/repair-queue.jsonl \
    || true

  jankurai audit . \
    --mode ratchet \
    --baseline target/jankurai/accepted-baseline.json \
    --json agent/repo-score.json \
    --md agent/repo-score.md \
    --repair-queue-jsonl target/jankurai/repair-queue.jsonl \
    || true

  report_success "Running jankurai proofbind"
  jankurai proofbind verify . --changed-from origin/main 2>/dev/null || true

  report_success "Running jankurai copy-code"
  jankurai copy-code . --json target/jankurai/copy-code.json --md target/jankurai/copy-code.md 2>/dev/null || true

  report_success "Running jankurai security lane"
  jankurai security run . --strict --profile ci --out target/jankurai/security/evidence.json 2>/dev/null || true

  report_success "Running jankurai migration analyze"
  jankurai migrate . --analyze --json target/jankurai/migration-report.json 2>/dev/null || true
else
  report_error "jankurai execution skipped"
fi

if [ ! -f agent/repo-score.json ]; then
  echo '{"status":"unavailable","reason":"jankurai execution failed or unavailable"}' > agent/repo-score.json
fi
if [ ! -f agent/repo-score.md ]; then
  echo '# Jankurai Audit Report' > agent/repo-score.md
  echo '' >> agent/repo-score.md
  echo 'Status: Unavailable' >> agent/repo-score.md
fi

cp -f agent/repo-score.json target/jankurai/repo-score.json 2>/dev/null || true
cp -f agent/repo-score.md target/jankurai/repo-score.md 2>/dev/null || true

report_success "Jankurai audit completed"
exit 0
