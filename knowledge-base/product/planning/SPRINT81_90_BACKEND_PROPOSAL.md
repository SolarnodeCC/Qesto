---
id: SPRINT81_90_BACKEND_PROPOSAL
type: planning
domain: backend
category: backend
status: proposed
version: 1.0
created: 2026-06-01
updated: 2026-06-01
author: qesto-backend
tags:
  - planning
  - backend
  - v5.1
  - v5.2
  - v6.0
  - native-push
  - marketplace
  - stripe-connect
  - agentic
  - townhall
  - retro-ideate
  - deliberate
  - embed-sdk
  - captions
  - sovereign-tier
  - durable-objects
  - d1
  - kv
  - workers-ai
relates_to:
  - SPRINT81_90_PLAN
  - SPRINT81_90_ARCH_NOTES
  - SPRINT81_90_INFRA_PLAN
  - SPRINT81_90_FRONTEND_PROPOSAL
  - SPRINT81_90_AI_PLAN
  - SPRINT81_90_SECURITY_PLAN
  - BACKLOG_MASTER
  - ROADMAP_FULL
  - schema.sql
  - ADR-0044
  - ADR-0045
  - ADR-0046
  - ADR-0047
  - ADR-0048
  - ADR-0049
  - ADR-0050
  - ADR-0051
  - ADR-0052
  - ADR-0053
---

# Sprint 81–90 Backend Proposal — Post-v5.0 → v6.0 GA Expansion Arc

_Prepared: 2026-06-01 (UTC). Backend agent synthesis aligned to [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md) (epics E81–E90, releases v5.1/v5.2/v6.0, ADR-0044–0053), [`BACKLOG_MASTER.md`](../backlog/BACKLOG_MASTER.md), and the live `schema.sql` / `functions/api/` surface._

This proposal commits the **backend (BE) engineering slice** for S81–S90: D1 schema deltas, new KV namespaces, new Durable Object classes, the per-epic API surface, the per-sprint BE story tables (IDs consistent with the master plan), and the risk/sequencing notes the architect and security tracks depend on.

---

## Executive summary

Ten sprints of backend work carrying the platform from **v5.0 GA** to **v6.0 GA** across three thrusts: **reach** (native push backend + device token store), **economy** (Stripe Connect payout + marketplace billing + KYC + agent runtime GA), and **new buyers** (TOWNHALL, RETRO/IDEATE, DELIBERATE, EMBED, CAPTIONS, sovereign tier).

| Metric | Value |
|--------|-------|
| **Total BE points committed (S81–S90)** | **291 pts** |
| New Durable Object classes | **6** — `PushFanoutDO`, `MarketplaceLedgerDO`, `AgentRunDO` (GA per ADR-0039/0046), `TownhallQueueDO`, `WorkspaceDO`, `TallyDO` |
| New KV namespaces | **6** — `DEVICE_TOKENS_KV`, `MARKETPLACE_KV`, `AGENT_KV`, `WORKSPACE_KV`, `EMBED_KV`, `CAPTIONS_KV` |
| New D1 tables (net) | 17 across 9 epics (see deltas) |
| AI method | **Workers AI only** (`c.env.AI.run`) for agent runtime and captions — no Anthropic/OpenAI API (hard rule) |
| Forbidden co-scheduling | ADR-0046 (agent runtime GA, S83) and ADR-0049 (verifiable-vote crypto, S86) never in same sprint — honored |

**BE points are the engineering slice only.** SEC, QA, AI, OPS, MKT, FE, and i18n slices live in their role plans (see [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md) §Role deep-dives). Where a story is tagged `BE/AI` or `BE/SEC` in the master plan, the BE portion is counted here and the partner-track portion in that role's plan.

---

## Foundation assumptions (v5.0 shipped at S80)

| Prerequisite | Backend dependency it unlocks |
|--------------|-------------------------------|
| ADR-0035 SessionRoom decomposed | New realtime DOs (`TownhallQueueDO`, `WorkspaceDO`) follow the decomposed sub-DO pattern, not a monolith |
| ADR-0039 agent runtime foundation | `AgentRunDO` promoted to GA in S83 (ADR-0046) instead of net-new |
| Realtime v3 (`results_delta` wire format) | TOWNHALL upvote deltas and workspace sync reuse the v3 delta envelope |
| CMK / residency (S71–S80) | Sovereign tier (S89) extends the existing residency plane, not a parallel one |
| Workers AI only | Agent runtime and CAPTIONS bind `c.env.AI`; no new external AI binding is introduced or permitted |
| Pages Functions 30s CPU ceiling | Long agent runs and ASR streaming run inside DOs / Workflows, not request handlers |

