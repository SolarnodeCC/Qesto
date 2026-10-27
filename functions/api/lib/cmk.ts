/**
 * SEC-CMK-01 — customer-managed keys (S78). NOT IMPLEMENTED.
 *
 * DD-35 (issue #907): nothing in Qesto wraps, unwraps or encrypts data under a
 * customer key. What exists is a stored *intent* — a team asked for CMK and
 * named a key id. Earlier this was typed as a `CmkEnvelope` asserting
 * `algorithm: 'AES-256-GCM'`, and the admin endpoint served that as if it were
 * a live control. It is now typed and reported as what it is, so no security
 * review reads an algorithm claim with no cryptography behind it.
 *
 * Marketing surfaces list CMK as roadmap (guarded by check:compliance-claims).
 */
import { z } from 'zod'
import { decodeKvJson } from './boundary-decode'

/** A team's recorded request for CMK. Carries no key material. */
export type CmkIntentDeclaration = {
  teamId: string
  keyId: string
  requestedAt: number
}

/**
 * Accepts both the new shape and legacy `CmkEnvelope` rows (which used
 * `rotatedAt` and carried `algorithm` / `status`); the extra legacy fields
 * are dropped so they can never be echoed back.
 */
const CmkIntentSchema = z
  .object({
    teamId: z.string(),
    keyId: z.string(),
    requestedAt: z.number().optional(),
    rotatedAt: z.number().optional(),
  })
  .transform(
    (v): CmkIntentDeclaration => ({
      teamId: v.teamId,
      keyId: v.keyId,
      requestedAt: v.requestedAt ?? v.rotatedAt ?? 0,
    }),
  )

/** Implementation status reported by every CMK surface until real envelope encryption ships. */
export const CMK_IMPLEMENTATION_STATUS = 'not_implemented' as const

export function cmkKvKey(teamId: string): string {
  return `cmk:envelope:${teamId}`
}

export function parseCmkIntent(raw: string | null): CmkIntentDeclaration | null {
  return decodeKvJson(raw, CmkIntentSchema)
}
