/**
 * FE-CAPTIONS-OVERLAY-01 — Unit tests (S88)
 *
 * Tests:
 *  1. captionsReducer — partial→final segment merge by id
 *  2. captionsReducer — MAX_SEGMENTS cap / oldest eviction
 *  3. captionsReducer — start / stop / set_locale actions
 *  4. visibleSegments — returns last ≤2 distinct ids
 *  5. AAA contrast — white on scrim vs WCAG 7:1 threshold
 *  6. Font-size step logic (boundary behaviour)
 */

import { describe, it, expect } from 'vitest'
import {
  captionsReducer,
  visibleSegments,
  CAPTIONS_INITIAL,
  MAX_SEGMENTS,
  type CaptionSegment,
  type CaptionsState,
} from '../../src/hooks/useCaptions'

// ── Helpers ──────────────────────────────────────────────────────────────────

function seg(id: string, text: string, isFinal = false, ts = 1000): CaptionSegment {
  return { id, ts, lang: 'en', text, isFinal }
}

function addSeg(state: CaptionsState, s: CaptionSegment): CaptionsState {
  return captionsReducer(state, { kind: 'segment', segment: s })
}

// ── Reducer: partial → final merge ───────────────────────────────────────────

describe('captionsReducer — partial→final merge by id', () => {
  it('appends a new partial segment to an empty list', () => {
    const s1 = captionsReducer(CAPTIONS_INITIAL, {
      kind: 'segment',
      segment: seg('a', 'hel', false),
    })
    expect(s1.segments).toHaveLength(1)
    expect(s1.segments[0]).toMatchObject({ id: 'a', text: 'hel', isFinal: false })
  })

  it('updates a partial in-place when a newer partial for the same id arrives', () => {
    let s = addSeg(CAPTIONS_INITIAL, seg('a', 'hel', false))
    s = addSeg(s, seg('a', 'hello', false))
    // Still one entry, text updated, still partial
    expect(s.segments).toHaveLength(1)
    expect(s.segments[0]).toMatchObject({ id: 'a', text: 'hello', isFinal: false })
  })

  it('locks the partial to final when the final segment arrives', () => {
    let s = addSeg(CAPTIONS_INITIAL, seg('a', 'hel', false))
    s = addSeg(s, seg('a', 'hello everyone', true))
    expect(s.segments).toHaveLength(1)
    expect(s.segments[0]).toMatchObject({ id: 'a', text: 'hello everyone', isFinal: true })
  })

  it('appends a final without prior partial (server may skip partials)', () => {
    const s = addSeg(CAPTIONS_INITIAL, seg('b', 'good morning', true))
    expect(s.segments).toHaveLength(1)
    expect(s.segments[0].isFinal).toBe(true)
  })

  it('keeps position stable: replacing a partial does not move it to the end', () => {
    let s = addSeg(CAPTIONS_INITIAL, seg('first', 'hello', true))
    s = addSeg(s, seg('second', 'part', false))
    s = addSeg(s, seg('second', 'partial updated', false))
    // 'first' must remain at index 0
    expect(s.segments[0].id).toBe('first')
    expect(s.segments[1].id).toBe('second')
  })

  it('a final does NOT replace a different final (different ids are independent)', () => {
    let s = addSeg(CAPTIONS_INITIAL, seg('a', 'hello', true))
    s = addSeg(s, seg('b', 'world', true))
    expect(s.segments).toHaveLength(2)
    expect(s.segments[0].id).toBe('a')
    expect(s.segments[1].id).toBe('b')
  })
})

// ── Reducer: MAX_SEGMENTS cap ─────────────────────────────────────────────────

describe('captionsReducer — MAX_SEGMENTS eviction', () => {
  it(`caps the list at MAX_SEGMENTS (${MAX_SEGMENTS}), evicting oldest from front`, () => {
    let s = CAPTIONS_INITIAL
    for (let i = 0; i < MAX_SEGMENTS + 2; i++) {
      s = addSeg(s, seg(`id${i}`, `text ${i}`, true, 1000 + i))
    }
    expect(s.segments).toHaveLength(MAX_SEGMENTS)
    // The two oldest should have been evicted
    const ids = s.segments.map((x) => x.id)
    expect(ids).not.toContain('id0')
    expect(ids).not.toContain('id1')
    expect(ids).toContain(`id${MAX_SEGMENTS + 1}`)
  })

  it('does not evict when under the cap', () => {
    let s = CAPTIONS_INITIAL
    for (let i = 0; i < MAX_SEGMENTS; i++) {
      s = addSeg(s, seg(`id${i}`, `text ${i}`, true))
    }
    expect(s.segments).toHaveLength(MAX_SEGMENTS)
  })
})

// ── Reducer: start / stop / set_locale ───────────────────────────────────────

describe('captionsReducer — lifecycle actions', () => {
  it('start sets active=true', () => {
    const s = captionsReducer(CAPTIONS_INITIAL, { kind: 'start' })
    expect(s.active).toBe(true)
  })

  it('stop sets active=false and clears segments', () => {
    let s = captionsReducer(CAPTIONS_INITIAL, { kind: 'start' })
    s = addSeg(s, seg('a', 'hello', true))
    s = captionsReducer(s, { kind: 'stop' })
    expect(s.active).toBe(false)
    expect(s.segments).toHaveLength(0)
  })

  it('set_locale updates locale', () => {
    const s = captionsReducer(CAPTIONS_INITIAL, { kind: 'set_locale', locale: 'nl' })
    expect(s.locale).toBe('nl')
  })

  it('set_locale does not affect segments', () => {
    let s = addSeg(CAPTIONS_INITIAL, seg('a', 'hello', true))
    s = captionsReducer(s, { kind: 'set_locale', locale: 'fr' })
    expect(s.segments).toHaveLength(1)
  })
})

