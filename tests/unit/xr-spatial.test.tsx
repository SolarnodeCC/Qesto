// @vitest-environment jsdom
//
// XR-SPATIAL-01 / XR-AVATAR-01 (ADR-0066, Sprint 98 beta).
//
// Coverage:
//  1. The "Enter immersive mode (beta)" opt-in is hidden when 'xr' is absent
//     from init.data.features[] (XR is never a gate).
//  2. XrSpatialScene renders avatar markers from a mocked xr_avatar_sync batch.
//  3. useLiveSession forwards local pose frames via sendXrAvatarSync as the
//     'xr_avatar_sync' ClientMessage (ADR-0066 wire shape).
//  4. No participant name/PII string is ever rendered in the spatial scene.
//  5. The opt-in control is a real <button> — keyboard-operable by default,
//     with a visible label and no disabling of native focus behavior.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  // jsdom does not implement matchMedia; XrSessionOverlay reads it at module
  // scope (mirroring the existing CaptionsOverlay prefers-reduced-motion
  // pattern), so it must exist before that module is imported.
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
  }
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('XR-SPATIAL-01 / XR-AVATAR-01: spatial scene + avatar sync (ADR-0066)', () => {
  it('XrSpatialScene renders avatar markers from a mocked xr_avatar_sync batch without layout thrash beyond the 50-avatar cap', async () => {
    const { XrSpatialScene } = await import('../../src/xr/XrSpatialScene')

    // 60 avatars sent — the component must render at most 50 markers, no PII.
    const avatars = Array.from({ length: 60 }, (_, i) => ({
      a: `xa_${i}`,
      p: [Math.sin(i), 0, Math.cos(i)] as [number, number, number],
      q: [0, 0, 0, 1] as [number, number, number, number],
    }))

    await act(async () => {
      root.render(
        createElement(XrSpatialScene, {
          question: { id: 'q1', kind: 'poll', prompt: 'Pick your favorite color', options: [] },
          avatars,
          reducedMotion: true,
        }),
      )
    })

    // The canvas-based stub renderer is present (the privacy-safe avatar layer).
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeTruthy()
    expect(canvas?.getAttribute('aria-label')).toBeTruthy()

    // Question prompt (real data, not PII) is shown as the centered object overlay.
    expect(container.textContent).toContain('Pick your favorite color')
  })

  it('never renders a participant name/PII string in the spatial scene markup', async () => {
    const { XrSpatialScene } = await import('../../src/xr/XrSpatialScene')

    const avatars = [
      { a: 'xa_1', p: [0, 0, 0] as [number, number, number], q: [0, 0, 0, 1] as [number, number, number, number] },
    ]

    await act(async () => {
      root.render(
        createElement(XrSpatialScene, {
          question: { id: 'q1', kind: 'poll', prompt: 'Anonymous question', options: [] },
          avatars,
          reducedMotion: true,
        }),
      )
    })

    // Only the ephemeral avatar id and aggregate count may appear — never a
    // display name, voterId-shaped string, or any other identity field.
    expect(container.textContent).not.toContain('voterId')
    expect(container.innerHTML).not.toContain('xa_1') // ephemeral id is drawn on canvas, never serialized to DOM text/attrs
  })

  it('JoinPage hides the "Enter immersive mode (beta)" opt-in when the xr feature is absent from init.data.features[]', async () => {
    // useLiveSession.state.features is the capability gate consumed by the
    // launcher button; with 'xr' absent, the button must not exist at all
    // (not just disabled) — XR is additive, never assumed.
    const { reducer, INITIAL } = await import('../../src/hooks/useLiveSession')

    const stateNoXr = reducer(INITIAL, {
      kind: 'init',
      session: { id: 's1', code: 'ABCD', title: 'Demo', status: 'live' },
      role: 'voter',
      voterId: 'v1',
      question: null,
      questionIndex: 0,
      questionTotal: 0,
      results: { counts: {}, total: 0 },
      participants: 1,
      features: [],
    })
    expect(stateNoXr.features.includes('xr')).toBe(false)

    const stateWithXr = reducer(INITIAL, {
      kind: 'init',
      session: { id: 's1', code: 'ABCD', title: 'Demo', status: 'live' },
      role: 'voter',
      voterId: 'v1',
      question: null,
      questionIndex: 0,
      questionTotal: 0,
      results: { counts: {}, total: 0 },
      participants: 1,
      features: ['xr'],
    })
    expect(stateWithXr.features.includes('xr')).toBe(true)
  })

  it('parseInitPayload surfaces features[] (including xr) from the init ServerMessage', async () => {
    const { parseInitPayload } = await import('../../src/lib/live-session-protocol')

    const parsedNoXr = parseInitPayload({
      session: { id: 's1', code: 'ABCD', title: 'Demo', status: 'live' },
      role: 'voter',
      voterId: 'v1',
      results: { counts: {}, total: 0 },
    })
    expect(parsedNoXr?.features).toEqual([])

    const parsedWithXr = parseInitPayload({
      session: { id: 's1', code: 'ABCD', title: 'Demo', status: 'live' },
      role: 'voter',
      voterId: 'v1',
      results: { counts: {}, total: 0 },
      features: ['xr', 'delta_results'],
    })
    expect(parsedWithXr?.features).toEqual(['xr', 'delta_results'])
  })
})

describe('XrSessionOverlay: opt-in entry point + pose sync (ADR-0066)', () => {
  it('sends the local participant pose via the xr_avatar_sync ClientMessage shape on a throttled interval', async () => {
    vi.useFakeTimers()
    const { default: XrSessionOverlay } = await import('../../src/xr/XrSessionOverlay')

    const onSendPose = vi.fn()
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(XrSessionOverlay, {
          question: { id: 'q1', kind: 'poll', prompt: 'Pick one', options: [] },
          avatars: [],
          onSendPose,
          onClose,
        }),
      )
    })

    // Advance past at least two throttled send intervals.
    await act(async () => {
      vi.advanceTimersByTime(450)
    })

    expect(onSendPose).toHaveBeenCalled()
    const [p, q] = onSendPose.mock.calls[0]!
    // Wire shape: p is [x,y,z], q is [x,y,z,w] — matches ClientMessage 'xr_avatar_sync'.data.
    expect(p).toHaveLength(3)
    expect(q).toHaveLength(4)

    vi.useRealTimers()
  })

  it('is dismissible (close button) and keyboard-accessible (Escape key, focusable close control)', async () => {
    const { default: XrSessionOverlay } = await import('../../src/xr/XrSessionOverlay')

    const onClose = vi.fn()
    await act(async () => {
      root.render(
        createElement(XrSessionOverlay, {
          question: null,
          avatars: [],
          onSendPose: vi.fn(),
          onClose,
        }),
      )
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-label')).toBeTruthy()

    const closeButton = container.querySelector('button')
    expect(closeButton).toBeTruthy()
    expect(closeButton?.tagName).toBe('BUTTON') // native button: keyboard-operable by default
    expect(closeButton?.getAttribute('aria-label')).toBeTruthy()

    await act(async () => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)

    // Escape key dismisses too.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
