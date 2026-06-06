import { z } from 'zod'
import type { WorkspaceRow } from '../../lib/workspace-types'

export const WorkspaceKindSchema = z.enum(['retro', 'ideate', 'event'])
export const WorkspaceCadenceSchema = z.enum(['weekly', 'biweekly', 'sprint', 'manual'])

export const WorkspaceCreateSchema = z.object({
  kind: WorkspaceKindSchema,
  title: z.string().trim().min(1).max(120),
  templateJson: z.record(z.string(), z.unknown()).optional(),
  cadence: WorkspaceCadenceSchema.optional(),
  retentionDays: z.number().int().min(7).max(3650).optional(),
})

export const WorkspacePatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  templateJson: z.record(z.string(), z.unknown()).optional(),
  cadence: WorkspaceCadenceSchema.nullable().optional(),
  retentionDays: z.number().int().min(7).max(3650).nullable().optional(),
  archived: z.boolean().optional(),
})

export const WorkspaceKindQuerySchema = z.object({
  kind: WorkspaceKindSchema.optional(),
})

export const ActionsPatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string().trim().min(1).max(500),
      status: z.enum(['open', 'resolved']),
    }),
  ),
})

export const TrendsQuerySchema = z.object({
  window: z.enum(['30d', '90d', '180d']).default('90d'),
  kind: z.enum(['participation', 'team_health']).default('participation'),
})

export function mapWorkspace(row: WorkspaceRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    kind: row.kind,
    title: row.title,
    template: JSON.parse(row.template_json || '{}'),
    cadence: row.cadence,
    retentionDays: row.retention_days,
    lastInstanceAt: row.last_instance_at,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadWorkspaceRow(
  db: D1Database,
  wsId: string,
  teamId: string,
): Promise<WorkspaceRow | null> {
  return db
    .prepare(
      `SELECT id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at,
              created_by, created_at, updated_at
         FROM workspaces WHERE id = ?1 AND team_id = ?2`,
    )
    .bind(wsId, teamId)
    .first<WorkspaceRow>()
}
