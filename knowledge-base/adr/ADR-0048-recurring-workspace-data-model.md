---
id: ADR-0048
status: proposed
created: 2026-06-05
relates_to: ADR-0045-cross-session-intelligence, ADR-0044-townhall-qa-board, ADR-0010-zero-knowledge-mode, ADR-0009-pii-sanitization, ADR-KV-Tenant-Conventions, ADR-0001-do-per-session
---

# ADR-0048: Recurring-Workspace Data Model (RETRO / IDEATE / EVENT Persistence + History)

## Context

Qesto's unit of work is the **single session**: created in DRAFT, run once, closed,
archived. Everything team-scoped about a session is a denormalised `sessions.team_id`
(`schema.sql:59`). The next-buyer epics break that one-shot assumption:

- **EPIC-RETRO** is *recurring* — a team runs a retro every sprint, and unresolved
  action items, mood, and participation must carry **sprint-over-sprint**.
- **EPIC-IDEATE** is a *multi-session innovation program* — ideas and clusters span
  several workshops.
- **EPIC-STAGE** needs a *team-scoped container above sessions* (an event with linked
  per-talk sessions) — STAGE-00 originally proposed a standalone `event` table and an
  ADR-0047 amendment.

A first slice already shipped: migration `0052_stage_workspaces.sql` created a
`workspaces` table (`kind IN ('retro','ideate')`) and `routes/team-workspaces.ts` does
CRUD, but it has **no session linkage**, **no history/trend tier**, **member-only RBAC**
(`isTeamMember` is the only gate — `team-workspaces.ts:54`), and **no retention model**.
That is a stub, not the data model.

This ADR fixes the **persistent parent-container model**: one team-scoped `workspace`
that owns an ordered series of session *instances*, with longitudinal history, trends,
action-item carryover, RBAC, and a GDPR retention story. It deliberately **reuses**
the cross-session intelligence machinery (ADR-0045) rather than re-inventing it.

