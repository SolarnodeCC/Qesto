/**
 * MULTI-REGION-WRITE-01 — annotate D1 mutations with logical write region (ADR-0022 Phase 2).
 * Single D1 binding until replica bindings ship; telemetry + headers for operators.
 */
import { emitMultiRegionWrite } from './multi-region-telemetry'
import type { Env } from '../types'

export type D1WriteContext = {
  writeRegion: string
  readRegion: string
}

export async function withD1WriteContext(
  env: Env,
  colo: string | null | undefined,
  operation: string,
  traceId: string | undefined,
): Promise<D1WriteContext> {
  const { writeRegion, readRegion } = await emitMultiRegionWrite(env, colo, operation, traceId)
  return { writeRegion, readRegion }
}
