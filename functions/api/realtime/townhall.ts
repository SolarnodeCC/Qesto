// TOWNHALL board (ADR-0044) wire types shared between the DO and clients.
import type { Anonymity, TownhallModeration, TownhallItemStatus } from '../types'

// Moderator actions on a single board item. `spotlight`/`clear_spotlight` move an
// O(1) pointer; `group` requires a `groupParentId`.
export type TownhallModerateAction =
  | 'approve'
  | 'dismiss'
  | 'restore'
  | 'answer'
  | 'spotlight'
  | 'clear_spotlight'
  | 'group'
  | 'ungroup'

// Server-internal item (full record kept in DO storage; includes authorHash).
export type TownhallItem = {
  id: string
  body: string
  displayName: string | null
  authorHash: string
  status: TownhallItemStatus
  upvotes: number
  groupParent: string | null
  createdAt: number
  rev: number
}

// Audience/console-facing projection — never carries authorHash.
export type TownhallBoardItem = {
  id: string
  body: string
  displayName: string | null
  upvotes: number
  status: Exclude<TownhallItemStatus, 'grouped'>
  isSpotlit: boolean
  groupedCount: number
  createdAt: number
}

export type TownhallMeta = {
  moderation: TownhallModeration
  anonymity: Anonymity
  version: number
}
