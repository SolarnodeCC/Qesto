// Browser crash reporting → POST /api/client-errors (server redacts + logs).
// Capped per page load so a render loop cannot flood the endpoint.
import { API_BASE_URL } from '../config/api'
import { BUILD_INFO } from '../buildInfo'

export type ClientErrorKind = 'render' | 'error' | 'unhandledrejection' | 'chunk'

const MAX_REPORTS_PER_PAGE = 5
let sent = 0
const seen = new Set<string>()

export function reportClientError(kind: ClientErrorKind, error: unknown): void {
  try {
    if (sent >= MAX_REPORTS_PER_PAGE) return
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Non-Error thrown')
    const message = (err.message || err.name || 'Unknown error').slice(0, 500)
    const key = `${kind}:${message}`
    if (seen.has(key)) return
    seen.add(key)
    sent++
    const body = JSON.stringify({
      kind,
      message,
      ...(err.stack ? { stack: err.stack.slice(0, 4000) } : {}),
      path: window.location.pathname.slice(0, 300),
      release: String(BUILD_INFO.frontendCommit ?? 'unknown').slice(0, 64),
    })
    void fetch(`${API_BASE_URL}/api/client-errors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-qesto-client': 'web' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {
      /* reporting must never throw */
    })
  } catch {
    /* reporting must never throw */
  }
}

/** Install window-level handlers once (main.tsx). */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (ev) => {
    // Resource load errors have no `error`; only report script errors.
    if (ev.error) reportClientError('error', ev.error)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    reportClientError('unhandledrejection', ev.reason)
  })
}
