#!/usr/bin/env bash
# L3 Hook: SessionStart — Cross-session memory loader
# Surfaces the most recent learnings from .claude/memory/LEARNINGS.md into the
# session context so agents start each session informed by prior decisions.
# Bounded (last N entries, hard line cap) to protect the context window.

LEARNINGS=".claude/memory/LEARNINGS.md"
MAX_ENTRIES=5      # number of most-recent dated entries to surface
LINE_CAP=80        # hard ceiling on lines printed, regardless of entry sizes

# No-op cleanly if memory is missing or empty.
[[ -s "$LEARNINGS" ]] || exit 0

# Entry headers look like:  ## 2026-06-26 — [role] title
# Find the start line of the Nth-from-last entry; print from there to EOF.
START_LINE=$(grep -nE '^## [0-9]{4}-[0-9]{2}-[0-9]{2} ' "$LEARNINGS" \
  | tail -n "$MAX_ENTRIES" | head -n 1 | cut -d: -f1)

# No dated entries yet (only the header/instructions) — nothing useful to surface.
[[ -n "$START_LINE" ]] || exit 0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Qesto cross-session memory — recent learnings"
echo " (full log: $LEARNINGS — Grep it for older/topic entries)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -n "+${START_LINE}" "$LEARNINGS" | head -n "$LINE_CAP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
