-- CONNECT federated session membership (ADR-0062, S96)
-- CONNECT-JOIN-01 storage + CONNECT-SOVEREIGN-01 hard exclusion constraint.
--
-- A federated session admits multiple tenants. Membership lives here so cross-tenant
-- isolation is a real, region-scoped query surface. The CHECK constraint is the THIRD
-- enforcement layer for sovereign exclusion (after the mint guard and the join guard,
-- ADR-0062 §2): the database itself rejects any membership row for a sovereign tenant,
-- so an accidental sovereign federation is impossible even if both app guards are missed.

CREATE TABLE IF NOT EXISTS connect_federation_members (
  session_id   TEXT NOT NULL,
  team_id      TEXT NOT NULL,
  host_team_id TEXT NOT NULL,
  region_id    TEXT NOT NULL,
  scope        TEXT NOT NULL DEFAULT 'participate' CHECK (scope IN ('participate', 'co_host')),
  -- Denormalised tenant sovereignty; the CHECK makes a sovereign membership row
  -- structurally impossible to insert (CONNECT-SOVEREIGN-01).
  is_sovereign INTEGER NOT NULL DEFAULT 0 CHECK (is_sovereign = 0),
  invite_jti   TEXT,
  joined_at    INTEGER NOT NULL,
  PRIMARY KEY (session_id, team_id)
);

-- Isolation queries are always region-scoped (region_id) and per-session; this index
-- backs the region-partitioned membership read (CONNECT-ISOLATION-01).
CREATE INDEX IF NOT EXISTS idx_connect_members_session_region
  ON connect_federation_members(session_id, region_id);
