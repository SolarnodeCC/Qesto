-- 0015_v2_2_schema — Sprint 20 v2.2 schema additions
-- Adds AI recap provenance tracking + custom role support
-- See ADR-CIRCUIT-BREAKER, ADR-INTEGRATION-FOUNDATION, INFRA-SPRINT-20-CHECKLIST

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend recaps table for AI provenance tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recaps ADD COLUMN format_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recaps ADD COLUMN ai_model_version TEXT;
ALTER TABLE recaps ADD COLUMN generated_at INTEGER;
ALTER TABLE recaps ADD COLUMN evidence_json TEXT;

-- Index for version filtering in read path
CREATE INDEX IF NOT EXISTS idx_recaps_session_format ON recaps(session_id, format_version);

-- ─────────────────────────────────────────────────────────────────────────────
-- Custom roles table for enterprise team delegation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '{}',  -- JSON: { can_create_session: true, can_view_results: true, ... }
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_team ON custom_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_created_by ON custom_roles(created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit event types now include LIVE energizer events (documented here)
-- ─────────────────────────────────────────────────────────────────────────────
-- New audit_action types for v2.2:
--   ws.energizer_activate: Host activates an energizer during LIVE session
--   ws.energizer_deactivate: Host deactivates an energizer
--   ws.energizer_complete: Energizer auto-completes (timer expires, threshold met)
--   ws.score_updated: Participant score updated (Quick Finger, Team Quiz)
--   ws.badge_earned: Participant earned a badge (Streak, Fastest Finger, etc.)
--   role.created: Custom role created
--   role.updated: Custom role updated
--   role.assigned: Custom role assigned to team member
--   role.removed: Custom role removed from team member
--
-- These are logged to audit_events table via existing insert logic:
--   INSERT INTO audit_events (session_id, team_id, user_id, audit_action, metadata, created_at)
--   VALUES (...)
--
-- The audit_action column is TEXT (no CHECK constraint), so new types can be added
-- without schema migration. This migration just documents the new types.
