import { describe, expect, it } from 'vitest'
import {
  deriveAccountStatus,
  createPartnerAccount,
  getPartnerAccount,
  updatePartnerAccountState,
} from '../../functions/api/lib/marketplace-billing'
import { D1Mock } from '../helpers/d1-mock'

describe('marketplace-billing', () => {
  describe('deriveAccountStatus', () => {
    it('restricts on a Stripe disabled_reason', () => {
      expect(
        deriveAccountStatus({ requirements: { disabled_reason: 'requirements.past_due' } }),
      ).toBe('restricted')
    })

    it('verifies when charges and payouts are both enabled', () => {
      expect(deriveAccountStatus({ charges_enabled: true, payouts_enabled: true })).toBe('verified')
    })

    it('reports onboarding once details are submitted but not yet cleared', () => {
      expect(deriveAccountStatus({ details_submitted: true, charges_enabled: false })).toBe('onboarding')
    })

    it('defaults to pending for a fresh account', () => {
      expect(deriveAccountStatus({})).toBe('pending')
    })
  })

  describe('partner account repository', () => {
    it('creates, reads, and reconciles a partner account', async () => {
      const db = new D1Mock() as unknown as D1Database
      await createPartnerAccount(db, { teamId: 'team-1', stripeAccountId: 'acct_123' })
      const created = await getPartnerAccount(db, 'team-1')
      expect(created?.stripeAccountId).toBe('acct_123')
      expect(created?.status).toBe('onboarding')
      expect(created?.payoutsEnabled).toBe(false)

      await updatePartnerAccountState(db, {
        teamId: 'team-1',
        status: 'verified',
        chargesEnabled: true,
        payoutsEnabled: true,
        defaultPayoutCurrency: 'eur',
      })
      const verified = await getPartnerAccount(db, 'team-1')
      expect(verified?.status).toBe('verified')
      expect(verified?.payoutsEnabled).toBe(true)
      expect(verified?.defaultPayoutCurrency).toBe('eur')
    })
  })
})