---

## Data-model & migration impact per epic

All new tables follow existing `schema.sql` conventions: ULID `TEXT PRIMARY KEY`, **unix-ms `INTEGER`** timestamps, `INTEGER NOT NULL DEFAULT 0` booleans, `CHECK` constraints for enums, `idx_<table>_<cols>` indexes on any WHERE column expected > 1000 rows. Each delta lands as a numbered migration block appended to `schema.sql` — never an unversioned `ALTER TABLE`. Schema changes are escalated to the architect before merge (ADR-0048/0049/0052 own the non-trivial ones).

### E81 — Native Mobile GA (S81–S82, ADR-0044)

- **New table `device_tokens`** — `(id, user_id, platform CHECK(platform IN ('ios','android','web')), token TEXT, app_version, locale, created_at, last_seen_at, revoked_at)`; `idx_device_tokens_user`, `idx_device_tokens_revoked`.
- **New table `push_receipts`** — delivery/click telemetry for native push actions `(id, token_id, notification_id, status, sent_at, delivered_at, opened_at)`; `idx_push_receipts_notification`.
- **New KV `DEVICE_TOKENS_KV`** — hot lookup `device:{userId}` → token set; TTL-refreshed on heartbeat (helper in `lib/kv-keys.ts`). Authoritative copy stays in D1.
- **New DO `PushFanoutDO`** — batches and rate-limits fan-out to APNs/FCM, owns retry/backoff and dead-token pruning (external-service fragility gate: explicit timeout + retry + degradation).

### E82 — Marketplace Economy (S82–S83, ADR-0045)

- **New table `marketplace_listings`** — `(id, partner_id, kind CHECK(kind IN ('plugin','template','agent')), title, price_cents, currency, revenue_share_bps, status CHECK(status IN ('draft','review','live','suspended')), created_at, published_at)`; `idx_listings_partner`, `idx_listings_status`.
- **New table `connect_accounts`** — Stripe Connect account map `(id, partner_id, stripe_account_id, kyc_status CHECK(kyc_status IN ('pending','verified','restricted','rejected')), payouts_enabled INTEGER NOT NULL DEFAULT 0, updated_at)`; `idx_connect_partner`.
- **New table `payout_ledger`** — append-only `(id, listing_id, buyer_team_id, gross_cents, fee_cents, net_cents, currency, stripe_transfer_id, status, occurred_at)`; `idx_payout_listing`, `idx_payout_status`.
- **New table `marketplace_purchases`** — entitlement record `(id, team_id, listing_id, purchased_at, refunded_at)`; `idx_purchases_team`.
- **New KV `MARKETPLACE_KV`** — listing catalog cache + entitlement check `entitlement:{teamId}:{listingId}`.
- **New DO `MarketplaceLedgerDO`** — single-writer guard around payout ledger to serialize Connect transfer state and KYC-webhook reconciliation (idempotent on `stripe_event_id`).

### E83 — Agentic Facilitation (S83–S84, ADR-0046)

- **New table `agent_definitions`** — `(id, owner_id, marketplace_listing_id, model TEXT, tools_json TEXT, sandbox_policy_json TEXT, status, created_at)`; `idx_agent_owner`.
- **New table `agent_runs`** — `(id, agent_id, session_id, status CHECK(status IN ('queued','running','succeeded','failed','halted')), started_at, ended_at, token_cost, error_code)`; `idx_agent_runs_session`, `idx_agent_runs_status`.
- **New KV `AGENT_KV`** — run scratch state + safety-eval verdict cache `agent:run:{runId}`.
- **DO `AgentRunDO`** promoted to **GA** (ADR-0039 → ADR-0046): owns the run loop, tool-call sandbox gating, and Cloudflare **Workflows** handoff for multi-step facilitation. **Workers AI only** — every model call is `c.env.AI.run(...)`; no external AI binding. Sandbox policy enforced per `sandbox_policy_json` before any tool dispatch (`SEC-AGENT-SANDBOX-01`).

