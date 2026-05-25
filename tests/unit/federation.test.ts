import { describe, expect, it } from 'vitest'
import { FederationLinkSchema } from '../../functions/api/lib/federation'

describe('federation', () => {
  it('parses a valid link', () => {
    const link = FederationLinkSchema.parse({
      id: '01',
      sourceTeamId: 't1',
      targetTeamId: 't2',
      scopes: ['read_sessions'],
      status: 'pending',
      createdAt: Date.now(),
      createdBy: 'u1',
    })
    expect(link.status).toBe('pending')
  })
})
