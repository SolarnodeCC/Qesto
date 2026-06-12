-- Migration 0055: EMBED embeddable widget configs (epic E87, ADR-0050).
-- Apply: `wrangler d1 migrations apply qesto-prod`
-- Safety: new table + additive indexes only. No data backfill, no column drops.
-- jankurai:migration-safe approved=architect
-- SQLite-compatible.

-- One row per registered embeddable-widget config. `allowed_origins` is the
-- SINGLE source of truth for both the minted token's `ao` claim and the embed
-- page's frame-ancestors CSP — one allowlist, enforced at multiple points.
-- `created_by` is audit-only and is NEVER copied into the browser-shipped token
-- (no PII / user id in the embed credential). `revoked_at` is the immediate
-- kill-switch: widgetTokenMiddleware rejects a token whose wid row is revoked,
-- overriding a still-unexpired exp.
CREATE TABLE IF NOT EXISTS embed_widgets (
  id              TEXT PRIMARY KEY,                              -- widget config id = token `wid` + revocation handle
  team_id         TEXT NOT NULL,                                 -- tenant binding
  session_id      TEXT NOT NULL,                                 -- embedded session (canonical id)
  session_code    TEXT NOT NULL,                                 -- public join code (token `code` claim)
  allowed_origins TEXT NOT NULL,                                 -- JSON array of exact origin strings (token `ao` source)
  scope           TEXT NOT NULL DEFAULT 'read'
                    CHECK (scope IN ('read')),                   -- v1: read only
  created_by      TEXT NOT NULL,                                 -- minting host user id (audit only, never in token)
  created_at      INTEGER NOT NULL,                              -- epoch ms
  revoked_at      INTEGER                                        -- NULL = active; non-NULL = revoked
);
CREATE INDEX IF NOT EXISTS idx_embed_widgets_team ON embed_widgets(team_id);
CREATE INDEX IF NOT EXISTS idx_embed_widgets_session ON embed_widgets(session_id);
