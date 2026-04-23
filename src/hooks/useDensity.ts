import { useState, useCallback, useEffect } from 'react'

export type Density = 'compact' | 'comfortable' | 'spacious'

const STORAGE_KEY = 'qesto-density'

const DENSITY_PADDING: Record<Density, string> = {
  compact: 'p-2',
  comfortable: 'p-4',
  spacious: 'p-6',
}

const DENSITY_GAP: Record<Density, string> = {
  compact: 'gap-1',
  comfortable: 'gap-4',
  spacious: 'gap-6',
}

function readStored(): Density {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'compact' || v === 'comfortable' || v === 'spacious') return v
  } catch {
    // SSR or storage unavailable
  }
  return 'comfortable'
}

function isValidDensity(v: unknown): v is Density {
  return v === 'compact' || v === 'comfortable' || v === 'spacious'
}

export function useDensity() {
  const [density, setDensityState] = useState<Density>(readStored)

  // Hydrate from server prefs on mount (best-effort; silently ignored on failure).
  useEffect(() => {
    fetch('/api/users/preferences', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ ok: boolean; data?: { density?: unknown } }>)
      .then((body) => {
        if (body.ok && isValidDensity(body.data?.density)) {
          setDensityState(body.data.density)
          try { localStorage.setItem(STORAGE_KEY, body.data.density) } catch { /* noop */ }
        }
      })
      .catch(() => { /* silently fail — offline or unauthenticated */ })
  }, [])

  const setDensity = useCallback((d: Density) => {
    try {
      localStorage.setItem(STORAGE_KEY, d)
    } catch {
      // storage unavailable
    }
    setDensityState(d)
    // Fire-and-forget persistence to USERS_KV; no UI dependency on result.
    fetch('/api/users/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ density: d }),
    }).catch(() => { /* silently fail */ })
  }, [])

  return {
    density,
    setDensity,
    padding: DENSITY_PADDING[density],
    gap: DENSITY_GAP[density],
  }
}
