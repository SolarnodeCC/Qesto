/**
 * Minimal Stripe Connect client (E82, MARKETPLACE-CONNECT-01 / PAYOUT-01, Sprint 82).
 *
 * The Stripe npm SDK is too heavy for the edge runtime budget, so — mirroring
 * `routes/billing.ts:makeStripeClient` — we call the REST API directly with
 * fetch, wrapped in the shared Stripe circuit breaker. Only the Connect methods
 * we use are implemented. Secrets are passed in by the caller (never logged).
 */
import { CircuitBreakers } from './resilience/circuit-breaker'

export type StripeConnectAccount = {
  id: string
  charges_enabled?: boolean
  payouts_enabled?: boolean
  details_submitted?: boolean
  default_currency?: string | null
  requirements?: { disabled_reason?: string | null } | null
}

export type StripeAccountLink = { url: string; expires_at: number }
export type StripeTransfer = { id: string; amount: number; currency: string; destination: string }

function makeForm(body: Record<string, string>): string {
  return new URLSearchParams(body).toString()
}

export function makeStripeConnectClient(secretKey: string) {
  async function call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<T> {
    return CircuitBreakers.stripe.execute(
      async (signal) => {
        const init: RequestInit = {
          method,
          headers: {
            Authorization: `Bearer ${secretKey}`,
            ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
            // Stripe deduplicates POSTs carrying the same Idempotency-Key, so a
            // retried/replayed transfer cannot move funds twice (#588).
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          },
          signal,
        }
        if (body) init.body = makeForm(body)
        const res = await fetch(`https://api.stripe.com/v1${path}`, init)
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: { message: 'Stripe error' } }))) as {
            error?: { message?: string }
          }
          throw new Error(err?.error?.message ?? 'Stripe API error')
        }
        return res.json() as Promise<T>
      },
      () => {
        throw new Error('Stripe circuit open')
      },
    )
  }

  return {
    /** Create an Express connected account for a partner. */
    createAccount: (params: { email?: string; country?: string }) =>
      call<StripeConnectAccount>('POST', '/accounts', {
        type: 'express',
        ...(params.country ? { country: params.country } : {}),
        ...(params.email ? { email: params.email } : {}),
        'capabilities[transfers][requested]': 'true',
      }),

    /** Onboarding / KYC link the partner completes in a hosted Stripe flow. */
    createAccountLink: (params: { account: string; refreshUrl: string; returnUrl: string }) =>
      call<StripeAccountLink>('POST', '/account_links', {
        account: params.account,
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
        type: 'account_onboarding',
      }),

    /** Verification-polling read of the connected account state. */
    retrieveAccount: (accountId: string) =>
      call<StripeConnectAccount>('GET', `/accounts/${encodeURIComponent(accountId)}`),

    /**
     * Route a payout to a connected account. This issues a REAL transfer against
     * the live Stripe API whenever STRIPE_SECRET_KEY is configured. `idempotencyKey`
     * is required by the route layer so retries cannot double-pay (#588).
     */
    createTransfer: (params: {
      amountCents: number
      currency: string
      destination: string
      idempotencyKey?: string
    }) =>
      call<StripeTransfer>(
        'POST',
        '/transfers',
        {
          amount: String(params.amountCents),
          currency: params.currency,
          destination: params.destination,
        },
        params.idempotencyKey,
      ),
  }
}