Non-negotiable constraints carried in from the arc: Workers AI only (hard rule #1);
zero-knowledge sessions (ADR-0010) must never enter any aggregate; no PII in derived
stores (ADR-0009); SQLite cannot `ALTER` a `CHECK` constraint in place (the 0008/0009/0010
and 0046 precedent); secrets via `wrangler pages secret put`.

## Decision

### 1. One `workspace` entity for all three kinds — `event` absorbs STAGE-00

Extend the existing `workspaces` table; do **not** add a parallel `events` table. A
workspace is the team-scoped container above sessions for every recurring/multi-session
product:

- `kind ∈ ('retro','ideate','event')` — `event` **supersedes** the standalone event
  container proposed in STAGE-00 / the ADR-0047 amendment. The session-linkage, RBAC,
  and retention plumbing below is identical for all three kinds; only `cadence` and the
  trend `kind`s differ. This collapses two near-identical containers into one and is the
  primary cross-layer call of this ADR.
- `cadence ∈ ('weekly','biweekly','sprint','manual')` for `retro`/`ideate`; **NULL** for
  `event` (an event is a one-shot container, not a recurrence). Cadence is advisory
  metadata for the "create next instance" affordance — it does **not** schedule anything
  server-side in v1.
- `retention_days INTEGER` — per-workspace instance retention (see §6); NULL = team default.
- `archived_at`, `last_instance_at` for lifecycle + cheap "active workspaces" reads.

Because SQLite cannot widen the `0052` `CHECK (kind IN ('retro','ideate'))` in place, the
migration **recreates** `workspaces` (the table is new in this same S85 arc and empty in
prod) via copy-migrate, mirroring the 0009/0010 table-rebuild precedent.

### 2. Session linkage: `workspace_id` + `workspace_seq` on `sessions`

Each session is **one instance** of a workspace. Add to `sessions`:

- `workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL` — nullable; a normal
  one-shot session has `workspace_id = NULL` and is **unchanged** (regression baseline).
- `workspace_seq INTEGER` — 1-based instance ordinal within the workspace, assigned at
  link time; gives deterministic "retro #4" ordering without sorting on `created_at`.

`ON DELETE SET NULL` (not CASCADE) is deliberate: deleting a workspace must **not**
destroy historical session results, votes, or `insights_daily` rows — those are
independently owned and independently erasable. The link is metadata, the session is the
record. `team_id` continues to carry tenant scope; `workspace_id` is the finer container.

**History is therefore a query, not a new store**: a workspace's history is
`SELECT … FROM sessions WHERE workspace_id = ?1 ORDER BY workspace_seq DESC`, joined to
the existing `insights_daily` per-session tier (already team-scoped per ADR-0045). No
duplicate "instance" table.

### 3. Trends: a materialised `workspace_trend` table mirroring `team_insight_rollup`

Team-health / participation / theme trends are **pre-aggregated**, never computed per
page load. Reuse the proven ADR-0045 rollup shape, scoped to the workspace:

```
workspace_trend(workspace_id, kind, window, payload_json, computed_at)
  kind ∈ ('team_health','participation','recurring_themes')
  PRIMARY KEY (workspace_id, kind, window)
```

`payload_json` is a PII-free, pre-aggregated blob (bucketed mood, participation rate,
clustered theme labels + centroid refs) — the same discipline as `insights_daily.themes_json`.
A dedicated table (vs. overloading `team_insight_rollup`) keeps workspace-scoped trends
addressable and deletable on workspace delete, and keeps team-wide INSIGHTS+ rollups
unchanged.

### 4. Compute is async + tiered — zero hot-path cost (reuse ADR-0045)

- *Tier 1 (on close, exists):* `precomputeInsights()` (`routes/sessions/shared.ts:263`,
  fired from `lifecycle.ts`) already writes `insights_daily` + upserts the embedding for
  any closed session — including workspace instances, for free. The **ZK write-boundary
  guard** (skip when `anonymity === 'zero_knowledge'`) is inherited verbatim.
- *Tier 2 (workspace rollup, new):* the **existing daily cron**
  (`worker/index.ts:handleScheduled`, `wrangler.toml crons = ["0 2 * * *"]`) iterates
  workspaces whose team holds the `crossSessionInsights` entitlement and that have ≥1
  newly closed instance since `computed_at`, recomputes the three `kind`s into
  `workspace_trend`, and invalidates the KV read cache. A Team+ on-demand **Refresh**
  enqueues the same job for one workspace (debounced) to cover the daily freshness lag.
- *Read path:* `GET /api/teams/:id/workspaces/:wsId/trends` serves `workspace_trend`
  through a tenant-namespaced KV cache key
  (`namespacedKey(teamId, 'ws:<wsId>:trend:<kind>')`, ADR-KV-Tenant-Conventions).
- *Clustering:* recurring-theme trends are a metadata-filtered query over
  `DECISIONS_VECTORIZE` (`filter: { team_id, workspace_id }`) — **no new index** — with
  labels from `lib/ai-insights.ts` (Workers AI). No third-party egress.

### 5. RBAC: reuse team roles; fix the member-only gap (SEC-WORKSPACE-RBAC-01)

Workspace authorization reuses team roles (`owner`/`admin`/`member`/`viewer`) and the
custom-RBAC tables (`custom_roles`, `team_role_assignments`) — it introduces no new
permission system. The matrix replaces the current `isTeamMember`-only check:

| Action | owner / admin | member | viewer |
|---|---|---|---|
| Create / delete / archive workspace | ✅ | ✅ (own kind) | ❌ |
| Patch workspace (title/template/cadence) | ✅ | ✅ | ❌ |
| Run an instance, view board/history | ✅ | ✅ | ✅ (read-only) |
| View trends | ✅ | ✅ | ✅ |
| Export (action items / themes) | ✅ | ✅ | ❌ |

Authorization is server-enforced per route (not client-trusted), and export is **doubly**
gated: role (above) **and** the existing `resultsExport` plan feature. Cross-tenant access
is structurally impossible because every query is `WHERE team_id = ?` first.

### 6. Plan gating

- New `recurringWorkspaces` key in `PlanQuotas.featuresUnlocked` (`types.ts:228`),
  **Team tier**, following the `townhallQA` / `crossSessionInsights` precedent — gates
  workspace create + instance linkage.
- The **trend read path reuses the existing `crossSessionInsights` entitlement** — a
  team-health trend *is* cross-session intelligence, so no second longitudinal gate is
  added. Lower tiers get `403 feature_not_available` + `upgrade_url` (no empty-state
  data leak); the cron computes only for entitled teams (cost control).

### 7. Action-item carryover: reuse ACTIONS_KV, tenant-namespaced

Open action items are the one piece of mutable, cross-instance state and live in
`ACTIONS_KV` (already a tenant-isolated binding per `tenant-namespace.ts:22`), **not** a
new D1 table:

- Key: `namespacedKey(teamId, 'ws:<wsId>:actions')` → JSON blob `{ items: ActionItem[] }`,
  read/written via `readKvJson` / `writeKvJson` (`lib/kv.ts`).
- On creating the next instance, the API **pre-seeds** the new board with items where
  `status === 'open'`; resolved items stay in KV history until the retention sweep.
- D1 stays the durable record of *what was decided* (persisted with the closed session);
  KV is the *working set* that carries forward. This mirrors the ADR-0044 "DO/KV is live,
  D1 is the archive" tiering and avoids per-instance write contention on the hot path.

### 8. GDPR / retention model

- **ZK exclusion** is enforced at the Tier-1 write boundary (§4), so ZK instances are
  structurally absent from `insights_daily`, vector metadata, and therefore every
  `workspace_trend` row — defence in depth, not a forgettable query-time filter.
- **k-anonymity floor** (consistent with ADR-0045/0011): a `team_health` /
  `participation` trend point is emitted only when the workspace has **≥3 contributing
  instances** and each contributing instance has **≥5 respondents**; below floor → omitted,
  not blurred. Recurring-theme clusters require **≥3 instances**.
- **Trends store only aggregates** — bucketed mood, rates, centroid refs, theme labels —
  never per-respondent rows, free text, or identifiers. `safeLogContext()` (ADR-0009)
  applies to the cron path.
- **Retention sweep:** the daily cron archives/erases workspace instances older than
  `workspace.retention_days` (or the team default), purging `insights_daily` and KV
  action history for swept instances; the next rollup re-materialises without them.
- **Deletion cascade:** deleting a workspace `SET NULL`s `sessions.workspace_id`
  (history survives independently), and **must additionally** purge `workspace_trend`
  rows, the `ACTIONS_KV` blob, and the team+workspace `DECISIONS_VECTORIZE` metadata — a
  new deletion step alongside the existing `session-delete.ts` / team-delete purges.
- **Per-author erasure** reuses the opaque `author_hash` / `voter_id` surfaces
  (`sha256(ip‖fingerprint)`, no PII) already used by votes and `townhall_questions`.

## Alternatives considered

- **Standalone `events` table for STAGE + separate `workspaces`** — rejected: two
  near-identical team-scoped containers duplicate session-linkage, RBAC, retention, and
  trend plumbing. One `kind`-discriminated `workspace` collapses them; STAGE-00 folds in.
- **New `workspace_instances` table** — rejected: a session *is* the instance. A
  `workspace_id` + `workspace_seq` on `sessions` makes history a one-line query and keeps
  GDPR erasure on the existing session-delete path, avoiding a parallel lifecycle to keep
  in sync.
- **`ON DELETE CASCADE` from workspace to sessions** — rejected: deleting a recurring
  workspace would silently destroy months of independently-owned session results; the
  link is metadata, so `SET NULL` is correct.
- **Reuse `team_insight_rollup` for workspace trends** — rejected: workspace trends must
  be addressable and deletable per workspace; overloading the team-wide table couples two
  scopes and complicates workspace-delete purges. The shape is reused; the table is not.
- **New action-items D1 table** — rejected for the carryover working set:
  per-instance read/modify/write on close is exactly the contention ADR-0044 avoided;
  tenant-namespaced KV is the right tier, with D1 holding the durable closed-session record.
- **Synchronous trend recompute on session close** — rejected (ADR-0045 precedent):
  adds latency to the hot path; the daily cron + debounced refresh amortises it.
- **A new RBAC/permission system for workspaces** — rejected: team roles + custom-RBAC
  already express owner/admin/member/viewer; workspaces only need a per-route matrix.

## Consequences

- Reuses `insights_daily`, `team_insight_rollup`'s shape, `DECISIONS_VECTORIZE`, the daily
  cron, the entitlement + tenant-KV conventions, and `ai-insights.ts` — RETRO/IDEATE
  history + trends are mostly wiring, not net-new infrastructure.
- STAGE's event container is unified here: STAGE-00 / the ADR-0047 amendment is reduced
  to "use `workspace.kind = 'event'`", removing a planned table and an ADR amendment.
- The shipped `0052` `workspaces` table + `team-workspaces.ts` CRUD are **extended**, not
  replaced; the member-only RBAC stub is hardened to the §5 matrix (SEC-WORKSPACE-RBAC-01).
- Clean GDPR story: trends are derived aggregates over ZK-free, PII-free, k-anonymised
  inputs; workspace delete and the retention sweep both purge derived stores.
- One-shot sessions (`workspace_id = NULL`) and team-wide INSIGHTS+ rollups are untouched
  — regression baseline.
- **Daily freshness lag** between close and trend — mitigated by the Team+ on-demand refresh.
- Cron cost scales with entitled, recently-active workspaces — bounded by the entitlement
  gate and the "changed since `computed_at`" guard.
- A `kind`-discriminated container trades some schema rigidity for one model spanning three
  epics — acceptable; payloads are read whole and cached.

## D1 migration (sketch — `migrations/0053_workspace_recurring_model.sql`)

```sql
-- Migration 0053: recurring-workspace model (ADR-0048, Sprint 85).
-- Apply: wrangler d1 migrations apply qesto_3_db --local
-- Safety: recreates the new-in-arc `workspaces` table to widen the kind CHECK
-- (SQLite cannot ALTER a CHECK in place — 0009/0010/0046 precedent); additive
-- columns on sessions; new trend table. No destructive backfill on prod data.

-- (1) Widen workspaces: + 'event' kind, + cadence/retention/lifecycle columns.
ALTER TABLE workspaces RENAME TO workspaces_old;
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retro','ideate','event')),
  title TEXT NOT NULL,
  cadence TEXT CHECK (cadence IN ('weekly','biweekly','sprint','manual')),  -- NULL for event
  template_json TEXT NOT NULL DEFAULT '{}',
  retention_days INTEGER,                       -- NULL = team default
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_instance_at INTEGER,
  archived_at INTEGER
);
INSERT INTO workspaces (id, team_id, kind, title, template_json, created_by, created_at, updated_at)
  SELECT id, team_id, kind, title, template_json, created_by, created_at, updated_at FROM workspaces_old;
DROP TABLE workspaces_old;
CREATE INDEX IF NOT EXISTS idx_workspaces_team_kind ON workspaces(team_id, kind, updated_at DESC);

-- (2) Session linkage. Additive, NULL for normal one-shot sessions.
ALTER TABLE sessions ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN workspace_seq INTEGER;
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id, workspace_seq DESC);

-- (3) Workspace-scoped trend rollup (mirrors team_insight_rollup, ADR-0045).
CREATE TABLE IF NOT EXISTS workspace_trend (
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('team_health','participation','recurring_themes')),
  window TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, kind, window)
);
CREATE INDEX IF NOT EXISTS idx_workspace_trend_computed ON workspace_trend(workspace_id, computed_at DESC);
```

> `schema.sql` is the canonical CHECK-enum source for fresh DBs (per the 0046 note); the
> widened `workspaces` definition and the two `sessions` columns are mirrored there.

## Data model (TypeScript — `functions/api/types.ts`)

```ts
export type WorkspaceKind = 'retro' | 'ideate' | 'event'
export type WorkspaceCadence = 'weekly' | 'biweekly' | 'sprint' | 'manual'

export interface Workspace {
  id: string
  team_id: string
  kind: WorkspaceKind
  title: string
  cadence: WorkspaceCadence | null   // null for 'event'
  template: Record<string, unknown>
  retention_days: number | null      // null = team default
  created_by: string
  created_at: number
  updated_at: number
  last_instance_at: number | null
  archived_at: number | null
}

export type WorkspaceTrendKind = 'team_health' | 'participation' | 'recurring_themes'

export interface ActionItem {
  id: string
  text: string
  status: 'open' | 'done' | 'dropped'
  carried_from_seq?: number          // instance ordinal it originated in
  created_at: number
}

// PlanQuotas.featuresUnlocked gains:
//   recurringWorkspaces: boolean   // Team tier — gates workspace create/linkage
//   (trend reads reuse the existing crossSessionInsights entitlement)
```

## API surface (extends `routes/team-workspaces.ts`)

| Method + path | Purpose | Gate |
|---|---|---|
| `POST /api/teams/:id/workspaces` | create (kind/cadence/template) | `recurringWorkspaces` + owner/admin/member |
| `GET /api/teams/:id/workspaces[?kind=]` | list | team member+ |
| `GET /api/teams/:id/workspaces/:wsId` | detail | team member+ |
| `PATCH /api/teams/:id/workspaces/:wsId` | edit title/cadence/template/retention | owner/admin/member |
| `DELETE /api/teams/:id/workspaces/:wsId` | delete + cascade purge (§8) | owner/admin |
| `GET /api/teams/:id/workspaces/:wsId/history` | linked instances + per-session insights | team member+ |
| `GET /api/teams/:id/workspaces/:wsId/trends` | materialised `workspace_trend` | `crossSessionInsights` + member+ |
| `POST /api/teams/:id/workspaces/:wsId/instances` | create next session, assign `workspace_seq`, pre-seed open actions | `recurringWorkspaces` + owner/admin/member |
| `POST /api/teams/:id/workspaces/:wsId/refresh` | debounced on-demand trend recompute | Team+ |

## Back-compat / test matrix

- One-shot session (`workspace_id = NULL`) → behaviour unchanged at every tier (baseline).
- `0052` `retro`/`ideate` rows → survive the table recreate intact; `event` kind now accepted.
- Linked instances → `history` returns them ordered by `workspace_seq`; `workspace_seq`
  monotonic and gap-tolerant.
- **ZK** instance closed → **absent** from `insights_daily`, vector metadata, and every
  `workspace_trend` row (assert per tier).
- Trend with **2** contributing instances → omitted (k≥3); with 3 (each ≥5 respondents) → surfaces.
- Recurring theme spanning **2** instances → omitted; spanning 3 → surfaces with a label.
- Open action item → pre-seeded into the next instance; resolved item → not carried.
- Lower-tier team hits `…/trends` → `403 feature_not_available` + `upgrade_url`; cron skips it.
- `viewer` create/export → `403`; `member` create same-kind → `200`; export also requires
  `resultsExport`.
- Cron re-run, no new closed instance → no recompute (idempotent); with one → trend updates,
  KV cache invalidates.
- Workspace delete → `sessions.workspace_id` set NULL (results survive); `workspace_trend`,
  `ACTIONS_KV` blob, and team+workspace vector metadata purged.
- Retention sweep past `retention_days` → instance `insights_daily` + KV action history
  purged; next rollup re-materialises without them.
- Cross-tenant `wsId` under another team's `:id` → `403` (team-scope guard first).

## References

- `migrations/0052_stage_workspaces.sql`, `functions/api/routes/team-workspaces.ts`
  (existing stub being extended)
- `knowledge-base/adr/ADR-0045-cross-session-intelligence.md` (rollup shape, ZK boundary,
  cron tiering, k-anonymity), `migrations/0047_cross_session_insights.sql`
- `knowledge-base/adr/ADR-0044-townhall-qa-board.md` (live/KV vs D1-archive tiering, author_hash erasure)
- `functions/api/routes/sessions/shared.ts` (`precomputeInsights`), `routes/sessions/lifecycle.ts`
- `functions/api/lib/insights-vectorize.ts` (`DECISIONS_VECTORIZE` metadata filter)
- `functions/api/lib/tenant-namespace.ts` (`namespacedKey`, ACTIONS_KV isolation),
  `functions/api/lib/kv.ts`, `functions/api/lib/kv-keys.ts`
- `functions/api/types.ts` (`PlanQuotas.featuresUnlocked`), `worker/index.ts`
  (`handleScheduled`), `wrangler.toml` (`crons`)
- `schema.sql` (`workspaces`, `sessions`, `insights_daily`, `team_insight_rollup`,
  `custom_roles`, `team_role_assignments`)
- `knowledge-base/product/planning/NEXT_5_EPICS_PLAN.md` (EPIC-RETRO/IDEATE/STAGE,
  RETRO-00, SEC-WORKSPACE-RBAC-01), `knowledge-base/product/planning/SPRINT81_90_ARCH_NOTES.md`
  (ADR-0048 brief)
