/**
 * MULTI-REGION-WRITE-01 — emit write telemetry on session D1 mutations.
 */
import type { Context } from 'hono'
import { emitMultiRegionWrite } from './multi-region-telemetry'
import type { Env } from '../types'

export function requestColo(c: Context<{ Bindings: Env }>): string | null {
  return (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null
}

export function trackSessionWrite(c: Context<{ Bindings: Env; Variables: { trace_id?: string } }>, op: string): void {
  void emitMultiRegionWrite(c.env, requestColo(c), op, c.get('trace_id'))
}
