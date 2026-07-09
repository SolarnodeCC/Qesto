// EMBED widget (ADR-0050): config row, token claims, postMessage protocol.

// ── EMBED widget (ADR-0050) — embeddable engagement widget config + token ────

/** A team's embeddable-widget configuration row (D1 `embed_widgets`). */
export interface EmbedWidget {
  id: string
  team_id: string
  session_id: string
  session_code: string
  /** Exact origin strings (lowercased, no trailing slash). Stored as JSON TEXT in D1. */
  allowed_origins: string[]
  scope: 'read'
  /** Minting host user id — audit only; NEVER copied into the browser-shipped token. */
  created_by: string
  created_at: number
  /** NULL = active; non-NULL epoch ms = revoked (immediate kill-switch). */
  revoked_at: number | null
}

/**
 * Signed widget-token claims (ADR-0050 §1). Compact HMAC envelope — carries
 * tenant + session handles only, NO PII, safe to sit in third-party page source.
 */
export interface EmbedWidgetTokenClaims {
  v: 1
  /** embed_widgets.id — widget config row + revocation handle. */
  wid: string
  /** sessionId (canonical). */
  sid: string
  /** session join code (public shareable handle). */
  code: string
  /** teamId — tenant binding. */
  tid: string
  /** allowedOrigins — exact origin strings, lowercased, no trailing slash. */
  ao: string[]
  /** scope — READ-ONLY and the only value v1 mints. */
  scp: 'read'
  /** issued-at (epoch seconds). */
  iat: number
  /** expiry (epoch seconds) — short TTL (default 3600s; max 86400s). */
  exp: number
}

// postMessage protocol (shared SDK ↔ embed page contract — ADR-0050 §3c).
export type EmbedToHostMessage =
  | { source: 'qesto-embed'; v: 1; type: 'ready' }
  | { source: 'qesto-embed'; v: 1; type: 'resize'; height: number }
  | {
      source: 'qesto-embed'
      v: 1
      type: 'event'
      event: 'joined' | 'voted' | 'results_updated' | 'session_closed'
      payload?: { code?: string; questionId?: string }
    }

export type HostToEmbedMessage =
  | { source: 'qesto-embed'; v: 1; type: 'host_ready' }
  | { source: 'qesto-embed'; v: 1; type: 'config'; theme?: 'light' | 'dark' }
