/**
 * Migration integrity, against real SQLite.
 *
 * Until RT-2026-09 the 82 migrations in `migrations/` were never executed by
 * any test. The only D1 double was tests/helpers/d1-mock.ts, a hand-maintained
 * prefix matcher with no link to the migration files, so a migration could add
 * a NOT NULL column, tighten a CHECK, or fail to parse entirely and the whole
 * suite would stay green.
 *
 * These tests apply the migrations for real and assert on the resulting schema.
 */
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SqliteD1, migrationFiles, normalisePlaceholders } from '../helpers/d1-sqlite'

const ROOT = join(import.meta.dirname, '..', '..')

function tablesOf(db: Database.Database): Set<string> {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]
  return new Set(rows.map((r) => r.name))
}

function columnsOf(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string; notnull: number }[]
  return rows.map((c) => `${c.name}:${c.type}${c.notnull ? ' NOT NULL' : ''}`).sort()
}

function migratedDb(): Database.Database {
  const db = new Database(':memory:')
  for (const f of migrationFiles()) db.exec(readFileSync(join(ROOT, 'migrations', f), 'utf8'))
  return db
}

function schemaSqlDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(readFileSync(join(ROOT, 'schema.sql'), 'utf8'))
  return db
}

describe('migrations apply', () => {
  it('applies every migration in order against real SQLite', () => {
    // SqliteD1.migrated() throws with the offending filename if any migration
    // is invalid SQL or depends on an object an earlier one did not create.
    expect(() => SqliteD1.migrated()).not.toThrow()
  })

  it('orders migrations numerically, not lexically', () => {
    // Plain string sort puts 0100 before 0081 and silently reorders history.
    const files = migrationFiles()
    const numbers = files.map((f) => Number(f.slice(0, 4)))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
  })

  it('excludes .verify.sql sidecars, which are assertions rather than migrations', () => {
    expect(migrationFiles().some((f) => f.endsWith('.verify.sql'))).toBe(false)
  })

  it('produces the core tables the API depends on', () => {
    const tables = tablesOf(migratedDb())
    for (const t of ['users', 'sessions', 'questions', 'votes', 'magic_links', 'audit_log']) {
      expect(tables.has(t)).toBe(true)
    }
  })
})

/**
 * `scripts/reconcile-remote-d1.mjs` states, as "the repo's invariant", that
 * `schema.sql` == the sum of all migrations — and acts on PRODUCTION on that
 * basis. It does not hold: schema.sql still describes itself as the "v1
 * vertical slice" while the migrations have moved far past it.
 *
 * Closing the gap is a data-model decision with production consequences, so
 * this pins the divergence instead of asserting it away: the numbers below are
 * what exists today, and the test fails if the drift GROWS. Lower them as
 * schema.sql is brought back in step; delete this block when it reaches parity.
 */
describe('schema.sql vs migrations drift (documented, ratcheted)', () => {
  const KNOWN_TABLES_ONLY_IN_SCHEMA_SQL = ['help_conversations', 'help_messages']
  const KNOWN_TABLES_MISSING_FROM_SCHEMA_SQL = 32
  const KNOWN_TABLES_WITH_DIFFERING_COLUMNS = ['help_feedback', 'sessions', 'users']

  it('does not grow the set of tables missing from schema.sql', () => {
    const fromSchema = tablesOf(schemaSqlDb())
    const fromMigrations = tablesOf(migratedDb())
    const missing = [...fromMigrations].filter((t) => !fromSchema.has(t))
    expect(missing.length).toBeLessThanOrEqual(KNOWN_TABLES_MISSING_FROM_SCHEMA_SQL)
  })

  it('does not grow the set of tables that exist only in schema.sql', () => {
    const fromSchema = tablesOf(schemaSqlDb())
    const fromMigrations = tablesOf(migratedDb())
    const orphans = [...fromSchema].filter((t) => !fromMigrations.has(t)).sort()
    expect(orphans).toEqual(KNOWN_TABLES_ONLY_IN_SCHEMA_SQL)
  })

  it('does not grow the set of tables whose columns disagree', () => {
    const a = schemaSqlDb()
    const b = migratedDb()
    const shared = [...tablesOf(a)].filter((t) => tablesOf(b).has(t)).sort()
    const differing = shared.filter((t) => columnsOf(a, t).join('|') !== columnsOf(b, t).join('|'))
    expect(differing).toEqual(KNOWN_TABLES_WITH_DIFFERING_COLUMNS)
  })

  it('records the specific billing/recap columns schema.sql is missing', () => {
    // Named explicitly so the consequence is legible: a database provisioned
    // from schema.sql alone has no users.stripe_customer_id.
    const fromSchema = columnsOf(schemaSqlDb(), 'users')
    const fromMigrations = columnsOf(migratedDb(), 'users')
    expect(fromMigrations.some((c) => c.startsWith('stripe_customer_id:'))).toBe(true)
    expect(fromSchema.some((c) => c.startsWith('stripe_customer_id:'))).toBe(false)
  })
})

