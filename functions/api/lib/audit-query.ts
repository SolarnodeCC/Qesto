/**
 * AUDIT-API-QUERY-01 — forensic audit query helpers (S78).
 */
import { z } from 'zod'

export const AuditQuerySchema = z.object({
  teamId: z.string().optional(),
  action: z.string().optional(),
  from: z.number().int().optional(),
  to: z.number().int().optional(),
  limit: z.number().int().min(1).max(500).default(100),
})

export type AuditQuery = z.infer<typeof AuditQuerySchema>

export type AuditRecord = {
  id: string
  action: string
  actorId: string | null
  teamId: string | null
  at: number
  meta: Record<string, unknown>
}

export function filterAuditRecords(records: AuditRecord[], q: AuditQuery): AuditRecord[] {
  return records
    .filter((r) => (q.teamId ? r.teamId === q.teamId : true))
    .filter((r) => (q.action ? r.action === q.action : true))
    .filter((r) => (q.from ? r.at >= q.from : true))
    .filter((r) => (q.to ? r.at <= q.to : true))
    .slice(0, q.limit)
}
