import type { PollOption } from '../../hooks/useSessions'

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

export interface DashboardTeam {
  id: string
  name: string
  plan: string
}

export type DuplicateModalState = { sourceId: string; sourceTitle: string } | null
