---
id: ADR-0045
status: accepted
created: 2026-05-30
accepted: 2026-06-01
relates_to: ADR-0009-pii-sanitization, ADR-0010-zero-knowledge-mode, ADR-0011-live-sentiment-inference, ADR-0018-kb-rag-activation, ADR-KV-Tenant-Conventions
---

# ADR-0045: Cross-Session Intelligence Aggregation & Privacy Model

## Context

Qesto's analytics stop at the single session. `precomputeInsights()`
(`functions/api/routes/sessions/shared.ts:263`) runs fire-and-forget on session
close (`lifecycle.ts:324`) and writes one distilled-themes row per closed session to
the **existing** `insights_daily` table; `useInsights` + `InsightThemeCard` then derive
a team's "top themes" **client-side** by calling the per-session analyze endpoint and
summing in the browser. That is DX-INSIGHTS-02, not a product.

EPIC-INSIGHTS+ (Competitive epic #3) lifts this into a longitudinal **Voice-of-Customer /
L&D intelligence** product: recurring-topic detection, engagement trend lines, and a
per-facilitator scorecard **across all of a team's sessions**. This ADR fixes the
data model, the compute tier, and — most importantly — the privacy model, because
aggregating across sessions is exactly where a naive implementation re-identifies
anonymous and zero-knowledge respondents.

Constraints that are non-negotiable: Workers AI only (hard rule #1); zero-knowledge
sessions (ADR-0010) must never contribute to any cross-tenant or cross-session aggregate;
no PII in derived stores (ADR-0009); and the session-close hot path must not gain latency.

## Decision

1. **Two-tier store; reuse the per-session tier.** The per-session tier is the **existing
   `insights_daily` table** — do **not** add a redundant `session_insights` table (this
   refines INSIGHTS-01's provisional schema). It is extended by migration `0047` with a
   denormalised `team_id` (copied from `sessions` at write time, for cheap team-scoped
   reads and ZK filtering) and an `embedding_ref` flag. The **team tier** is a new
   materialised table `team_insight_rollup(team_id, kind, window, payload_json,
   computed_at)`, where `kind ∈ ('recurring_themes','engagement_trend','facilitator_scorecard')`
   and `payload_json` is a pre-aggregated, PII-free blob — mirroring the proven
   `insights_daily.themes_json` shape rather than over-normalising.

2. **Reuse `DECISIONS_VECTORIZE`; no new index.** Per-session embeddings are already
   produced and upserted via `lib/insights-vectorize.ts` (768d cosine, 5s timeout).
   Upserts are tagged with `team_id`, `session_id`, and `closed_at` **metadata** so
   recurring-topic clustering is a metadata-filtered `query(vector, { topK, filter: {
   team_id } })` over a team's recent embeddings — no separate clustering store.

3. **Compute is async and tiered — zero hot-path cost.**
   - *Tier 1 (on close, exists):* `precomputeInsights()` writes `insights_daily` + upserts
     the embedding. **New ZK guard:** skip entirely when `session.anonymity ===
     'zero_knowledge'`.
   - *Tier 2 (team rollup, new):* the **existing daily cron** (`wrangler.toml`
     `crons = ["0 2 * * *"]`, `worker/index.ts:handleScheduled`) iterates teams that
     (a) hold the `crossSessionInsights` entitlement and (b) have ≥1 newly closed session
     since `last_rollup_at`, recomputes the three `kind`s, writes `team_insight_rollup`,
     and invalidates the KV read cache. Team+ users get an on-demand "Refresh" that
     enqueues the same job for their team only (debounced) to cover the freshness lag.
   - *Read path:* `GET /api/teams/:id/insights/*` serves `team_insight_rollup` through a
     tenant-namespaced KV cache key (`namespacedKey(teamId, 'insights:<kind>')`,
     per ADR-KV-Tenant-Conventions).

4. **Privacy model (the core of this ADR).**
   - **ZK exclusion** is enforced at the Tier-1 write boundary, so ZK sessions are
     structurally absent from `insights_daily`, the vector metadata, and therefore every
     rollup — defence in depth, not a query-time filter that can be forgotten.
   - **k-anonymity floor**, consistent with ADR-0011: a recurring theme surfaces only if
     its cluster spans **≥3 distinct sessions**; any respondent-derived metric requires
     **≥5 respondents** in the contributing session. Below floor → the signal is omitted,
     not blurred.
   - Rollups store **only aggregates** (counts, centroid refs, bucketed rates) — never
     per-respondent rows, free-text answers, or identifiers. `safeLogContext()` applies to
     the cron path (ADR-0009).
   - The facilitator scorecard is **team-internal** (`owner_id` is a team member),
     gated by team membership + the existing analytics RBAC permission; it is never
     cross-tenant.

5. **Plan gating.** A new `crossSessionInsights` key in `PlanQuotas.featuresUnlocked`
   (`functions/api/types.ts`), Team tier and above, following the `townhallQA` precedent.
   The cron computes **only** for entitled teams (cost control); the read API returns
   `403 feature_not_available` with `upgrade_url` for lower tiers (no data leak in the
   empty-state).

6. **AI stays on Workers AI.** Clustering uses the existing Workers-AI embeddings; theme
   labelling reuses `lib/ai-insights.ts` (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
   No third-party egress.

## Alternatives considered

- **New `session_insights` table** — rejected: `insights_daily` already is the
  per-session aggregate tier with a ZK-deletable, session-scoped row; duplicating it
  doubles the close-path write and the GDPR surface.
- **New Vectorize index for insights** — rejected: `DECISIONS_VECTORIZE` already holds the
  embeddings; a `team_id` metadata filter gives team-scoped clustering for free.
- **Synchronous rollup on session close** — rejected: recomputes a whole team per close and
  adds latency to the hot path; the daily cron amortises and a debounced on-demand refresh
  covers urgency.
- **On-the-fly computation per page load (no materialisation)** — rejected: O(sessions ×
  embeddings) Vectorize queries per request blows the 2s p95 budget and the cost envelope.
- **Real-time streaming aggregation (DO/queue)** — rejected: cross-session intelligence is
  a longitudinal product, not latency-sensitive; daily freshness with on-demand refresh is
  sufficient and far cheaper.
- **Query-time ZK filtering** — rejected in favour of write-boundary exclusion: a single
  missed filter would leak ZK data into an aggregate; structural absence cannot.

## Consequences

- Reuses `insights_daily`, `insights-vectorize.ts`, the daily cron, and the entitlement +
  tenant-KV conventions — INSIGHTS-02+ is mostly wiring, not net-new infrastructure.
- Clean GDPR story: rollups are derived aggregates over ZK-free, PII-free inputs; session
  delete already purges `insights_daily` (`session-delete.ts:19`) and the next cron
  re-materialises without it; **team delete must also purge `team_insight_rollup` + the
  team's vector metadata** (new deletion step).
- Existing single-session insights (`GET /insights/themes`, `useInsights`,
  `InsightThemeCard`) are unchanged — regression baseline.
- **Daily freshness lag** between close and rollup — mitigated by the Team+ on-demand
  refresh.
- **Cron cost scales with entitled, recently-active teams** — bounded by entitlement gating
  and the "changed since `last_rollup_at`" guard; clustering cost bounded by `topK` + a
  recent-window filter.
- A new `kind`-discriminated rollup table trades some query rigidity for schema
  flexibility — acceptable given payloads are read whole and cached.

## Back-compat / test matrix

- Closed **non-ZK** session → appears in `insights_daily` with `team_id`; embedding carries
  `team_id` metadata.
- Closed **ZK** session → **absent** from `insights_daily`, vector metadata, and every
  rollup (assert at each tier).
- Theme spanning **2** sessions → **omitted** (k≥3 floor); spanning 3 → surfaces.
- Metric from a session with **<5** respondents → omitted.
- Lower-tier team hits read API → `403 feature_not_available` with `upgrade_url`; cron
  skips it.
- Cron re-run with no new closed sessions → no recompute (idempotent); with new sessions →
  rollup updates and KV cache invalidates.
- Session delete then cron → theme/metric contribution gone. Team delete → rollup + vector
  metadata purged.

## References

- `functions/api/routes/sessions/shared.ts` (`precomputeInsights`), `routes/sessions/lifecycle.ts`
- `functions/api/lib/insights-vectorize.ts` (`DECISIONS_VECTORIZE` upsert/query precedent)
- `functions/api/lib/entitlements.ts`, `functions/api/types.ts` (`featuresUnlocked`)
- `functions/api/lib/tenant-namespace.ts` (`namespacedKey`), `worker/index.ts`, `wrangler.toml [triggers]`
- `schema.sql` (`insights_daily`), migration `0047_cross_session_insights.sql` (INSIGHTS-01)
- EPIC-INSIGHTS+ in `knowledge-base/product/backlog/BACKLOG_MASTER.md`
