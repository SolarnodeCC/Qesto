/**
 * MULTI-REGION-WRITE-01 — best-effort write routing telemetry (ADR-0022 Phase 2).
 */
import { writeEvent } from './observability'
import type { Env } from '../types'
import { getMultiRegionRoutingSnapshot } from './multi-region'

export async function emitMultiRegionWrite(
  env: Env,
  colo: string | null | undefined,
  detail: string,
  traceId?: string,
): Promise<{ writeRegion: string; readRegion: string }> {
  const snap = await getMultiRegionRoutingSnapshot(env, colo)
  writeEvent(env.METRICS_AE, {
    name: 'multi_region.write_routed',
    traceId,
    detail: `${detail}:${snap.writeRegion}:read=${snap.readRegion}`,
  })
  if (snap.failoverActive) {
    writeEvent(env.METRICS_AE, {
      name: 'multi_region.failover_triggered',
      traceId,
      detail: `write:${snap.writeRegion}`,
    })
  }
  return { writeRegion: snap.writeRegion, readRegion: snap.readRegion }
}
