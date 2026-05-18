import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBillingPortalSession } from '../../src/lib/account-billing'

vi.mock('../../src/api/client', () => ({
  api: vi.fn(),
}))

import { api } from '../../src/api/client'

describe('createBillingPortalSession', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset()
  })

  it('returns portal URL on success', async () => {
    vi.mocked(api).mockResolvedValue({
      ok: true,
      data: { url: 'https://billing.stripe.com/session/test' },
    })

    const result = await createBillingPortalSession()
    expect(result).toEqual({ ok: true, url: 'https://billing.stripe.com/session/test' })
    expect(api).toHaveBeenCalledWith('/api/billing/portal', { method: 'POST' })
  })

  it('returns error message when API fails', async () => {
    vi.mocked(api).mockResolvedValue({
      ok: false,
      status: 400,
      error: { code: 'no_subscription', message: 'No Stripe subscription found' },
    })

    const result = await createBillingPortalSession()
    expect(result).toEqual({ ok: false, message: 'No Stripe subscription found' })
  })
})
