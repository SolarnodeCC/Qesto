/**
 * CANVAS-THEME-01 / FE-AAA-GA-01 — contrast token validation (S88)
 *
 * Verifies that each theme's text/background combination meets the stated
 * WCAG level without a browser — uses pure luminance maths.
 *
 * WCAG formula:
 *   L = 0.2126R + 0.7152G + 0.0722B  (linearised)
 *   contrast = (L1 + 0.05) / (L2 + 0.05)  where L1 ≥ L2
 *
 * All AA themes must have text:bg ≥ 4.5:1.
 * The high-contrast theme must have text:bg ≥ 7:1 (AAA / SC 1.4.6).
 */
import { describe, it, expect } from 'vitest'

function linearise(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(...hexToRgb(hex1))
  const l2 = relativeLuminance(...hexToRgb(hex2))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Token values mirrored from src/styles/canvas-themes.css
const THEMES = {
  default: { text: '#0A0F1E', bg: '#FFFFFF', accent: '#0F766E' }, // teal-700, 5.47:1 on white
  dark: { text: '#F0F2F8', bg: '#0A0F1E', accent: '#2DD4BF' },
  'high-contrast': { text: '#000000', bg: '#FFFFFF', accent: '#005C5C' },
  'brand-neutral': { text: '#E8EAF0', bg: '#1C243A', accent: '#34D399' },
} as const

describe('Canvas theme colour contrast — WCAG AA (4.5:1 minimum)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: text on background ≥ 4.5:1`, () => {
      const ratio = contrastRatio(t.text, t.bg)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it(`${name}: accent on background ≥ 4.5:1`, () => {
      const ratio = contrastRatio(t.accent, t.bg)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('Canvas theme colour contrast — WCAG AAA (7:1) for high-contrast', () => {
  it('high-contrast: text on background ≥ 7:1 (SC 1.4.6)', () => {
    const { text, bg } = THEMES['high-contrast']
    const ratio = contrastRatio(text, bg)
    expect(ratio).toBeGreaterThanOrEqual(7)
  })

  it('high-contrast: accent on background ≥ 7:1 (SC 1.4.6)', () => {
    const { accent, bg } = THEMES['high-contrast']
    const ratio = contrastRatio(accent, bg)
    expect(ratio).toBeGreaterThanOrEqual(7)
  })
})

describe('Canvas theme colour contrast — other themes text ≥ 7:1 (documented as AAA targets)', () => {
  it('default: text (#0A0F1E) on white achieves ≥ 18:1 (far above AAA)', () => {
    const ratio = contrastRatio('#0A0F1E', '#FFFFFF')
    expect(ratio).toBeGreaterThanOrEqual(18)
  })

  it('dark: text (#F0F2F8) on dark-bg achieves well above 7:1', () => {
    const ratio = contrastRatio('#F0F2F8', '#0A0F1E')
    expect(ratio).toBeGreaterThanOrEqual(7)
  })

  it('brand-neutral: text (#E8EAF0) on navy achieves well above 7:1', () => {
    const ratio = contrastRatio('#E8EAF0', '#1C243A')
    expect(ratio).toBeGreaterThanOrEqual(7)
  })
})
