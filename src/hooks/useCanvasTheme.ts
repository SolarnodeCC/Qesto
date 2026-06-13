/**
 * CANVAS-THEME-01 — useCanvasTheme hook + CanvasThemeContext (S88)
 *
 * Persists the presenter's canvas theme choice in localStorage under
 * 'qesto:canvas-theme'. The provider applies [data-canvas-theme] to the
 * element it wraps; child components consume via context.
 *
 * Themes must match the token sets in src/styles/canvas-themes.css.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export const CANVAS_THEMES = ['default', 'dark', 'high-contrast', 'brand-neutral'] as const
export type CanvasTheme = (typeof CANVAS_THEMES)[number]

const STORAGE_KEY = 'qesto:canvas-theme'

function readStored(): CanvasTheme {
  if (typeof window === 'undefined') return 'default'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return (CANVAS_THEMES as readonly string[]).includes(v ?? '') ? (v as CanvasTheme) : 'default'
}

export interface CanvasThemeContextValue {
  theme: CanvasTheme
  setTheme: (t: CanvasTheme) => void
}

export const CanvasThemeContext = createContext<CanvasThemeContextValue>({
  theme: 'default',
  setTheme: () => undefined,
})

export function useCanvasTheme(): CanvasThemeContextValue {
  return useContext(CanvasThemeContext)
}

/**
 * Returns a stable state + setter pair for use in the CanvasThemeProvider.
 * Kept separate so both Display and Present pages can instantiate their own
 * providers without cross-talk.
 */
export function useCanvasThemeState(): CanvasThemeContextValue {
  const [theme, setThemeState] = useState<CanvasTheme>(readStored)

  const setTheme = useCallback((t: CanvasTheme) => {
    setThemeState(t)
    try {
      window.localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // storage quota / private browsing — continue in-memory
    }
  }, [])

  // Sync if another tab changes the preference
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        const v = e.newValue
        if ((CANVAS_THEMES as readonly string[]).includes(v)) {
          setThemeState(v as CanvasTheme)
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { theme, setTheme }
}
