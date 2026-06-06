import type { PollOption, SessionSummary } from '../../hooks/useSessions'
import type { ApiError } from '../../api/client'

export type StatusFilter = 'all' | 'live' | 'draft' | 'closed'

export interface Template {
  id: string
  type: 'qesto' | 'customer'
  name: string
  description: string
  category: string
  topic: string
  previewAlt: string
  questions: Array<{ kind: string; prompt: string; options: PollOption[] }>
}

export interface TemplateModalState {
  open: boolean
  template: Template | null
}

export type SessionsListState =
  | { status: 'loading' }
  | { status: 'ready'; sessions: SessionSummary[] }
  | { status: 'error'; error: ApiError }

export interface DashboardTeam {
  id: string
  name: string
  plan: string
}

export type DuplicateModalState = { sourceId: string; sourceTitle: string } | null
