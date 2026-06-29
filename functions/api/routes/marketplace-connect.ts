/**
 * MARKETPLACE-CONNECT-01 / PAYOUT-01 (E82, Sprint 82) — Stripe Connect account
 * linking + payout routing for marketplace partners.
 *
 * Mirrors the `routes/billing.ts` Stripe pattern (REST via fetch behind the
 * shared circuit breaker). Partner billing is keyed per team and gated on the
 * `billing:manage` team permission. When Stripe is not configured (dev/local)
 * the routes degrade to 503 `misconfigured` so the rest of the flow stays
 * exercisable without secrets.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import { authorizeTeamPermission } from '../lib/authz-helpers'
import { ok, fail } from '../lib/http'
import { writeEvent } from '../lib/observability'
import { makeStripeConnectClient } from '../lib/stripe-connect'
import {
  createPartnerAccount,
  getPartnerAccount,
  updatePartnerAccountState,
  deriveAccountStatus,
} from '../lib/marketplace-billing'
import { payoutIdempotencyKey } from '../lib/marketplace-payout'
import {
  computeOutstandingPayoutCents,
  findPayoutByIdempotencyKey,
  recordPayout,
  currentPayoutPeriod,
} from '../lib/marketplace-payout-ledger'
import { ulid } from '../lib/ulid'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

const LinkAccountSchema = z.object({
  teamId: z.string().min(1).max(128),
  country: z.string().length(2).optional(),
})

const PayoutSchema = z.object({
  teamId: z.string().min(1).max(128),
  amountCents: z.number().int().positive().max(100_000_00),
  currency: z.string().min(3).max(3),
})

export function mountMarketplaceConnectRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // POST /api/marketplace/connect/accounts — create/onboard a partner account.
  app.post('/accounts', async (c) => {
    const parsed = await validateBody(c, LinkAccountSchema)
    if ('error' in parsed) return parsed.error
    const { teamId, country } = parsed.data

    const authz = await authorizeTeamPermission(c, teamId, 'billing:manage', 'Billing management permission required')
    if (!authz.ok) return authz.res

    if (!c.env.STRIPE_SECRET_KEY) {
      return fail(c, 'misconfigured', 'Stripe Connect not configured', 503)
    }

    const stripe = makeStripeConnectClient(c.env.STRIPE_SECRET_KEY)

    // Reuse an existing connected account if onboarding was already started.
    const existing = await getPartnerAccount(c.env.DB, teamId)
    let accountId = existing?.stripeAccountId ?? null
    if (!accountId) {
      const account = await stripe.createAccount({
        ...(country ? { country } : {}),
        ...(c.get('user').email ? { email: c.get('user').email } : {}),
      })
      accountId = account.id
    }

    await createPartnerAccount(c.env.DB, { teamId, stripeAccountId: accountId })

    const link = await stripe.createAccountLink({
      account: accountId,
      refreshUrl: `${c.env.PAGES_URL}/settings/marketplace?connect=refresh`,
      returnUrl: `${c.env.PAGES_URL}/settings/marketplace?connect=return`,
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'partner.account_created',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      traceId: c.get('trace_id'),
    })

    return ok(c, { teamId, stripeAccountId: accountId, onboardingUrl: link.url, status: 'onboarding' })
  })

  // GET /api/marketplace/connect/accounts/:teamId — verification-polling read.
  app.get('/accounts/:teamId', async (c) => {
    const teamId = c.req.param('teamId')
    const authz = await authorizeTeamPermission(c, teamId, 'billing:manage', 'Billing management permission required')
    if (!authz.ok) return authz.res

    const account = await getPartnerAccount(c.env.DB, teamId)
    if (!account) {
      return ok(c, { teamId, status: 'none', chargesEnabled: false, payoutsEnabled: false })
    }

    // Reconcile against Stripe when configured (best-effort; falls back to cache).
    if (c.env.STRIPE_SECRET_KEY && account.stripeAccountId) {
      try {
        const stripe = makeStripeConnectClient(c.env.STRIPE_SECRET_KEY)
        const remote = await stripe.retrieveAccount(account.stripeAccountId)
        const status = deriveAccountStatus(remote)
        await updatePartnerAccountState(c.env.DB, {
          teamId,
          status,
          chargesEnabled: Boolean(remote.charges_enabled),
          payoutsEnabled: Boolean(remote.payouts_enabled),
          defaultPayoutCurrency: remote.default_currency ?? null,
        })
        return ok(c, {
          teamId,
          stripeAccountId: account.stripeAccountId,
          status,
          chargesEnabled: Boolean(remote.charges_enabled),
          payoutsEnabled: Boolean(remote.payouts_enabled),
          defaultPayoutCurrency: remote.default_currency ?? null,
        })
      } catch {
        // Fall through to the cached snapshot.
      }
    }

    return ok(c, {
      teamId,
      stripeAccountId: account.stripeAccountId,
      status: account.status,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      defaultPayoutCurrency: account.defaultPayoutCurrency,
    })
  })

  // POST /api/marketplace/connect/payouts — route a payout to a partner. NOTE: this
  // issues a REAL Stripe transfer whenever STRIPE_SECRET_KEY is set. The amount is
  // capped server-side at the partner's verified outstanding balance and guarded by
  // an idempotency key (#588) — the request body amount is validated, never trusted.
  app.post('/payouts', async (c) => {
    const parsed = await validateBody(c, PayoutSchema)
    if ('error' in parsed) return parsed.error
    const { teamId, amountCents, currency } = parsed.data

    const authz = await authorizeTeamPermission(c, teamId, 'billing:manage', 'Billing management permission required')
    if (!authz.ok) return authz.res

    const account = await getPartnerAccount(c.env.DB, teamId)
    if (!account?.stripeAccountId) {
      return fail(c, 'no_account', 'Partner has no connected Stripe account', 400)
    }
    if (!account.payoutsEnabled) {
      return fail(c, 'payouts_disabled', 'Partner account is not cleared for payouts yet', 409)
    }
    if (!c.env.STRIPE_SECRET_KEY) {
      return fail(c, 'misconfigured', 'Stripe Connect not configured', 503)
    }

    // #588: NEVER trust the client-supplied amount. Cap the payout at the balance
    // the partner has actually earned (net of platform share), minus payouts
    // already committed. Reject anything above the verified outstanding balance.
    const outstandingCents = await computeOutstandingPayoutCents(c.env.DB, teamId)
    if (amountCents > outstandingCents) {
      return fail(
        c,
        'amount_exceeds_balance',
        `Requested ${amountCents} exceeds the outstanding payable balance of ${outstandingCents} cents`,
        409,
      )
    }

    // #588: stable idempotency key (team + period + amount). A prior committed
    // payout with this key short-circuits — retries/replays cannot double-pay.
    const period = currentPayoutPeriod()
    const idemKey = payoutIdempotencyKey(teamId, amountCents, period)
    const existing = await findPayoutByIdempotencyKey(c.env.DB, idemKey)
    if (existing && existing.status !== 'failed') {
      return ok(c, {
        teamId,
        transferId: existing.stripe_transfer_id,
        amountCents: existing.amount_cents,
        currency: existing.currency,
        idempotent: true,
      })
    }

    const stripe = makeStripeConnectClient(c.env.STRIPE_SECRET_KEY)
    const transfer = await stripe.createTransfer({
      amountCents,
      currency: currency.toLowerCase(),
      destination: account.stripeAccountId,
      idempotencyKey: idemKey,
    })

    // Record the payout in the ledger so subsequent balance checks subtract it.
    await recordPayout(c.env.DB, {
      id: ulid(),
      team_id: teamId,
      idempotency_key: idemKey,
      amount_cents: amountCents,
      currency: currency.toLowerCase(),
      stripe_account_id: account.stripeAccountId,
      stripe_transfer_id: transfer.id,
      status: 'initiated',
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'partner.payout_initiated',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      value: amountCents / 100,
      traceId: c.get('trace_id'),
    })

    return ok(c, { teamId, transferId: transfer.id, amountCents, currency: currency.toLowerCase() })
  })

  parent.route('/api/marketplace/connect', app)
}
