import { z } from 'zod'

export type SessionBranding = {
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
}

// localStorage is a trust boundary — narrow the parsed JSON instead of casting.
const JoinCacheMapSchema = z.record(z.string(), z.record(z.string(), z.unknown()))

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

const ENTRY_CACHE_KEY = 'qesto:entry-cache'

export function cacheJoinSession(code: string, payload: Record<string, unknown>): void {
  try {
    const raw = localStorage.getItem(ENTRY_CACHE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    const map = JoinCacheMapSchema.safeParse(parsed).data ?? {}
    map[code.toUpperCase()] = { ...payload, cachedAt: Date.now() }
    localStorage.setItem(ENTRY_CACHE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
}

export function readCachedJoinSession(code: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(ENTRY_CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const map = JoinCacheMapSchema.safeParse(parsed).data
    return map?.[code.toUpperCase()] ?? null
  } catch {
    return null
  }
}
