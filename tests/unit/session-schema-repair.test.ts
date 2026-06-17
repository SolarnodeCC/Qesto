import { describe, expect, it, beforeEach } from 'vitest'
import {
  __resetTownhallSchemaRepairForTests,
  ensureTownhallSchema,
  sessionsTableNeedsModeWiden,
} from '../../functions/api/lib/session-schema-repair'

function mockDb(ddl: string | null): D1Database {
  return {
    prepare: (sql: string) => ({
      first: async () => (sql.includes('sqlite_master') ? { sql: ddl } : null),
      all: async () => ({ results: [] }),
      run: async () => ({ meta: { changes: 0 } }),
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } }),
      }),
    }),
  } as unknown as D1Database
}

describe('sessionsTableNeedsModeWiden', () => {
  it('returns true when session_mode CHECK lacks townhall', async () => {
    const db = mockDb("CHECK (session_mode IN ('reflection','fun'))")
    expect(await sessionsTableNeedsModeWiden(db)).toBe(true)
  })

  it('returns false when session_mode CHECK already includes townhall', async () => {
    const db = mockDb(
      "CHECK (session_mode IN ('reflection','fun','townhall','stage','retro','ideate','deliberate'))",
    )
    expect(await sessionsTableNeedsModeWiden(db)).toBe(false)
  })
})

describe('ensureTownhallSchema', () => {
  beforeEach(() => {
    __resetTownhallSchemaRepairForTests()
  })

  it('rethrows on failure without marking the schema ready', async () => {
    let pragmaCalls = 0
    const db = {
      prepare: (sql: string) => ({
        first: async () =>
          sql.includes('sqlite_master') ? { sql: "CHECK (session_mode IN ('reflection','fun'))" } : null,
        all: async () => {
          if (sql.includes('PRAGMA table_info')) {
            pragmaCalls++
            throw new Error('pragma failed')
          }
          return { results: [] }
        },
        run: async () => ({ meta: { changes: 0 } }),
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { changes: 0 } }),
        }),
      }),
    } as unknown as D1Database

    await expect(ensureTownhallSchema(db)).rejects.toThrow('pragma failed')
    await expect(ensureTownhallSchema(db)).rejects.toThrow('pragma failed')
    expect(pragmaCalls).toBe(2)
  })

  it('no-ops when session_mode CHECK is already widened', async () => {
    let rebuildAttempts = 0
    const db = {
      prepare: (sql: string) => ({
        first: async () =>
          sql.includes('sqlite_master')
            ? {
                sql: "CHECK (session_mode IN ('reflection','fun','townhall','stage','retro','ideate','deliberate'))",
              }
            : null,
        all: async () => {
          if (sql.includes('PRAGMA table_info')) rebuildAttempts++
          return { results: [] }
        },
        run: async () => ({ meta: { changes: 0 } }),
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { changes: 0 } }),
        }),
      }),
    } as unknown as D1Database

    await ensureTownhallSchema(db)
    await ensureTownhallSchema(db)
    expect(rebuildAttempts).toBe(0)
  })
})
