# Production Database Migration Sync — Step-by-Step Fix

**Date:** 2026-05-17  
**Issue:** Production has 3 pending migrations; 0015 was applied but tracker not updated; 0016/0020 (v2.2) must not apply yet  
**Fix Target:** Sync 0015, keep 0016/0020 staged until Sprint 26 release

---

## Problem Summary

```
Production (qesto_3_db) migrations list shows:
✗ 0015_help_assistant_tables.sql — tables exist but not marked applied
✗ 0016_recaps_table.sql — v2.2 feature (staged, don't apply yet)
✗ 0020_v2_2_schema.sql — v2.2 feature (staged, don't apply yet)
```

The help_documents, help_feedback, etc. tables already exist in production, meaning 0015 was applied at some point but wrangler's migration tracker lost sync.

---

## Solution: 6 Steps to Fix

### STEP 1: Verify 0015 tables exist

```bash
wrangler d1 execute qesto_3_db --remote --command "SELECT COUNT(*) as count FROM help_documents"
```

**Expected:** A number (0 or higher)  
**If error "no such table":** Unexpected — tables should exist

---

### STEP 2: Verify recaps doesn't exist yet (v2.2 safeguard)

```bash
wrangler d1 execute qesto_3_db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='recaps'"
```

**Expected:** Empty result (0 rows) — good, recaps not yet in production ✓

---

### STEP 3: Apply 0015 to sync wrangler's tracker

```bash
wrangler d1 migrations apply qesto_3_db --remote
```

**What this does:**
- Applies 0015 (will skip if tables already exist, or succeed if they don't)
- Updates wrangler's internal migration tracker
- Leaves 0016/0020 pending (ready for Sprint 26 release)

**Expected output:**
```
🌀 Applying migrations...
✓ Applied 0015_help_assistant_tables.sql
ℹ️ Migrations to be applied:
  - 0016_recaps_table.sql
  - 0020_v2_2_schema.sql
```

---

### STEP 4: Verify the tracker is now synced

```bash
wrangler d1 migrations list qesto_3_db --remote
```

**Expected output:**
```
Migrations to be applied:
┌────────────────────────────┐
│ Name                       │
├────────────────────────────┤
│ 0016_recaps_table.sql      │
├────────────────────────────┤
│ 0020_v2_2_schema.sql       │
└────────────────────────────┘
```

✓ **Only v2.2 migrations remain pending** — correct!

---

### STEP 5: Add safety reminder to wrangler.toml

Open `wrangler.toml` and add this comment before the `[[d1_databases]]` section for the production DB:

```toml
# ⚠️ DO NOT apply migrations manually until Sprint 26 v2.2 release approval
# 0016_recaps_table.sql and 0020_v2_2_schema.sql are staged for v2.2
# Feature flag rollout: Sprints 25–26
# Automatic application: Only via approved Sprint 26 release process
```

---

### STEP 6: Verify no unexpected changes to production

```bash
wrangler d1 execute qesto_3_db --remote --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"
```

**Expected:** 34–35 tables (same count as before)  
Should **not** have recaps or custom_roles tables yet.

---

## Verification Checklist

| Check | Command | Expected | Status |
|---|---|---|---|
| **1. 0015 tables exist** | `SELECT COUNT(*) FROM help_documents` | number ≥ 0 | [ ] |
| **2. Recaps doesn't exist** | `SELECT COUNT(*) FROM sqlite_master WHERE name='recaps'` | 0 rows | [ ] |
| **3. Apply & sync tracker** | `wrangler d1 migrations apply --remote` | ✓ success | [ ] |
| **4. Verify tracker fixed** | `wrangler d1 migrations list --remote` | 0016, 0020 pending | [ ] |
| **5. Table count unchanged** | `SELECT COUNT(*) FROM sqlite_master WHERE type='table'` | 34–35 | [ ] |
| **6. wrangler.toml updated** | Add safety comment | Documented | [ ] |

---

## If Something Goes Wrong

### Issue: "UNIQUE constraint failed" or "table already exists"

**Why:** 0015 attempted to create tables that already exist  
**Solution:** This is expected behavior. Wrangler skips the CREATE TABLE statements and just marks the migration as applied.

```bash
# Just run the apply again if it partially failed
wrangler d1 migrations apply qesto_3_db --remote
```

---

### Issue: 0016 or 0020 accidentally got applied to production

**🚨 CRITICAL:** This should not happen if you follow Step 3 only.

If you see `recaps` or `custom_roles` in production:

```bash
# Check what was applied
wrangler d1 execute qesto_3_db --remote --command "SELECT name FROM sqlite_master WHERE name IN ('recaps', 'custom_roles')"

# If they exist, v2.2 was applied early — escalate to DevOps immediately
```

**Recovery:** Database rollback required. Contact DevOps.

---

### Issue: 0015 fails but tables don't exist

**Why:** Unusual state — tables were dropped but migration tracker wasn't reset  
**Solution:**

```bash
# Reapply 0015 from scratch
wrangler d1 migrations apply qesto_3_db --remote
```

---

## After Fix: Hands-Off Until Sprint 26

**DO NOT:**
- Run `wrangler d1 migrations apply` again
- Manually apply 0016 or 0020
- Modify migration files

**DO:**
- Keep migrations staged on this branch (`claude/plan-roadmap-sprints-FcRjL`)
- Commit `wrangler.toml` change to branch
- Wait for Sprint 26 release decision

---

## When to Apply 0016/0020 (Sprint 26 Release)

In Sprint 26, during the v2.2 go-live process:

1. **Canary gate passes** (5% cohort, all metrics healthy)
2. **DevOps approval** given to proceed with migrations
3. **Run migration application:**
   ```bash
   wrangler d1 migrations apply qesto_3_db --remote
   ```
4. **Verify:**
   ```bash
   wrangler d1 execute qesto_3_db --remote --command "SELECT COUNT(*) FROM recaps"
   ```
5. **Deploy code with feature flags ON**

---

## References

- **Planning:** `/docs/EPIC-ROADMAP-V2.2-VALIDATED.md` (Sprint 25-26 release gates)
- **Schema:** `migrations/0016_recaps_table.sql`, `migrations/0020_v2_2_schema.sql`
- **Wrangler docs:** https://developers.cloudflare.com/d1/cli-commands/#migrations

---

**Status:** Ready to execute. Follow steps 1–6 above.
