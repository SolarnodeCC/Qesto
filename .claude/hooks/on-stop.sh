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

# ── Backlog / Sprint Plan consistency check ───────────────────────────────────
# Warn if source or spec files changed but backlog/sprint-plan were not updated.

CHANGED_SPEC=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'docs/(SPEC|ARCHITECTURE|API_FULL)\.md$' || true)
CHANGED_BACKLOG=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'docs/BACKLOG\.md$' || true)
CHANGED_SPRINT=$(printf "%s\n" "$CHANGED_FILES" | grep -cE 'docs/SPRINT_PLAN\.md$' || true)

if [[ "$CHANGED_ROUTES" -gt 0 || "$CHANGED_SCHEMA" -gt 0 || "$CHANGED_DO" -gt 0 || "$CHANGED_SPEC" -gt 0 ]]; then
  if [[ "$CHANGED_BACKLOG" -eq 0 ]]; then
    echo "BACKLOG: Significant changes made — did you add new tech-debt or close items in docs/BACKLOG.md?" >&2
  fi
  if [[ "$CHANGED_SPRINT" -eq 0 ]]; then
    echo "SPRINT: Did you need to update the sprint status or exit criteria in docs/SPRINT_PLAN.md?" >&2
  fi
fi

exit 0
