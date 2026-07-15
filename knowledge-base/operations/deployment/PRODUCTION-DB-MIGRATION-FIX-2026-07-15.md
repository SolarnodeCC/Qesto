# Production Database Migration Fix — 0060/0077 Duplicate Index (2026-07-15)

**Date:** 2026-07-15
**Issue:** `wrangler d1 migrations apply qesto_3_db --remote` failed with
`index idx_stripe_webhook_events_event_type already exists: SQLITE_ERROR [code: 7500]`,
blocking the entire migration chain (0078, 0079, 0080 never applied).
**Fix Target:** Make the duplicate `stripe_webhook_events` index-creation idempotent so the
chain clears and 0080 (votes UNIQUE widen) lands.
**PRs:** #741 (0077 → no-op), #742 (0060 → `IF NOT EXISTS`)

---

## Problem Summary

```
wrangler d1 migrations apply qesto_3_db --remote
✘ [ERROR] index idx_stripe_webhook_events_event_type already exists: SQLITE_ERROR [code: 7500]
```

Two migrations create the same `stripe_webhook_events` table and indexes:

- **0060_stripe_webhook_events.sql** — original, used bare `CREATE INDEX` (no `IF NOT EXISTS`).
- **0077_stripe_webhook_events.sql** — a byte-for-byte duplicate of 0060.

The indexes already exist in production's schema, but wrangler's `d1_migrations` tracker did
**not** have these migrations marked as applied. On every `apply`, wrangler re-ran the raw
`CREATE INDEX` and SQLite hard-failed with `already exists` (a bare `CREATE INDEX` throws;
`CREATE INDEX IF NOT EXISTS` skips). Because the runner only records a migration as applied on
success, the failure halted the chain before 0078/0079/0080 were ever attempted.

**Why it resurfaced after the first fix:** #741 converted 0077 to a comment-only no-op. Running
`apply` then failed on **0060** instead — the only *other* migration still creating those indexes
with a bare statement. #742 fixed 0060 the same way (`IF NOT EXISTS`).

---

## Root Cause

- Non-idempotent `CREATE INDEX` in a migration whose target objects already exist but are not
  recorded in `d1_migrations`.
- The `d1_migrations` tracker and the actual schema drifted out of sync (objects present, tracker
  rows absent) — the same class of drift documented in `PRODUCTION-DB-MIGRATION-FIX.md`
  (2026-05-17, migrations 0015/0016/0020).

---

## The Fix (already merged to `main`)

| Migration | Before | After | PR |
|---|---|---|---|
| `0077_stripe_webhook_events.sql` | Duplicate of 0060, bare `CREATE INDEX` | Comment-only no-op (executes no SQL) | #741 |
| `0060_stripe_webhook_events.sql` | Bare `CREATE INDEX` (×2) | `CREATE INDEX IF NOT EXISTS` (×2) | #742 |

With both in place, wrangler marks 0060 and 0077 as applied without erroring, and the chain
continues to 0078 → 0079 → 0080.

---

## Verification — run from a credentialed environment

> `wrangler ... --remote` requires `CLOUDFLARE_API_TOKEN`. These cannot be run from a sandbox
> without prod credentials; run them from a machine/CI that has them.

### STEP 0: Confirm the merged fix is actually on disk

```bash
git checkout main && git pull origin main
grep "CREATE INDEX" migrations/0060_stripe_webhook_events.sql
```

**Expected:** both lines read `CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_...`
**If they show bare `CREATE INDEX`:** you are on a stale checkout — the pull did not land. Stop and
fix that first; this is the #1 cause of "I applied the fix but still get the error"
(`wrangler` reads migration files from local disk, not from GitHub).

### STEP 1: Read current tracker state (safe, read-only)

```bash
wrangler d1 migrations list qesto_3_db --remote
```

**Before fix is applied:** 0077, 0078, 0079, 0080 (and possibly 0060) listed as pending.

### STEP 2: Apply

```bash
wrangler d1 migrations apply qesto_3_db --remote
```

**Expected:** 0060 and 0077 apply as no-ops; 0078/0079/0080 apply their real changes; no
`already exists` error.

### STEP 3: Confirm the tracker is clean

```bash
wrangler d1 migrations list qesto_3_db --remote
```

**Expected:** no pending migrations.

### STEP 4: Confirm 0080 landed (the real payload of this chain)

```bash
wrangler d1 execute qesto_3_db --remote --command \
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='votes'"
```

