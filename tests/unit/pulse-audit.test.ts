import { describe, expect, it } from 'vitest'
import {
  buildPulseAuditRecord,
  recordPulseQueryAudit,
  fetchPulseQueryAudit,
  type PulseAuditRecord,
} from '../../functions/api/lib/pulse-audit'

/** Minimal inline D1 fake covering only the pulse_query_audit insert + select. */
function fakeDb() {
  const rows: PulseAuditRecord[] = []
  const db = {
    prepare(sql: string) {
      const args: unknown[] = []
      return {
        bind(...a: unknown[]) {
          args.push(...a)
          return this
        },
        async run() {
          if (sql.startsWith('INSERT INTO pulse_query_audit')) {
            const [id, team_id, actor_id, query_type, window, cohort_size, masked_rows, trace_id, queried_at] = args as [
              string, string, string, PulseAuditRecord['queryType'], string, number, number, string | null, number,
            ]
            rows.push({ id, teamId: team_id, actorId: actor_id, queryType: query_type, window, cohortSize: cohort_size, maskedRows: masked_rows, traceId: trace_id, queriedAt: queried_at })
          }
          return { meta: { changes: 1 } }
        },
        async all<T>() {
          const [teamId] = args as [string, number]
          const results = rows
            .filter((r) => r.teamId === teamId)
            .sort((a, b) => b.queriedAt - a.queriedAt)
            .map((r) => ({
              id: r.id,
              team_id: r.teamId,
              actor_id: r.actorId,
              query_type: r.queryType,
              window: r.window,
              cohort_size: r.cohortSize,
              masked_rows: r.maskedRows,
              trace_id: r.traceId,
              queried_at: r.queriedAt,
            }))
          return { results: results as unknown as T[] }
        },
      }
    },
  }
  return { db: db as unknown as D1Database, rows }
}

describe('PULSE-AUDIT-01', () => {
  it('builds a normalised audit record', () => {
    const rec = buildPulseAuditRecord({
      teamId: 't1',
      actorId: 'u1',
      queryType: 'summary',
      window: '30d',
      cohortSize: 4.9,
      maskedRows: -1,
      now: 1000,
    })
    expect(rec.cohortSize).toBe(4)
    expect(rec.maskedRows).toBe(0)
    expect(rec.queriedAt).toBe(1000)
    expect(rec.traceId).toBeNull()
    expect(typeof rec.id).toBe('string')
  })

  it('records and exports audit rows newest-first', async () => {
    const { db } = fakeDb()
    await recordPulseQueryAudit(db, buildPulseAuditRecord({ teamId: 't1', actorId: 'u1', queryType: 'summary', window: '30d', cohortSize: 5, maskedRows: 1, now: 100 }))
    await recordPulseQueryAudit(db, buildPulseAuditRecord({ teamId: 't1', actorId: 'u2', queryType: 'trends', window: '90d', cohortSize: 3, maskedRows: 3, now: 200 }))
    await recordPulseQueryAudit(db, buildPulseAuditRecord({ teamId: 't2', actorId: 'u3', queryType: 'summary', window: '30d', cohortSize: 9, maskedRows: 0, now: 150 }))

    const t1 = await fetchPulseQueryAudit(db, 't1')
    expect(t1).toHaveLength(2)
    expect(t1[0].queriedAt).toBe(200)
    expect(t1[0].queryType).toBe('trends')
    expect(t1[1].queriedAt).toBe(100)

    const t2 = await fetchPulseQueryAudit(db, 't2')
    expect(t2).toHaveLength(1)
    expect(t2[0].actorId).toBe('u3')
  })
})
