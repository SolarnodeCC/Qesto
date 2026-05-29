/**
 * TOWNHALL board rules for SessionRoom (ADR-0044). Pure, I/O-free functions — the DO
 * (TOWNHALL-04/05) owns storage and wires these to point-addressable keys. Mirrors the
 * shape of `session-room-vote.ts`: small functions returning discriminated results.
 *
 * The live board is the DO's source of truth; this module never touches storage, D1, or
 * the network, which keeps the state machine fully unit-testable.
 */

import type { TownhallItem, TownhallBoardItem, TownhallModerateAction } from '../realtime'
import type { TownhallModeration, TownhallItemStatus } from '../types'

// ── Storage key layout (DO storage; point-addressable, no whole-board rewrites) ──
export const TOWNHALL_KEYS = {
  meta: 'th:meta',
  index: 'th:index',
  spotlight: 'th:spotlight',
  spotlitHistory: 'th:spotlit_history',
  groups: 'th:groups',
  rev: 'th:rev',
  item: (id: string) => `th:item:${id}`,
  upvoters: (id: string) => `th:upvoters:${id}`,
  submitRate: (voterId: string) => `th:submit_rate:${voterId}`,
} as const

// ── Submit rate limiting (separate, tighter bucket than the vote bucket) ─────────
// Submissions are far more expensive than upvotes (text + moderation surface), so cap
// at 3 burst, sustained ~3/min. Upvotes reuse the existing vote bucket in SessionRoom.
export const TOWNHALL_SUBMIT_BUCKET_CAPACITY = 3
export const TOWNHALL_SUBMIT_BUCKET_REFILL_PER_SEC = 1 / 20

export type TokenBucket = { tokens: number; lastAt: number }

export function newSubmitBucket(now: number): TokenBucket {
  return { tokens: TOWNHALL_SUBMIT_BUCKET_CAPACITY, lastAt: now }
}

/** Consume one submit token. On failure the bucket is returned unchanged so accrual continues. */
export function consumeSubmitToken(bucket: TokenBucket, now: number): { ok: boolean; bucket: TokenBucket } {
  const elapsed = Math.max(0, (now - bucket.lastAt) / 1000)
  const refilled = Math.min(
    TOWNHALL_SUBMIT_BUCKET_CAPACITY,
    bucket.tokens + elapsed * TOWNHALL_SUBMIT_BUCKET_REFILL_PER_SEC,
  )
  if (refilled < 1) return { ok: false, bucket }
  return { ok: true, bucket: { tokens: refilled - 1, lastAt: now } }
}

// ── Revision counter ─────────────────────────────────────────────────────────────
export function nextRev(rev: number): number {
  return rev + 1
}

// ── Item creation ──────────────────────────────────────────────────────────────
// Pre-moderation → starts hidden (`pending`); post-moderation → visible (`approved`).
// This initial status is the *only* behavioural difference between the two modes.
export function createTownhallItem(params: {
  id: string
  body: string
  displayName?: string | null
  authorHash: string
  moderation: TownhallModeration
  now: number
  rev: number
}): TownhallItem {
  return {
    id: params.id,
    body: params.body.trim(),
    displayName: params.displayName?.trim() ? params.displayName.trim() : null,
    authorHash: params.authorHash,
    status: params.moderation === 'pre' ? 'pending' : 'approved',
    upvotes: 0,
    groupParent: null,
    createdAt: params.now,
    rev: params.rev,
  }
}

