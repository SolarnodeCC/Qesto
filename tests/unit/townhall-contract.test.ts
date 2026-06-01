import { describe, expect, it } from 'vitest'
import { parseClientMessage } from '../../functions/api/lib/protocol-schemas'
import { PLAN_QUOTAS } from '../../functions/api/types'
import { featureAllowed, denyFeature } from '../../functions/api/lib/entitlements'
import { TOWNHALL_FEATURE, townhallEnabled } from '../../functions/api/realtime'

// TOWNHALL-02 contract layer (ADR-0044): entitlement gating, feature flag, and the
// additive WebSocket message family. Board behaviour itself lands in TOWNHALL-03+.

describe('townhall entitlement', () => {
  it('is Team-tier only', () => {
    expect(featureAllowed(PLAN_QUOTAS.team, 'townhallQA')).toBe(true)
    expect(featureAllowed(PLAN_QUOTAS.starter, 'townhallQA')).toBe(false)
    expect(featureAllowed(PLAN_QUOTAS.free, 'townhallQA')).toBe(false)
  })

  it('denyFeature produces the standard upgrade envelope', () => {
    const denial = denyFeature('free', 'townhallQA')
    expect(denial.code).toBe('feature_not_available')
    expect(denial.details.feature).toBe('townhallQA')
    expect(denial.details.upgrade_url).toBe('/billing/upgrade')
  })
})

describe('townhall feature flag', () => {
  it('advertises the townhall_board capability string', () => {
    expect(TOWNHALL_FEATURE).toBe('townhall_board')
  })

  it('is gated by REALTIME_TOWNHALL_ENABLED', () => {
    expect(townhallEnabled({ REALTIME_TOWNHALL_ENABLED: 'true' })).toBe(true)
    expect(townhallEnabled({ REALTIME_TOWNHALL_ENABLED: 'false' })).toBe(false)
    expect(townhallEnabled({})).toBe(false)
  })
})

describe('townhall client message validation', () => {
  const stamp = (m: object) => JSON.stringify({ v: 1, timestamp: Date.now(), ...m })

  it('accepts a well-formed submit', () => {
    const parsed = parseClientMessage(stamp({ type: 'townhall_submit', data: { body: 'How will this affect Q3?' } }))
    expect(parsed?.type).toBe('townhall_submit')
  })

  it('accepts an optional display name', () => {
    const parsed = parseClientMessage(
      stamp({ type: 'townhall_submit', data: { body: 'Anonymous-by-default?', displayName: 'Sam' } }),
    )
    expect(parsed?.type).toBe('townhall_submit')
  })

  it('rejects a too-short body', () => {
    expect(parseClientMessage(stamp({ type: 'townhall_submit', data: { body: 'hi' } }))).toBeNull()
  })

  it('rejects a body over 500 chars', () => {
    const body = 'x'.repeat(501)
    expect(parseClientMessage(stamp({ type: 'townhall_submit', data: { body } }))).toBeNull()
  })

  it('accepts an upvote', () => {
    const parsed = parseClientMessage(stamp({ type: 'townhall_upvote', data: { itemId: 'item-1' } }))
    expect(parsed?.type).toBe('townhall_upvote')
  })

  it('accepts moderate actions', () => {
    for (const action of ['approve', 'dismiss', 'answer', 'spotlight', 'clear_spotlight', 'ungroup'] as const) {
      const parsed = parseClientMessage(stamp({ type: 'townhall_moderate', data: { itemId: 'i1', action } }))
      expect(parsed?.type).toBe('townhall_moderate')
    }
  })

  it('requires groupParentId for the group action', () => {
    expect(parseClientMessage(stamp({ type: 'townhall_moderate', data: { itemId: 'i1', action: 'group' } }))).toBeNull()
    const ok = parseClientMessage(
      stamp({ type: 'townhall_moderate', data: { itemId: 'i1', action: 'group', groupParentId: 'i2' } }),
    )
    expect(ok?.type).toBe('townhall_moderate')
  })

  it('rejects an unknown moderate action', () => {
    expect(parseClientMessage(stamp({ type: 'townhall_moderate', data: { itemId: 'i1', action: 'nuke' } }))).toBeNull()
  })
})
