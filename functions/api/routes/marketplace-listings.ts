/**
 * MARKETPLACE-PAID-LISTING-01 — paid listing CRUD (Sprint 83).
 * Extends marketplace-connect with template/plugin listings + purchases.
 */
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { hasTeamPermission } from '../lib/authz'
import { ok, fail } from '../lib/http'
import { writeEvent } from '../lib/observability'
import { ulid } from '../lib/ulid'
import {
  createMarketplaceListing,
  getMarketplaceListing,
  hasMarketplaceEntitlement,
  listLivePublicListings,
  listPartnerListings,
  priceCentsForTier,
  recordMarketplacePurchase,
  updateMarketplaceListing,
  LISTING_KINDS,
  MARKETPLACE_PRICE_TIERS,
} from '../lib/marketplace-listings'
import { splitMarketplacePayout } from '../lib/marketplace-payout'
import type { Team } from './teams'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

const CreateListingSchema = z.object({
  teamId: z.string().min(1).max(128),
  kind: z.enum(LISTING_KINDS),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priceTier: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  currency: z.string().length(3).optional(),
  visibility: z.enum(['private', 'team', 'public']).optional(),
})

const PatchListingSchema = z.object({
  teamId: z.string().min(1).max(128),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priceTier: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  status: z.enum(['draft', 'review', 'live', 'suspended']).optional(),
  visibility: z.enum(['private', 'team', 'public']).optional(),
})

const PurchaseSchema = z.object({
  buyerTeamId: z.string().min(1).max(128),
})

async function authorizeBillingManager(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  teamId: string,
): Promise<{ ok: true; team: Team } | { ok: false; res: Response }> {
  const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
  if (!team) return { ok: false, res: fail(c, 'not_found', 'Team not found', 404) }
  const allowed = await hasTeamPermission(c.env.DB, team, c.get('user').sub, 'billing:manage')
  if (!allowed) return { ok: false, res: fail(c, 'forbidden', 'Billing management permission required', 403) }
  return { ok: true, team }
}

export function mountMarketplaceListingRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/price-tiers', (c) =>
    ok(c, { tiers: MARKETPLACE_PRICE_TIERS }),
  )

  app.get('/listings', async (c) => {
    const teamId = c.req.query('teamId')
    if (teamId) {
      const authz = await authorizeBillingManager(c, teamId)
      if (!authz.ok) return authz.res
      const listings = await listPartnerListings(c.env.DB, teamId)
      return ok(c, { listings })
    }
    const listings = await listLivePublicListings(c.env.DB)
    return ok(c, { listings })
  })

  app.post('/listings', async (c) => {
    const parsed = await validateBody(c, CreateListingSchema)
    if ('error' in parsed) return parsed.error
    const { teamId, kind, title, description, priceTier, priceCents, currency, visibility } = parsed.data

    const authz = await authorizeBillingManager(c, teamId)
    if (!authz.ok) return authz.res

    const cents = priceCents ?? (priceTier ? priceCentsForTier(priceTier) : 0)
    const listingId = ulid()
    const vis = visibility ?? 'private'
    const status = vis === 'public' ? 'review' : 'draft'

    await createMarketplaceListing(c.env.DB, {
      id: listingId,
      partner_team_id: teamId,
      kind,
      title,
      description: description ?? null,
      price_cents: cents,
      currency: (currency ?? 'eur').toLowerCase(),
      revenue_share_bps: 7000,
      status,
      visibility: vis,
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'partner.marketplace_viewed',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      detail: 'listing_created',
      traceId: c.get('trace_id'),
    })

    const listing = await getMarketplaceListing(c.env.DB, listingId, teamId)
    return ok(c, { listing }, 201)
  })

  app.patch('/listings/:listingId', async (c) => {
    const parsed = await validateBody(c, PatchListingSchema)
    if ('error' in parsed) return parsed.error
    const listingId = c.req.param('listingId')
    const authz = await authorizeBillingManager(c, parsed.data.teamId)
    if (!authz.ok) return authz.res

    const price_cents =
      parsed.data.priceCents ??
      (parsed.data.priceTier ? priceCentsForTier(parsed.data.priceTier) : undefined)

    const updated = await updateMarketplaceListing(c.env.DB, listingId, parsed.data.teamId, {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(price_cents !== undefined ? { price_cents } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
      ...(parsed.data.status === 'live' ? { published_at: Date.now() } : {}),
    })
    if (!updated) return fail(c, 'not_found', 'Listing not found', 404)

    const listing = await getMarketplaceListing(c.env.DB, listingId, parsed.data.teamId)
    return ok(c, { listing })
  })

  app.get('/listings/:listingId', async (c) => {
    const listingId = c.req.param('listingId')
    const teamId = c.req.query('teamId')
    const listing = await getMarketplaceListing(c.env.DB, listingId, teamId ?? undefined)
    if (!listing) return fail(c, 'not_found', 'Listing not found', 404)
    if (listing.visibility === 'private' && teamId) {
      const authz = await authorizeBillingManager(c, teamId)
      if (!authz.ok) return authz.res
    }
    return ok(c, { listing })
  })

  app.post('/listings/:listingId/purchase', async (c) => {
    const parsed = await validateBody(c, PurchaseSchema)
    if ('error' in parsed) return parsed.error
    const listingId = c.req.param('listingId')
    const listing = await getMarketplaceListing(c.env.DB, listingId)
    if (!listing || listing.status !== 'live') {
      return fail(c, 'not_available', 'Listing is not available for purchase', 404)
    }

    const entitled = await hasMarketplaceEntitlement(c.env.DB, parsed.data.buyerTeamId, listingId)
    if (entitled) {
      return ok(c, { purchaseId: null, entitled: true, duplicate: true })
    }

    const split = splitMarketplacePayout(listing.priceCents, listing.revenueShareBps)
    const purchaseId = ulid()
    await recordMarketplacePurchase(c.env.DB, {
      id: purchaseId,
      buyerTeamId: parsed.data.buyerTeamId,
      listingId,
      amountCents: listing.priceCents,
      currency: listing.currency,
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'partner.payout_initiated',
      userId: c.get('user').sub,
      teamId: listing.partnerTeamId,
      plan: c.get('plan'),
      value: split.netCents / 100,
      detail: purchaseId,
      traceId: c.get('trace_id'),
    })

    return ok(c, { purchaseId, entitled: true, split })
  })

  parent.route('/api/marketplace', app)
}
