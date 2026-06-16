/**
 * Shared client for the per-user appearance preferences stored in USERS_KV
 * (see functions/api/routes/users.ts). Theme, density, and high-contrast hooks
 * all read/write through here so the workspace appearance follows the user
 * across devices.
 *
 * The GET is memoised for the lifetime of the page so the three independent
 * appearance controls hydrate from a single network request. A PATCH
 * invalidates the cache so a later mount reflects the new value.
 */

import { getAuthToken } from '../api/client'

export type ColorSchemePref = 'system' | 'light' | 'dark'
export type DensityPref = 'compact' | 'comfortable' | 'spacious'

export interface UserPreferences {
  density?: DensityPref
  colorScheme?: ColorSchemePref
  highContrast?: boolean
}

let cached: Promise<UserPreferences> | null = null

function hasAuthSession(): boolean {
  if (typeof document === 'undefined') return false
  if (getAuthToken()) return true
  return document.cookie.split(';').some((part) => part.trim().startsWith('qesto_session='))
}

/** Best-effort fetch of server-side preferences. Never rejects. */
export function loadUserPreferences(): Promise<UserPreferences> {
  if (!cached) {
    cached = (async () => {
      if (!hasAuthSession()) return {}
      return fetch('/api/users/preferences', { credentials: 'include' })
        .then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; data?: UserPreferences }>) : Promise.resolve({ ok: false })))
        .then((body) => (body.ok && body.data ? body.data : {}))
        .catch(() => ({}))
    })()
  }
  return cached
}

/** Fire-and-forget persistence of a single preference; no UI dependency on result. */
export function patchUserPreference(patch: UserPreferences): void {
  if (!hasAuthSession()) return
  // Optimistically fold the change into the cache so concurrent mounts see it.
  cached = cached
    ? cached.then((prev) => ({ ...prev, ...patch }))
    : Promise.resolve({ ...patch })

  fetch('/api/users/preferences', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {
    /* silently fail — offline or unauthenticated */
  })
}

/** Test-only: drop the memoised GET so each test starts from a clean slate. */
export function __resetUserPreferencesForTests(): void {
  cached = null
}
