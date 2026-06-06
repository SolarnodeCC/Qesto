/** ADR-0048 — recurring workspace shared types. */

export type WorkspaceKind = 'retro' | 'ideate' | 'event'
export type WorkspaceCadence = 'weekly' | 'biweekly' | 'sprint' | 'manual'
export type WorkspaceTrendKind = 'team_health' | 'participation' | 'recurring_themes'
export type WorkspaceTrendWindow = '30d' | '90d' | '180d'

export type WorkspaceActionItem = {
  id: string
  text: string
  status: 'open' | 'resolved'
  sourceSessionId?: string | null
  createdAt: number
  resolvedAt?: number | null
}

export type WorkspaceActionsBlob = {
  items: WorkspaceActionItem[]
}

export type WorkspaceRow = {
  id: string
  team_id: string
  kind: WorkspaceKind
  title: string
  template_json: string
  cadence: WorkspaceCadence | null
  retention_days: number | null
  last_instance_at: number | null
  archived_at: number | null
  created_by: string
  created_at: number
  updated_at: number
}

export type WorkspaceInstanceRow = {
  id: string
  title: string
  status: string
  workspace_seq: number | null
  created_at: number
  closed_at: number | null
}

export const DEFAULT_RETRO_TEMPLATE = {
  columns: ['went_well', 'didnt_go_well', 'actions'],
  dotVoteLimit: 3,
} as const

export const DEFAULT_IDEATE_TEMPLATE = {
  clusterDebounceMs: 3000,
  dotVoteLimit: 5,
} as const
