/**
 * Requirement: issue #887 (DD-14) — list endpoints page with an opaque keyset
 * cursor over (created_at DESC, id DESC), never OFFSET; malformed input is a
 * 400, never a 500; the public session list follows the cursor to the end.
 */
import { describe, expect, it } from 'vitest'
import { decodeCursor, encodeCursor, parsePageQuery, toPage } from '../../functions/api/lib/pagination'
import { listSessionsForTeamPage } from '../../functions/api/repositories/sessionRepository'

describe('cursor encoding', () => {
  it('round-trips and rejects garbage', () => {
    const c = { createdAt: 1730000000000, id: '01JBXYZ' }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
    expect(decodeCursor('!!!')).toBeNull()
    expect(decodeCursor(btoa('nocolon'))).toBeNull()
    expect(decodeCursor(btoa('abc:id'))).toBeNull()
  })

  it('parsePageQuery validates limit and cursor', () => {
    expect(parsePageQuery({}, 100)).toEqual({ ok: true, page: { limit: 100, cursor: null } })
    expect(parsePageQuery({ limit: '0' }).ok).toBe(false)
    expect(parsePageQuery({ limit: '101' }).ok).toBe(false)
    expect(parsePageQuery({ cursor: 'zz' }).ok).toBe(false)
  })

  it('toPage trims the probe row and emits nextCursor only when more exist', () => {
    const rows = [3, 2, 1].map((n) => ({ id: `s${n}`, created_at: n }))
    const p = toPage(rows, 2)
    expect(p.items.map((r) => r.id)).toEqual(['s3', 's2'])
    expect(decodeCursor(p.nextCursor!)).toEqual({ createdAt: 2, id: 's2' })
    expect(toPage(rows, 3).nextCursor).toBeNull()
  })
})

// Minimal D1 fake that evaluates the keyset predicate the repository emits.
function fakeDb(rows: Array<{ id: string; created_at: number; team_id: string }>) {
  return {
    prepare(sql: string) {
      return {
        bind(...b: unknown[]) {
          return {
            async all() {
              const keyset = sql.includes('created_at < ?2')
              const [team, a, c, d] = b as [string, number, string, number]
              const limit = keyset ? d : (a as unknown as number)
              const out = rows
                .filter((r) => r.team_id === team)
                .filter((r) => !keyset || r.created_at < a || (r.created_at === a && r.id < c))
                .sort((x, y) => y.created_at - x.created_at || (y.id < x.id ? -1 : 1))
                .slice(0, limit)
              return { results: out }
            },
          }
        },
      }
    },
  } as unknown as D1Database
}

describe('listSessionsForTeamPage', () => {
  it('walks every row exactly once across pages, including created_at ties', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      id: `s${i}`,
      created_at: i < 4 ? 100 : 200, // ties within each group
      team_id: 't1',
    }))
    rows.push({ id: 'other', created_at: 300, team_id: 't2' })
    const db = fakeDb(rows)
    const seen: string[] = []
    let cursor = null as ReturnType<typeof decodeCursor>
    for (let guard = 0; guard < 10; guard++) {
      const page = await listSessionsForTeamPage(db, 't1', { limit: 3, cursor })
      seen.push(...page.items.map((r) => r.id))
      if (!page.nextCursor) break
      cursor = decodeCursor(page.nextCursor)
    }
    expect(seen).toHaveLength(7)
    expect(new Set(seen).size).toBe(7)
    expect(seen).not.toContain('other')
  })
})
