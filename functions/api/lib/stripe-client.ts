/**
 * Minimal Stripe REST client (extracted from routes/billing.ts, ADR-0069).
 *
 * The `stripe` npm package is not available in the edge runtime budget, so we
 * call the REST API directly behind the shared Stripe circuit breaker. Only the
 * methods used by billing + marketplace are implemented. Lives in lib/ so route
 * handlers depend on a typed client rather than embedding HTTP plumbing.
 */
import { CircuitBreakers } from './resilience/circuit-breaker'

export function makeStripeClient(secretKey: string) {
  async function get<T>(pathWithQuery: string): Promise<T> {
    return CircuitBreakers.stripe.execute(
      async (signal) => {
        const res = await fetch(`https://api.stripe.com/v1${pathWithQuery}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${secretKey}` },
          signal,
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: { message: 'Stripe error' } }))) as {
            error?: { message?: string }
          }
          throw new Error(err?.error?.message ?? 'Stripe API error')
        }
        return res.json() as Promise<T>
      },
      () => { throw new Error('Stripe circuit open') },
    )
  }

  async function post<T>(path: string, body: Record<string, string>): Promise<T> {
    const params = new URLSearchParams(body).toString()
    return CircuitBreakers.stripe.execute(
      async (signal) => {
        const res = await fetch(`https://api.stripe.com/v1${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
          signal,
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: { message: 'Stripe error' } }))) as {
            error?: { message?: string }
          }
          throw new Error(err?.error?.message ?? 'Stripe API error')
        }
        return res.json() as Promise<T>
      },
      () => { throw new Error('Stripe circuit open') },
    )
  }
  return {
    checkoutSessions: {
      create: (params: Record<string, string>) =>
        post<{ url: string; id: string }>('/checkout/sessions', params),
    },
    billingPortal: {
      sessions: {
        create: (params: { customer: string; return_url: string }) =>
          post<{ url: string }>('/billing_portal/sessions', {
            customer: params.customer,
            return_url: params.return_url,
          }),
      },
    },
    invoices: {
      list: (params: { customer: string; limit?: number }) =>
        get<{ data: Array<{ id: string; status: string; amount_due: number; currency: string; created: number; hosted_invoice_url: string | null; invoice_pdf: string | null }> }>(
          `/invoices?customer=${encodeURIComponent(params.customer)}&limit=${String(params.limit ?? 20)}`,
        ),
    },
    subscriptions: {
      cancel: (subscriptionId: string) => post<{ id: string; status: string }>(`/subscriptions/${subscriptionId}/cancel`, {}),
      updatePrice: (subscriptionId: string, itemId: string, priceId: string) =>
        post<{ id: string; status: string }>(`/subscriptions/${subscriptionId}`, {
          'items[0][id]': itemId,
          'items[0][price]': priceId,
          proration_behavior: 'create_prorations',
        }),
    },
  }
}

export type StripeClient = ReturnType<typeof makeStripeClient>
