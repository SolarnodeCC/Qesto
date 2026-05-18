import { describe, expect, it } from 'vitest'
import {
  rejectDraftForResults,
  requireClosedOrArchivedForInsights,
  requireDraft,
  requireEditableTitle,
  requireFound,
  requireLiveForClose,
  requireLiveForWebSocket,
} from '../../functions/api/lib/session-lifecycle'
import type { Session } from '../../functions/api/types'

function sess(overrides: Partial<Session> & Pick<Session, 'id' | 'status'>): Session {
  return {
    owner_id: 'owner',
    code: 'ABC123',
    title: 't',
    anonymity: 'full',
    vote_policy: 'once',
    session_mode: 'reflection',
    created_at: 1,
    started_at: null,
    closed_at: null,
    archived_at: null,
    ...overrides,
  }
}

describe('session-lifecycle', () => {
  it('requireFound returns not_found when null', () => {
    const r = requireFound(null)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('not_found')
      expect(r.error.status).toBe(404)
    }
  })

  it('requireDraft respects reason-specific messages', () => {
    const live = sess({ id: '1', status: 'live' })
    const patch = requireDraft(live, 'patch')
    expect(patch.ok).toBe(false)
    if (!patch.ok) expect(patch.error.message).toContain('edited via REST')

    const start = requireDraft(live, 'start')
    expect(start.ok).toBe(false)
    if (!start.ok) expect(start.error.message).toBe('Only DRAFT sessions can be started')

    const reorder = requireDraft(live, 'reorder')
    expect(reorder.ok).toBe(false)
    if (!reorder.ok) expect(reorder.error.message).toContain('reordered')
  })

  it('requireLiveForClose vs requireLiveForWebSocket codes differ', () => {
    const draft = sess({ id: '1', status: 'draft' })
    const close = requireLiveForClose(draft)
    expect(close.ok).toBe(false)
    if (!close.ok) expect(close.error.code).toBe('conflict')

    const ws = requireLiveForWebSocket(draft)
    expect(ws.ok).toBe(false)
    if (!ws.ok) expect(ws.error.code).toBe('not_live')
  })

  it('rejectDraftForResults blocks draft only', () => {
    const draft = sess({ id: '1', status: 'draft' })
    expect(rejectDraftForResults(draft).ok).toBe(false)

    const closed = sess({ id: '2', status: 'closed' })
    expect(rejectDraftForResults(closed).ok).toBe(true)
  })

  it('requireClosedOrArchivedForInsights allows closed and archived', () => {
    expect(requireClosedOrArchivedForInsights(sess({ id: '1', status: 'live' })).ok).toBe(false)
    expect(requireClosedOrArchivedForInsights(sess({ id: '2', status: 'closed' })).ok).toBe(true)
    expect(requireClosedOrArchivedForInsights(sess({ id: '3', status: 'archived' })).ok).toBe(true)
  })

  it('requireEditableTitle allows draft, closed, and archived', () => {
    expect(requireEditableTitle(sess({ id: '1', status: 'draft' })).ok).toBe(true)
    expect(requireEditableTitle(sess({ id: '2', status: 'closed' })).ok).toBe(true)
    expect(requireEditableTitle(sess({ id: '3', status: 'archived' })).ok).toBe(true)
  })

  it('requireEditableTitle rejects live and energizing', () => {
    const live = requireEditableTitle(sess({ id: '1', status: 'live' }))
    expect(live.ok).toBe(false)
    if (!live.ok) expect(live.error.message).toContain('active')

    const energizing = requireEditableTitle(sess({ id: '2', status: 'energizing' }))
    expect(energizing.ok).toBe(false)
  })
})
