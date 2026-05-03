/**
 * Vote accumulation rules for SessionRoom LIVE voting (WS4-B).
 * Mutates `voters` in place — matches historical SessionRoom concurrency assumptions.
 */

import type { LiveQuestion } from '../realtime'
import type { QuestionKind, VotePolicy } from '../types'

export type SessionVotes = Record<string, string[]>

const MULTI_VOTE_KINDS = new Set<QuestionKind>(['multi_select', 'upvote', 'word_cloud'])

export function isMultiVoteQuestionKind(kind: QuestionKind): boolean {
  return MULTI_VOTE_KINDS.has(kind)
}

/** `word_cloud` / `open`: optionId is free text; other kinds must match configured options. */
export function isFreeTextQuestionKind(kind: QuestionKind): boolean {
  return kind === 'word_cloud' || kind === 'open'
}

export type ApplyVoteMutationResult =
  | { ok: true; countKey: string | null; countDecKey: string | null }
  | { ok: false; code: 'duplicate'; message: string }

/**
 * Applies one vote to the in-memory voters map for the active question.
 * Branch order matches SessionRoom semantics: multi-vote **kinds** override `votePolicy`.
 */
export function applyVoteMutation(
  voters: SessionVotes,
  params: {
    questionKind: LiveQuestion['kind']
    votePolicy: VotePolicy
    voterId: string
    optionId: string
  },
): ApplyVoteMutationResult {
  const { questionKind, votePolicy, voterId, optionId } = params

  if (isMultiVoteQuestionKind(questionKind)) {
    const previous = voters[voterId] ?? []
    if (previous.includes(optionId)) {
      return { ok: false, code: 'duplicate', message: 'You already selected this option' }
    }
    voters[voterId] = [...previous, optionId]
    return { ok: true, countKey: optionId, countDecKey: null }
  }

  if (votePolicy === 'once') {
    if ((voters[voterId]?.length ?? 0) > 0) {
      return { ok: false, code: 'duplicate', message: 'You already voted on this question' }
    }
    voters[voterId] = [optionId]
    return { ok: true, countKey: optionId, countDecKey: null }
  }

  if (votePolicy === 'multi') {
    const previous = voters[voterId]?.[0]
    if (previous === optionId) {
      return { ok: false, code: 'duplicate', message: 'You already selected this option' }
    }
    voters[voterId] = [optionId]
    return { ok: true, countKey: optionId, countDecKey: previous ?? null }
  }

  // react: no per-voter dedupe; stored choice is overwritten but counts always increment.
  voters[voterId] = [optionId]
  return { ok: true, countKey: optionId, countDecKey: null }
}
