#!/usr/bin/env bash
# L3 Hook: Stop — Session observability.
# Appends one JSON line per session-stop to .claude/metrics/sessions.jsonl so the
# config layer has a usage/activity signal (which ECC has via cost-tracker /
# metrics-bridge; Qesto previously had none). Local-only, never committed.
#
# Always exits 0 — observability must never block a session.

set +e

METRICS_DIR=".claude/metrics"
METRICS_FILE="$METRICS_DIR/sessions.jsonl"
mkdir -p "$METRICS_DIR" 2>/dev/null

# Stop hooks receive a JSON payload on stdin; capture session_id if jq is present.
STDIN_JSON="$(cat 2>/dev/null)"
SESSION_ID=""
if command -v jq >/dev/null 2>&1 && [ -n "$STDIN_JSON" ]; then
  SESSION_ID="$(printf '%s' "$STDIN_JSON" | jq -r '.session_id // empty' 2>/dev/null)"
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo none)"

# Working-tree activity since last commit (proxy for "what this session touched").
# grep -c always prints a count (and exits 1 on zero) — rely on ${VAR:-0} for
# defaults rather than `|| echo 0`, which would emit a second line and corrupt JSON.
FILES_CHANGED="$(git status --porcelain 2>/dev/null | grep -c . )"
SHORTSTAT="$(git diff --shortstat 2>/dev/null)"
INS="$(printf '%s' "$SHORTSTAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+')"
DEL="$(printf '%s' "$SHORTSTAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+')"
TS_FILES="$(git status --porcelain 2>/dev/null | awk '{print $NF}' | grep -cE '\.(ts|tsx)$')"

# Emit a single compact JSON object (defaults guard against empty values).
printf '{"ts":"%s","session":"%s","branch":"%s","sha":"%s","files_changed":%s,"ts_files":%s,"insertions":%s,"deletions":%s}\n' \
  "$TS" "${SESSION_ID:-}" "$BRANCH" "$SHA" "${FILES_CHANGED:-0}" "${TS_FILES:-0}" "${INS:-0}" "${DEL:-0}" \
  >> "$METRICS_FILE" 2>/dev/null

exit 0
