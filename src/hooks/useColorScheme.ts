import { useEffect, useState } from 'react'

export type ColorScheme = 'light' | 'dark'

const STORAGE_KEY = 'qesto:color-scheme'

function readStored(): ColorScheme | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'dark' || v === 'light' ? v : null
}

function readSystem(): ColorScheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useColorScheme(): { scheme: ColorScheme; toggle: () => void; set: (s: ColorScheme) => void } {
  const [scheme, setScheme] = useState<ColorScheme>(() => readStored() ?? readSystem())

  useEffect(() => {
    document.documentElement.dataset.theme = scheme
    window.localStorage.setItem(STORAGE_KEY, scheme)
  }, [scheme])

  return {
    scheme,
    set: setScheme,
    toggle: () => setScheme((s) => (s === 'dark' ? 'light' : 'dark')),
  }
}
