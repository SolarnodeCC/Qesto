// REST-based hook for the DELIBERATE ballot-commit session mode (ADR-0049).
//
// This hook wraps the three voter-facing API calls (cast, verify, tally) plus
// the config read. Unlike WS-backed sessions (ideate/townhall/retro), DELIBERATE
// uses ordinary cookie-authenticated REST — the vote is a one-shot sealed commit,
// not a live board.
//
// State machine:
//   idle → casting → cast_done (receipt held) → verifying → verified / verify_error
//
// The tally is fetched separately on demand (presenter-only in practice, but the
// API is public once the session closes, so it is included here for completeness).

import { useCallback, useReducer } from 'react'
import { api } from '../api/client'

// ─── API shapes ───────────────────────────────────────────────────────────────

export type DeliberateReceipt = {
  sessionId: string
  sessionFingerprint: string
  ballotNonce: string
  commitment: string
  choice: string
  leafIndex: number
  issuedAt: string
  verifyPath: string
}

export type DeliberateVerifyResult = {
  verified: boolean
  commitmentValid: boolean
  inLedger: boolean
  ledgerCommitmentMatch: boolean
  leafIndex: number
  merkleRoot: string
  reason?: string
}

export type DeliberateTally = {
  voteCount: number
  commitmentCount: number
  tally: Record<string, number>
  merkleRoot: string
  ledger: Array<{
    leafIndex: number
    ballotNonce: string
    commitment: string
    choice: string
  }>
}

export type DeliberateConfig = {
  sessionId: string
  sessionMode: 'deliberate'
  status: string
  deliberateReady: boolean
  ballotCount: number
}

// ─── State ────────────────────────────────────────────────────────────────────

type Phase =
  | { kind: 'idle' }
  | { kind: 'casting' }
  | { kind: 'cast_done'; receipt: DeliberateReceipt }
  | { kind: 'verifying'; receipt: DeliberateReceipt }
  | { kind: 'verified'; receipt: DeliberateReceipt; result: DeliberateVerifyResult }
  | { kind: 'verify_error'; receipt: DeliberateReceipt; message: string }
  | { kind: 'cast_error'; message: string }

export type DeliberateState = {
  phase: Phase
  tally: DeliberateTally | null
  tallyLoading: boolean
  tallyError: string | null
}

type DeliberateAction =
  | { type: 'cast_start' }
  | { type: 'cast_ok'; receipt: DeliberateReceipt }
  | { type: 'cast_err'; message: string }
  | { type: 'verify_start' }
  | { type: 'verify_ok'; result: DeliberateVerifyResult }
  | { type: 'verify_err'; message: string }
  | { type: 'tally_start' }
  | { type: 'tally_ok'; tally: DeliberateTally }
  | { type: 'tally_err'; message: string }

export const DELIBERATE_INITIAL: DeliberateState = {
  phase: { kind: 'idle' },
  tally: null,
  tallyLoading: false,
  tallyError: null,
}

export function deliberateReducer(state: DeliberateState, action: DeliberateAction): DeliberateState {
  switch (action.type) {
    case 'cast_start':
      return { ...state, phase: { kind: 'casting' } }
    case 'cast_ok':
      return { ...state, phase: { kind: 'cast_done', receipt: action.receipt } }
    case 'cast_err':
      return { ...state, phase: { kind: 'cast_error', message: action.message } }
    case 'verify_start': {
      if (state.phase.kind !== 'cast_done' && state.phase.kind !== 'verified' && state.phase.kind !== 'verify_error') {
        return state
      }
      const receipt = (state.phase as { receipt: DeliberateReceipt }).receipt
      return { ...state, phase: { kind: 'verifying', receipt } }
    }
    case 'verify_ok': {
      if (state.phase.kind !== 'verifying') return state
      return { ...state, phase: { kind: 'verified', receipt: state.phase.receipt, result: action.result } }
    }
    case 'verify_err': {
      if (state.phase.kind !== 'verifying') return state
      return { ...state, phase: { kind: 'verify_error', receipt: state.phase.receipt, message: action.message } }
    }
    case 'tally_start':
      return { ...state, tallyLoading: true, tallyError: null }
    case 'tally_ok':
      return { ...state, tallyLoading: false, tally: action.tally }
    case 'tally_err':
      return { ...state, tallyLoading: false, tallyError: action.message }
    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeliberateSession(sessionId: string | undefined) {
  const [state, dispatch] = useReducer(deliberateReducer, DELIBERATE_INITIAL)

  /** Cast a ballot. Can only be called once per voter (server enforces). */
  const cast = useCallback(
    async (choice: string): Promise<boolean> => {
      if (!sessionId) return false
      dispatch({ type: 'cast_start' })
      const res = await api<{ receipt: DeliberateReceipt }>(
        `/api/sessions/${encodeURIComponent(sessionId)}/deliberate/cast`,
        { method: 'POST', body: { choice } },
      )
      if (res.ok) {
        dispatch({ type: 'cast_ok', receipt: res.data.receipt })
        return true
      }
      dispatch({ type: 'cast_err', message: res.error.message })
      return false
    },
    [sessionId],
  )

  /** Verify the held receipt against the merkle ledger. */
  const verify = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false
    const phase = state.phase
    if (phase.kind !== 'cast_done' && phase.kind !== 'verified' && phase.kind !== 'verify_error') return false
    const { ballotNonce, commitment, choice } = (phase as { receipt: DeliberateReceipt }).receipt
    dispatch({ type: 'verify_start' })
    const res = await api<DeliberateVerifyResult>(
      `/api/sessions/${encodeURIComponent(sessionId)}/deliberate/verify`,
      { method: 'POST', body: { ballotNonce, commitment, choice } },
    )
    if (res.ok) {
      dispatch({ type: 'verify_ok', result: res.data })
      return res.data.verified
    }
    dispatch({ type: 'verify_err', message: res.error.message })
    return false
  }, [sessionId, state.phase])

  /** Fetch the public tally (post-close). */
  const fetchTally = useCallback(async () => {
    if (!sessionId) return
    dispatch({ type: 'tally_start' })
    const res = await api<DeliberateTally>(
      `/api/sessions/${encodeURIComponent(sessionId)}/deliberate/tally`,
    )
    if (res.ok) dispatch({ type: 'tally_ok', tally: res.data })
    else dispatch({ type: 'tally_err', message: res.error.message })
  }, [sessionId])

  return { state, cast, verify, fetchTally }
}
