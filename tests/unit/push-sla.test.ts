/**
 * Requirement: ADR-0034 (PWA offline/push) + ADR-0030 (SLOs) — push delivery SLA accounting.
 */
import { describe, expect, it } from 'vitest'
import { computePushSla } from '../../functions/api/lib/push-sla'

describe('push-sla', () => {
  it('marks healthy when delivery rate high', () => {
    const s = computePushSla({ delivered: 995, failed: 5, p99Ms: 800 })
    expect(s.status).toBe('healthy')
  })
})
