import { useState, useCallback, useEffect } from 'react'
import { loadUserPreferences, patchUserPreference, type DensityPref } from '../lib/user-preferences'
import { useAuth } from './useAuth'

export type Density = DensityPref

const STORAGE_KEY = 'qesto-density'

function isValidDensity(v: unknown): v is Density {
  return v === 'compact' || v === 'comfortable' || v === 'spacious'
}

function readStored(): Density {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (isValidDensity(v)) return v
  } catch {
    // SSR or storage unavailable
  }
  return 'comfortable'
}

/** Reflect the active density onto <html> so the CSS density scale applies. */
function applyDensity(d: Density) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.density = d
  }
}

export function useDensity() {
  const auth = useAuth()
  const [density, setDensityState] = useState<Density>(readStored)

  // Keep the DOM attribute in sync with state (covers the initial mount too).
  useEffect(() => {
    applyDensity(density)
  }, [density])

  // Hydrate from server prefs once auth is known (HttpOnly cookie via credentials).
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    loadUserPreferences().then((prefs) => {
      if (isValidDensity(prefs.density)) {
        setDensityState(prefs.density)
        try { localStorage.setItem(STORAGE_KEY, prefs.density) } catch { /* noop */ }
      }
    })
  }, [auth.status])

  const setDensity = useCallback((d: Density) => {
    try {
      localStorage.setItem(STORAGE_KEY, d)
    } catch {
      // storage unavailable
    }
    setDensityState(d)
    applyDensity(d)
    patchUserPreference({ density: d })
  }, [])

  return { density, setDensity }
}
