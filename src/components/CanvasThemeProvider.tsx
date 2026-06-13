/**
 * CANVAS-THEME-01 — CanvasThemeProvider (S88)
 *
 * Wraps the canvas element and applies data-canvas-theme.
 * Import canvas-themes.css once at the app entry; this provider only
 * manages the attribute — it carries no CSS itself.
 */
import { type ReactNode } from 'react'
import { CanvasThemeContext, useCanvasThemeState } from '../hooks/useCanvasTheme'

interface CanvasThemeProviderProps {
  children: ReactNode
  /** Caller must forward ref/className to wire up the DOM attribute themselves */
}

/**
 * Provides the canvas theme context. The outermost canvas `<div>` should spread
 * `data-canvas-theme={theme}` from `useCanvasTheme()`.
 */
export function CanvasThemeProvider({ children }: CanvasThemeProviderProps) {
  const value = useCanvasThemeState()
  return (
    <CanvasThemeContext.Provider value={value}>
      {children}
    </CanvasThemeContext.Provider>
  )
}