### E84 — Town Hall & Hybrid Events (S84–S85, ADR-0047)

- **New table `townhall_questions`** — `(id, session_id, author_anon_id, body, upvotes INTEGER NOT NULL DEFAULT 0, status CHECK(status IN ('pending','approved','rejected','answered','merged')), merged_into, created_at, moderated_at)`; `idx_townhall_session_status`, `idx_townhall_upvotes`.
- **New table `townhall_moderation_log`** — audit of moderator actions `(id, question_id, moderator_id, action, reason, occurred_at)`; `idx_modlog_question`.
- **New DO `TownhallQueueDO`** — moderation queue + upvote aggregation at scale; emits realtime-v3 `results_delta` for upvote counts; debounced KV/D1 flush; targets 50k concurrent (`TOWNHALL-SCALE-PROOF-50K-01`, S85). Reuses decomposed SessionRoom sub-DO pattern (ADR-0035), not a monolith.
- KV: reuses `SESSIONS_KV` for ephemeral anonymity-id mapping; no new namespace.

### E85 — Continuous Collaboration / RETRO + IDEATE (S85–S86, ADR-0048)

- **New table `workspaces`** — recurring container `(id, team_id, kind CHECK(kind IN ('retro','ideate')), title, cadence, created_at, archived_at)`; `idx_workspaces_team`.
- **New table `workspace_sessions`** — links a workspace to each recurring run `(id, workspace_id, session_id, occurred_at, health_score)`; `idx_wss_workspace`.
- **New table `workspace_history`** — trend snapshots `(id, workspace_id, metric, value, captured_at)`; `idx_wshistory_workspace_metric`.
- **New KV `WORKSPACE_KV`** — board hot state + recurring-template cache.
- **New DO `WorkspaceDO`** — live retro/ideate board collaboration (sticky notes, grouping, voting) over realtime v3; persists deltas to `WORKSPACE_KV` then D1 on close. RBAC enforced via shared workspace helper (`SEC-WORKSPACE-RBAC-01`).

### E86 — Verifiable Governance / DELIBERATE (S86–S87, ADR-0049)

- **New table `vote_receipts`** — `(id, session_id, ballot_hash TEXT, receipt_code TEXT, voter_salt_ref, issued_at)`; `idx_receipts_session`, unique `idx_receipts_code`. Receipt is a cryptographic commitment (HMAC/hash over ballot + per-session secret) — **not** blockchain (out of scope per master plan).
- **New table `tally_runs`** — `(id, session_id, tally_root TEXT, ballot_count, computed_at, computed_by CHECK(computed_by IN ('platform','independent')))`; `idx_tally_session`. Supports **independent re-tally** (`DELIBERATE-RETALLY-01`, S87).
- **New DO `TallyDO`** — single-writer tally aggregator producing a deterministic, re-computable tally root; isolates the integrity-critical path from request handlers. Crypto material via WebCrypto (`crypto.subtle`), edge-compatible.
- KV: receipts surfaced through existing `DECISIONS_KV` / `AUDIT_KV`; no new namespace.

### E87 — Embeddable Platform / EMBED (S87–S88, ADR-0050)

- **New table `embed_widgets`** — `(id, team_id, session_id, kind, allowed_origins_json TEXT, theme_json, sdk_key_hash TEXT, status, created_at, revoked_at)`; `idx_embed_team`, unique `idx_embed_keyhash`.
- **New table `embed_events`** — embed-origin engagement telemetry `(id, widget_id, origin, event, occurred_at)`; `idx_embed_events_widget`.
- **New KV `EMBED_KV`** — SDK-key → widget-config + origin-allowlist hot path `embed:key:{hash}`.
- DO: none net-new; embed widgets bridge to existing SessionRoom/TownhallQueueDO read paths. Origin sandboxing + SDK auth enforced in middleware (`SEC-EMBED-ORIGIN-01`).

### E88 — Adaptive Experience & CAPTIONS (S88–S89, ADR-0051)

