/**
 * Shared client for the per-user appearance preferences stored in USERS_KV
 * (see functions/api/routes/users.ts). Theme, density, and high-contrast hooks
 * all read/write through here so the workspace appearance follows the user
 * across devices.
 *
 * The GET is memoised for the lifetime of the page so the three independent
 * appearance controls hydrate from a single network request. A PATCH
 * invalidates the cache so a later mount reflects the new value.
 *
 * Fetch is gated on AuthProvider calling setUserPreferencesAuthKnown(true) after
 * /api/auth/me succeeds. HttpOnly session cookies are not visible to JS, so we
 * must not sniff document.cookie — credentials: 'include' is used when enabled.
 */

export type ColorSchemePref = 'system' | 'light' | 'dark'
export type DensityPref = 'compact' | 'comfortable' | 'spacious'

export interface UserPreferences {
  density?: DensityPref
  colorScheme?: ColorSchemePref
  highContrast?: boolean
}

let cached: Promise<UserPreferences> | null = null
let preferencesFetchEnabled = false

/**
 * Called from AuthProvider when auth state is resolved. Skips GET/PATCH while
 * loading or anonymous to avoid noisy 401s; enables fetch for authenticated
 * users (HttpOnly cookie sent via credentials: 'include').
 */
export function setUserPreferencesAuthKnown(authenticated: boolean): void {
  if (authenticated === preferencesFetchEnabled) return
  preferencesFetchEnabled = authenticated
  cached = null
}

/** Best-effort fetch of server-side preferences. Never rejects. */
export function loadUserPreferences(): Promise<UserPreferences> {
  if (!preferencesFetchEnabled) return Promise.resolve({})
  if (!cached) {
    cached = fetch('/api/users/preferences', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; data?: UserPreferences }>) : Promise.resolve({ ok: false })))
      .then((body) => (body.ok && body.data ? body.data : {}))
      .catch(() => ({}))
  }
  return cached
}

/** Fire-and-forget persistence of a single preference; no UI dependency on result. */
export function patchUserPreference(patch: UserPreferences): void {
  if (!preferencesFetchEnabled) return
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

/** Test-only: drop the memoised GET and auth gate between Vitest cases. */
export function __resetUserPreferencesForTests(): void {
  cached = null
  preferencesFetchEnabled = false
}
