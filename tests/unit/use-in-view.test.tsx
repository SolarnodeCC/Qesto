// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useInView } from '../../src/hooks/useInView'

// React 19 requires this flag to use `act` outside a test renderer.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function render(node: React.ReactElement) {
  act(() => {
    root.render(node)
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  // Clean up any stub left on the global.
  delete (globalThis as Record<string, unknown>).IntersectionObserver
})

// Minimal IntersectionObserver stub that lets a test fire the callback.
class FakeIO {
  static instances: FakeIO[] = []
  cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
    FakeIO.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
  fire(isIntersecting: boolean) {
    act(() => {
      this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    })
  }
}

describe('useInView (Finding 5 #3 scroll reveal)', () => {
  it('starts inView=true when IntersectionObserver is unavailable (progressive enhancement)', () => {
    // jsdom has no IntersectionObserver by default, and no matchMedia → content
    // must be visible immediately so no-JS / crawler paths are never hidden.
    let result: ReturnType<typeof useInView> | undefined
    function Probe() {
      result = useInView()
      return null
    }
    render(<Probe />)
    expect(result?.inView).toBe(true)
  })

  it('starts hidden then reveals on first intersection when observer is supported', () => {
    ;(globalThis as Record<string, unknown>).IntersectionObserver = FakeIO as unknown
    FakeIO.instances = []

    let result: { ref: React.RefObject<HTMLDivElement | null>; inView: boolean } | undefined
    function Probe() {
      result = useInView<HTMLDivElement>()
      return <div ref={result.ref} />
    }
    render(<Probe />)

    expect(result?.inView).toBe(false)
    expect(FakeIO.instances).toHaveLength(1)

    FakeIO.instances[0].fire(true)
    expect(result?.inView).toBe(true)
  })
})
