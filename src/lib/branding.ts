export type SessionBranding = {
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
}

export function applyBrandingToDocument(branding: SessionBranding | null | undefined): void {
  if (!branding || typeof document === 'undefined') return
  const root = document.documentElement
  if (branding.primaryColor) {
    root.style.setProperty('--brand-primary', branding.primaryColor)
    root.style.setProperty(
      '--gradient-brand',
      `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor ?? branding.primaryColor})`,
    )
  }
  if (branding.secondaryColor) root.style.setProperty('--brand-secondary', branding.secondaryColor)
}

const JOIN_CACHE_KEY = 'qesto:join-cache'

export function cacheJoinSession(code: string, payload: Record<string, unknown>): void {
  try {
    const raw = localStorage.getItem(JOIN_CACHE_KEY)
    const map = (raw ? (JSON.parse(raw) as unknown) : {}) as Record<string, unknown>
    map[code.toUpperCase()] = { ...payload, cachedAt: Date.now() }
    localStorage.setItem(JOIN_CACHE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
}

export function readCachedJoinSession(code: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(JOIN_CACHE_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as unknown as Record<string, Record<string, unknown>>
    return map[code.toUpperCase()] ?? null
  } catch {
    return null
  }
}
