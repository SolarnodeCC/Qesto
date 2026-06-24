// @vitest-environment jsdom
//
// HeroPollPreview (Finding 4) — landing-page hero "live results" preview.
//
// Coverage:
//  1. Renders the fake Present-mode card with the question and option labels.
//  2. The card is aria-hidden (purely illustrative; real claims live in copy).
//  3. Under prefers-reduced-motion the bars render fully populated immediately
//     and no animation timer is scheduled.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import HeroPollPreview from '../../src/components/HeroPollPreview'

let container: HTMLDivElement
let root: Root

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
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

describe('HeroPollPreview', () => {
  it('renders the question and all option labels', () => {
    mockReducedMotion(true)
    act(() => root.render(createElement(HeroPollPreview)))

    expect(container.textContent).toContain('Which sprint goal should we commit to first?')
    expect(container.textContent).toContain('Ship onboarding redesign')
    expect(container.textContent).toContain('Cut checkout drop-off')
    expect(container.textContent).toContain('Pay down API debt')
  })

  it('marks the illustrative card aria-hidden', () => {
    mockReducedMotion(true)
    act(() => root.render(createElement(HeroPollPreview)))

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('shows a populated frame immediately under reduced motion (no zero state)', () => {
    mockReducedMotion(true)
    act(() => root.render(createElement(HeroPollPreview)))

    // Total = 142 + 96 + 48 = 286 responses shown right away, not 0.
    expect(container.textContent).toContain('Live · 286 responses')
  })

  it('starts from an empty tally when motion is allowed', () => {
    mockReducedMotion(false)
    vi.useFakeTimers()
    try {
      act(() => root.render(createElement(HeroPollPreview)))
      expect(container.textContent).toContain('Live · 0 responses')
    } finally {
      vi.useRealTimers()
    }
  })
})
