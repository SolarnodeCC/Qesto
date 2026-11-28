/**
 * Requirement: CLAUDE.md session state machine (LIVE → CLOSED) + DD-03 salt destruction at close — abandoned sessions are auto-closed.
 */
import { describe, expect, it } from 'vitest'
import { closeStaleSessions, STALE_SESSION_AGE_MS } from '../../functions/api/lib/stale-session-sweep'
import type { Env } from '../../functions/api/types'

function fakeDb(rows: Array<{ id: string; owner_id: string }>) {
  const batches: string[][] = []
  let cutoff = 0
  const db = {
    prepare(sql: string) {
      const stmt = {
        sql,
        args: [] as unknown[],
        bind(...a: unknown[]) { stmt.args = a; return stmt },
        async all() { cutoff = stmt.args[0] as number; return { results: rows } },
        async run() { return { meta: { changes: 1 } } },
      }
      return stmt
    },
    async batch(stmts: Array<{ sql: string }>) { batches.push(stmts.map((s) => s.sql)); return [] },
  }
  return { db, batches, cutoff: () => cutoff }
}

describe('closeStaleSessions', () => {
  it('closes abandoned sessions through the DO + D1 close path', async () => {
    const { db, batches, cutoff } = fakeDb([{ id: 's_old', owner_id: 'u1' }])
    const doCalls: string[] = []
    const env = {
      DB: db,
      SESSION_ROOM: {
        idFromName: (n: string) => n,
        get: (id: string) => ({
          fetch: async (url: string) => {
            doCalls.push(`${id} ${url}`)
            return new Response(JSON.stringify({ ok: true, data: { votes: [{ voterId: 'v', optionId: 'a', questionId: 'q1' }], questionId: 'q1' } }))
          },
        }),
      },
    } as unknown as Env
    const now = 10 * STALE_SESSION_AGE_MS
    const r = await closeStaleSessions(env, now)
    expect(cutoff()).toBe(now - STALE_SESSION_AGE_MS)
    expect(r).toEqual({ scanned: 1, closed: 1, failed: 0 })
    expect(doCalls).toEqual(['s_old https://do.internal/close'])
    const flat = batches.flat().join('\n')
    expect(flat).toContain('INSERT OR IGNORE INTO votes')
    expect(flat).toMatch(/UPDATE sessions/)
  })

  it('still closes the D1 row when the DO has no state', async () => {
    const { db, batches } = fakeDb([{ id: 's_nodo', owner_id: 'u1' }])
    const env = {
      DB: db,
      SESSION_ROOM: { idFromName: (n: string) => n, get: () => ({ fetch: async () => new Response('Session not LIVE', { status: 409 }) }) },
    } as unknown as Env
    const r = await closeStaleSessions(env)
    expect(r.closed).toBe(1)
    expect(batches.flat().join('\n')).toMatch(/UPDATE sessions/)
  })
})
