import { describe, it, expect } from 'vitest'
import { isPublicApiPath } from '../../functions/api/lib/public-api-paths'

describe('partner marketplace public paths', () => {
  it('allows marketplace listing without JWT', () => {
    expect(isPublicApiPath('/api/marketplace/apps')).toBe(true)
    expect(isPublicApiPath('/api/partner/sla')).toBe(true)
  })
})
