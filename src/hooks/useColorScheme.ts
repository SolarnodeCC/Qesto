import { useEffect, useState } from 'react'

export type ColorSchemePreference = 'system' | 'light' | 'dark'
export type ResolvedColorScheme = 'light' | 'dark'

const STORAGE_KEY = 'qesto:color-scheme'

function readStored(): ColorSchemePreference | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'dark' || v === 'light' || v === 'system' ? v : null
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

  return {
    preference,
    scheme,
    setPreference: setPreferenceState,
    toggle: () =>
      setPreferenceState((p) => {
        const current = resolveScheme(p)
        return current === 'dark' ? 'light' : 'dark'
      }),
  }
}
