// Session domain model shared between functions/ (Hono) and src/ (React).

export type SessionStatus = 'draft' | 'energizing' | 'live' | 'closed' | 'archived'
export type QuestionKind =
  | 'poll'
  | 'ranking'
  | 'consent'
  | 'open'
  | 'multi_select'
  | 'likert'
  | 'upvote'
  | 'word_cloud'
  | 'slider'
  | 'reaction'
export type Anonymity = 'full' | 'partial' | 'none' | 'zero_knowledge'
export type VotePolicy = 'once' | 'multi' | 'react'
export type SessionMode = 'reflection' | 'fun' | 'townhall' | 'stage' | 'retro' | 'ideate' | 'deliberate'

/** TOWNHALL (ADR-0044): per-session moderation model, chosen at draft. */
export type TownhallModeration = 'pre' | 'post'
/** TOWNHALL item lifecycle. `spotlight` is a separate O(1) pointer, not a status. */
export type TownhallItemStatus = 'pending' | 'approved' | 'dismissed' | 'answered' | 'grouped'

export type PollOption = { id: string; label: string }

export type Question = {
  id: string
  session_id: string
  position: number
  kind: QuestionKind
  prompt: string
  options: PollOption[]
  created_at: number
}

export type Session = {
  id: string
  owner_id: string
  code: string
  title: string
  status: SessionStatus
  anonymity: Anonymity
  vote_policy: VotePolicy
  session_mode: SessionMode
  /** TOWNHALL (ADR-0044): moderation model when session_mode = 'townhall'. */
  townhall_moderation?: TownhallModeration | null
  created_at: number
  started_at: number | null
  closed_at: number | null
  archived_at: number | null
  /** Optional analytics-only field (OBS-001). Not exposed to frontend. */
  team_id?: string | null
  /** ADR-0048: recurring workspace linkage for retro/ideate/event instances. */
  workspace_id?: string | null
  workspace_seq?: number | null
  /** Growth Engine: opt-out flag for public template gallery (defaults 1/true). */
  is_public?: number
  /** Sprint 18 prereq: wizard provenance — 1 if questions came from the AI wizard. */
  ai_generated?: number
  /** Sprint 18 prereq: GDPR consent timestamp (epoch ms). NULL if no consent given. */
  ai_consent_at?: number | null
  /** Sprint 18 prereq: sha256 hex of grounding prompt context, used to dedupe refines. */
  ai_grounding_hash?: string | null
  /** S19-MEASURE-01: count of AI-suggested questions the host accepted (kept in final set). */
  ai_accepted_count?: number
  /** S19-MEASURE-01: count of AI-suggested questions the host dismissed. */
  ai_dismissed_count?: number
  /** AI-RECAP-PROV-01: model id used for last recap/insights generation. */
  ai_recap_model?: string | null
  /** AI-RECAP-PROV-01: epoch ms when host edited AI-generated recap text. */
  ai_recap_edited_at?: number | null
}
