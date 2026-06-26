#!/usr/bin/env bash
# L3 Hook: Stop — Final checks before Claude ends a session
# Reminds about required quality gates if source files were changed.

# Build a unified changed-file list from porcelain status so files are not
# double-counted when both staged and unstaged.
CHANGED_FILES=$(git status --porcelain 2>/dev/null | awk '{print $NF}')
TOTAL_TS=$(printf "%s\n" "$CHANGED_FILES" | grep -cE '\.(ts|tsx)$' || true)

if [[ $TOTAL_TS -gt 0 ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " Qesto Quality Gate Reminder"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " $TOTAL_TS TypeScript file(s) changed."
  echo ""
  echo " Before committing, verify:"
  echo "   npm test              → all unit tests pass"
  echo "   npm run type-check    → no TypeScript errors"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
fi

# Warn about any .env files accidentally created (ignore vendor dirs)
ENV_FILES=$(find . \
  -path "./.git" -prune -o \
  -path "./node_modules" -prune -o \
  -name ".env" -not -name ".env.example" -print 2>/dev/null)
if [[ -n "$ENV_FILES" ]]; then
  echo "SECURITY WARNING: .env file(s) found — ensure they are gitignored:" >&2
  echo "$ENV_FILES" >&2
fi

# ── QA Checklist Validation ──────────────────────────────────────────────────
# Check if changed files trigger quality gates from QA_CHECKLIST.md

CHANGED_ROUTES=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'functions/api/routes/.*\.ts$' || true)
CHANGED_SCHEMA=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'schema\.sql$' || true)
CHANGED_DO=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'functions/api/SessionRoom\.ts$' || true)
CHANGED_UI=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'src/(pages|components)/.*\.tsx$' || true)
CHANGED_DOCS=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'docs/.*\.(md|txt)$' || true)

GATES_TRIGGERED=0

if [[ "$CHANGED_ROUTES" -gt 0 ]]; then
  echo "QA: API_ROUTES_DOCUMENTED gate triggered — update knowledge-base/api/API_FULL.md (see QA_CHECKLIST.md)" >&2
  GATES_TRIGGERED=1
fi

if [[ "$CHANGED_SCHEMA" -gt 0 ]]; then
  echo "QA: SCHEMA_DOCUMENTED gate triggered — update knowledge-base/architecture/ARCHITECTURE.md §3.1 (see QA_CHECKLIST.md)" >&2
  GATES_TRIGGERED=1
fi

if [[ "$CHANGED_DO" -gt 0 ]]; then
  echo "QA: DO_DOCUMENTED gate triggered — update knowledge-base/architecture/ARCHITECTURE.md and knowledge-base/api/API_FULL.md (see QA_CHECKLIST.md)" >&2
  GATES_TRIGGERED=1
fi

if [[ "$CHANGED_UI" -gt 0 ]]; then
  echo "QA: A11Y_CHECKLIST gate triggered — verify touch targets, contrast, aria-labels (see QA_CHECKLIST.md)" >&2
  GATES_TRIGGERED=1
fi

if [[ $GATES_TRIGGERED -eq 1 ]]; then
  echo "" >&2
  echo "  See .claude/QA_CHECKLIST.md for full gate definitions and how to validate." >&2
fi

# ── Backlog / Release Train consistency check ─────────────────────────────────
# Warn if source or spec files changed but the active backlog / release train were not updated.

CHANGED_SPEC=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'knowledge-base/specifications/.*\.md$' || true)
CHANGED_BACKLOG=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'knowledge-base/product/backlog/BACKLOG_(ACTIVE|MASTER)\.md$' || true)
CHANGED_TRAIN=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'knowledge-base/product/(backlog/BACKLOG_ACTIVE|planning/RELEASE_TRAIN_MASTER)\.md$' || true)

if [[ "$CHANGED_ROUTES" -gt 0 || "$CHANGED_SCHEMA" -gt 0 || "$CHANGED_DO" -gt 0 || "$CHANGED_SPEC" -gt 0 ]]; then
  if [[ "$CHANGED_BACKLOG" -eq 0 ]]; then
    echo "BACKLOG: Significant changes made — did you add new tech-debt or close items in knowledge-base/product/backlog/BACKLOG_MASTER.md?" >&2
  fi
  if [[ "$CHANGED_TRAIN" -eq 0 ]]; then
    echo "RELEASE TRAIN: Did you need to update the story status or exit criteria for the active train in knowledge-base/product/backlog/BACKLOG_ACTIVE.md (cadence contract: RELEASE_TRAIN_MASTER.md)?" >&2
  fi
fi

# ── Cross-session memory reminder ─────────────────────────────────────────────
# If significant work happened this session, prompt to persist a learning so the
# next session starts informed (surfaced by .claude/hooks/session-start.sh).
if [[ "$TOTAL_TS" -gt 0 || "$CHANGED_SCHEMA" -gt 0 || "$CHANGED_SPEC" -gt 0 ]]; then
  echo "" >&2
  echo "MEMORY: Made a non-obvious decision or hit a gotcha this session? Append an entry to" >&2
  echo "  .claude/memory/LEARNINGS.md (date, role, learning, why, refs) so it carries forward." >&2
fi

# ── Testgaps worker ───────────────────────────────────────────────────────────
# Consolidated repo-wide report of changed source files missing tests (advisory).
if [[ "$TOTAL_TS" -gt 0 ]] && [[ -f scripts/check-testgaps.mjs ]]; then
  node scripts/check-testgaps.mjs >&2 || true
fi

exit 0

