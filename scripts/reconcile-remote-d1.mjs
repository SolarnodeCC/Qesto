#!/usr/bin/env node
/**
 * scripts/reconcile-remote-d1.mjs — Reconcile the REMOTE (production) D1
 * migration tracker with schema.sql, and apply the one genuinely-new migration.
 *
 * WHY THIS EXISTS
 * ---------------
 * Production `qesto_3_db` was provisioned from `schema.sql` (the cumulative
 * source of truth), so every table/index already exists — but wrangler's
 * `d1_migrations` tracker was never told which migration files those objects
 * came from. So `wrangler d1 migrations apply --remote` thinks ~25 migrations
 * are "pending", tries to REPLAY them from scratch, and aborts on the first
 * object that already exists (e.g. `idx_stripe_webhook_events_event_type
 * already exists`). Net effect: the newest migration
 * `0079_marketing_templates_registry.sql` never runs, so `marketing_templates`
 * is missing and `/api/gallery` returns 500.
 *
 * WHAT THIS DOES  (mirrors scripts/reset-local-d1.sh, but SAFE for remote)
 * ----------------------------------------------------------------------
 *   1. (read-only) shows the current remote tracker state / pending list.
 *   2. applies ONLY migration 0079 (idempotent: every statement is
 *      `CREATE ... IF NOT EXISTS`) so the one genuinely-new object exists.
 *   3. "stamps" every migration filename into `d1_migrations` with
 *      INSERT OR IGNORE, so wrangler stops trying to replay already-applied
 *      migrations.
 *   4. verifies 0 pending + `marketing_templates` is queryable.
 *
 * SAFETY
 * ------
 *   - NEVER wipes state, NEVER re-applies schema.sql on remote (unlike the
 *     local reset script), NEVER drops anything.
 *   - Only idempotent DDL (`IF NOT EXISTS`) and `INSERT OR IGNORE` run against
 *     prod. Re-running the script is a no-op.
 *   - Dry-run by default. Nothing is written without `--apply`.
 *
 * ASSUMPTION (the repo's invariant): `schema.sql` == the sum of all migrations,
 * so every pending migration's objects already exist in prod except 0079's.
 * The dry-run prints the pending list so you can eyeball this before `--apply`.
 *
 * ROLLBACK: this only ADDS a table/indexes and tracker rows. To undo, drop the
 * table (`DROP TABLE IF EXISTS marketing_templates`) and delete its tracker row
 * (`DELETE FROM d1_migrations WHERE name='0079_marketing_templates_registry.sql'`).
 *
 * USAGE
 *   node scripts/reconcile-remote-d1.mjs           # dry-run: inspect only
 *   node scripts/reconcile-remote-d1.mjs --apply   # reconcile + apply 0079
 *
 * Requires the same Cloudflare auth you already use for `wrangler ... --remote`.
 * wrangler may prompt "continue?" for remote writes — answer yes.
 */

import { execSync } from 'node:child_process'
import { readdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DB_NAME = 'qesto_3_db'
const MIGRATIONS_DIR = join(ROOT, 'migrations')
const NEW_MIGRATION = '0079_marketing_templates_registry.sql'
const APPLY = process.argv.includes('--apply')

function wrangler(argsString) {
  // stdio:'inherit' so Cloudflare auth + confirmation prompts work and output
  // is visible. execSync throws on a non-zero exit, which aborts the script.
  execSync(`npx wrangler ${argsString}`, { cwd: ROOT, stdio: 'inherit' })
}

function banner(step) {
  console.log(`\n─── ${step} ───`)
}

// Every *.sql file wrangler treats as a migration (basename, matching the
// name format wrangler stores in d1_migrations).
const migrationNames = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

banner('Step 0 — current remote migration state (read-only)')
console.log(`Database: ${DB_NAME} (--remote)`)
console.log(`Local migration files: ${migrationNames.length} *.sql`)
try {
  wrangler(`d1 migrations list ${DB_NAME} --remote`)
} catch {
  console.log('(could not list migrations — continuing; the tracker may be empty)')
}

if (!APPLY) {
  console.log('\nDRY-RUN. Review the pending list above.')
  console.log('When it looks right, re-run with:  node scripts/reconcile-remote-d1.mjs --apply')
  process.exit(0)
}

banner(`Step 1 — apply the new migration ${NEW_MIGRATION} (idempotent)`)
wrangler(`d1 execute ${DB_NAME} --remote --file=${join('migrations', NEW_MIGRATION)}`)

banner('Step 2 — stamp all migration filenames into d1_migrations')
const stampSql = [
  'CREATE TABLE IF NOT EXISTS d1_migrations(',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
  '  name TEXT UNIQUE,',
  '  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL',
  ');',
  ...migrationNames.map(
    (name) =>
      `INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('${name}', datetime('now'));`,
  ),
].join('\n')

const stampFile = join(tmpdir(), `qesto-d1-stamp-${Date.now()}.sql`)
writeFileSync(stampFile, stampSql)
try {
  wrangler(`d1 execute ${DB_NAME} --remote --file=${stampFile}`)
} finally {
  try {
    unlinkSync(stampFile)
  } catch {
    /* best-effort cleanup */
  }
}

banner('Step 3 — verify (expect 0 pending + a row count for marketing_templates)')
wrangler(`d1 migrations list ${DB_NAME} --remote`)
wrangler(`d1 execute ${DB_NAME} --remote --command="SELECT count(*) AS marketing_templates_rows FROM marketing_templates;"`)

console.log('\n✓ Done. Now check production: curl -s https://qesto.cc/api/gallery?limit=1')
