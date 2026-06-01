// Persistence helpers for the analytics cookie-consent decision.
// Kept framework-free so they are easy to unit-test in isolation.

export const CONSENT_STORAGE_KEY = 'qesto:cookie-consent'

export type ConsentValue = 'accepted' | 'rejected'

function isConsentValue(value: string | null): value is ConsentValue {
  return value === 'accepted' || value === 'rejected'
}

/** Read the stored decision, or null if the visitor has not chosen yet. */
export function readConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return isConsentValue(stored) ? stored : null
  } catch {
    // Storage unavailable (private browsing, quota, disabled) — treat as undecided.
    return null
  }
}

/** Persist the decision. Failures are swallowed so the UI still updates in-memory. */
export function writeConsent(value: ConsentValue): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value)
  } catch {
    // Storage unavailable; the in-memory state in useCookieConsent still applies.
  }
}
