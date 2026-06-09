/**
 * SEC-CMK-01 — customer-managed key envelope metadata (S78).
 */
import { z } from 'zod'
import { decodeKvJson } from './boundary-decode'

export type CmkEnvelope = {
  teamId: string
  keyId: string
  algorithm: 'AES-256-GCM'
  rotatedAt: number
  status: 'active' | 'pending_rotation'
}

const CmkEnvelopeSchema = z.object({
  teamId: z.string(),
  keyId: z.string(),
  algorithm: z.literal('AES-256-GCM'),
  rotatedAt: z.number(),
  status: z.enum(['active', 'pending_rotation']),
})

export function cmkKvKey(teamId: string): string {
  return `cmk:envelope:${teamId}`
}

export function parseCmkEnvelope(raw: string | null): CmkEnvelope | null {
  return decodeKvJson(raw, CmkEnvelopeSchema)
}