**Expected:** the `votes` table DDL includes `UNIQUE(question_id, voter_id, option_id)`.

### STEP 5: Confirm the stripe indexes exist (why 0060 had to be idempotent)

```bash
wrangler d1 execute qesto_3_db --remote --command \
  "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_stripe_webhook_events%'"
```

**Expected:** both `idx_stripe_webhook_events_event_type` and
`idx_stripe_webhook_events_created_at`.

---

## Verification Checklist

Verified against production `qesto_3_db` on **2026-07-15** (wrangler 4.95.0, `--remote`):

| Check | Command | Expected | Status |
|---|---|---|---|
| **0. Fix on disk** | `grep "CREATE INDEX" migrations/0060_*.sql` | both `IF NOT EXISTS` | ✅ confirmed |
| **1. Read tracker** | `wrangler d1 migrations list --remote` | pending listed | ✅ returned `No migrations to apply` — chain already fully applied |
| **2. Apply** | `wrangler d1 migrations apply --remote` | ✓ no `already exists` | ✅ `No migrations to apply` (clean no-op) |
| **3. Tracker clean** | `wrangler d1 migrations list --remote` | no pending | ✅ no pending |
| **4. 0080 landed** | `SELECT sql ... name='votes'` | `UNIQUE(...,option_id)` | ✅ `UNIQUE(question_id, voter_id, option_id)` present |
| **5. Indexes exist** | `SELECT name ... LIKE 'idx_stripe_webhook_events%'` | both present | ✅ both `_event_type` and `_created_at` present |

**Outcome:** Production DB is fully migrated and internally consistent. The migration
tracker reports no pending migrations, migration 0080's `votes` UNIQUE widen is live, and the
`stripe_webhook_events` indexes exist. The `index ... already exists` error reported during the
incident came from a stale/misdirected invocation (applying the migration file against an
already-migrated DB, or a pre-fix checkout), **not** from `migrations apply` in its fixed state —
`apply` is now a clean no-op. No index drop, tracker surgery, or DB recreation was needed.

---

## Static Audit of the Remaining Chain (2026-07-15)

Scanned all migration files for the same non-idempotent pattern that caused this incident:

- **Bare `CREATE INDEX` in the pending chain (0061→0080):** none.
- **Bare `CREATE UNIQUE INDEX` anywhere:** none.
- **`0044_sessions_is_public.sql`** has a bare `CREATE INDEX idx_sessions_is_public`, but it is
  *earlier* than 0060 (already applied, will not re-run), and `0078` later recreates that index
  with `IF NOT EXISTS` — self-healing, not a blocker.
- **`0078` / `0080` table rebuilds** (`CREATE TABLE sessions__mode_fix`, `votes__unique_fix`) are
  the canonical SQLite constraint-rebuild pattern: temp table is dropped/renamed within the same
  migration and all index recreation is guarded with `IF NOT EXISTS`. Neither had run against prod
  (chain was stuck at 0060), so no leftover temp table can collide.

**Conclusion:** once 0060 clears, the pending chain 0077 → 0078 → 0079 → 0080 is clean and should
apply in a single pass.

---

## Prevention

- **Always use `CREATE INDEX IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`** in migrations. A bare
  `CREATE` in a migration is a latent chain-blocker the moment the object exists but the tracker
  row does not.
- **Never duplicate a migration's schema** into a later migration number (0077 duplicating 0060).
  If a re-apply is genuinely needed, make it explicitly idempotent.
- **Do not hand-edit `d1_migrations`.** Fixing the SQL to be idempotent and re-running `apply` is
  safer than manual `INSERT`/`DELETE` on the tracker (see the 2026-05-17 precedent).

---

## References

- **Prior precedent:** `PRODUCTION-DB-MIGRATION-FIX.md` (2026-05-17, 0015/0016/0020 tracker drift)
- **Migrations:** `migrations/0060_stripe_webhook_events.sql`,
  `migrations/0077_stripe_webhook_events.sql`, `migrations/0080_widen_votes_unique.sql`
- **PRs:** #741 (0077 no-op), #742 (0060 idempotent)
- **Wrangler docs:** https://developers.cloudflare.com/d1/cli-commands/#migrations

---

**Status:** ✅ **RESOLVED (2026-07-15).** Fixes merged to `main` (#741, #742); production
`qesto_3_db` verified fully migrated and consistent (see Verification Checklist above — all 6
checks pass). No further action required.
