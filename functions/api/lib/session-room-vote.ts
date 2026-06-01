/**
 * Vote accumulation rules for SessionRoom LIVE voting (WS4-B).
 * Mutates `voters` in place — matches historical SessionRoom concurrency assumptions.
 */

import type { LiveQuestion } from '../realtime'
import type { QuestionKind, VotePolicy } from '../types'
import { RateLimiter } from './session-room-rate-limiter'

export type SessionVotes = Record<string, string[]>

export type TokenBucket = { tokens: number; lastAt: number }

/**
 * Decision returned by {@link evaluateVoteAdmission}. The DO applies the side
 * effects (ws.send / ws.close / persist bucket); this stays pure so the guard
 * sequence can be unit-tested in isolation.
 */
export type VoteAdmission =
  | { ok: true; bucket: TokenBucket; optionId: string }
  | { ok: false; bucket: TokenBucket; code: string; message: string; close?: boolean }

/**
 * Pure admission guard for an incoming LIVE vote. Mirrors the historical
 * SessionRoom.handleVote pre-checks in exact order: token-bucket → paused →
 * question timer → active question → questionId match → optionId presence →
 * option validity. Consumes one rate-limit token and returns the updated
 * bucket regardless of outcome.
 */
export function evaluateVoteAdmission(params: {
  bucket: TokenBucket
  bucketCapacity: number
  bucketRefillPerSec: number
  paused: boolean | undefined
  questionExpiresAt: number | undefined
  nowMs: number
  question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> | undefined
  data: { questionId?: string; optionId?: string } | undefined
}): VoteAdmission {
  const { bucket, allowed } = RateLimiter.consumeVoteToken(
    params.bucket,
    params.bucketCapacity,
    params.bucketRefillPerSec,
  )
  if (!allowed) {
    return { ok: false, bucket, code: 'rate_limited', message: 'Slow down', close: true }
  }
  if (params.paused) {
    return { ok: false, bucket, code: 'paused', message: 'Voting is paused' }
  }
  if (params.questionExpiresAt && params.nowMs > params.questionExpiresAt) {
    return {
      ok: false,
      bucket,
      code: 'question_closed',
      message: 'Time is up -- this question is no longer accepting votes',
    }
  }
  if (!params.question) {
    return { ok: false, bucket, code: 'no_question', message: 'No question is active' }
  }
  if (!params.data || params.data.questionId !== params.question.id) {
    return { ok: false, bucket, code: 'out_of_date', message: 'Vote for a different question' }
  }
  const optionId = params.data.optionId
  if (!optionId) {
    return { ok: false, bucket, code: 'bad_option', message: 'Missing optionId' }
  }
  if (!isFreeTextQuestionKind(params.question.kind) && !params.question.options.some((o) => o.id === optionId)) {
    return { ok: false, bucket, code: 'bad_option', message: 'Unknown option' }
  }
  return { ok: true, bucket, optionId }
}

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
