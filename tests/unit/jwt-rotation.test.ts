import { describe, expect, it } from 'vitest'
import { jwtVerificationSecrets, signJwt, verifyJwtWithSecrets } from '../../functions/api/lib/jwt'

describe('JWT rotation', () => {
  it('accepts token signed with previous secret during rotation', async () => {
    const prev = 'prev-secret-at-least-32-chars-long!!'
    const current = 'current-secret-at-least-32-chars-long!'
    const token = await signJwt({ sub: 'u1', email: 'a@b.co' }, prev, 3600)
    const secrets = jwtVerificationSecrets({ JWT_SECRET: current, JWT_SECRET_PREV: prev })
    const claims = await verifyJwtWithSecrets(token, secrets)
    expect(claims?.sub).toBe('u1')
  })

  it('rejects when neither secret matches', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.co' }, 'only-one-secret-32-chars-minimum!!', 3600)
    const claims = await verifyJwtWithSecrets(token, ['wrong-secret-32-chars-minimum!!!'])
    expect(claims).toBeNull()
  })
})
