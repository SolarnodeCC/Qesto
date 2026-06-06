/**
 * PWA-PUSH-HARDENING-01 — Web Push subscription storage and payload validation (S71).
 */
import { z } from 'zod'
import { PWA_PUSH_TTL_SECONDS } from './constants'

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
  userAgent: z.string().max(512).optional(),
})

export type PushSubscription = z.infer<typeof PushSubscriptionSchema>

export const PushPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500).default(''),
  url: z.string().url().max(2048).optional(),
  tag: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
})

export type PushPayload = z.infer<typeof PushPayloadSchema>

export function pushSubscriptionKvKey(userId: string): string {
  return `push:sub:${userId}`
}

export async function savePushSubscription(
  kv: KVNamespace,
  userId: string,
  sub: PushSubscription,
): Promise<void> {
  await kv.put(pushSubscriptionKvKey(userId), JSON.stringify({ ...sub, updatedAt: Date.now() }), {
    expirationTtl: PWA_PUSH_TTL_SECONDS,
  })
}

export async function loadPushSubscription(kv: KVNamespace, userId: string): Promise<PushSubscription | null> {
  const raw = await kv.get(pushSubscriptionKvKey(userId))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return PushSubscriptionSchema.parse(parsed)
  } catch {
    return null
  }
}

export async function deletePushSubscription(kv: KVNamespace, userId: string): Promise<void> {
  await kv.delete(pushSubscriptionKvKey(userId))
}

/** Returns VAPID public key for client subscribe(), or null when push is not configured. */
export function getVapidPublicKey(env: { VAPID_PUBLIC_KEY?: string }): string | null {
  const key = env.VAPID_PUBLIC_KEY?.trim()
  return key && key.length > 0 ? key : null
}

export function isPushConfigured(env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string }): boolean {
  return !!(env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim())
}
