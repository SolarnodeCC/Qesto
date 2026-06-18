// STUDIO-THEME-01 — unit tests for pure CANVAS theme application to drafts.
import { describe, expect, it } from 'vitest'
import {
  applyThemeToDrafts,
  resolveStudioTheme,
  STUDIO_THEMES,
  STUDIO_THEME_NAMES,
} from '../../functions/api/lib/studio-theme'
import type { AuthoringDraft } from '../../functions/api/lib/studio-authoring'

const drafts: AuthoringDraft[] = [
  { id: 'a', kind: 'poll', prompt: 'Q1?', options: [{ id: 'o1', label: 'X' }] },
  { id: 'b', kind: 'open', prompt: 'Q2?', options: [] },
]

describe('resolveStudioTheme', () => {
  it('resolves each known theme name', () => {
    for (const name of STUDIO_THEME_NAMES) {
      expect(resolveStudioTheme(name)?.name).toBe(name)
    }
  })

  it('returns null for unknown / undefined ids', () => {
    expect(resolveStudioTheme('nope')).toBeNull()
    expect(resolveStudioTheme(undefined)).toBeNull()
    expect(resolveStudioTheme('')).toBeNull()
  })
})

describe('applyThemeToDrafts', () => {
  it('attaches the theme tokens to every draft', () => {
    const theme = STUDIO_THEMES.dark
    const themed = applyThemeToDrafts(drafts, theme)
    expect(themed).toHaveLength(2)
    for (const d of themed) {
      expect(d.theme).toBe(theme)
      expect(d.theme.colors.bg).toBe('#0A0F1E')
      expect(d.theme.tone).toBe('dark')
    }
  })

  it('preserves draft fields', () => {
    const themed = applyThemeToDrafts(drafts, STUDIO_THEMES.default)
    expect(themed[0].id).toBe('a')
    expect(themed[0].prompt).toBe('Q1?')
    expect(themed[0].options).toEqual([{ id: 'o1', label: 'X' }])
  })

  it('is pure — does not mutate the input drafts', () => {
    const snapshot = JSON.stringify(drafts)
    applyThemeToDrafts(drafts, STUDIO_THEMES.default)
    expect(JSON.stringify(drafts)).toBe(snapshot)
    expect('theme' in drafts[0]).toBe(false)
  })

  it('returns an empty array for empty input', () => {
    expect(applyThemeToDrafts([], STUDIO_THEMES.default)).toEqual([])
  })
})

describe('theme token contract', () => {
  it('every theme exposes the full CANVAS token set', () => {
    for (const name of STUDIO_THEME_NAMES) {
      const t = STUDIO_THEMES[name]
      expect(t.colors.bg).toMatch(/^#[0-9A-F]{6}$/i)
      expect(t.colors.accent).toMatch(/^#[0-9A-F]{6}$/i)
      expect(t.colors.bars).toHaveLength(4)
      expect(t.font.body).toContain('Inter')
      expect(t.font.display).toContain('Syne')
      expect(['light', 'dark']).toContain(t.tone)
    }
  })

  it('high-contrast uses extra leading (WCAG 1.4.8)', () => {
    expect(STUDIO_THEMES['high-contrast'].font.lineHeight).toBeGreaterThan(1.6)
  })
})