- **New table `caption_tracks`** — `(id, session_id, source_lang, target_langs_json, status, started_at, ended_at, wer_estimate)`; `idx_captions_session`.
- **New KV `CAPTIONS_KV`** — rolling ASR/MT segment buffer `captions:{sessionId}:seg` (short TTL; transient).
- **CAPTIONS pipeline** — ASR + MT via **Workers AI only** (`c.env.AI.run` for the approved ASR + translation models); streamed through the live session DO. Explicit timeout + degradation (drop to source-language passthrough on model failure). No third-party transcription/translation service (hard rule).
- CANVAS (themes + adaptive dataviz) is FE-led; BE delta limited to a `theme_json` column on existing session/team config (no new table).

### E89 — Gov Cloud & Sovereign Tier (S89, ADR-0052)

- **New table `tenant_data_planes`** — `(id, team_id, plane CHECK(plane IN ('commercial','gov','sovereign')), region, ato_boundary_ref, created_at)`; `idx_planes_team`.
- Extends existing residency/CMK tables (S71–S80); no new KV/DO. Sovereign tier pins storage + AI inference to the in-boundary region and routes through the existing residency middleware. FedRAMP Moderate boundary documented in ADR-0052; BE work is enforcement wiring + `API-PLAT-V6-AUDIT-01` surface review.

### E90 — Platform v6.0 Certification (S90, ADR-0053)

- No new tables. `GET /api/platform/version` → `6.0.0`; v5.x deprecation headers on `public-api-v1/v2`; sunset notice (`V5X-SUNSET-NOTICE-01`).

---

## API surface additions (route list per epic)

New handlers live in thin `routes/{domain}.routes.ts` modules mounted in `functions/api/[[route]].ts`; multi-step logic goes to `services/` + `repositories/`, KV/HTTP helpers via `lib/kv.ts` / `lib/http.ts` / `lib/kv-keys.ts` (audit gates).

| Epic | Routes added |
|------|--------------|
| **E81 Native** | `POST /api/push/tokens` (register), `DELETE /api/push/tokens/:id` (revoke), `POST /api/push/test` (host), `POST /api/push/send` (internal/cron via `PushFanoutDO`), `POST /api/push/receipts` (telemetry). Extends existing `pwa-push.ts`. |
| **E82 Marketplace** | `POST /api/marketplace/listings`, `PATCH /api/marketplace/listings/:id`, `GET /api/marketplace/listings`, `POST /api/marketplace/connect/onboard`, `GET /api/marketplace/connect/status`, `POST /api/marketplace/purchase`, `GET /api/marketplace/payouts`, `POST /api/webhooks/stripe-connect` (KYC + transfer webhooks, idempotent). Extends `partner-marketplace.ts`. |
| **E83 Agentic** | `POST /api/agents`, `PATCH /api/agents/:id`, `POST /api/agents/:id/runs`, `GET /api/agents/:id/runs/:runId`, `POST /api/agents/:id/runs/:runId/halt`, `GET /api/marketplace/agents`. AgentRunDO-fronted. |
| **E84 Townhall** | `POST /api/sessions/:id/townhall/questions`, `POST /api/sessions/:id/townhall/questions/:qid/upvote`, `PATCH /api/sessions/:id/townhall/questions/:qid` (moderate), `GET /api/sessions/:id/townhall/queue`. Extends `townhall/` route dir; mutations forbidden on DRAFT (LIVE/DO-owned). |
| **E85 Retro/Ideate** | `POST /api/workspaces`, `GET /api/workspaces`, `GET /api/workspaces/:id`, `POST /api/workspaces/:id/sessions`, `GET /api/workspaces/:id/history`, `PATCH /api/workspaces/:id` (archive). |
| **E86 Deliberate** | `GET /api/sessions/:id/receipts/:code` (voter receipt lookup), `POST /api/sessions/:id/tally`, `GET /api/sessions/:id/tally`, `POST /api/sessions/:id/retally` (independent). |
| **E87 Embed** | `POST /api/embed/widgets`, `PATCH /api/embed/widgets/:id`, `DELETE /api/embed/widgets/:id`, `GET /api/embed/v1/config` (SDK, origin-checked), `POST /api/embed/v1/events` (SDK telemetry), `GET /api/embed/v1/session/:code` (headless read). |
| **E88 Captions** | `POST /api/sessions/:id/captions/start`, `POST /api/sessions/:id/captions/stop`, `GET /api/sessions/:id/captions/status`. Live segment stream flows over the session DO WS, not REST. |
| **E89 Sovereign** | `POST /api/admin/tenants/:teamId/data-plane`, `GET /api/admin/tenants/:teamId/data-plane`. Extends `residency.ts` / `multi-region-admin.ts`. |
| **E90 v6.0** | `GET /api/platform/version` → `6.0.0`; deprecation/sunset headers on `public-api-v1`, `public-api-v2`. |

