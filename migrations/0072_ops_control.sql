-- Platformbeheer Module 4 (OPS) — operational control + incident tracking.
--
-- These tables back the OPS module's read views and audited operator actions.
-- Destructive infra operations (rollback, restore, secret rotation) are NOT
-- executed from the Worker; the endpoints record an audited, confirmed operator
-- request and update tracking state here, which the external pipeline / NAS
-- runner acts on. The tables are the durable source of truth for "what was
-- requested, by whom, when, and what is its status".
--
-- `incidents` / `incident_impacts` were already queried defensively by
-- admin/ops.ts (summary); this makes them first-class.

CREATE TABLE IF NOT EXISTS incidents (
  id          TEXT    PRIMARY KEY,                              -- ulid
  severity    INTEGER NOT NULL CHECK (severity IN (1, 2, 3)),   -- 1 = SEV1 (highest)
  title       TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  linked_metric TEXT,                                           -- e.g. 'workers.error_rate'
  postmortem  TEXT,                                             -- free-text, set on close
  created_by  TEXT,                                             -- admin user id
  created_at  INTEGER NOT NULL,
  closed_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_impacts (
  id          TEXT    PRIMARY KEY,
  incident_id TEXT    NOT NULL,
  session_id  TEXT,
  user_id     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incident_impacts_incident ON incident_impacts(incident_id);

-- Cron execution log — one row per run, written by the scheduled worker. The
-- OPS view reads the latest row per job and compares to the expected cadence to
-- raise a missed-run alert.
CREATE TABLE IF NOT EXISTS cron_runs (
  id          TEXT    PRIMARY KEY,
  job         TEXT    NOT NULL,                                 -- registry key, e.g. 'kb-watchdog'
  status      TEXT    NOT NULL CHECK (status IN ('success', 'failure', 'running')),
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  detail      TEXT
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job, started_at DESC);

-- Secret/token rotation tracker. NEVER stores secret values — only metadata.
CREATE TABLE IF NOT EXISTS secret_rotations (
  name                  TEXT    PRIMARY KEY,                    -- e.g. 'CLOUDFLARE_API_TOKEN'
  last_rotated_at       INTEGER,
  expires_at            INTEGER,                                -- NULL = no known expiry
  last_used_at          INTEGER,
  rotation_requested_at INTEGER,                                -- set by "rotate now"
  created_at            INTEGER NOT NULL
);

-- Deployment history + rollback markers.
CREATE TABLE IF NOT EXISTS deploy_history (
  id            TEXT    PRIMARY KEY,
  version       TEXT    NOT NULL,
  environment   TEXT    NOT NULL DEFAULT 'production',
  sha           TEXT,
  status        TEXT    NOT NULL DEFAULT 'deployed'
    CHECK (status IN ('deployed', 'rolled_back', 'rollback_requested')),
  created_at    INTEGER NOT NULL,
  rolled_back_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_deploy_history_created ON deploy_history(created_at DESC);

PRAGMA foreign_key_check;
PRAGMA quick_check;
