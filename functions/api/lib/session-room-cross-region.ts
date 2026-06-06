import { absent } from './absent'
/**
 * RES-DO-02 — cross-region energizer snapshot mirror (best-effort KV default).
 */
import type { LiveEnergizerState } from '../realtime'
import { CROSS_REGION_MIRROR_TTL_SECONDS } from './constants'
export const CROSS_REGION_ENERGIZER_KV_KEY = 'do:energizer:mirror:'

export function crossRegionEnergizerKey(sessionId: string): string {
  return `${CROSS_REGION_ENERGIZER_KV_KEY}${sessionId}`
}

export async function mirrorEnergizerToKv(
  kv: KVNamespace | undefined,
  sessionId: string,
  state: LiveEnergizerState | null,
): Promise<void> {
  if (!kv) return
  const key = crossRegionEnergizerKey(sessionId)
  if (!state) {
    await kv.delete(key)
    return
  }
  await kv.put(key, JSON.stringify({ state, mirroredAt: Date.now() }), { expirationTtl: CROSS_REGION_MIRROR_TTL_SECONDS })
}

export async function loadEnergizerMirrorFromKv(
  kv: KVNamespace | undefined,
  sessionId: string,
): Promise<LiveEnergizerState | null> {
  if (!kv) return absent()
  const raw = await kv.get(crossRegionEnergizerKey(sessionId))
  if (!raw) return absent()
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return absent()
    const state = (parsed as { state?: unknown }).state
    return state && typeof state === 'object' ? (state as LiveEnergizerState) : null
  } catch {
    return absent()
  }
}