New WebSocket message types (documented in `knowledge-base/api/API_FULL.md`): `townhall_question_added`, `townhall_upvote_delta`, `townhall_moderated`, `workspace_note_delta`, `workspace_group_delta`, `caption_segment`, `agent_run_status`.

---

## Per-sprint BE story tables

IDs are consistent with [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md). Points below are the **BE slice only**; for `BE/FE`, `BE/AI`, `BE/SEC` shared stories the partner-track points sit in that role's plan. Each row carries its ADR and the data-model/DO/KV it touches.

### Sprint 81 — Native push backend (BE: 21)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `NATIVE-PUSH-01` (BE half of NATIVE-SHELL/PUSH) | 13 | 0044 | `device_tokens`, `push_receipts`, `DEVICE_TOKENS_KV`, `PushFanoutDO`, push routes |
| `MARKETPLACE-BILLING-SPIKE-01` | 8 | 0045 | Connect spike, ledger schema draft, KYC webhook shape |

### Sprint 82 — Mobile GA + marketplace billing (BE: 30)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `NATIVE-GA-01` (BE half) | 8 | 0044 | release plumbing, push receipts telemetry |
| `MARKETPLACE-CONNECT-01` | 13 | 0045 | `connect_accounts`, Connect onboard routes, `MarketplaceLedgerDO` |
| `MARKETPLACE-PAYOUT-01` (BE half) | 9 | 0045 | `payout_ledger`, stripe-connect webhook, idempotency |

### Sprint 83 — v5.1 RC + agent runtime foundation (BE: 34)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `MARKETPLACE-PAID-LISTING-01` | 13 | 0045 | `marketplace_listings`, `marketplace_purchases`, `MARKETPLACE_KV`, entitlement check |
| `RC-V51-01` (BE slice) | 8 | — | RC gate, contract suite, deprecation headers |
| `AGENT-RUNTIME-01` (BE half) | 13 | 0046 | `agent_definitions`, `agent_runs`, `AGENT_KV`, `AgentRunDO` GA + Workflows |

### Sprint 84 — Town hall + agent marketplace (BE: 31)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `TOWNHALL-QUEUE-01` (BE half) | 13 | 0047 | `townhall_questions`, `townhall_moderation_log`, `TownhallQueueDO` |
| `TOWNHALL-MODERATE-01` (BE half) | 5 | 0047 | moderation routes, status transitions |
| `AGENT-MARKETPLACE-01` (BE half) | 13 | 0046 | agent listing wiring, sandbox gate, marketplace/agents route |

### Sprint 85 — Hybrid events + retro/ideate foundation (BE: 26)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `RETRO-WORKSPACE-01` (BE half) | 13 | 0048 | `workspaces`, `workspace_sessions`, `workspace_history`, `WORKSPACE_KV`, `WorkspaceDO` |
| `IDEATE-BOARD-01` (BE half) | 8 | 0048 | ideate board persistence, grouping deltas |
| `STAGE-SUITE-01` (BE half) | 5 | — | hybrid-event read surfaces over existing DOs |

### Sprint 86 — v5.2 RC + verifiable voting foundation (BE: 26)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `IDEATE-PRIORITIZE-01` (BE half) | 5 | 0048 | prioritization tally on `WorkspaceDO` |
| `RC-V52-01` (BE slice) | 8 | — | RC gate, contract + load suites |
| `DELIBERATE-RECEIPT-01` (BE half) | 13 | 0049 | `vote_receipts`, `tally_runs`, `TallyDO`, WebCrypto commitment |

