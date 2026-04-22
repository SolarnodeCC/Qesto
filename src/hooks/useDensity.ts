import { useState, useCallback } from 'react'

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

export function useDensity() {
  const [density, setDensityState] = useState<Density>(readStored)

  const setDensity = useCallback((d: Density) => {
    try {
      localStorage.setItem(STORAGE_KEY, d)
    } catch {
      // storage unavailable
    }
    setDensityState(d)
  }, [])

  return {
    density,
    setDensity,
    padding: DENSITY_PADDING[density],
    gap: DENSITY_GAP[density],
  }
}
