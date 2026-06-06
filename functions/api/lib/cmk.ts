/**
 * SEC-CMK-01 — customer-managed key envelope metadata (S78).
 */
import { z } from 'zod'
import { parseJsonString } from './boundary-decode'

export const CmkEnvelopeSchema = z.object({
  teamId: z.string(),
  keyId: z.string(),
  algorithm: z.literal('AES-256-GCM'),
  rotatedAt: z.number(),
  status: z.enum(['active', 'pending_rotation']),
})

export type CmkEnvelope = z.infer<typeof CmkEnvelopeSchema>

export function cmkKvKey(teamId: string): string {
  return `cmk:envelope:${teamId}`
}

export function parseCmkEnvelope(raw: string | null): CmkEnvelope | null {
  if (!raw) return null
  return parseJsonString(CmkEnvelopeSchema, raw)
}
