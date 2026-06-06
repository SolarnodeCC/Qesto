/** ADR-0048 — retro board storage keys and helpers. */

import { ulid } from './ulid'

export type RetroColumn = 'went_well' | 'didnt_go_well' | 'actions'

export type RetroItem = {
  id: string
  column: RetroColumn
  body: string
  upvotes: number
  createdAt: number
  carried?: boolean
}

export const MAX_RETRO_ITEMS = 200

export const RETRO_KEYS = {
  index: 'retro:index',
  rev: 'retro:rev',
  dotVoteLimit: 'retro:dot_vote_limit',
  item: (id: string) => `retro:item:${id}`,
  upvoters: (id: string) => `retro:upvoters:${id}`,
  voterDots: (voterId: string) => `retro:voter_dots:${voterId}`,
  submitRate: (voterId: string) => `retro:submit_rate:${voterId}`,
} as const

export const RETRO_COLUMNS: RetroColumn[] = ['went_well', 'didnt_go_well', 'actions']

export function nextRetroRev(current: number): number {
  return current + 1
}

export function createRetroItem(column: RetroColumn, body: string, carried = false): RetroItem {
  return {
    id: ulid(),
    column,
    body: body.trim(),
    upvotes: 0,
    createdAt: Date.now(),
    ...(carried ? { carried: true } : {}),
  }
}

export function canUpvoteColumn(column: RetroColumn): boolean {
  return column === 'actions'
}
