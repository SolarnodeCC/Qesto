// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useCountUp } from '../../src/hooks/useCountUp'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function renderCountUp(initial: number) {
  let shown = NaN
  let target = initial
  function Probe() {
    shown = useCountUp(target)
    return null
  }
  act(() => root.render(<Probe />))
  return {
    get: () => shown,
    retarget: (next: number) => {
      target = next
      act(() => root.render(<Probe />))
    },
  }
}

describe('useCountUp (Finding 5 #1 animated numbers)', () => {
  it('returns the target immediately under prefers-reduced-motion', () => {
    mockMatchMedia(true)
    const h = renderCountUp(42)
    expect(h.get()).toBe(42)
    // Re-targeting also resolves instantly with no tween.
    h.retarget(99)
    expect(h.get()).toBe(99)
  })

  it('lands on the target value when motion is allowed', () => {
    mockMatchMedia(false)
    // Drive rAF synchronously to the end of the tween for determinism.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now() + 10_000)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const h = renderCountUp(0)
    expect(h.get()).toBe(0)
    h.retarget(73)
    expect(h.get()).toBe(73)
  })
})
