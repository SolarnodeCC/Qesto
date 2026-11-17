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

# Pinned auditor version — single source of truth is agent/standard-version.toml,
# which records the full commit SHA of the jankurai hub the lockfile vendors (#613).
EXPECTED_JANKURAI_VERSION="$(grep -E '^auditor_version' agent/standard-version.toml | sed -E 's/[^"]*"([^"]+)".*/\1/')"
JANKURAI_HUB="node_modules/jankurai-workspace"

install_jankurai() {
  if command -v jankurai >/dev/null 2>&1 \
     && jankurai version 2>/dev/null | grep -q "$EXPECTED_JANKURAI_VERSION"; then
    return 0
  fi
  # Since v1.7.x jankurai is a split family: the `jankurai-workspace` npm dep is
  # now the `jankurai-hub` (installer + family.lock), not a Cargo workspace, so
  # there is no crates/jankurai to `cargo install --path` any more. The CLI
  # source lives in jankurai-core, whose kernel dependency is on an
  # authenticated forge, so it cannot be built from source in CI.
  #
  # Instead run the hub's own installer from the SHA-locked copy `npm ci`
  # vendored (package-lock.json pins the hub commit). It downloads the release
  # tarball for the pinned tag and verifies its checksum, its signature against
  # a release key whose SHA-256 is pinned inside the locked installer, the
  # provenance (tag, version, family.lock/Cargo.lock hashes) and the binary's
  # reported version before installing. There is deliberately NO unverified /
  # mutable-tag fallback (issue #613); if the locked hub is missing, fail.
  if [ ! -f "$JANKURAI_HUB/jankurai-installer.sh" ]; then
    echo -e "${RED}✗ FAIL${NC}: $JANKURAI_HUB/jankurai-installer.sh not found — run 'npm ci' first (issue #613: no unpinned fallback install)" >&2
    return 1
  fi
  # The vendored hub and the recorded pin must name the same release.
  if [ "$(tr -d '[:space:]' < "$JANKURAI_HUB/VERSION")" != "$EXPECTED_JANKURAI_VERSION" ]; then
    echo -e "${RED}✗ FAIL${NC}: $JANKURAI_HUB/VERSION does not match auditor_version $EXPECTED_JANKURAI_VERSION in agent/standard-version.toml" >&2
    return 1
  fi
  report_success "Installing jankurai v$EXPECTED_JANKURAI_VERSION via the SHA-locked hub installer (signature-verified release)"
  JANKURAI_RELEASE_TAG="v$EXPECTED_JANKURAI_VERSION" JANKURAI_INSTALL_DIR="$HOME/.local/bin" \
    bash "$JANKURAI_HUB/jankurai-installer.sh"
  export PATH="$HOME/.local/bin:$PATH"
}

# Fail the lane if the auditor cannot be installed — do NOT write fallback
# artifacts and exit 0 (issue #613: a green "audit" that never ran is worse
# than a red one).
if ! install_jankurai; then
  echo -e "${RED}✗ FAIL${NC}: jankurai auditor could not be installed — failing the lane" >&2
  exit 1
fi

# Assert the auditor is present AND matches the pinned version before trusting
# any report it produces (issue #613: "auditor present and version-matches").
assert_tool jankurai
JANKURAI_VERSION_OUTPUT="$(jankurai version 2>&1)"
if ! grep -q "$EXPECTED_JANKURAI_VERSION" <<<"$JANKURAI_VERSION_OUTPUT"; then
  echo -e "${RED}✗ FAIL${NC}: jankurai version mismatch — expected $EXPECTED_JANKURAI_VERSION, got: $JANKURAI_VERSION_OUTPUT" >&2
  exit 1
fi
report_success "jankurai $EXPECTED_JANKURAI_VERSION present (pinned)"

# Advisory (report-only) audit — parity with .github/workflows/jankurai.yml. The
# repo's honest score is below the aspirational minimum_score=85 floor and
# most hard findings are known false positives / upstream-detector gaps, so the
# lane reports without gating on findings. Re-enable --mode ratchet once
# remediation reaches the floor.
#
# NOTE (issue #613): advisory mode still exits 0 on *findings* — a non-zero exit
# here means the auditor itself errored, so these primary audit calls are NOT
# wrapped in `|| true`. A tool error must fail the lane, not be swallowed.
report_success "Running jankurai advisory audit"
jankurai audit . \
  --mode advisory \
  --json target/jankurai/repo-score.json \
  --md target/jankurai/repo-score.md \
  --repair-queue-jsonl target/jankurai/repair-queue.jsonl

jankurai audit . \
  --mode advisory \
  --json agent/repo-score.json \
  --md agent/repo-score.md \
  --repair-queue-jsonl target/jankurai/repair-queue.jsonl

# Secondary lanes mirror the workflow's `continue-on-error: true` posture: they are
# non-gating while below the floor, but their failures are surfaced (report_error)
# rather than silently swallowed with `|| true`.
report_success "Running jankurai proofbind"
jankurai proofbind verify . --changed-from origin/main || report_error "proofbind failed (advisory, non-gating)"

report_success "Running jankurai copy-code"
jankurai copy-code . --json target/jankurai/copy-code.json --md target/jankurai/copy-code.md || report_error "copy-code failed (advisory, non-gating)"

report_success "Running jankurai security lane"
jankurai security run . --strict --profile ci --out target/jankurai/security/evidence.json || report_error "security lane failed (advisory, non-gating)"

report_success "Running jankurai migration analyze"
jankurai migrate . --analyze --out target/jankurai/migration-report.json || report_error "migration analyze failed (advisory, non-gating)"

cp -f agent/repo-score.json target/jankurai/repo-score.json
cp -f agent/repo-score.md target/jankurai/repo-score.md

report_success "Jankurai audit completed"
exit 0
