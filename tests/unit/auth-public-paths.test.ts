import { describe, it, expect } from 'vitest'
import { isPublicApiPath } from '../../functions/api/lib/public-api-paths'

describe('ARCH-HONO-02 public API paths', () => {
  it('marks marketplace and SLA as public', () => {
    expect(isPublicApiPath('/api/marketplace/apps')).toBe(true)
    expect(isPublicApiPath('/api/partner/sla')).toBe(true)
  })

  it('marks v2 realtime as public', () => {
    expect(isPublicApiPath('/api/v2/sessions/s1/realtime')).toBe(true)
  })

  it('requires auth for dashboard API', () => {
    expect(isPublicApiPath('/api/sessions')).toBe(false)
  })
})
