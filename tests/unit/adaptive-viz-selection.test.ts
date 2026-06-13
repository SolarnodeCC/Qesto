/**
 * CANVAS-ADAPTIVE-VIZ-01 — adaptive viz selection logic unit tests (S88)
 *
 * Tests the selection rule without mounting React:
 *   - 0 options   → empty/waiting branch
 *   - word_cloud / open → WordCloudViz branch
 *   - 1–2 options → DonutViz branch  (≤ DONUT_MAX = 2)
 *   - 3–6 options → VBarChart branch  (default)
 *   - 7+ options  → HBarChart branch  (> HORIZONTAL_THRESHOLD = 6)
 *   - tallyHidden  → hidden branch regardless of kind/count
 */
import { describe, it, expect } from 'vitest'
import type { VizOption } from '../../src/components/AdaptiveVizResults'

/** Mirrors the selection logic in AdaptiveVizResults without React */
type VizKind = 'word-cloud' | 'donut' | 'hbar' | 'vbar' | 'hidden' | 'empty'

function selectViz(
  options: VizOption[],
  questionKind: string | undefined,
  tallyHidden: boolean,
): VizKind {
  if (tallyHidden) return 'hidden'
  if (options.length === 0) return 'empty'
  if (questionKind === 'word_cloud' || questionKind === 'open') return 'word-cloud'
  if (options.length <= 2) return 'donut'
  if (options.length > 6) return 'hbar'
  return 'vbar'
}

function makeOptions(n: number): VizOption[] {
  return Array.from({ length: n }, (_, i) => ({ id: `o${i}`, label: `Option ${i + 1}`, count: i * 2 }))
}

describe('Adaptive viz selection rule', () => {
  it('returns "empty" for 0 options', () => {
    expect(selectViz([], 'poll', false)).toBe('empty')
  })

  it('returns "word-cloud" for word_cloud kind regardless of option count', () => {
    expect(selectViz(makeOptions(5), 'word_cloud', false)).toBe('word-cloud')
    expect(selectViz(makeOptions(0), 'word_cloud', false)).toBe('empty') // empty wins first
    expect(selectViz(makeOptions(1), 'word_cloud', false)).toBe('word-cloud')
  })

  it('returns "word-cloud" for open kind', () => {
    expect(selectViz(makeOptions(3), 'open', false)).toBe('word-cloud')
  })

  it('returns "donut" for 1 option', () => {
    expect(selectViz(makeOptions(1), 'poll', false)).toBe('donut')
  })

  it('returns "donut" for 2 options (binary choice)', () => {
    expect(selectViz(makeOptions(2), 'poll', false)).toBe('donut')
  })

  it('returns "vbar" for 3 options', () => {
    expect(selectViz(makeOptions(3), 'poll', false)).toBe('vbar')
  })

  it('returns "vbar" for 6 options (boundary)', () => {
    expect(selectViz(makeOptions(6), 'poll', false)).toBe('vbar')
  })

  it('returns "hbar" for 7 options (> HORIZONTAL_THRESHOLD)', () => {
    expect(selectViz(makeOptions(7), 'poll', false)).toBe('hbar')
  })

  it('returns "hbar" for many options', () => {
    expect(selectViz(makeOptions(15), 'ranking', false)).toBe('hbar')
  })

  it('returns "hidden" when tallyHidden is true, ignoring kind and count', () => {
    expect(selectViz(makeOptions(4), 'poll', true)).toBe('hidden')
    expect(selectViz(makeOptions(0), 'word_cloud', true)).toBe('hidden')
    expect(selectViz(makeOptions(10), 'open', true)).toBe('hidden')
  })
})

describe('VizOption typing', () => {
  it('VizOption has id, label and count fields', () => {
    const opt: VizOption = { id: 'x', label: 'Test', count: 42 }
    expect(opt.id).toBe('x')
    expect(opt.label).toBe('Test')
    expect(opt.count).toBe(42)
  })
})

describe('Donut pct calculation', () => {
  it('calculates percentage correctly for 2-option binary', () => {
    const opts: VizOption[] = [
      { id: 'a', label: 'Yes', count: 7 },
      { id: 'b', label: 'No', count: 3 },
    ]
    const total = 10
    const pcts = opts.map((o) => Math.round((o.count / total) * 100))
    expect(pcts).toEqual([70, 30])
  })

  it('handles zero-vote state without dividing by zero', () => {
    const opts: VizOption[] = [
      { id: 'a', label: 'Yes', count: 0 },
      { id: 'b', label: 'No', count: 0 },
    ]
    const total = 0
    const pcts = opts.map((o) => (total === 0 ? 0 : Math.round((o.count / total) * 100)))
    expect(pcts).toEqual([0, 0])
  })
})

describe('Bar chart pct calculation', () => {
  it('normalises bar heights relative to max, not total', () => {
    const opts: VizOption[] = [
      { id: 'a', label: 'A', count: 10 },
      { id: 'b', label: 'B', count: 5 },
      { id: 'c', label: 'C', count: 0 },
    ]
    const max = Math.max(...opts.map((o) => o.count))
    const heights = opts.map((o) => (max === 0 ? 0 : Math.round((o.count / max) * 100)))
    expect(heights).toEqual([100, 50, 0])
  })
})
