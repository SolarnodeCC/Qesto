import { describe, expect, it } from 'vitest'
import {
  probeInsightsQueueBinding,
  probeIntegrationFlag,
  probeSessionRoomBinding,
  summarizePlatformBindings,
} from '../../functions/api/lib/platform-bindings'
import type { Env } from '../../functions/api/types'

describe('platform-bindings', () => {
  it('detects missing SESSION_ROOM', () => {
    const probe = probeSessionRoomBinding({} as Env)
    expect(probe.bound).toBe(false)
    expect(probe.required).toBe(true)
  })

  it('detects present SESSION_ROOM', () => {
    const probe = probeSessionRoomBinding({
      SESSION_ROOM: { idFromName: () => ({}) } as unknown as Env['SESSION_ROOM'],
    })
    expect(probe.bound).toBe(true)
  })

  it('detects missing INSIGHTS_QUEUE', () => {
    const probe = probeInsightsQueueBinding({} as Pick<Env, 'INSIGHTS_QUEUE'>)
    expect(probe.bound).toBe(false)
    expect(probe.required).toBe(true)
  })

  it('detects present INSIGHTS_QUEUE', () => {
    const queue = { send: async () => undefined } as unknown as NonNullable<Env['INSIGHTS_QUEUE']>
    const probe = probeInsightsQueueBinding({ INSIGHTS_QUEUE: queue })
    expect(probe.bound).toBe(true)
  })

  it('INTEGRATION_ENABLED raw "1" is not effective', () => {
    const probe = probeIntegrationFlag({ INTEGRATION_ENABLED: '1' })
    expect(probe.bound).toBe(false)
    expect(probe.detail).toContain('effective=false')
  })

  it('INTEGRATION_ENABLED raw "true" is effective', () => {
    const probe = probeIntegrationFlag({ INTEGRATION_ENABLED: 'true' })
    expect(probe.bound).toBe(true)
  })

  it('summarize marks degraded when required bindings missing', () => {
    const report = summarizePlatformBindings({ INTEGRATION_ENABLED: 'true' } as Env)
    expect(report.degraded).toBe(true)
    expect(report.missingRequired).toContain('SESSION_ROOM')
    expect(report.missingRequired).toContain('INSIGHTS_QUEUE')
    expect(report.ok).toBe(false)
  })

  it('summarize ok when required bindings present', () => {
    const report = summarizePlatformBindings({
      SESSION_ROOM: { idFromName: () => ({}) } as unknown as Env['SESSION_ROOM'],
      INSIGHTS_QUEUE: { send: async () => undefined } as unknown as NonNullable<Env['INSIGHTS_QUEUE']>,
      INTEGRATION_ENABLED: 'true',
    } as Env)
    expect(report.degraded).toBe(false)
    expect(report.ok).toBe(true)
  })
})
