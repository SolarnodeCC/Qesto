#!/usr/bin/env bash
# Run these commands from the root of the Qesto repo on your local machine.
# They create a branch, commit each TD fix atomically, and open the PR.
set -e

# ── 1. Create branch ─────────────────────────────────────────────────────────
git checkout main
git pull origin main
git checkout -b tech-debt/quick-wins-2026-05

# ── TD-03: Migration sequence gaps ───────────────────────────────────────────
git add migrations/0017_reconcile_gap.sql \
        migrations/0018_reconcile_gap.sql \
        migrations/0019_reconcile_gap.sql \
        migrations/002{1..9}_reconcile_gap.sql \
        migrations/00{30..41}_reconcile_gap.sql \
        scripts/check-migration-gaps.mjs \
        package.json
git commit -m "fix(db): reconcile migration sequence gaps (TD-03)

Adds 24 no-op reconciliation migrations (0017-0019, 0021-0041) that
were applied directly to production without being versioned. Restores
a contiguous sequence so the schema can be reproduced from scratch.

Also adds scripts/check-migration-gaps.mjs and wires it into check:rc
so CI fails on any future gap."

# ── TD-02: Type-safe D1 queries ───────────────────────────────────────────────
git add functions/api/lib/db-row-types.ts \
        functions/api/routes/energizers/active.ts \
        functions/api/routes/energizers/advance-detail-leaderboard.ts \
        functions/api/routes/energizers/vote-next.ts \
        functions/api/routes/energizers/patch.ts \
        functions/api/routes/energizers/create-list.ts \
        functions/api/routes/gamification.ts \
        functions/api/middleware/rbac.ts \
        functions/api/middleware/kv-cache.ts
git commit -m "fix(types): replace 35 type-unsafe D1 \`prepare as any\` casts (TD-02)

Adds lib/db-row-types.ts with typed row interfaces for every table.
Removes all (DB.prepare as any) casts across 8 files, replacing them
with .first<RowType>() / .all<RowType>() generics. TypeScript is now
clean with zero unsafe D1 casts."

# ── TD-01: SessionRoom refactor ───────────────────────────────────────────────
git add functions/api/SessionRoom.ts \
        functions/api/lib/session-room-energizer.ts \
        functions/api/lib/session-room-rate-limiter.ts \
        functions/api/lib/session-room-energizer-handler.ts \
        functions/api/lib/session-room-townhall-handler.ts
git commit -m "refactor(realtime): extract collaborators from SessionRoom.ts (TD-01)

SessionRoom.ts: 2242 → 1256 lines (-44%).

Extracted four focused collaborator classes:
- session-room-energizer.ts        (226L) — pure scoring/ranking fns
- session-room-rate-limiter.ts      (53L) — IP rate limit + vote token bucket
- session-room-energizer-handler.ts (391L) — energizer WS handlers
- session-room-townhall-handler.ts  (392L) — all 15 townhall methods

SessionRoom retains: WS lifecycle, HTTP routes, vote, question nav,
alarm dispatch, response moderation."

# ── TD-14: Secrets hygiene ────────────────────────────────────────────────────
git add wrangler.toml
git commit -m "fix(security): move SUPERUSER_EMAIL out of wrangler.toml [vars] (TD-14)