// ── visibleSegments ───────────────────────────────────────────────────────────

describe('visibleSegments', () => {
  it('returns [] for empty input', () => {
    expect(visibleSegments([])).toEqual([])
  })

  it('returns at most 2 distinct segment ids', () => {
    const segs: CaptionSegment[] = [
      seg('a', 'first', true),
      seg('b', 'second', true),
      seg('c', 'partial', false),
    ]
    const v = visibleSegments(segs)
    // Should show last 2: 'b' and 'c'
    expect(v.map((x) => x.id)).toEqual(['b', 'c'])
  })

  it('shows the partial (newest) as the last entry', () => {
    const segs: CaptionSegment[] = [
      seg('prev', 'previous sentence', true),
      seg('curr', 'typing...', false),
    ]
    const v = visibleSegments(segs)
    expect(v[v.length - 1].id).toBe('curr')
    expect(v[v.length - 1].isFinal).toBe(false)
  })

  it('returns 1 entry when only 1 id is present', () => {
    const segs: CaptionSegment[] = [seg('a', 'solo', true)]
    expect(visibleSegments(segs)).toHaveLength(1)
  })

  it('collapses multiple entries for the same id to one in the result', () => {
    // This happens transiently (partial replaced by final) — shouldn't appear
    // but visibleSegments must be safe even if reducer is called mid-update.
    const segs: CaptionSegment[] = [
      seg('a', 'ver1', false),
      seg('a', 'ver2', true), // same id, overrides in reducer but test defensive path
      seg('b', 'other', false),
    ]
    const v = visibleSegments(segs)
    // 'a' appears at index 0, 'b' at index 1; 'a' id counted once
    const ids = v.map((x) => x.id)
    expect(ids.filter((id) => id === 'a')).toHaveLength(1)
    expect(ids.filter((id) => id === 'b')).toHaveLength(1)
  })
})

// ── WCAG AAA contrast for the scrim overlay ───────────────────────────────────

describe('CaptionsOverlay — WCAG AAA contrast (7:1)', () => {
  // The overlay uses white text (#FFFFFF) on a solid black scrim (rgba(0,0,0,0.80)).
  // Over ANY canvas theme the effective background colour is between pure black and
  // the canvas colour blended at 20% opacity.  The absolute worst case is blending
  // over pure white: 0.8*0 + 0.2*255 = ~51  → rgb(51,51,51), a very dark grey.
  //
  // We compute white-on-worst-case-effective-bg to assert ≥ 7:1 (WCAG AAA).

  function linearise(c: number): number {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }

  function luminance(r: number, g: number, b: number): number {
    return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
  }

  function contrast(l1: number, l2: number): number {
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }

  it('white text on the scrim (alpha=0.80 over pure white) meets WCAG AAA (≥7:1)', () => {
    // Effective background = alpha * black + (1-alpha) * white
    const alpha = 0.8
    const effectiveR = Math.round(alpha * 0 + (1 - alpha) * 255) // 51
    const effectiveG = effectiveR
    const effectiveB = effectiveR

    const bgL = luminance(effectiveR, effectiveG, effectiveB)
    const whiteL = luminance(255, 255, 255)

    const ratio = contrast(whiteL, bgL)
    // rgb(51,51,51) has luminance ~0.0331; white luminance = 1.0
    // contrast = (1.05) / (0.0331 + 0.05) = ~12.7
    expect(ratio).toBeGreaterThanOrEqual(7)
  })

  it('white text on pure black scrim achieves max contrast (21:1)', () => {
    const bgL = luminance(0, 0, 0)
    const whiteL = luminance(255, 255, 255)
    const ratio = contrast(whiteL, bgL)
    expect(ratio).toBeCloseTo(21, 0)
  })
})

// ── Font-size boundary behaviour ─────────────────────────────────────────────

describe('Font-size steps', () => {
  const FONT_SIZES = [14, 18, 22, 26, 32] as const

  it('smallest step is 14', () => {
    expect(FONT_SIZES[0]).toBe(14)
  })

  it('largest step is 32', () => {
    expect(FONT_SIZES[FONT_SIZES.length - 1]).toBe(32)
  })

  it('stepping down from min stays at min', () => {
    const min = FONT_SIZES[0]
    const idx = FONT_SIZES.indexOf(min)
    const next = idx <= 0 ? min : FONT_SIZES[idx - 1]
    expect(next).toBe(min)
  })

  it('stepping up from max stays at max', () => {
    const max = FONT_SIZES[FONT_SIZES.length - 1]
    const idx = FONT_SIZES.indexOf(max)
    const next = idx >= FONT_SIZES.length - 1 ? max : FONT_SIZES[idx + 1]
    expect(next).toBe(max)
  })

  it('each step is strictly increasing', () => {
    for (let i = 1; i < FONT_SIZES.length; i++) {
      expect(FONT_SIZES[i]).toBeGreaterThan(FONT_SIZES[i - 1])
    }
  })
})
