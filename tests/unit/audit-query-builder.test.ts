import { describe, expect, it } from 'vitest'
import { buildAuditEventWhereClause } from '../../functions/api/lib/audit'

describe('buildAuditEventWhereClause (CR-04)', () => {
  it('returns empty fragment and bindValues when no filters', () => {
    const r = buildAuditEventWhereClause({})
    expect(r.whereSql).toBe('')
    expect(r.bindValues).toEqual([])
    expect(r.nextPlaceholderIndex).toBe(1)
  })

  it('assigns sequential ?n placeholders matching bind order', () => {
    const r = buildAuditEventWhereClause({
      actor_id: 'user_x',
      action: 'session.create',
      subject_type: 'session',
      since_ts: 1000,
      until_ts: 2000,
    })
    expect(r.whereSql).toBe(
      'WHERE actor_id = ?1 AND action = ?2 AND subject_type = ?3 AND ts >= ?4 AND ts <= ?5',
    )
    expect(r.bindValues).toEqual(['user_x', 'session.create', 'session', 1000, 2000])
    expect(r.nextPlaceholderIndex).toBe(6)
  })

  it('includes ts >= 0 when since_ts is zero', () => {
    const r = buildAuditEventWhereClause({ since_ts: 0 })
    expect(r.whereSql).toBe('WHERE ts >= ?1')
    expect(r.bindValues).toEqual([0])
    expect(r.nextPlaceholderIndex).toBe(2)
  })

  it('skips empty-string equality filters', () => {
    const r = buildAuditEventWhereClause({ actor_id: '', action: 'auth.login' })
    expect(r.whereSql).toBe('WHERE action = ?1')
    expect(r.bindValues).toEqual(['auth.login'])
  })
})
