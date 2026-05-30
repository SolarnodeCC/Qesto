import { describe, expect, it } from 'vitest'
import { filterAuditRecords } from '../../functions/api/lib/audit-query'
import { computeWebhookSla } from '../../functions/api/lib/webhook-sla'

describe('forensics libs', () => {
  it('filters audit records', () => {
    const r = filterAuditRecords(
      [{ id: '1', action: 'login', actorId: 'u', teamId: 't', at: 100, meta: {} }],
      { limit: 10 },
    )
    expect(r).toHaveLength(1)
  })

  it('computes webhook sla', () => {
    expect(computeWebhookSla({ delivered: 9995, failed: 5 }).status).toBe('met')
  })
})
