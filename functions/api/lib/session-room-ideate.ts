/** ADR-0048 / IDEATE — ideation board storage keys and helpers. */

import { ulid } from './ulid'

export type IdeateIdeaStatus = 'active' | 'dismissed'

export type IdeateIdea = {
  id: string
  body: string
  upvotes: number
  clusterId: string | null
  status: IdeateIdeaStatus
  createdAt: number
}

export type IdeateCluster = {
  id: string
  label: string
  ideaIds: string[]
  updatedAt: number
}

export type IdeateRankingEntry = {
  rank: number
  ideaId: string
  body: string
  upvotes: number
}

export const MAX_IDEATE_IDEAS = 200

export const IDEATE_KEYS = {
  enabled: 'ideate:enabled',
  index: 'ideate:index',
  rev: 'ideate:rev',
  clusters: 'ideate:clusters',
  rankingRevealed: 'ideate:ranking_revealed',
  dotVoteLimit: 'ideate:dot_vote_limit',
  clusterDebounceMs: 'ideate:cluster_debounce_ms',
  clusterPendingAt: 'ideate:cluster_pending_at',
  item: (id: string) => `ideate:item:${id}`,
  upvoters: (id: string) => `ideate:upvoters:${id}`,
  voterDots: (voterId: string) => `ideate:voter_dots:${voterId}`,
  submitRate: (voterId: string) => `ideate:submit_rate:${voterId}`,
  embedding: (id: string) => `ideate:embedding:${id}`,
} as const

export function nextIdeateRev(current: number): number {
  return current + 1
}

export function createIdeateIdea(body: string): IdeateIdea {
  return {
    id: ulid(),
    body: body.trim(),
    upvotes: 0,
    clusterId: null,
    status: 'active',
    createdAt: Date.now(),
  }
}

export function computeIdeateRanking(ideas: IdeateIdea[]): IdeateRankingEntry[] {
  const active = ideas
    .filter((i) => i.status === 'active')
    .sort((a, b) => b.upvotes - a.upvotes || a.createdAt - b.createdAt)
  return active.map((idea, idx) => ({
    rank: idx + 1,
    ideaId: idea.id,
    body: idea.body,
    upvotes: idea.upvotes,
  }))
}

/** Union of upvoter sets — used when merging duplicate ideas without double-counting. */
export function mergeIdeateUpvoters(upvoterSets: string[][]): string[] {
  const union = new Set<string>()
  for (const set of upvoterSets) for (const voter of set) union.add(voter)
  return [...union]
}
