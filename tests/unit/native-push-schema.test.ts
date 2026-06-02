import { describe, expect, it } from 'vitest'
import { RegisterDeviceTokenSchema } from '../../functions/api/lib/native-push'

describe('native-push schema', () => {
  it('accepts ios/android tokens', () => {
    const parsed = RegisterDeviceTokenSchema.parse({
      platform: 'android',
      token: 'a'.repeat(32),
      appVersion: '5.1.0-beta',
    })
    expect(parsed.platform).toBe('android')
  })

  it('rejects short tokens', () => {
    expect(() =>
      RegisterDeviceTokenSchema.parse({ platform: 'ios', token: 'short' }),
    ).toThrow()
  })
})
