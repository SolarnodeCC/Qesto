import { api, type ApiResult } from '../api/client'

export type BillingPortalResult =
  | { ok: true; url: string }
  | { ok: false; message: string }

/** Creates a Stripe billing portal session and returns the redirect URL. */
export async function createBillingPortalSession(): Promise<BillingPortalResult> {
  const res = await api<{ url: string }>('/api/billing/portal', { method: 'POST' })
  if (res.ok) return { ok: true, url: res.data.url }
  return { ok: false, message: res.error.message }
}

export type InvoiceRow = {
  id: string
  status: string
  amount_due: number
  currency: string
  created: number
  hosted_invoice_url: string | null
}

export async function fetchBillingInvoices(): Promise<ApiResult<{ invoices: InvoiceRow[] }>> {
  return api<{ invoices: InvoiceRow[] }>('/api/billing/invoices')
}
