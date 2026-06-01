/**
 * Native push device token storage (NATIVE-PUSH-01, ADR-0044, Sprint 81).
 * FCM/APNs delivery is wired in a follow-up; this sprint registers and revokes tokens.
 */
import { z } from 'zod'

export const NativeDevicePlatformSchema = z.enum(['ios', 'android', 'web'])

export const RegisterDeviceTokenSchema = z.object({
  platform: NativeDevicePlatformSchema,
  token: z.string().min(16).max(4096),
  appVersion: z.string().max(32).optional(),
  locale: z.string().max(16).optional(),
})

export type RegisterDeviceTokenInput = z.infer<typeof RegisterDeviceTokenSchema>

export type DeviceTokenRow = {
  id: string
  user_id: string
  platform: 'ios' | 'android' | 'web'
  token: string
  app_version: string | null
  locale: string | null
  created_at: number
  last_seen_at: number
  revoked_at: number | null
}

export function newDeviceTokenId(): string {
  return crypto.randomUUID()
}
