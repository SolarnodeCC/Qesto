/**
 * A D1Database implementation backed by real SQLite (better-sqlite3).
 *
 * Why this exists: tests/helpers/d1-mock.ts is a 2699-line hand-maintained
 * matcher that recognises query strings by literal prefix. It is fast and it
 * fails loudly on an unknown statement, but it can only ever encode what its
 * author believed the SQL does — it has no constraints, no foreign keys, no
 * type affinity, no real join or ORDER BY semantics, and no connection to
 * `migrations/`. A migration that adds a NOT NULL column or tightens a CHECK
 * leaves every test against it green.
 *
 * This adapter runs the queries. Schema comes from applying `migrations/*.sql`
 * in order, so the migrations themselves become tested artifacts.
 *
 * Scope: a test double, not a D1 emulator. It covers the surface this codebase
 * uses — prepare/bind/first/all/run/batch/exec — over one in-memory database.
 */
import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations')

/**
 * Migration files in application order.
 *
 * `*.verify.sql` sidecars are assertions run against an already-migrated
 * database, not migrations — they are never recorded in `d1_migrations`
 * (see scripts/reconcile-remote-d1.mjs) and must not be applied here.
 */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.verify.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

/**
 * Rewrite D1's `?N` placeholders to plain `?`, reordering the bound values to
 * match. better-sqlite3 rejects positional arrays for numbered parameters, and
 * a naive textual swap would corrupt any statement that repeats or reorders
 * them (`WHERE a = ?1 AND b = ?2 OR c = ?1`). String literals and comments are
 * skipped so a `?` inside them is never treated as a placeholder.
 */
export function normalisePlaceholders(sql: string, values: unknown[]): { sql: string; values: unknown[] } {
  let out = ''
  const reordered: unknown[] = []
  let i = 0
  let sawNumbered = false

  while (i < sql.length) {
    const ch = sql[i]

    if (ch === "'" || ch === '"') {
      const quote = ch
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === quote && sql[j + 1] === quote) { j += 2; continue }
        if (sql[j] === quote) { j += 1; break }
        j += 1
      }
      out += sql.slice(i, j)
      i = j
      continue
    }

    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const stop = end === -1 ? sql.length : end
      out += sql.slice(i, stop)
      i = stop
      continue
    }

    if (ch === '?') {
      const m = /^\?(\d+)/.exec(sql.slice(i))
      if (m) {
        sawNumbered = true
        reordered.push(values[Number(m[1]) - 1])
        out += '?'
        i += m[0].length
        continue
      }
      reordered.push(undefined) // placeholder slot for a bare `?`
      out += '?'
      i += 1
      continue
    }

    out += ch
    i += 1
  }

  // Bare `?` statements keep their original ordering.
  return sawNumbered ? { sql: out, values: reordered } : { sql, values }
}

/** D1 hands back `null` for absent values and rejects undefined. */
function toBindable(v: unknown): unknown {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

class SqliteD1Statement {
  constructor(
    private db: Database.Database,
    private sql: string,
    private values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): SqliteD1Statement {
    return new SqliteD1Statement(this.db, this.sql, values)
  }

  private compiled() {
    const { sql, values } = normalisePlaceholders(this.sql, this.values)
    return { stmt: this.db.prepare(sql), bound: values.map(toBindable) }
  }

  async first<T = unknown>(column?: string): Promise<T | null> {
    const { stmt, bound } = this.compiled()
    const row = stmt.get(...bound) as Record<string, unknown> | undefined
    if (row === undefined) return null
    return (column ? (row[column] as T) ?? null : (row as T))
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: true; meta: Record<string, unknown> }> {
    const { stmt, bound } = this.compiled()
    const results = stmt.all(...bound) as T[]
    return { results, success: true, meta: { rows_read: results.length } }
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    const { stmt, bound } = this.compiled()
    const info = stmt.run(...bound)
    return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } }
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const { stmt, bound } = this.compiled()
    return stmt.raw().all(...bound) as T[]
  }
}

export class SqliteD1 {
  readonly db: Database.Database

  private constructor(db: Database.Database) {
    this.db = db
  }

  /** Fresh in-memory database with every migration applied, in order. */
  static migrated(): SqliteD1 {
    const db = new Database(':memory:')
    // D1 enforces foreign keys; SQLite defaults them off, which would hide
    // exactly the referential bugs this adapter exists to catch.
    db.pragma('foreign_keys = ON')
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      try {
        db.exec(sql)
      } catch (err) {
        throw new Error(`migration ${file} failed to apply: ${(err as Error).message}`, { cause: err })
      }
    }
    return new SqliteD1(db)
  }

  /** Empty database — for tests that build their own schema. */
  static empty(): SqliteD1 {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    return new SqliteD1(db)
  }

  prepare(sql: string): SqliteD1Statement {
    return new SqliteD1Statement(this.db, sql)
  }

  async batch<T = unknown>(statements: SqliteD1Statement[]): Promise<{ results: T[]; success: true }[]> {
    const out: { results: T[]; success: true }[] = []
    const run = this.db.transaction(() => undefined)
    run()
    for (const s of statements) out.push(await s.all<T>())
    return out
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.db.exec(sql)
    return { count: 0, duration: 0 }
  }

  /** Cast for code typed against the Workers D1Database interface. */
  asD1(): D1Database {
    return this as unknown as D1Database
  }
}
