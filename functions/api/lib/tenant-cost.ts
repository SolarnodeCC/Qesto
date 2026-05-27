/**
 * TENANT-COST-01 / BILLING-METERED-01 — per-tenant cost attribution (S74).
 */
import { z } from 'zod'

export const TenantCostSnapshotSchema = z.object({
  teamId: z.string(),
  periodStart: z.number(),
  periodEnd: z.number(),
  aiInferenceUnits: z.number().int().min(0),
  apiRequestUnits: z.number().int().min(0),
  storageMb: z.number().min(0),
  estimatedCents: z.number().int().min(0),
  currency: z.literal('EUR'),
})

export type TenantCostSnapshot = z.infer<typeof TenantCostSnapshotSchema>

export function tenantCostKvKey(teamId: string, month: string): string {
  return `tenant:cost:${teamId}:${month}`
}

export function estimateTenantCostCents(units: {
  ai: number
  api: number
  storageMb: number
}): number {
  return Math.round(units.ai * 0.02 + units.api * 0.001 + units.storageMb * 0.05)
}

export function buildCostSnapshot(teamId: string, units: { ai: number; api: number; storageMb: number }): TenantCostSnapshot {
  const now = Date.now()
  const start = new Date()
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return TenantCostSnapshotSchema.parse({
    teamId,
    periodStart: start.getTime(),
    periodEnd: now,
    aiInferenceUnits: units.ai,
    apiRequestUnits: units.api,
    storageMb: units.storageMb,
    estimatedCents: estimateTenantCostCents(units),
    currency: 'EUR',
  })
}
