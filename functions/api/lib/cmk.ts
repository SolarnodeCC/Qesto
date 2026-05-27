/**
 * SEC-CMK-01 — customer-managed key envelope metadata (S78).
 */
export type CmkEnvelope = {
  teamId: string
  keyId: string
  algorithm: 'AES-256-GCM'
  rotatedAt: number
  status: 'active' | 'pending_rotation'
}

export function cmkKvKey(teamId: string): string {
  return `cmk:envelope:${teamId}`
}

export function parseCmkEnvelope(raw: string | null): CmkEnvelope | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as CmkEnvelope
    if (o.algorithm !== 'AES-256-GCM') return null
    return o
  } catch {
    return null
  }
}