### Sprint 87 — Embeddable SDK + governance GA (BE: 34)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `EMBED-SDK-01` (BE half) | 13 | 0050 | `embed_widgets`, `EMBED_KV`, SDK-key auth, origin sandbox middleware |
| `EMBED-WIDGET-API-01` (BE half) | 8 | 0050 | `embed_events`, `/api/embed/v1/*` routes |
| `DELIBERATE-GA-01` | 8 | 0049 | governance GA wiring, receipt UX backend |
| `DELIBERATE-RETALLY-01` | 5 | 0049 | independent re-tally route + deterministic tally root |

### Sprint 88 — Adaptive experience + captions (BE: 13)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `CAPTIONS-PIPELINE-01` (BE half) | 13 | 0051 | `caption_tracks`, `CAPTIONS_KV`, Workers-AI ASR+MT over session DO, degradation path |

### Sprint 89 — v6.0 RC + sovereign tier (BE: 21)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `RC-V60-RC-01` (BE slice) | 8 | 0053 | RC gate, full regression, API audit prep |
| `SOVEREIGN-TIER-01` | 13 | 0052 | `tenant_data_planes`, residency enforcement, in-boundary AI routing |

### Sprint 90 — v6.0 GA (BE: 14)

| ID | Pts | ADR | Touches |
|----|-----|-----|---------|
| `V60-GA-RELEASE-01` (BE half) | 9 | 0053 | version bump → `6.0.0`, certification surface, deprecation headers |
| `V5X-SUNSET-NOTICE-01` | 5 | 0053 | sunset headers + notice on `public-api-v1/v2` |

**Per-sprint BE totals:** S81 21 · S82 30 · S83 34 · S84 31 · S85 26 · S86 26 · S87 34 · S88 13 · S89 21 · S90 14 = **291 pts**.

---

## Workers-AI-only confirmation

| Surface | Model invocation | External AI API? |
|---------|------------------|------------------|
| Agent runtime (`AgentRunDO`, ADR-0046) | `c.env.AI.run(...)` per tool/turn | **No** — forbidden by hard rule |
| Agent facilitation (`AGENT-FACILITATE-*`) | `c.env.AI.run(...)` | **No** |
| CAPTIONS ASR + MT (ADR-0051) | `c.env.AI.run(<approved ASR>)` + `c.env.AI.run(<approved MT>)` | **No** |
| AI retro summarizer / idea clustering (AI track) | `c.env.AI.run(...)` | **No** |

