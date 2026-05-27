import { describe, expect, it } from 'vitest'
import { assertResidencyAllowsMutation } from '../../functions/api/lib/residency-enforce'

describe('residency-enforce', () => {
  it('allows when no pin', async () => {
    const msg = await assertResidencyAllowsMutation({ TEAMS_KV: undefined } as never, null, 'us')
    expect(msg).toBeNull()
  })
})
