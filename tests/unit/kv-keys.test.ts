import { describe, expect, it } from 'vitest'
import {
  cachePlanUsageKey,
  quotaSessionsKey,
  teamDocumentKey,
  userPrefsKey,
} from '../../functions/api/lib/kv-keys'

describe('kv-keys', () => {
  it('builds stable quota and prefs keys', () => {
    expect(userPrefsKey('u1')).toBe('prefs:u1')
    expect(quotaSessionsKey('u1', '2026-05')).toBe('quota:sessions:u1:2026-05')
    expect(teamDocumentKey('tm_1')).toBe('team:tm_1')
    expect(cachePlanUsageKey('u1')).toBe('cache:plan:u1')
  })
})
