import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import {
  __resetTownhallSchemaRepairForTests,
  ensureTownhallSchema,
  sessionsTableNeedsModeWiden,
} from '../../functions/api/lib/session-schema-repair'

// Records every SQL string prepared against the mock DB so tests can assert the
// request-path repair never issues destructive DDL (the live DROP TABLE sessions
// rebuild was removed in the 2026-07-03 incident fix — it is migration 0078 now).
function recordingDb(ddl: string | null): { db: D1Database; sql: string[] } {
  const sql: string[] = []
  const db = {
    prepare: (query: string) => {
      sql.push(query)
      return {
        first: async () => (query.includes('sqlite_master') ? { sql: ddl } : null),
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } }),
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { changes: 0 } }),
        }),
      }
    },
  } as unknown as D1Database
  return { db, sql }
}

const WIDE_DDL =
  "CHECK (session_mode IN ('reflection','fun','townhall','stage','retro','ideate','deliberate'))"
const NARROW_DDL = "CHECK (session_mode IN ('reflection','fun'))"

describe('sessionsTableNeedsModeWiden', () => {
  it('returns true when session_mode CHECK lacks townhall', async () => {
    const { db } = recordingDb(NARROW_DDL)
    expect(await sessionsTableNeedsModeWiden(db)).toBe(true)
  })

  it('returns false when session_mode CHECK already includes townhall', async () => {
    const { db } = recordingDb(WIDE_DDL)
    expect(await sessionsTableNeedsModeWiden(db)).toBe(false)
  })
})

describe('ensureTownhallSchema', () => {
  beforeEach(() => {
    __resetTownhallSchemaRepairForTests()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('never runs a live table rebuild, even when the CHECK still needs widening', async () => {
    const logSpy = vi.spyOn(console, 'log')
    const { db, sql } = recordingDb(NARROW_DDL)

    await ensureTownhallSchema(db)

    // The destructive request-path rebuild is gone — these must never be issued.
    expect(sql.some((s) => s.includes('DROP TABLE sessions'))).toBe(false)
    expect(sql.some((s) => s.includes('sessions__mode_fix'))).toBe(false)
    expect(sql.some((s) => s.includes('PRAGMA foreign_keys=OFF'))).toBe(false)

    // Instead it warns the operator that migration 0078 is pending.
    const events = logSpy.mock.calls
      .map(([line]) => {
        try {
          return JSON.parse(line as string) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((e): e is Record<string, unknown> => e !== null)
    expect(events.find((e) => e.event === 'sessions.mode_widen_pending')).toBeTruthy()
  })

  it('adds missing additive columns and does not warn when already widened', async () => {
    const logSpy = vi.spyOn(console, 'log')
    const { db, sql } = recordingDb(WIDE_DDL)

    await ensureTownhallSchema(db)

    // Additive ALTERs still run (idempotent on newer DBs), rebuild never does.
    expect(sql.some((s) => s.includes('ALTER TABLE sessions ADD COLUMN'))).toBe(true)
    expect(sql.some((s) => s.includes('DROP TABLE sessions'))).toBe(false)

    const events = logSpy.mock.calls
      .map(([line]) => {
        try {
          return JSON.parse(line as string) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((e): e is Record<string, unknown> => e !== null)
    expect(events.find((e) => e.event === 'sessions.mode_widen_pending')).toBeUndefined()
  })

  it('is idempotent per isolate — repeated calls are cheap no-ops after the first', async () => {
    const { db, sql } = recordingDb(WIDE_DDL)
    await ensureTownhallSchema(db)
    const afterFirst = sql.length
    await ensureTownhallSchema(db)
    expect(sql.length).toBe(afterFirst)
  })
})