Removes SUPERUSER_EMAIL and SEED_ADMIN_EMAIL from committed config.
Both should be set via \`wrangler secret put\`. Comment added to guide."

# ── TD-12: TTL named constants ────────────────────────────────────────────────
git add functions/api/lib/constants.ts \
        functions/api/lib/coaching-actions.ts \
        functions/api/lib/integrations/token-store.ts \
        functions/api/lib/pwa-push.ts \
        functions/api/lib/session-room-cross-region.ts \
        functions/api/lib/tenant-quota.ts \
        functions/api/lib/webhook-dlq.ts \
        functions/api/lib/webhook-rate-limit.ts \
        functions/api/routes/copilot-context.ts \
        functions/api/routes/sessions/wizard.ts \
        functions/api/routes/ai-insights/register-coaching.ts \
        functions/api/routes/tenant-cost.ts \
        functions/api/routes/templates-marketing.ts \
        functions/api/routes/sessions/shared.ts \
        functions/api/routes/integrations.ts \
        functions/api/routes/templates.ts
git commit -m "fix(kv): replace TTL magic numbers with named constants (TD-12)

Adds 39 named TTL constants to lib/constants.ts (e.g. NINETY_DAYS_SECONDS,
WEBHOOK_DLQ_TTL_SECONDS, TEMPLATE_TTL_SECONDS). Replaces all inline
literals across 15 files. Single source of truth for all KV expiry."

# ── TD-09: Structured logging ─────────────────────────────────────────────────
git add functions/api/lib/log.ts
git add -- $(git diff --name-only HEAD -- 'functions/api/**/*.ts' 2>/dev/null | head -30)
git commit -m "fix(observability): replace console.log with logEvent() helper (TD-09)

Adds logEvent() to lib/log.ts — applies PII redaction, serialises
structured JSON, replaces 66 raw console.log calls across functions/api/.

Intentional exceptions: middleware/logger.ts (transport layer),
lib/seed-help.ts (dev script only)."

# ── TD-07: Sprint-named files ─────────────────────────────────────────────────
git add functions/api/routes/admin/journey-events.ts \
        functions/api/routes/admin/platform/engagement-analytics.ts \
        functions/api/routes/admin.ts \
        functions/api/routes/admin/platform-routes.ts \
        tests/functional/ui/launchpad-ui-contract.test.ts \
        tests/functional/ui/team-settings-contract.test.ts \
        tests/functional/ui/live-energizer-contract.test.ts \
        tests/functional/ui/team-quiz-contract.test.ts \
        tests/functional/ui/leaderboard-badge-contract.test.ts \
        tests/functional/ui/enterprise-release-contract.test.ts
git rm tests/functional/ui/sprint23-polish.test.ts \
       tests/functional/ui/sprint24-contract.test.ts \
       tests/functional/ui/sprint26-27-contract.test.ts \
       tests/functional/ui/sprint28-contract.test.ts \
       tests/functional/ui/sprint29-contract.test.ts \
       tests/functional/ui/sprint30-32-contract.test.ts \
       functions/api/routes/admin/sprint19.ts \
       functions/api/routes/admin/platform/sprint19.ts 2>/dev/null || true
git commit -m "refactor: rename sprint-named files to domain names (TD-07)

Route files:
  admin/sprint19.ts            → admin/journey-events.ts
  admin/platform/sprint19.ts  → admin/platform/engagement-analytics.ts

Test files:
  sprint23-polish              → launchpad-ui-contract
  sprint24-contract            → team-settings-contract
  sprint26-27-contract         → live-energizer-contract
  sprint28-contract            → team-quiz-contract
  sprint29-contract            → leaderboard-badge-contract
  sprint30-32-contract         → enterprise-release-contract"

# ── TD-06: Typed feature flags ────────────────────────────────────────────────
git add functions/api/lib/flags.ts
git add -- $(git diff --name-only HEAD -- 'functions/api/**/*.ts' 2>/dev/null | head -20)
git commit -m "feat(dx): add typed getFlag() helper, replace 25 raw flag checks (TD-06)

Adds lib/flags.ts with FlagName string-literal union and getFlag() /
flagOff() helpers. Replaces scattered \`env.FEATURE === 'true'\` checks
across 9 files with typed calls. Adding a new flag now requires updating
the union — typos are caught at compile time."

# ── Tech debt audit document ──────────────────────────────────────────────────
git add TECH_DEBT_AUDIT_2026-05.md
git commit -m "docs: add tech debt audit report (TD-00)

Audit of 15 debt items scored by (Impact+Risk)×(6-Effort). Covers
architecture, code, test, and infrastructure debt with a phased
remediation plan."

# ── 2. Push branch ────────────────────────────────────────────────────────────
git push -u origin tech-debt/quick-wins-2026-05

# ── 3. Create PR via gh CLI (install if needed: brew install gh) ──────────────
gh pr create \
  --title "tech-debt: critical fixes + quick wins (TD-01 → TD-14)" \
  --body "$(cat << 'EOF'
## Summary

Addresses 8 of 15 items from TECH_DEBT_AUDIT_2026-05.md — all three critical items and all Phase 1 quick wins.

## Changes

### 🔴 Critical
| Item | Change |
|------|--------|
| TD-03 | 24 no-op reconciliation migrations restore contiguous sequence (0017–0041). CI check added to `check:rc`. |
| TD-02 | New `lib/db-row-types.ts` + 35 `DB.prepare as any` casts replaced with `.first<RowType>()` / `.all<RowType>()`. |
| TD-01 | `SessionRoom.ts` 2242→1256 lines. Four collaborators extracted: `EnergizerHandler`, `TownhallHandler`, `RateLimiter`, pure scoring fns. |

### 🟠 High / Quick wins
| Item | Change |
|------|--------|
| TD-14 | `SUPERUSER_EMAIL` removed from `wrangler.toml [vars]` — use `wrangler secret put`. |
| TD-12 | 39 named TTL constants in `lib/constants.ts`; all inline literals replaced across 15 files. |
| TD-09 | `logEvent()` helper in `lib/log.ts` with PII redaction; 66 `console.log` calls replaced. |
| TD-07 | 2 route files + 6 test files renamed from sprint-numbers to domain names. |
| TD-06 | `lib/flags.ts` with `FlagName` union + `getFlag()` / `flagOff()`; 25 raw `=== 'true'` checks replaced. |

## Testing
- `npm run typecheck` — clean
- `npm run check:migrations` — passes (new CI script)
- No behaviour changes: all refactors are structural or additive

## Remaining debt
See TECH_DEBT_AUDIT_2026-05.md for TD-04, TD-05, TD-08, TD-10, TD-11, TD-13, TD-15.
EOF
)" \
  --base main \
  --head tech-debt/quick-wins-2026-05 \
  --label "tech-debt" \
  --draft
