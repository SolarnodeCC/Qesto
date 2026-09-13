/**
 * useLiveSession — the WebSocket client the whole live session runs on.
 *
 * Before RT-2026-09 this file had no test that executed it: `src/**\/*.ts` was
 * missing from coverage.include, and the project had no way to render a hook.
 * These tests drive the real hook through the real reducer, stubbing only the
 * transport so socket lifecycle and inbound frames can be produced on demand.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReconnectingWsOptions, ReconnectingWsStatus } from '../../src/hooks/liveSessionWsTransport'

// Capture the options the hook hands the transport so the test can act as the
// server. sendWsJson is NOT mocked — the real one is exercised via the fake socket.
let opts: ReconnectingWsOptions | null = null
const closeSpy = vi.fn()

vi.mock('../../src/hooks/liveSessionWsTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/hooks/liveSessionWsTransport')>()
  return {
    ...actual,
    createReconnectingWs: (o: ReconnectingWsOptions) => {
      opts = o
      return { socket: () => null, close: closeSpy }
    },
  }
})

const { useLiveSession } = await import('../../src/hooks/useLiveSession')

/** Minimal stand-in for an OPEN browser socket. */
function openSocket() {
  return { readyState: 1, send: vi.fn() } as unknown as WebSocket & { send: ReturnType<typeof vi.fn> }
}

function frame(type: string, data: Record<string, unknown>) {
  return { data: JSON.stringify({ v: 1, type, data, timestamp: Date.now() }) } as MessageEvent
}

const QUESTION = {
  id: 'q1',
  kind: 'poll',
  prompt: 'What should we prioritise?',
  options: [
    { id: 'a', label: 'Option A' },
    { id: 'b', label: 'Option B' },
  ],
}

beforeEach(() => {
  opts = null
  closeSpy.mockClear()
  localStorage.clear()
  vi.stubGlobal('WebSocket', { OPEN: 1 })
})

describe('useLiveSession — inbound frames drive state', () => {
  it('applies an init frame to session, role and question state', () => {
    const { result } = renderHook(() => useLiveSession('sess_1'))

    act(() => {
      opts!.onStatus({ kind: 'open' } as ReconnectingWsStatus)
      opts!.onMessage(
        frame('init', {
          session: { id: 'sess_1', code: 'ABC123', title: 'Retro', status: 'live' },
          role: 'voter',
          voterId: 'voter_1',
          question: QUESTION,
          questionIndex: 0,
          questionTotal: 3,
          results: { counts: {}, total: 0 },
          participants: 4,
        }),
      )
    })

    expect(result.current.state.connection).toBe('open')
    expect(result.current.state.role).toBe('voter')
    expect(result.current.state.question?.prompt).toBe('What should we prioritise?')
    expect(result.current.state.questionTotal).toBe(3)
    expect(result.current.state.participants).toBe(4)
  })

  it('updates tallies from a results frame', () => {
    const { result } = renderHook(() => useLiveSession('sess_1'))

    act(() => {
      opts!.onMessage(frame('results', { counts: { a: 3, b: 1 }, total: 4 }))
    })

    expect(result.current.state.results).toEqual({ counts: { a: 3, b: 1 }, total: 4 })
  })

  it('ignores a malformed frame instead of throwing', () => {
    const { result } = renderHook(() => useLiveSession('sess_1'))

    act(() => {
      opts!.onMessage({ data: 'not json at all' } as MessageEvent)
      opts!.onMessage(frame('init', { nonsense: true }))
    })

    expect(result.current.state.question).toBeNull()
  })
})

describe('useLiveSession — connection status reaches the user', () => {
  it('surfaces a human-readable countdown while reconnecting', () => {
    const { result } = renderHook(() => useLiveSession('sess_1'))

    act(() => {
      opts!.onStatus({ kind: 'reconnecting', attempt: 2, delayMs: 4000 } as ReconnectingWsStatus)
    })

    expect(result.current.state.connection).toBe('reconnecting')
    expect(result.current.state.reconnectAttempts).toBe(2)
  })

  it('explains what to do once reconnection has given up', () => {
    const { result } = renderHook(() => useLiveSession('sess_1'))

    act(() => {
      opts!.onStatus({ kind: 'failed' } as ReconnectingWsStatus)
    })

    expect(result.current.state.error).toMatch(/unable to connect/i)
  })

  it('closes the socket on unmount', () => {
    const { unmount } = renderHook(() => useLiveSession('sess_1'))
    unmount()
    expect(closeSpy).toHaveBeenCalled()
  })

  it('does not open a socket when disabled', () => {
    renderHook(() => useLiveSession('sess_1', { enabled: false }))
    expect(opts).toBeNull()
  })
})

describe('useLiveSession — voting, including offline', () => {
  it('sends a vote frame naming the current question and option', () => {
    const ws = openSocket()
    const { result } = renderHook(() => useLiveSession('sess_1'))

    act(() => {
      opts!.onSocket!(ws)
      opts!.onMessage(frame('question', { question: QUESTION, index: 0, total: 1 }))
    })
    act(() => {
      result.current.sendVote('a')
    })

    expect(ws.send).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string)
    expect(sent.type).toBe('vote')
    expect(sent.data).toEqual({ questionId: 'q1', optionId: 'a' })
    expect(result.current.state.lastVote).toEqual({ optionId: 'a' })
  })

  it('queues the vote when the socket is down, then flushes it on reconnect', () => {
    const { result } = renderHook(() => useLiveSession('sess_1'))

    // No socket yet — the participant taps anyway (tunnel, flaky venue wifi).
    act(() => {
      opts!.onMessage(frame('question', { question: QUESTION, index: 0, total: 1 }))
    })
    act(() => {
      result.current.sendVote('b')
    })

    // The UI still acknowledges the tap, and the vote is durably queued.
    expect(result.current.state.lastVote).toEqual({ optionId: 'b' })
    expect(localStorage.getItem('qesto:offline-votes')).toContain('"optionId":"b"')

    // Connection returns: the queued vote goes out without the user re-tapping.
    const ws = openSocket()
    act(() => {
      opts!.onOpen!(ws)
    })

    expect(ws.send).toHaveBeenCalledTimes(1)
    const flushed = JSON.parse(ws.send.mock.calls[0][0] as string)
    expect(flushed.data).toEqual({ questionId: 'q1', optionId: 'b' })
  })

  it('does not send a vote before a question has arrived', () => {
    const ws = openSocket()
    const { result } = renderHook(() => useLiveSession('sess_1'))

    act(() => {
      opts!.onSocket!(ws)
    })
    act(() => {
      result.current.sendVote('a')
    })

    expect(ws.send).not.toHaveBeenCalled()
  })
})