describe('real SQL semantics the prefix-matching mock cannot express', () => {
  it('enforces NOT NULL', async () => {
    const d1 = SqliteD1.migrated()
    await expect(
      d1.prepare('INSERT INTO users (id, email, created_at, plan) VALUES (?1, ?2, ?3, ?4)')
        .bind('u1', null, Date.now(), 'free')
        .run(),
    ).rejects.toThrow(/NOT NULL/i)
  })

  it('enforces UNIQUE on users.email', async () => {
    const d1 = SqliteD1.migrated()
    const insert = (id: string) =>
      d1.prepare('INSERT INTO users (id, email, created_at, plan) VALUES (?1, ?2, ?3, ?4)')
        .bind(id, 'dup@example.com', Date.now(), 'free')
        .run()
    await insert('u1')
    await expect(insert('u2')).rejects.toThrow(/UNIQUE/i)
  })

  it('enforces the plan CHECK constraint', async () => {
    const d1 = SqliteD1.migrated()
    await expect(
      d1.prepare('INSERT INTO users (id, email, created_at, plan) VALUES (?1, ?2, ?3, ?4)')
        .bind('u1', 'a@example.com', Date.now(), 'platinum')
        .run(),
    ).rejects.toThrow(/CHECK/i)
  })

  it('round-trips a row through bind/first/all with real ordering', async () => {
    const d1 = SqliteD1.migrated()
    for (const [id, email] of [['u1', 'b@example.com'], ['u2', 'a@example.com']]) {
      await d1.prepare('INSERT INTO users (id, email, created_at, plan) VALUES (?1, ?2, ?3, ?4)')
        .bind(id, email, Date.now(), 'free')
        .run()
    }
    const one = await d1.prepare('SELECT email FROM users WHERE id = ?1').bind('u1').first<{ email: string }>()
    expect(one?.email).toBe('b@example.com')

    const all = await d1.prepare('SELECT email FROM users ORDER BY email ASC').all<{ email: string }>()
    expect(all.results.map((r) => r.email)).toEqual(['a@example.com', 'b@example.com'])
  })

  it('reports changes from run()', async () => {
    const d1 = SqliteD1.migrated()
    await d1.prepare('INSERT INTO users (id, email, created_at, plan) VALUES (?1, ?2, ?3, ?4)')
      .bind('u1', 'a@example.com', Date.now(), 'free')
      .run()
    const res = await d1.prepare('UPDATE users SET plan = ?1 WHERE id = ?2').bind('team', 'u1').run()
    expect(res.meta.changes).toBe(1)
  })
})

describe('normalisePlaceholders', () => {
  it('reorders values to match ?N order of appearance', () => {
    const { sql, values } = normalisePlaceholders('SELECT * FROM t WHERE b = ?2 AND a = ?1', ['A', 'B'])
    expect(sql).toBe('SELECT * FROM t WHERE b = ? AND a = ?')
    expect(values).toEqual(['B', 'A'])
  })

  it('repeats a value when the same ?N is referenced twice', () => {
    const { values } = normalisePlaceholders('SELECT * FROM t WHERE a = ?1 OR b = ?2 OR c = ?1', ['A', 'B'])
    expect(values).toEqual(['A', 'B', 'A'])
  })

  it('leaves a ? inside a string literal alone', () => {
    const { sql, values } = normalisePlaceholders("SELECT '?1 literal' AS q, a FROM t WHERE a = ?1", ['A'])
    expect(sql).toBe("SELECT '?1 literal' AS q, a FROM t WHERE a = ?")
    expect(values).toEqual(['A'])
  })

  it('passes bare ? statements through untouched', () => {
    const { sql, values } = normalisePlaceholders('INSERT INTO t VALUES (?, ?)', ['A', 'B'])
    expect(sql).toBe('INSERT INTO t VALUES (?, ?)')
    expect(values).toEqual(['A', 'B'])
  })
})
