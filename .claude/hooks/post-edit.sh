#!/usr/bin/env bash
# L3 Hook: PostToolUse(Write|Edit) — Automation after file edits
# Scans written content for secrets, validates route mounting, enforces test files.

FILE="$1"

# ── Secret pattern scan ───────────────────────────────────────────────────────
if [[ -f "$FILE" ]]; then
  # Detect common secret patterns written to file
  if grep -qE "(sk_live_|sk_test_|rk_live_)[a-zA-Z0-9]{20,}" "$FILE" 2>/dev/null; then
    echo "SECURITY ALERT: Stripe secret key pattern detected in $FILE. Remove immediately." >&2
    exit 1
  fi

  if grep -qE "ANTHROPIC_API_KEY\s*=\s*sk-ant-" "$FILE" 2>/dev/null; then
    echo "SECURITY ALERT: Anthropic API key written to file $FILE. Remove immediately." >&2
    exit 1
  fi

  if grep -qE "re_[a-zA-Z0-9]{20,}" "$FILE" 2>/dev/null; then
    echo "WARNING: Possible Resend API key pattern in $FILE. Verify this is not a real key." >&2
  fi
fi

# ── Route mounting validation (BLOCKING) ──────────────────────────────────────
if [[ "$FILE" =~ ^functions/api/routes/.*\.routes\.ts$ ]]; then
  ROUTE_NAME=$(basename "$FILE" .ts | sed 's/\.routes/Routes/')
  if ! grep -q "$ROUTE_NAME" functions/api/[[route]].ts 2>/dev/null; then
    echo "ERROR: Route file $(basename "$FILE") not mounted in functions/api/[[route]].ts" >&2
    echo "Add this line to [[route]].ts:" >&2
    echo "  app.route('/api', ${ROUTE_NAME})" >&2
    exit 1
  fi
fi

# ── Validate new source files have tests (BLOCKING for routes) ────────────────
if [[ "$FILE" =~ ^functions/api/routes/.*\.routes\.ts$ ]]; then
  DOMAIN=$(basename "$FILE" .ts | sed 's/\.routes//')
  TESTFILE="tests/unit/${DOMAIN}.test.ts"
  if [[ ! -f "$TESTFILE" ]]; then
    echo "ERROR: Missing test file for route. Create: $TESTFILE" >&2
    exit 1
  fi
fi

# ── TypeScript automation ─────────────────────────────────────────────────────
# Only remind on TypeScript source files (not test files to avoid slow CI)
if [[ "$FILE" =~ ^src/.*\.(ts|tsx)$ ]] || \
   [[ "$FILE" =~ ^functions/api/.*\.ts$ ]] || \
   [[ "$FILE" =~ ^worker/.*\.ts$ ]]; then
  echo "INFO: TypeScript file edited — run 'npm run type-check' before committing." >&2
fi

# ── Frontend component test reminder ─────────────────────────────────────────
if [[ "$FILE" =~ ^src/(pages|components)/.*\.tsx$ ]]; then
  BASENAME=$(basename "$FILE" .tsx)
  TESTFILE="tests/unit/${BASENAME}.test.tsx"
  if [[ ! -f "$TESTFILE" ]]; then
    echo "REMINDER: No test file found for component $BASENAME. Add UI tests: $TESTFILE" >&2
  fi
fi

# ── CLAUDE.md freshness reminders ────────────────────────────────────────────
if [[ "$FILE" == functions/api/types/env.ts ]]; then
  echo "REMINDER: env.ts edited — new bindings must be added to wrangler.toml [vars] or via 'wrangler pages secret put'." >&2
fi

if [[ "$FILE" == functions/api/types.ts ]] || [[ "$FILE" =~ ^functions/api/types/.*\.ts$ ]]; then
  echo "REMINDER: types edited — if you added new patterns, update CLAUDE.md." >&2
fi

# ── Docs freshness reminders ──────────────────────────────────────────────────
# Map edited source files to the docs that should stay in sync with them.

if [[ "$FILE" =~ ^functions/api/routes/.*\.ts$ ]] || [[ "$FILE" == "functions/api/[[route]].ts" ]]; then
  echo "REMINDER: API route changed — update docs/API_FULL.md if endpoints were added/modified." >&2
fi

if [[ "$FILE" == functions/api/SessionRoom.ts ]]; then
  echo "REMINDER: SessionRoom DO changed — update docs/ARCHITECTURE.md (§3.3 DO state, §5 realtime) and docs/API_FULL.md (§8 WS protocol) if needed." >&2
fi

if [[ "$FILE" == schema.sql ]]; then
  echo "REMINDER: schema.sql changed — update docs/ARCHITECTURE.md §3.1 (D1 schema)." >&2
fi

if [[ "$FILE" == functions/api/types.ts ]] || [[ "$FILE" =~ ^functions/api/types/.*\.ts$ ]]; then
  echo "REMINDER: types changed — update docs/API_FULL.md or docs/ARCHITECTURE.md if the contract changed." >&2
fi

if [[ "$FILE" =~ ^src/(pages|components)/.*\.tsx$ ]]; then
  # Only remind if the component name suggests a11y-relevant UI
  echo "REMINDER: UI component changed — update docs/A11Y_FULL.md if keyboard, focus, or aria behaviour changed." >&2
fi

if [[ "$FILE" == wrangler.toml ]]; then
  echo "REMINDER: wrangler.toml changed — update docs/CONFIGURATION.txt if new vars or bindings were added." >&2
fi

# ── Backlog & Sprint Plan freshness ───────────────────────────────────────────
# Remind to keep BACKLOG.md and SPRINT_PLAN.md in sync when stories are touched.

if [[ "$FILE" == docs/BACKLOG.md ]]; then
  echo "REMINDER: BACKLOG.md updated — verify docs/SPRINT_PLAN.md Next/Upcoming Sprint sections reflect the new WSJF order." >&2
fi

if [[ "$FILE" == docs/SPRINT_PLAN.md ]]; then
  echo "REMINDER: SPRINT_PLAN.md updated — verify docs/BACKLOG.md item statuses match (open/closed)." >&2
fi

# ── New route file detection ──────────────────────────────────────────────────
if [[ "$FILE" =~ ^functions/api/routes/.*\.routes\.ts$ ]]; then
  ROUTE_MOUNTED=$(grep -l "$(basename "$FILE" .ts | sed 's/\.routes/Routes/')" functions/api/'[[route]]'.ts 2>/dev/null)
  if [[ -z "$ROUTE_MOUNTED" ]]; then
    echo "INFO: New route file $(basename "$FILE") — ensure it is mounted in functions/api/[[route]].ts." >&2
  fi
fi

exit 0
