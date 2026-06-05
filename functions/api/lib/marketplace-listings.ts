/**
 * MARKETPLACE-PAID-LISTING-01 — paid listing repository (Sprint 83).
 */
import type { D1Database } from '@cloudflare/workers-types'

export const LISTING_KINDS = ['plugin', 'template', 'agent'] as const
export type ListingKind = (typeof LISTING_KINDS)[number]

export const LISTING_STATUSES = ['draft', 'review', 'live', 'suspended'] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const LISTING_VISIBILITIES = ['private', 'team', 'public'] as const
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number]

export const MARKETPLACE_PRICE_TIERS = [
  { id: 'free', label: 'Free', priceCents: 0 },
  { id: 'starter', label: 'Starter', priceCents: 999 },
  { id: 'pro', label: 'Pro', priceCents: 2999 },
  { id: 'enterprise', label: 'Enterprise', priceCents: 9999 },
] as const

export type MarketplaceListingRow = {
  id: string
  partner_team_id: string
  kind: ListingKind
  title: string
  description: string | null
  price_cents: number
  currency: string
  revenue_share_bps: number
  status: ListingStatus
  visibility: ListingVisibility
  created_at: number
  updated_at: number
  published_at: number | null
}

export type MarketplaceListing = {
  id: string
  partnerTeamId: string
  kind: ListingKind
  title: string
  description: string | null
  priceCents: number
  currency: string
  revenueShareBps: number
  status: ListingStatus
  visibility: ListingVisibility
  createdAt: number
  updatedAt: number
  publishedAt: number | null
}

function rowToListing(row: MarketplaceListingRow): MarketplaceListing {
  return {
    id: row.id,
    partnerTeamId: row.partner_team_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    revenueShareBps: row.revenue_share_bps,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

export function priceCentsForTier(tierId: string): number {
  const tier = MARKETPLACE_PRICE_TIERS.find((t) => t.id === tierId)
  return tier?.priceCents ?? 0
}

export async function createMarketplaceListing(
  db: D1Database,
  row: Omit<MarketplaceListingRow, 'created_at' | 'updated_at' | 'published_at'> & {
    published_at?: number | null
  },
): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO marketplace_listings
         (id, partner_team_id, kind, title, description, price_cents, currency,
          revenue_share_bps, status, visibility, created_at, updated_at, published_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?12)`,
    )
    .bind(
      row.id,
      row.partner_team_id,
      row.kind,
      row.title,
      row.description ?? null,
      row.price_cents,
      row.currency,
      row.revenue_share_bps,
      row.status,
      row.visibility,
      now,
      row.published_at ?? null,
    )
    .run()
}

export async function updateMarketplaceListing(
  db: D1Database,
  listingId: string,
  partnerTeamId: string,
  patch: Partial<{
    title: string
    description: string | null
    price_cents: number
    status: ListingStatus
    visibility: ListingVisibility
    published_at: number | null
  }>,
): Promise<boolean> {
  const existing = await getMarketplaceListing(db, listingId, partnerTeamId)
  if (!existing) return false
  const now = Date.now()
  await db
    .prepare(
      `UPDATE marketplace_listings
          SET title = ?3,
              description = ?4,
              price_cents = ?5,
              status = ?6,
              visibility = ?7,
              published_at = ?8,
              updated_at = ?9
        WHERE id = ?1 AND partner_team_id = ?2`,
    )
    .bind(
      listingId,
      partnerTeamId,
      patch.title ?? existing.title,
      patch.description !== undefined ? patch.description : existing.description,
      patch.price_cents ?? existing.priceCents,
      patch.status ?? existing.status,
      patch.visibility ?? existing.visibility,
      patch.published_at !== undefined ? patch.published_at : existing.publishedAt,
      now,
    )
    .run()
  return true
}

export async function getMarketplaceListing(
  db: D1Database,
  listingId: string,
  partnerTeamId?: string,
): Promise<MarketplaceListing | null> {
  const row = partnerTeamId
    ? await db
        .prepare(
          `SELECT id, partner_team_id, kind, title, description, price_cents, currency,
                  revenue_share_bps, status, visibility, created_at, updated_at, published_at
             FROM marketplace_listings
            WHERE id = ?1 AND partner_team_id = ?2`,
        )
        .bind(listingId, partnerTeamId)
        .first<MarketplaceListingRow>()
    : await db
        .prepare(
          `SELECT id, partner_team_id, kind, title, description, price_cents, currency,
                  revenue_share_bps, status, visibility, created_at, updated_at, published_at
             FROM marketplace_listings WHERE id = ?1`,
        )
        .bind(listingId)
        .first<MarketplaceListingRow>()
  return row ? rowToListing(row) : null
}

export async function listPartnerListings(
  db: D1Database,
  partnerTeamId: string,
): Promise<MarketplaceListing[]> {
  const result = await db
    .prepare(
      `SELECT id, partner_team_id, kind, title, description, price_cents, currency,
              revenue_share_bps, status, visibility, created_at, updated_at, published_at
         FROM marketplace_listings
        WHERE partner_team_id = ?1
        ORDER BY updated_at DESC`,
    )
    .bind(partnerTeamId)
    .all<MarketplaceListingRow>()
  return (result.results ?? []).map(rowToListing)
}

export async function listLivePublicListings(db: D1Database): Promise<MarketplaceListing[]> {
  const result = await db
    .prepare(
      `SELECT id, partner_team_id, kind, title, description, price_cents, currency,
              revenue_share_bps, status, visibility, created_at, updated_at, published_at
         FROM marketplace_listings
        WHERE status = 'live' AND visibility = 'public'
        ORDER BY published_at DESC`,
    )
    .all<MarketplaceListingRow>()
  return (result.results ?? []).map(rowToListing)
}

export async function recordMarketplacePurchase(
  db: D1Database,
  params: {
    id: string
    buyerTeamId: string
    listingId: string
    amountCents: number
    currency: string
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO marketplace_purchases
         (id, buyer_team_id, listing_id, amount_cents, currency, purchased_at, refunded_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)`,
    )
    .bind(params.id, params.buyerTeamId, params.listingId, params.amountCents, params.currency, Date.now())
    .run()
}

export async function hasMarketplaceEntitlement(
  db: D1Database,
  buyerTeamId: string,
  listingId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM marketplace_purchases
        WHERE buyer_team_id = ?1 AND listing_id = ?2 AND refunded_at IS NULL`,
    )
    .bind(buyerTeamId, listingId)
    .first<{ id: string }>()
  return Boolean(row)
}
