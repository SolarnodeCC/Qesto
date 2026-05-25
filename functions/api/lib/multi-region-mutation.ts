/**
 * MULTI-REGION-WRITE-01 — emit write telemetry on session D1 mutations.
 */
import type { Context } from 'hono'
import { emitMultiRegionWrite } from './multi-region-telemetry'
import type { Env } from '../types'

type AnyEnv = { Bindings: Env; Variables: any }

export function requestColo(c: Context<AnyEnv>): string | null {
  return (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null
}

export function trackSessionWrite(c: Context<AnyEnv>, op: string): void {
  const traceId = c.get('trace_id')
  void emitMultiRegionWrite(c.env, requestColo(c), op, typeof traceId === 'string' ? traceId : undefined)
}
