// Internal HMAC-signed webhook delivery helper for the Growth Engine marketing pipeline.
// Sends a session.closed event to /api/webhooks/marketing after PII stripping.
// Callers use waitUntil so the delivery never delays the close response.

import { hmacSha256Hex } from './webhooks'
import type { SessionWebhookPayload } from './template-schemas'
import type { Env } from '../types'

export async function deliverMarketingWebhook(
  env: Env,
  payload: SessionWebhookPayload,
): Promise<void> {
  const secret = env.MARKETING_WEBHOOK_SECRET
  if (!secret) {
    console.log({ event: 'webhook.marketing.skipped_no_secret', sessionId: payload.sessionId })
    return
  }
  const body = JSON.stringify(payload)
  const signature = `sha256=${await hmacSha256Hex(secret, body)}`
  const apiUrl = env.API_URL || 'https://qesto.cc'
  let response: Response
  try {
    response = await fetch(`${apiUrl}/api/webhooks/marketing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Qesto-Signature': signature },
      body,
    })
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'webhook.marketing.delivery_error',
        sessionId: payload.sessionId,
        error: String(err),
      }),
    )
    return
  }
  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: 'webhook.marketing.delivery_failed',
        sessionId: payload.sessionId,
        status: response.status,
      }),
    )
  }
}
