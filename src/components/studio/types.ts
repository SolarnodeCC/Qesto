// STUDIO (ADR-0060, S97) — shared view-model types for the Studio authoring UI.
// Mirrors backend shapes from functions/api/lib/studio-authoring.ts,
// functions/api/lib/studio-theme.ts and functions/api/lib/studio-suggest.ts.
// Deliberately re-declared here (not imported) because functions/api is backend-owned
// and read-only for frontend — these are the minimal view models the UI needs.

export type StudioQuestionKind =
  | 'poll'
  | 'ranking'
  | 'consent'
  | 'open'
  | 'multi_select'
  | 'likert'
  | 'upvote'
  | 'word_cloud'
  | 'slider'

export const STUDIO_KINDS: StudioQuestionKind[] = [
  'poll',
  'ranking',
  'consent',
  'open',
  'multi_select',
  'likert',
  'upvote',
  'word_cloud',
  'slider',
]

export type StudioThemeId = 'default' | 'dark' | 'high-contrast' | 'brand-neutral'

export const STUDIO_THEME_IDS: StudioThemeId[] = ['default', 'dark', 'high-contrast', 'brand-neutral']

export type StudioDraftOption = { id: string; label: string }

export type StudioDraft = {
  id: string
  kind: StudioQuestionKind
  prompt: string
  options: StudioDraftOption[]
}

export type StudioLibraryItem = {
  id: string
  team_id: string
  created_by: string
  source: 'authored' | 'fork'
  forked_from_id: string | null
  question_json: { kind: StudioQuestionKind; prompt: string; options: StudioDraftOption[] }
  theme_id: string | null
  title: string
  use_count: number
  created_at: number
  updated_at: number
}

export type StudioSuggestion = {
  id: string
  kind: 'poll'
  prompt: string
  options: StudioDraftOption[]
  source: { sessionId: string; title: string; score: number }
}
