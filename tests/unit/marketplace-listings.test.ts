import { describe, expect, it } from 'vitest'
import {
  createMarketplaceListing,
  getMarketplaceListing,
  hasMarketplaceEntitlement,
  listPartnerListings,
  priceCentsForTier,
  recordMarketplacePurchase,
} from '../../functions/api/lib/marketplace-listings'
import { D1Mock } from '../helpers/d1-mock'

describe('marketplace-listings (MARKETPLACE-PAID-LISTING-01)', () => {
  it('maps price tiers to cents', () => {
    expect(priceCentsForTier('pro')).toBe(2999)
    expect(priceCentsForTier('free')).toBe(0)
  })

  it('creates and lists partner listings', async () => {
    const db = new D1Mock() as unknown as D1Database
    await createMarketplaceListing(db, {
      id: 'lst-1',
      partner_team_id: 'team-partner',
      kind: 'template',
      title: 'Retro pack',
      description: 'Weekly retro template',
      price_cents: 999,
      currency: 'eur',
      revenue_share_bps: 7000,
      status: 'draft',
      visibility: 'private',
    })
    const listings = await listPartnerListings(db, 'team-partner')
    expect(listings).toHaveLength(1)
    expect(listings[0].title).toBe('Retro pack')
  })

  it('records purchase entitlement', async () => {
    const db = new D1Mock() as unknown as D1Database
    await createMarketplaceListing(db, {
      id: 'lst-2',
      partner_team_id: 'team-partner',
      kind: 'plugin',
      title: 'Plugin',
      description: null,
      price_cents: 0,
      currency: 'eur',
      revenue_share_bps: 7000,
      status: 'live',
      visibility: 'public',
      published_at: Date.now(),
    })
    await recordMarketplacePurchase(db, {
      id: 'pur-1',
      buyerTeamId: 'team-buyer',
      listingId: 'lst-2',
      amountCents: 0,
      currency: 'eur',
    })
    expect(await hasMarketplaceEntitlement(db, 'team-buyer', 'lst-2')).toBe(true)
    expect(await getMarketplaceListing(db, 'lst-2')).not.toBeNull()
  })
})
