// WEBHOOK-01 — Generic outbound webhook delivery (barrel).
//
// Stores webhook configs in INTEGRATIONS_KV under:
//   webhook:config:{teamId}:{webhookId}     — WebhookConfig blob
//   webhook:team-index:{teamId}             — string[] webhookIds (reverse index for fast list)
//   webhook:delivery:{webhookId}            — DeliveryEntry[] (last 50, 7-day TTL)
//
// Wire format on outbound POST:
//   Headers:
//     Content-Type:       application/json
//     X-Qesto-Event:      session.closed
//     X-Qesto-Timestamp:  <epoch_ms>
//     X-Qesto-Signature-256: sha256=<hex_hmac>
//   Body: { event, timestamp, data }
//
// Retry policy: up to 3 attempts; sleeps 1000/2000/4000 ms between attempts.
// Each attempt has a 10s timeout. Delivery is best-effort; failures are logged
// to the per-webhook delivery log and do not propagate to the caller.

export type {
  DeliveryEntry,
  WebhookConfig,
  WebhookEvent,
  WebhookPayload,
} from './webhooks-types'

export {
  DELIVERY_LOG_MAX_ENTRIES,
  DELIVERY_LOG_TTL_SECONDS,
  DELIVERY_TIMEOUT_MS,
  KNOWN_WEBHOOK_EVENTS,
  MAX_DELIVERY_ATTEMPTS,
  RETRY_BACKOFF_MS,
  WEBHOOK_DELIVERY_SLA_MS,
  WEBHOOK_LIMIT_PER_TEAM,
  webhookConfigKey,
  webhookDeliveryKey,
  webhookTeamIndexKey,
} from './webhooks-types'

export { generateWebhookSecret, hmacSha256Hex } from './webhooks-crypto'

export {
  addToTeamIndex,
  countTeamWebhooks,
  deleteWebhookConfig,
  getWebhookConfig,
  loadTeamWebhooks,
  loadWebhookConfig,
  loadTeamWebhookIds,
  redactWebhookSecret,
  removeFromTeamIndex,
  saveWebhookConfig,
} from './webhooks-store'

export { deliverTeamWebhooks, deliverWebhook, listDeliveries } from './webhooks-delivery'
