/**
 * RES-DO-02 — cross-region energizer snapshot mirror (best-effort KV fallback).
 */
import type { LiveEnergizerState } from '../realtime'

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
  await kv.put(key, JSON.stringify({ state, mirroredAt: Date.now() }), { expirationTtl: 3600 })
}

export async function loadEnergizerMirrorFromKv(
  kv: KVNamespace | undefined,
  sessionId: string,
): Promise<LiveEnergizerState | null> {
  if (!kv) return null
  const raw = await kv.get(crossRegionEnergizerKey(sessionId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { state?: LiveEnergizerState }
    return parsed.state ?? null
  } catch {
    return null
  }
}
