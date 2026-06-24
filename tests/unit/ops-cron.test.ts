import { describe, it, expect } from 'vitest'
import { CRON_REGISTRY, isCronMissed, nextRunAfter, MISSED_RUN_GRACE_MS } from '../../functions/api/lib/ops-cron'

const DAY = 24 * 60 * 60 * 1000

describe('isCronMissed', () => {
  const now = 1_000_000_000_000

  it('is not missed when the last run is within interval + grace', () => {
    expect(isCronMissed(now - DAY + 1000, DAY, now)).toBe(false)
  })

  it('is missed once interval + grace has elapsed', () => {
    expect(isCronMissed(now - DAY - MISSED_RUN_GRACE_MS - 1, DAY, now)).toBe(true)
  })

  it('respects the grace window edge (AC: alert ~1 min after due)', () => {
    // Exactly at interval + grace → not yet missed; one ms past → missed.
    expect(isCronMissed(now - (DAY + MISSED_RUN_GRACE_MS), DAY, now)).toBe(false)
    expect(isCronMissed(now - (DAY + MISSED_RUN_GRACE_MS) - 1, DAY, now)).toBe(true)
  })

  it('treats a never-run job as missed', () => {
    expect(isCronMissed(null, DAY, now)).toBe(true)
  })
})

describe('nextRunAfter', () => {
  it('adds the interval to the last run', () => {
    expect(nextRunAfter(1000, DAY, 5000)).toBe(1000 + DAY)
  })
  it('returns now when never run', () => {
    expect(nextRunAfter(null, DAY, 5000)).toBe(5000)
  })
})

describe('CRON_REGISTRY', () => {
  it('has unique keys and positive intervals', () => {
    const keys = CRON_REGISTRY.map((j) => j.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const j of CRON_REGISTRY) expect(j.intervalMs).toBeGreaterThan(0)
  })
  it('includes the LinkedIn automation job called out in the brief', () => {
    expect(CRON_REGISTRY.some((j) => j.key === 'linkedin-automation')).toBe(true)
  })
})