No new AI binding is added to `wrangler.toml`. Every agentic and captions code path binds the existing `c.env.AI`. Reviewers should reject any PR introducing `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or an external transcription/translation fetch on these surfaces.

---

## External-service fragility decisions (audit gate)

Each external integration carries an explicit timeout / retry / degradation decision; missing ones are escalated to devops + architect.

| Service | Decision |
|---------|----------|
| APNs / FCM (E81) | `PushFanoutDO` owns batched fan-out, exponential backoff, dead-token pruning; degrade = drop + log, never block request handler. |
| Stripe Connect (E82) | Idempotent on `stripe_event_id`; webhook signature verified; transfer retries via `MarketplaceLedgerDO`; degrade = queue + reconcile, surface KYC `restricted` state. |
| Workers AI ASR/MT (E88) | Per-segment timeout; on failure degrade to source-language passthrough; WER tracked on `caption_tracks`. |
| Workers AI agent runs (E83) | Per-turn timeout + max-turn ceiling in `AgentRunDO`; `halted` terminal state; sandbox policy checked before every tool dispatch. |

---

## Risk & sequencing notes

1. **ADR-0046 (S83) and ADR-0049 (S86) are never co-scheduled** — honored by construction; they are three sprints apart and split across Pentest #4 (mobile + marketplace, S81–S83) and Pentest #5 (governance + embed + agent, S87–S89). Do not pull DELIBERATE crypto work forward into S83.
2. **Marketplace payout is gated on KYC + legal/finance review (S83)** before paid listings go live. `MarketplaceLedgerDO` must be idempotent and reconciliation-safe before any real transfer; `CONTRACT-MARKETPLACE-PAYOUT-01` (QA, S83) is a hard gate.
3. **Agent safety eval green (`SEC-AGENT-EVAL-01`, S84)** gates agent marketplace going public; sandbox policy enforcement (`SEC-AGENT-SANDBOX-01`, S83) ships before public agents.
4. **TownhallQueueDO scale** — 50k-concurrent proof (`TOWNHALL-SCALE-PROOF-50K-01`, S85) and staging WS smoke are mandatory before scale marketing; debounce KV/D1 flush to avoid hot-key contention on upvotes.
5. **Verifiable re-tally independence** — `TallyDO` must produce a deterministic, re-computable root so an independent party can re-tally (`DELIBERATE-RETALLY-01`, S87 gate) without platform secrets beyond the published commitment scheme.
6. **Embed origin sandboxing** — SDK-key auth + origin allowlist enforced in middleware before any session data is served; `SEC-EMBED-ORIGIN-01` blocks GA.
7. **Sovereign tier reuses the residency plane** (ADR-0052) — do not fork a parallel data plane; enforce in existing residency middleware and pin AI inference in-boundary.
8. **Schema migrations are architect-gated** — ADR-0048 (workspace model), ADR-0049 (receipts/tally), ADR-0052 (data planes) each carry a migration entry appended to `schema.sql`; no unversioned `ALTER TABLE`.
9. **Realtime-touching DOs require staging WebSocket smoke** (`TownhallQueueDO`, `WorkspaceDO`, captions stream) per audit alignment.

---

## New env bindings (S81–S90)

| Binding | Type | Sprint | Notes |
|---------|------|--------|-------|
| `DEVICE_TOKENS_KV` | KV namespace | S81 | `wrangler.toml` binding (id added by devops) |
| `MARKETPLACE_KV` | KV namespace | S83 | |
| `AGENT_KV` | KV namespace | S83 | |
| `WORKSPACE_KV` | KV namespace | S85 | |
| `EMBED_KV` | KV namespace | S87 | |
| `CAPTIONS_KV` | KV namespace | S88 | short-TTL transient |
| `PushFanoutDO` / `MarketplaceLedgerDO` / `AgentRunDO` / `TownhallQueueDO` / `WorkspaceDO` / `TallyDO` | DO bindings | S81–S86 | `[[durable_objects.bindings]]` + migration tag |
| `APNS_KEY` / `FCM_KEY` | secret | S81 | `wrangler pages secret put APNS_KEY` (never in `wrangler.toml`) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | secret | S82 | `wrangler pages secret put STRIPE_CONNECT_WEBHOOK_SECRET` |
| `EMBED_SDK_SIGNING_SECRET` | secret | S87 | `wrangler pages secret put EMBED_SDK_SIGNING_SECRET` |

KV namespace IDs and DO migration tags are committed by devops in [`SPRINT81_90_INFRA_PLAN.md`](./SPRINT81_90_INFRA_PLAN.md); secrets via `wrangler pages secret put` only (hard rule).

---

## Docs to update as stories land

| Change | Doc |
|--------|-----|
| New HTTP routes (E81–E90) | `knowledge-base/api/API_FULL.md` |
| New WS message types (townhall/workspace/captions/agent) | `knowledge-base/api/API_FULL.md` |
| New KV namespaces + DO classes | `knowledge-base/architecture/ARCHITECTURE.md` |
| D1 migrations (ADR-0048/0049/0052) | `knowledge-base/architecture/ARCHITECTURE.md` + `schema.sql` |
| New secrets/env bindings | `docs/CONFIGURATION.txt` + `CLAUDE.md` |
| Shipped stories | `BACKLOG_MASTER.md` + per-sprint release notes |

---

## Backend sign-off checklist

- [ ] Architect signs ADR-0044/0045/0046/0047/0048/0049/0050/0051/0052/0053 before the BE story in its sprint starts
- [ ] No PR on agent/captions surfaces introduces an external AI API binding (Workers AI only)
- [ ] ADR-0046 and ADR-0049 confirmed in different sprints in the tracker
- [ ] Stripe Connect KYC + payout idempotency reviewed by legal/finance before S83 paid listings
- [ ] `MarketplaceLedgerDO` and `TallyDO` proven single-writer/idempotent under contract tests
- [ ] Every external service (APNs/FCM, Stripe Connect, Workers AI) has timeout/retry/degradation wired
- [ ] All new schema lands as versioned migration in `schema.sql`, architect-approved
- [ ] `npm test` and `tsc --noEmit` green on every BE PR
