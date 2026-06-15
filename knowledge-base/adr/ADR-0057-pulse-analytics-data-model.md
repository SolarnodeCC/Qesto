---
id: ADR-0057
status: accepted
created: 2026-06-19
accepted: 2026-06-19
deciders: architect, product-owner, dpo
relates_to: ADR-0045, ADR-0048, ADR-0010, ADR-0054, SPRINT91_99_STORIES
---

# ADR-0057: PULSE Analytics Product Data Model

## Status

Accepted (S91). Governs E92 PULSE foundation (`PULSE-STORE-01`). Longitudinal features
(`PULSE-LONGITUDINAL-01`, k-anonymity, AI narration) complete in S92–S93 per plan.

## Context

HR/People-ops buyers need cross-session engagement analytics beyond the existing INSIGHTS+
rollup (ADR-0045). PULSE is a **standalone analytics product** with time-series aggregation,
GDPR retention tiers, and tenant isolation — reusing workspace linkage (ADR-0048) and the
session-close async queue (ADR-042).

Constraints: Workers AI only for narration (S93); zero-knowledge sessions excluded at the
write boundary (ADR-0010); k-anonymity floor before cohort visibility (S92).

## Decision

### 1. Two-tier D1 store

**Tier 1 — per-session rollup** (`pulse_session_rollup`)

| Column | Purpose |
|--------|---------|
| `session_id` (PK) | Closed session |
| `team_id`, `workspace_id` | Tenant scope (denormalised) |
| `closed_at` | Session close epoch ms |
| `participant_count`, `vote_count` | Engagement inputs |
| `participation_rate` | `vote_count / max(participant_count, 1)` |
| `sentiment_score` | Nullable aggregate from session sentiment (presenter-only signal) |
| `payload_json` | PII-free extras (question counts, reaction totals) |
| `computed_at` | Rollup timestamp |

**Tier 2 — team daily time-series** (`pulse_team_daily`)

| Column | Purpose |
|--------|---------|
| `team_id`, `day` (PK) | ISO-8601 date bucket |
| `participation_avg`, `sentiment_avg` | Daily aggregates |
| `session_count`, `response_total` | Volume |
| `computed_at` | Last merge timestamp |

### 2. Write path (async, lag < 5 min)

On session close, enqueue `pulse_rollup` to `INSIGHTS_QUEUE` (same consumer as
`precompute_insights`). Consumer writes Tier 1, then merges Tier 2 for the team's close day.

**ZK guard:** skip entirely when `session.anonymity === 'zero_knowledge'`.

### 3. Read path

`GET /api/teams/:id/pulse/summary?window=30d|90d`

- Auth: team member (owner/member/viewer with analytics read)
- Plan gate: `pulseAnalytics` (Team tier+)
- Returns `pulse_team_daily` rows for the window; empty array when no entitled data

### 4. Privacy & retention (foundation)

- Tier 1/2 store **aggregates only** — no per-respondent rows or free text.
- k-anonymity enforcement for dashboard cohorts lands S92 (`PULSE-KANON-01`).
- GDPR retention cron (90d PII redact / 7y delete) lands S92 (`PULSE-RETENTION-01`).
- Query audit log lands S93 (`PULSE-AUDIT-01`).

### 5. Isolation

- All queries bind `team_id` from authenticated membership; cross-team reads return 403.
- Contract tests in `tests/unit/pulse-aggregation.test.ts`.

## Consequences

- S92 adds longitudinal trends, k-anonymity, retention cron, isolation proof.
- S93 adds AI narration (eval-gated) and HR dashboard UI.
- Reuses ADR-0045 Vectorize path for theme clustering; PULSE store is relational time-series.

## References

- `functions/api/lib/pulse-aggregation.ts`
- `functions/api/routes/pulse.ts`
- `migrations/0056_pulse_aggregation.sql`
