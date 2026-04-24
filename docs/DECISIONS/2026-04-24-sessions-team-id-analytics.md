# ADR-lite: Add `team_id` to `sessions` table for analytics attribution

- **Date:** 2026-04-24
- **Status:** Implemented
- **Owner:** Architect
- **Area:** D1 schema, Analytics Engine, session creation path

## Context

Qesto emits Analytics Engine (AE) events with the contract
`blob1=event`, `blob2=userId`, `blob3=teamId`. The north-star metric —
**sessions per active team per month** — and the team-churn signal both
require `blob3` to be populated on every `session.started` event.

In practice, `blob3` was always empty. The `sessions` D1 table had no
`team_id` column, so the AE event writer had nothing to stamp onto the
event. As a result, the north-star query returned a single unattributed
bucket and team-level retention was uncomputable. Teams exist in
`TEAMS_KV` and users have membership records, so the attribution data is
reachable — it simply was not joined onto sessions.

## Options considered

**A. Query-time join in AE / D1.** Compute team attribution on read by
joining sessions to team-membership at query time. Rejected: AE cannot
join to D1 or KV, and a D1-side join would require materializing team
membership into D1 purely for reporting.

**B. Add nullable `team_id` column to `sessions`, populate at creation.**
Look up the creating user's team in `TEAMS_KV` during
`POST /api/sessions`, write the resolved `teamId` (or `NULL`) onto the
row, and stamp `blob3` from the row at AE emit time.

**C. Separate team-membership events in AE.** Emit `team.member_added`
events and reconstruct session→team attribution in SQL over AE.
Rejected: fragile, expensive at query time, and still leaves historical
sessions unattributed without a second pipeline.

## Decision

**Option B.** Add a nullable `team_id TEXT` column to `sessions`,
populated at session creation by a `TEAMS_KV` lookup on the creating
user. AE emitters read `session.team_id` and stamp it into `blob3`.

## Trade-offs

- **Positive:** backfill-free (nullable means existing rows stay valid);
  no query-time join; idiomatic D1 pattern; `blob3` is authoritative and
  stamped once at the source.
- **Negative:** sessions created by users without a team record write
  `NULL` and therefore do not appear in team-level metrics. Accepted —
  individual-user sessions are still valid for user-level funnels.
- **Risk:** if the `TEAMS_KV` lookup fails at creation, we accept `NULL`
  rather than blocking session creation. Session creation must not
  depend on analytics attribution.

## Implementation

- Column added via the existing `patchSchemaIfNeeded()` idempotent
  migration pattern (no manual `ALTER TABLE`).
- `POST /api/sessions` resolves team via `TEAMS_KV` lookup and writes
  `team_id` onto the row.
- AE emit path stamps `blob3` from `session.team_id`.
- Deployed 2026-04-24.

## Rollback path

The column is nullable and additive. Rollback is to stop writing
`team_id` at creation and stop stamping `blob3`; the column can remain
in place with no schema revert required. No data migration is needed in
either direction.

## Success criteria

- AE audit shows `blob3` non-empty on `session.started` events for
  team-affiliated users.
- The north-star query (`sessions per active team per month`) returns
  per-team buckets instead of a single unattributed bucket.
- No regression in session-creation latency or error rate for users
  without a team.
