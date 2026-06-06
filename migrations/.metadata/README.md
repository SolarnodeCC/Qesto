# Migration Safety Metadata

This directory contains human-readable safety evidence and approval records for Qesto migrations.

## Jankurai sidecars (required for HLT-021/HLT-030)

**Jankurai v1.5.1 reads adjacent TOML sidecars**, not files in this directory:

```
migrations/0003_emoji_poll.sql
migrations/0003_emoji_poll.meta.toml   ← jankurai scans this
migrations/0003_emoji_poll.verify.sql  ← optional post-check SQL
```

Each `.meta.toml` must include: `owner`, `approval`, `rollback`, `backup`, `lock_timeout`, `statement_timeout`, and `verify` (or a `.verify.sql` sidecar).

Run `npm run check:migrations` to validate sidecars in CI.

## JSON archive (this directory)

Each `.json` file corresponds to a migration and documents:

- **kind**: `additive`, `idempotent_rebuild`, `schema_rebuild`, etc.
- **destructive**: Whether data loss occurs
- **reason_safe**: Pre-conditions that made the migration safe at apply time
- **safety_evidence**: Specific data-loss safeguards, rollback steps, integrity checks
- **approval**: Owner, date, and ticket reference
- **postgres_timeouts**: Lock and statement timeouts for PostgreSQL implementations

## Examples

### Additive (Safe)
- Migration: `0043_kb_vectors_storage.json`
- Type: Add new column
- Impact: Zero data loss; rollback via `DROP COLUMN`

### Table Rebuild (Destructive, Previously Verified Empty)
- Migration: `0003_emoji_poll.json`
- Type: Drop + recreate table
- Safety: Applied when table confirmed empty during Phase 9
- Rollback: Restore from backup or replay prior migrations

### Idempotent (Safe)
- Migration: `0006_fix_metrics_summary_columns.json`
- Type: Conditional index rebuild with PRAGMA checks
- Impact: No data loss; metrics auto-expire anyway

## How Jankurai Rules Are Satisfied

- **HLT-030** (destructive migration without metadata) → ✅ Each destructive migration has a `.json` entry
- **HLT-021** (destructive migration without approval) → ✅ All have `approval` section with owner + date
- **PostgreSQL DDL safety** → ✅ Files with `postgres_timeouts` document lock_timeout and statement_timeout

## Adding New Migrations

When creating a migration:

1. Create the `.sql` file in `migrations/`
2. If destructive or risky, add a `.metadata/{id}.json` entry
3. Include: owner, approval, safety evidence, rollback procedure
4. For PostgreSQL: specify `lock_timeout_ms` and `statement_timeout_ms`

## Verification

Run before deployments:
```bash
npm run db:verify --metadata migrations/.metadata/
```

This will:
- Check each migration has a metadata entry if flagged as destructive
- Validate approval dates aren't stale
- Confirm lock/statement timeouts are present for PostgreSQL DDL