// ── Duplicate-body suppression (soft) ────────────────────────────────────────────
export function normalizeBody(body: string): string {
  return body.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isDuplicateBody(existingBodies: string[], body: string): boolean {
  const n = normalizeBody(body)
  return existingBodies.some((b) => normalizeBody(b) === n)
}

// ── Upvote (per-item dedupe via the upvoter set) ─────────────────────────────────
export type UpvoteResult =
  | { ok: true; item: TownhallItem; upvoters: string[] }
  | { ok: false; code: 'duplicate' }

export function applyTownhallUpvote(
  item: TownhallItem,
  upvoters: string[],
  voterId: string,
  rev: number,
): UpvoteResult {
  if (upvoters.includes(voterId)) return { ok: false, code: 'duplicate' }
  const nextUpvoters = [...upvoters, voterId]
  // The item's own count is always the size of its own upvoter set; grouped totals are
  // merged at projection time (mergedUpvoteCount) so a voter is never double-counted.
  return { ok: true, item: { ...item, upvotes: nextUpvoters.length, rev }, upvoters: nextUpvoters }
}

// ── Moderation state machine ─────────────────────────────────────────────────────
// pending → approved | dismissed ; dismissed → approved (restore) ; approved → answered.
// `spotlight`/`clear_spotlight` move the board-level pointer (O(1)), not item status.
// `group`/`ungroup` set/clear the child's groupParent.
export type ModerationOutcome =
  | { ok: true; kind: 'item'; item: TownhallItem }
  | { ok: true; kind: 'spotlight'; spotlightId: string | null }
  | { ok: false; code: 'invalid_transition' | 'bad_request'; message: string }

function itemOut(item: TownhallItem): ModerationOutcome {
  return { ok: true, kind: 'item', item }
}

function invalid(action: TownhallModerateAction, status: TownhallItemStatus): ModerationOutcome {
  return {
    ok: false,
    code: 'invalid_transition',
    message: `Cannot '${action}' an item in status '${status}'`,
  }
}

export function applyTownhallModeration(
  item: TownhallItem,
  action: TownhallModerateAction,
  opts: { rev: number; groupParentId?: string | undefined },
): ModerationOutcome {
  const rev = opts.rev
  switch (action) {
    case 'approve':
      if (item.status !== 'pending' && item.status !== 'dismissed') return invalid(action, item.status)
      return itemOut({ ...item, status: 'approved', rev })
    case 'restore':
      if (item.status !== 'dismissed') return invalid(action, item.status)
      return itemOut({ ...item, status: 'approved', rev })
    case 'dismiss':
      if (item.status === 'dismissed' || item.status === 'grouped') return invalid(action, item.status)
      return itemOut({ ...item, status: 'dismissed', rev })
    case 'answer':
      if (item.status !== 'approved') return invalid(action, item.status)
      return itemOut({ ...item, status: 'answered', rev })
    case 'group':
      if (!opts.groupParentId) return { ok: false, code: 'bad_request', message: 'group requires groupParentId' }
      if (opts.groupParentId === item.id)
        return { ok: false, code: 'bad_request', message: 'cannot group an item under itself' }
      if (item.status === 'grouped') return invalid(action, item.status)
      return itemOut({ ...item, status: 'grouped', groupParent: opts.groupParentId, rev })
    case 'ungroup':
      if (item.status !== 'grouped') return invalid(action, item.status)
      return itemOut({ ...item, status: 'approved', groupParent: null, rev })
    case 'spotlight':
      if (item.status !== 'approved' && item.status !== 'answered') return invalid(action, item.status)
      return { ok: true, kind: 'spotlight', spotlightId: item.id }
    case 'clear_spotlight':
      return { ok: true, kind: 'spotlight', spotlightId: null }
    default:
      return { ok: false, code: 'bad_request', message: `Unknown action '${String(action)}'` }
  }
}

// ── Visibility & projection ──────────────────────────────────────────────────────
/** Audience sees only approved + answered items (identical for pre/post moderation). */
export function isAudienceVisible(status: TownhallItemStatus): boolean {
  return status === 'approved' || status === 'answered'
}

/** Merged upvote total = size of the UNION of upvoter sets (never double-counts a voter). */
export function mergedUpvoteCount(upvoterSets: string[][]): number {
  const union = new Set<string>()
  for (const set of upvoterSets) for (const voter of set) union.add(voter)
  return union.size
}

/** Project an internal item to the wire shape — never carries authorHash. */
export function toBoardItem(
  item: TownhallItem,
  opts: { isSpotlit: boolean; groupedCount: number; mergedUpvotes: number },
): TownhallBoardItem {
  return {
    id: item.id,
    body: item.body,
    displayName: item.displayName,
    upvotes: opts.mergedUpvotes,
    // Grouped children are represented via the parent's `groupedCount`, never projected
    // on their own; the narrowing below is defensive for that unreachable case.
    status: item.status === 'grouped' ? 'approved' : item.status,
    isSpotlit: opts.isSpotlit,
    groupedCount: opts.groupedCount,
    createdAt: item.createdAt,
  }
}

/** Display order: highest merged upvotes first, then oldest first (stable). */
export function compareForDisplay(a: TownhallBoardItem, b: TownhallBoardItem): number {
  if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes
  return a.createdAt - b.createdAt
}
