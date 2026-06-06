// WEBHOOK-01 — Types, constants, and KV key builders for outbound webhooks.

export type WebhookEvent =
  | 'session.closed'
  | 'session.started'
  | 'session.energizer'
  | 'energizer.activated'
  | 'sentiment.threshold'
  | 'leaderboard.milestone'

export const KNOWN_WEBHOOK_EVENTS: readonly WebhookEvent[] = [
  'session.closed',
  'session.started',
  'session.energizer',
  'energizer.activated',
  'sentiment.threshold',
  'leaderboard.milestone',
] as const

/** Target: 95% of deliveries complete within 5 minutes (INT-WEBHOOK-MATURITY-01). */
export const WEBHOOK_DELIVERY_SLA_MS = 5 * 60 * 1000

export const WEBHOOK_LIMIT_PER_TEAM = 10

export interface WebhookConfig {
  id: string
  teamId: string
  url: string
  /** HMAC secret — generated server-side on create, never returned after creation. */
  secret: string
  events: WebhookEvent[]
  enabled: boolean
  createdAt: number
  updatedAt: number
  createdBy: string
}

export interface DeliveryEntry {
  id: string
  webhookId: string
  event: string
  url: string
  statusCode: number | null
  success: boolean
  attempt: number
  durationMs: number
  deliveredAt: number
  error?: string
}

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: number
  data: Record<string, unknown>
}

export function webhookConfigKey(teamId: string, webhookId: string): string {
  return `webhook:config:${teamId}:${webhookId}`
}

export function webhookTeamIndexKey(teamId: string): string {
  return `webhook:team-index:${teamId}`
}

export function webhookDeliveryKey(webhookId: string): string {
  return `webhook:delivery:${webhookId}`
}

export const DELIVERY_LOG_MAX_ENTRIES = 50
export const DELIVERY_LOG_TTL_SECONDS = 7 * 24 * 60 * 60
export const DELIVERY_TIMEOUT_MS = 10_000
export const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000] as const
export const MAX_DELIVERY_ATTEMPTS = RETRY_BACKOFF_MS.length
