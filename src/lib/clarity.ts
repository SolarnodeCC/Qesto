// Microsoft Clarity loader.
//
// Clarity is privacy-sensitive (session recording + cookies), so we never load it
// automatically. loadClarity() is called only after the visitor accepts analytics
// cookies via the consent banner (see src/components/CookieConsentBanner.tsx).

export const CLARITY_PROJECT_ID = 'x06dypkbyr'

type ClarityQueue = { (...args: unknown[]): void; q?: unknown[] }

declare global {
  interface Window {
    clarity?: ClarityQueue
  }
}

let injected = false

/**
 * Inject the Clarity tag. Idempotent and SSR-safe: repeated calls (or a tag
 * already present on the page) are no-ops. Mirrors the official Clarity bootstrap
 * but only runs on explicit consent.
 */
export function loadClarity(projectId: string = CLARITY_PROJECT_ID): void {
  if (injected) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  injected = true

  if (window.clarity) return

  const queue: ClarityQueue = (...args: unknown[]) => {
    ;(queue.q = queue.q || []).push(args)
  }
  window.clarity = queue

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${projectId}`
  const first = document.getElementsByTagName('script')[0]
  if (first && first.parentNode) {
    first.parentNode.insertBefore(script, first)
  } else {
    document.head.appendChild(script)
  }
}

/** Test-only hook to reset the module-level guard between cases. */
export function __resetClarityForTests(): void {
  injected = false
}
