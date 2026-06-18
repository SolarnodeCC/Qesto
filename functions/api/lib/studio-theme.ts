// STUDIO-THEME-01 (ADR-0060) — attach CANVAS theme tokens to authoring drafts.
//
// Pure, side-effect-free. `applyThemeToDrafts(drafts, theme)` returns NEW draft
// objects, each carrying the selected CANVAS theme tokens, so the authoring
// preview inherits brand styling before the session is created. Input drafts are
// never mutated; no storage / network is touched.
//
// The token type aligns to the CANVAS theme contract in
// src/styles/canvas-themes.css (--canvas-bg/-surface/-border/-text/-text-muted/
// -accent/-bar-1..4, font stacks, line-height, letter-spacing). We model the
// minimal subset STUDIO needs to render a faithful preview (colours, fonts,
// tone), keyed by theme name.

import type { AuthoringDraft } from './studio-authoring'

/** Named CANVAS themes (must match canvas-themes.css / useCanvasTheme.ts). */
export const STUDIO_THEME_NAMES = ['default', 'dark', 'high-contrast', 'brand-neutral'] as const
export type StudioThemeName = (typeof STUDIO_THEME_NAMES)[number]

/**
 * Minimal CANVAS theme token set carried onto a draft for preview styling.
 * Mirrors the `--canvas-*` token contract.
 */
export type StudioTheme = {
  name: StudioThemeName
  colors: {
    bg: string
    surface: string
    border: string
    text: string
    textMuted: string
    accent: string
    bars: [string, string, string, string]
  }
  font: {
    body: string
    display: string
    scale: number
    lineHeight: number
    letterSpacing: string
  }
  /** Presentation tone — informs copy/preview density, not colour. */
  tone: 'light' | 'dark'
}

const FONT_BODY = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
const FONT_DISPLAY = 'Syne, ui-sans-serif, system-ui, -apple-system, sans-serif'

/** Built-in CANVAS themes, kept in sync with src/styles/canvas-themes.css. */
export const STUDIO_THEMES: Record<StudioThemeName, StudioTheme> = {
  default: {
    name: 'default',
    colors: {
      bg: '#FFFFFF',
      surface: '#FAFAFA',
      border: '#E5E5E5',
      text: '#0A0F1E',
      textMuted: '#404040',
      accent: '#0F766E',
      bars: ['#0F766E', '#6D28D9', '#B45309', '#0369A1'],
    },
    font: { body: FONT_BODY, display: FONT_DISPLAY, scale: 1, lineHeight: 1.6, letterSpacing: '0em' },
    tone: 'light',
  },
  dark: {
    name: 'dark',
    colors: {
      bg: '#0A0F1E',
      surface: '#151C2E',
      border: '#1E2A45',
      text: '#F0F2F8',
      textMuted: '#A8B3CC',
      accent: '#2DD4BF',
      bars: ['#2DD4BF', '#A78BFA', '#FCD34D', '#38BDF8'],
    },
    font: { body: FONT_BODY, display: FONT_DISPLAY, scale: 1, lineHeight: 1.6, letterSpacing: '0em' },
    tone: 'dark',
  },
  'high-contrast': {
    name: 'high-contrast',
    colors: {
      bg: '#FFFFFF',
      surface: '#F5F5F5',
      border: '#000000',
      text: '#000000',
      textMuted: '#000000',
      accent: '#005C5C',
      bars: ['#005C5C', '#3B0764', '#451A03', '#0C4A6E'],
    },
    font: { body: FONT_BODY, display: FONT_DISPLAY, scale: 1, lineHeight: 1.75, letterSpacing: '0.01em' },
    tone: 'light',
  },
  'brand-neutral': {
    name: 'brand-neutral',
    colors: {
      bg: '#1C243A',
      surface: '#232D48',
      border: '#2E3A56',
      text: '#E8EAF0',
      textMuted: '#A8B3CC',
      accent: '#34D399',
      bars: ['#34D399', '#818CF8', '#FBBF24', '#60A5FA'],
    },
    font: { body: FONT_BODY, display: FONT_DISPLAY, scale: 1, lineHeight: 1.6, letterSpacing: '0em' },
    tone: 'dark',
  },
}

/** Resolve a theme id to its token set; returns null for unknown ids. */
export function resolveStudioTheme(themeId: string | undefined): StudioTheme | null {
  if (!themeId) return null
  return (STUDIO_THEMES as Record<string, StudioTheme>)[themeId] ?? null
}

/** A draft with its preview theme tokens attached (non-destructive). */
export type ThemedDraft = AuthoringDraft & { theme: StudioTheme }

/**
 * Attach the selected CANVAS theme tokens to each draft so the preview inherits
 * brand styling. PURE: returns new objects, never mutates `drafts` or `theme`.
 */
export function applyThemeToDrafts(drafts: AuthoringDraft[], theme: StudioTheme): ThemedDraft[] {
  return drafts.map((draft) => ({ ...draft, theme }))
}
