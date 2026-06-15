import { useCallback, useEffect, useState } from 'react'
import { loadUserPreferences, patchUserPreference } from '../lib/user-preferences'

export type ColorSchemePreference = 'system' | 'light' | 'dark'
export type ResolvedColorScheme = 'light' | 'dark'

const STORAGE_KEY = 'qesto:color-scheme'

function isValidPreference(v: unknown): v is ColorSchemePreference {
  return v === 'dark' || v === 'light' || v === 'system'
}

function readStored(): ColorSchemePreference | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  return isValidPreference(v) ? v : null
}

function readSystem(): ResolvedColorScheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveScheme(preference: ColorSchemePreference): ResolvedColorScheme {
  if (preference === 'system') return readSystem()
  return preference
}

export function useColorScheme(): {
  preference: ColorSchemePreference
  scheme: ResolvedColorScheme
  setPreference: (p: ColorSchemePreference) => void
  toggle: () => void
} {
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(() => readStored() ?? 'system')
  const [scheme, setScheme] = useState<ResolvedColorScheme>(() => resolveScheme(readStored() ?? 'system'))

  useEffect(() => {
    const resolved = resolveScheme(preference)
    setScheme(resolved)
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.themePreference = preference
    window.localStorage.setItem(STORAGE_KEY, preference)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setScheme(readSystem())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  // Hydrate from server prefs on mount (best-effort; silently ignored on failure).
  useEffect(() => {
    loadUserPreferences().then((prefs) => {
      if (isValidPreference(prefs.colorScheme)) setPreferenceState(prefs.colorScheme)
    })
  }, [])

  const setPreference = useCallback((p: ColorSchemePreference) => {
    setPreferenceState(p)
    patchUserPreference({ colorScheme: p })
  }, [])

  const toggle = useCallback(() => {
    setPreferenceState((p) => {
      const next: ColorSchemePreference = resolveScheme(p) === 'dark' ? 'light' : 'dark'
      patchUserPreference({ colorScheme: next })
      return next
    })
  }, [])

  return { preference, scheme, setPreference, toggle }
}
