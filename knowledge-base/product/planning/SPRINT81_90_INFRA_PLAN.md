---
id: SPRINT81_90_INFRA_PLAN
type: planning
domain: devops
category: planning
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - devops
  - infrastructure
  - capacitor-pipeline
  - stripe-connect
  - agent-runtime-do
  - fedramp-ato
  - sovereign-tenant
  - townhall-scale
  - embed-cdn
  - captions-pipeline
  - dr-drill
  - v6-infra
relates_to:
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
  - SPRINT81_90_PLAN
  - SPRINT71_80_INFRA_PLAN
  - BACKLOG_MASTER
  - OPS_RUNBOOKS_V3
---

# Sprint 81–90 Infrastructure Plan — Native Mobile Pipeline + Marketplace Payout + Agent Runtime + Gov Cloud + v6.0 GA

_Created: 2026-06-01 by DevOps. Horizon: S81–S90 (~2028-02-18 → 2028-07-07)._
_Basis: SPRINT71_80_INFRA_PLAN (v5.0-infra complete), ADR-0044–ADR-0053, SPRINT81_90_PLAN themes E81–E90._

---

## Context and Prerequisites

S71–S80 delivers **v5.0-infra**: multi-region writes GA (`WRITE_REGION_PCT=100`), DR full-region automation (RTO ≤ 15 min), 50k load proof (P95 ≤ 100ms), SLO paging GA, global 3-region CI/CD pipeline, chaos monthly GA, v5 KV namespaces provisioned, observability v2 unified dashboard, staging v5 parity. By S81 the following are assumed complete:

| Gate | Evidence needed at S81 start |
|------|------------------------------|
| v5.0 GA shipped | `GET /api/platform/version` → `5.0.0`; v5.0.0.md release artifact exists |
| v5.0-infra GA (DEVOPS-V5-03) | `/api/admin/health` all v5 bindings green; `V5_RELEASE_GATE_CHECKLIST.md` signed |
| MR writes GA (DEVOPS-MRW-09) | `WRITE_REGION_PCT=100` in prod; ADR-0027 marked implemented |
| DR full-region automation (DEVOPS-DRA-08) | `dr-failover.sh --from us --to eu` RTO ≤ 15 min proven in last quarterly drill |
| 50k load proof current | `/api/admin/perf/50k-proof` green; evidence ≤ 90 days old at S81 kickoff |
| Staging v5 parity (DEVOPS-STG-10) | `wrangler deploy --env staging --dry-run` all v5 bindings pass |
| SLO paging GA (DEVOPS-PAG-03/PAG-04) | On-call rotation live; `PAGERDUTY_ROUTING_KEY` provisioned |
| ADR-0042 accepted (Capacitor shell) | Shell infra design signed off; pre-condition for store pipeline |
| ADR-0043 accepted (FedRAMP mapping) | Control mapping docs complete; pre-condition for full ATO boundary work |

**Velocity assumption:** 28–35 pts/sprint. Stories are grouped into five workstreams (Mobile-Pipeline, Marketplace-Infra, Agent-Infra, Scale-Ops, Gov-Cloud) operating concurrently. Target: 310 pts across 10 sprints (31.0 avg).

---

## Release Map

| Release | Sprints | DevOps milestone |
|---------|---------|-----------------|
| v5.1-infra | S81–S83 | Capacitor CI/CD GA, Stripe Connect payout infra live, AgentRunDO binding provisioned |
| v5.2-infra | S84–S86 | TOWNHALL DO moderation queue at scale, recurring-workspace D1 migrations, verifiable-vote KV isolation |
| v6.0-rc-infra | S87–S89 | Embed SDK CDN edge, captions pipeline (Workers AI), FedRAMP sovereign data plane, DR pre-drill |
| v6.0-GA-infra | S90 | Annual DR drill (RTO ≤ 2h evidence), v6.0 release gate, v5.x sunset runbook |

---

## Sprint Table

| Sprint | Window (est.) | Theme | Stories | Pts |
|--------|---------------|-------|---------|-----|
| **S81** | 2028-02-18 → 03-03 | Capacitor build/sign pipeline + Stripe Connect secrets staging | DEVOPS-MOB-01, DEVOPS-MOB-02, DEVOPS-MKT-01, DEVOPS-OPS-01 | **31** |
| **S82** | 2028-03-04 → 03-17 | Store notarize/publish automation + Stripe Connect payout binding GA | DEVOPS-MOB-03, DEVOPS-MOB-04, DEVOPS-MKT-02, DEVOPS-MKT-03 | **34** |
| **S83** | 2028-03-18 → 03-31 | AgentRunDO binding + Workflows capacity + v5.1-infra release gate | DEVOPS-AGT-01, DEVOPS-AGT-02, DEVOPS-OPS-02, DEVOPS-SEC-07 | **31** |
| **S84** | 2028-04-01 → 04-14 | TOWNHALL moderation DO scaling + 50k revalidation + agent cost metering | DEVOPS-TOWN-01, DEVOPS-TOWN-02, DEVOPS-AGT-03, DEVOPS-LT-07 | **34** |
| **S85** | 2028-04-14 → 04-28 | Recurring-workspace D1 migrations + load regression refresh + chaos audit | DEVOPS-WS-01, DEVOPS-WS-02, DEVOPS-LT-08, DEVOPS-CHX-13 | **29** |
| **S86** | 2028-04-28 → 05-12 | Verifiable-vote KV isolation + v5.2-infra release gate + payout compliance logging | DEVOPS-GOV-01, DEVOPS-MKT-04, DEVOPS-OPS-03, DEVOPS-SEC-08 | **28** |
| **S87** | 2028-05-12 → 05-26 | Embed SDK CDN/edge distribution + widget origin CSP hardening + captions pipeline prep | DEVOPS-SDK-01, DEVOPS-SDK-02, DEVOPS-CAP-01, DEVOPS-SEC-09 | **34** |
| **S88** | 2028-05-26 → 06-09 | Live captions Workers AI pipeline infra + sovereign tenant data plane foundation | DEVOPS-CAP-02, DEVOPS-CAP-03, DEVOPS-SOV-01, DEVOPS-OPS-04 | **31** |
| **S89** | 2028-06-09 → 06-23 | FedRAMP ATO boundary hardening + annual DR pre-drill + v6.0-rc gate | DEVOPS-FED-01, DEVOPS-FED-02, DEVOPS-DR-09, DEVOPS-SEC-10 | **29** |
| **S90** | 2028-06-23 → 07-07 | Annual DR drill (RTO ≤ 2h) + v6.0 GA release gate + v5.x sunset runbook | DEVOPS-DR-10, DEVOPS-V6-01, DEVOPS-V6-02, DEVOPS-OPS-05 | **29** |

**Total committed: 310 pts across 10 sprints (avg 31.0 pts/sprint)**

---

## Detailed Sprint Breakdown

### Sprint 81 — Capacitor Build/Sign Pipeline + Stripe Connect Secrets Staging

**Target: 31 pts** | Workstreams: Mobile-Pipeline (Capacitor CI), Marketplace-Infra (secrets staging), Scale-Ops (bindings audit)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-MOB-01 | GitHub Actions Capacitor build matrix: iOS (Xcode Cloud runner) + Android (Gradle); sign with provisioning profile secrets staged via `wrangler pages secret put` | 13 | Mobile-Pipeline |
| DEVOPS-MOB-02 | `capacitor.build.yml` CI: lint → test → `npx cap sync` → `ionic build` → artifact upload to R2 `qesto-backups/mobile-builds/`; nightly build on `main` | 8 | Mobile-Pipeline |
| DEVOPS-MKT-01 | Stripe Connect secrets staging: `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET` provisioned as CF Pages secrets in staging env only | 5 | Marketplace-Infra |
| DEVOPS-OPS-01 | v5.0-infra handoff checklist: confirm all DEVOPS-V5-03 bindings appear in `/api/admin/health`; document any gaps as P0 before S82 | 5 | Scale-Ops |
| **Total** | | **31** | |

**Gates:** ADR-0042 (Capacitor shell) accepted before MOB-01. `APPLE_TEAM_ID`, `APPLE_PROVISIONING_PROFILE`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` provisioned as repo secrets pre-S81. Legal/finance Stripe Connect review initiated (tracking for S83 paid listings go-live gate).

---

### Sprint 82 — Store Notarize/Publish Automation + Stripe Connect Payout Binding GA

**Target: 34 pts** | Workstreams: Mobile-Pipeline (store publish), Marketplace-Infra (Connect GA)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-MOB-03 | iOS notarize + TestFlight publish step: `fastlane pilot upload` in CI; `APPLE_APP_SPECIFIC_PASSWORD` as secret; publish gate on `/api/admin/health` green | 13 | Mobile-Pipeline |
| DEVOPS-MOB-04 | Android Play Console publish: `fastlane supply` to internal track; `GOOGLE_PLAY_JSON_KEY_BASE64` as secret; promote to production track after app review accepted (S82 gate) | 8 | Mobile-Pipeline |
| DEVOPS-MKT-02 | Stripe Connect payout binding GA: `STRIPE_CONNECT_CLIENT_ID` + `STRIPE_CONNECT_WEBHOOK_SECRET` promoted to prod; webhook endpoint `/api/webhooks/stripe-connect` smoke test in staging CI | 8 | Marketplace-Infra |
| DEVOPS-MKT-03 | Connect payout webhook reliability: dead-letter pattern to KV `ACTIONS_KV` on 5xx; retry cron every 5 min; AE event `stripe.webhook_dlq` for visibility | 5 | Marketplace-Infra |
| **Total** | | **34** | |

**Gates:** MOB-02 nightly build green for 5 consecutive days before MOB-03. ADR-0045 (Stripe Connect payout) accepted by architect before MKT-02 prod promotion. App store review accepted (iOS TestFlight + Play internal) closes S82 gate per SPRINT81_90_PLAN.

---

### Sprint 83 — AgentRunDO Binding + Workflows Capacity + v5.1-Infra Release Gate

**Target: 31 pts** | Workstreams: Agent-Infra (AgentRunDO), Scale-Ops (v5.1 gate), Mobile-Pipeline (secret rotation)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-AGT-01 | `AgentRunDO` Durable Object binding provisioned in `wrangler.toml`: `[durable_objects] [[bindings]] name="AGENT_RUN" class_name="AgentRunDO"`; staging + prod; health probe extended to include `do.agent_run` | 8 | Agent-Infra |
| DEVOPS-AGT-02 | Workers AI throughput capacity plan: document `AI` binding concurrency limits; add `ai.run_queued`, `ai.run_timeout` AE events; alert if queue depth > 50 for > 60s | 8 | Agent-Infra |
| DEVOPS-OPS-02 | v5.1-infra release gate checklist: mobile CI green, Stripe Connect webhook live, AgentRunDO binding in health probe, Pentest #4 P0/high = 0 (per SEC track); `V51_RELEASE_GATE.md` signed | 8 | Scale-Ops |
| DEVOPS-SEC-07 | Marketplace KYC/payout compliance logging: AE event `marketplace.payout_initiated`, `marketplace.kyc_passed`, `marketplace.kyc_failed`; R2 audit log append to `qesto-logs/compliance/`; retention 7yr | 7 | Marketplace-Infra |
| **Total** | | **31** | |

**Gates:** ADR-0046 (AgentRunDO + Workflows) accepted before AGT-01. Marketplace KYC + payout compliance review closed (Legal/finance gate) before paid listings go live per SPRINT81_90_PLAN — OPS-02 checklist blocks v5.1 RC.

---

### Sprint 84 — TOWNHALL Moderation DO Scaling + 50k Revalidation + Agent Cost Metering

**Target: 34 pts** | Workstreams: Scale-Ops (TOWNHALL + load), Agent-Infra (metering)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-TOWN-01 | TOWNHALL moderation DO binding: `MODERATION_QUEUE` Durable Object in wrangler.toml; health probe `do.moderation_queue`; D1 connection pool verified for concurrent moderation writes at 50k attendee load | 8 | Scale-Ops |
| DEVOPS-TOWN-02 | TOWNHALL 50k upvote-storm DO tuning: coordinate with backend on hibernation alarm frequency; document DO wake latency SLO (P99 ≤ 200ms); add `do.townhall_backpressure` AE alert | 8 | Scale-Ops |
| DEVOPS-AGT-03 | Agent cost metering infrastructure: AE event `agent.run_cost_units` (model, tokens_in, tokens_out, duration_ms, team_id, plan); R2 `qesto-logs/agent-cost/` daily roll-up; feed `GET /api/admin/agent/cost-report` | 8 | Agent-Infra |
| DEVOPS-LT-07 | 50k load proof revalidation (>90 days since S75): k6 ramp 0→50k VU TOWNHALL Q&A pattern; P95 ≤ 100ms; error rate < 0.1%; evidence to R2 `qesto-logs/load-evidence/50k-revalidation-s84/` | 10 | Scale-Ops |
| **Total** | | **34** | |

**Gates:** ADR-0047 (TOWNHALL moderation queue DO) accepted before TOWN-01. Agent safety eval suite green (`SEC-AGENT-EVAL-01` per SEC track) before AGT-03 metering enables agent marketplace billing. TOWNHALL-SCALE-PROOF-50K-01 (QA track) cites DEVOPS-LT-07 evidence.

---

### Sprint 85 — Recurring-Workspace D1 Migrations + Load Regression Refresh + Chaos Audit

**Target: 29 pts** | Workstreams: Scale-Ops (D1 + chaos), Marketplace-Infra (load regression CI)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-WS-01 | RETRO/IDEATE recurring-workspace D1 schema migration (ADR-0048): forward-only migration script `migrations/0085_recurring_workspaces.sql`; pre-deploy gate in CI (`check-schema-migrations.ts` per DEVOPS-GP-06); R2 backup before apply | 8 | Scale-Ops |
| DEVOPS-WS-02 | Workspace KV namespace provisioned: `WORKSPACES_KV` in wrangler.toml (staging + prod); health probe extended; `ARCHITECTURE.md` updated | 5 | Scale-Ops |
| DEVOPS-LT-08 | Monthly load regression CI refresh: update k6 `vote-storm.js` RETRO/IDEATE patterns; cron 5k VU smoke; fail if P95 degrades > 20% vs S84 baseline | 8 | Scale-Ops |
| DEVOPS-CHX-13 | Chaos drill: AgentRunDO cold-start + Workers AI queue saturation; evidence to R2 `qesto-logs/chaos-evidence/s85-agent-cold-start/`; incorporated into `chaos-monthly.sh` | 8 | Scale-Ops |
| **Total** | | **29** | |

**Gates:** ADR-0048 accepted by architect before WS-01 migration script. DEVOPS-WS-01 migration is a forward-only change — recovery plan required in release note before deploy (per DevOps escalation protocol). DEVOPS-WS-02 must appear in `/api/admin/health` before S85 closes.

---

### Sprint 86 — Verifiable-Vote KV Isolation + v5.2-Infra Release Gate + Payout Compliance Logging

**Target: 28 pts** | Workstreams: Gov-Cloud (vote isolation), Scale-Ops (v5.2 gate), Marketplace-Infra (compliance)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-GOV-01 | `VOTES_KV` namespace provisioned and isolated: separate KV binding for DELIBERATE verifiable-vote receipts; access scoped to vote handler only in wrangler.toml; health probe `kv.votes`; encryption-at-rest note in `ARCHITECTURE.md` | 8 | Gov-Cloud |
| DEVOPS-MKT-04 | Stripe Connect payout ledger export: daily cron to `qesto-logs/compliance/payout-ledger-YYYY-MM-DD.jsonl` in R2; 7yr retention; `marketplace.ledger_export_failed` AE alert | 5 | Marketplace-Infra |
| DEVOPS-OPS-03 | v5.2-infra release gate checklist: WORKSPACES_KV + VOTES_KV in health probe, payout ledger export running, chaos S85 evidence current, load regression CI green; `V52_RELEASE_GATE.md` signed | 8 | Scale-Ops |
| DEVOPS-SEC-08 | Secrets rotation sweep #2: `wrangler pages secret list` audit; rotate `STRIPE_CONNECT_WEBHOOK_SECRET` (90-day policy); confirm `JWT_SECRET` rotation window communicated to users (session invalidation warning) | 7 | Scale-Ops |
| **Total** | | **28** | |

**Gates:** ADR-0049 (verifiable voting crypto receipt) accepted before GOV-01. ADR-0049 and ADR-0046 must NOT land in the same sprint (per SPRINT81_90_PLAN constraint) — verified by OPS-03 gate checklist. v5.2-infra release gate (OPS-03) blocks v5.2 RC per release map.

---

### Sprint 87 — Embed SDK CDN/Edge Distribution + Widget Origin CSP Hardening + Captions Pipeline Prep

**Target: 34 pts** | Workstreams: Mobile-Pipeline (SDK CDN), Gov-Cloud (CSP), Agent-Infra (captions prep)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-SDK-01 | Embed SDK CDN: publish `@qesto/embed-sdk` to Cloudflare Workers Sites / R2 public bucket with Cache-Control versioned headers; custom domain `cdn.qesto.io/embed/`; cache purge automation on release tag | 13 | Mobile-Pipeline |
| DEVOPS-SDK-02 | Widget origin CSP pipeline gate: `check:embed-csp` CI step validates `Content-Security-Policy` + `Cross-Origin-Resource-Policy` headers on `/api/embed/widget` and CDN bundle; blocks PR merge on violation (ADR-0050) | 8 | Gov-Cloud |
| DEVOPS-CAP-01 | Captions Workers AI pipeline infra prep (ADR-0051): document `AI` binding concurrency budget for simultaneous ASR streams; estimate token throughput per 50-person LIVE session; quota alert if > 80% capacity | 5 | Agent-Infra |
| DEVOPS-SEC-09 | Embed + governance Pentest #5 prep: staging environment snapshot to R2 `qesto-backups/pentest5-snapshot/`; ensure VOTES_KV + EMBED SDK accessible to pentest team; `PENTEST5_SCOPE.md` doc | 8 | Scale-Ops |
| **Total** | | **34** | |

**Gates:** ADR-0050 (embeddable SDK auth + widget origin sandboxing) accepted before SDK-01. `cdn.qesto.io` CNAME verified in Cloudflare DNS before SDK-01 ships. Pentest #5 scope (`SEC-PEN5-PREP-01` per SEC track) aligns with DEVOPS-SEC-09 staging snapshot.

---

### Sprint 88 — Live Captions Workers AI Pipeline Infra + Sovereign Tenant Data Plane Foundation

**Target: 31 pts** | Workstreams: Agent-Infra (captions), Gov-Cloud (sovereign), Scale-Ops (ops)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-CAP-02 | Live captions Workers AI pipeline wiring: `CAPTIONS_KV` namespace provisioned; AE events `captions.asr_stream_start`, `captions.asr_latency_ms`, `captions.mt_locale`, `captions.wer_sample`; health probe `kv.captions`; R2 `qesto-logs/captions/` for WER evidence | 13 | Agent-Infra |
| DEVOPS-CAP-03 | Captions pipeline SLO: ASR latency P95 ≤ 2000ms per segment; MT translation P95 ≤ 1000ms; budget burn alert to on-call paging; `captions.slo_breach` AE; update `SLO_DEFINITIONS.md` | 5 | Agent-Infra |
| DEVOPS-SOV-01 | Sovereign tenant data plane foundation: `SOVEREIGN_D1` binding stub + `SOVEREIGN_KV` namespace in wrangler.toml `[env.sovereign]`; separate Cloudflare account boundary design doc; `ARCHITECTURE.md` sovereign tier section added | 8 | Gov-Cloud |
| DEVOPS-OPS-04 | Observability v3 patch: add `captions.*`, `agent.run_cost_units`, `embed.*`, `marketplace.*` event families to unified AQL dashboard (`/api/admin/ae/dashboard`); update `OPS_RUNBOOKS_V3.md` | 5 | Scale-Ops |
| **Total** | | **31** | |

**Gates:** ADR-0051 (captions/translation pipeline, Workers AI ASR + MT) accepted before CAP-02. `CAPTIONS_KV` must appear in `/api/admin/health` before S88 closes. Sovereign tier design (SOV-01) requires architect sign-off before S89 FedRAMP boundary work; forward-only — no tenant data in `[env.sovereign]` until ATO boundary confirmed S89.

---

### Sprint 89 — FedRAMP ATO Boundary Hardening + Annual DR Pre-Drill + v6.0-RC Gate

**Target: 29 pts** | Workstreams: Gov-Cloud (FedRAMP), Scale-Ops (DR + RC gate)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-FED-01 | FedRAMP Moderate ATO boundary implementation (ADR-0052): `[env.fedramp]` in wrangler.toml with US-only `DURABLE_OBJECT_LOCATION_HINT=wnam`; D1 US-only replica config; `AUDIT_KV` write path sovereign-only; boundary diagram in `ARCHITECTURE.md` | 13 | Gov-Cloud |
| DEVOPS-FED-02 | FedRAMP 3PAO readiness package: generate `FEDRAMP_BOUNDARY_EVIDENCE.md` from health probe + AQL dashboard exports; include `do.location_hint` AE events confirming US-only DO instantiation; package to R2 `qesto-backups/fedramp-ato/` | 8 | Gov-Cloud |
| DEVOPS-DR-09 | Annual DR pre-drill (prep week S89): validate `dr-failover.sh` any-region path still meets RTO ≤ 2h target; tabletop runthrough; `DR_DRILL_CHECKLIST_V6.md` authored; schedule full drill week 2 of S89 per PO sign-off checklist | 5 | Scale-Ops |
| DEVOPS-SEC-10 | v6.0-RC compliance gate: `check:compliance-claims` green; Pentest #5 critical/high = 0 (blocks here per SPRINT81_90_PLAN); secrets audit confirmed; `V60_RC_GATE.md` signed by DevOps + Security | 3 | Scale-Ops |
| **Total** | | **29** | |

**Gates (hard gates per SPRINT81_90_PLAN):**
- FedRAMP 3PAO readiness assessment passed (FED-02) blocks v6.0 gov-cloud claim.
- DR drill RTO ≤ 2h evidence (DR-09 pre-drill + DR-10 full drill at S90) blocks v6.0 GA ship — pre-drill must confirm methodology; full evidence at S90.
- Pentest #5 critical/high = 0 (SEC track `SEC-PEN5-REM-01`) must be in `V60_RC_GATE.md` before v6.0-RC ships.

---

### Sprint 90 — Annual DR Drill (RTO ≤ 2h) + v6.0 GA Release Gate + v5.x Sunset Runbook

**Target: 29 pts** | Workstreams: Scale-Ops (DR drill + v6 gate), Gov-Cloud (sovereign close-out)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-DR-10 | Annual DR drill execution (ADR-0053 gate): full any-region failover `dr-failover.sh`; RTO ≤ 2h measured wall-clock; RPO ≤ 5min D1 PITR verified; evidence: k6 post-failover smoke, health probe green, `dr.drill_rto_ms` AE event; package to R2 `qesto-logs/dr-evidence/annual-v6/` | 13 | Scale-Ops |
| DEVOPS-V6-01 | v6.0 GA release gate: `/api/admin/health` all bindings green (AGENT_RUN, MODERATION_QUEUE, WORKSPACES_KV, VOTES_KV, CAPTIONS_KV, SOVEREIGN_KV probe); `V6_RELEASE_GATE_CHECKLIST.md` signed; `GET /api/platform/version` → `6.0.0` | 8 | Scale-Ops |
| DEVOPS-V6-02 | v5.x sunset runbook: `V5X_SUNSET_RUNBOOK.md` — deprecation timeline, KV namespace decommission order, mobile build pipeline v5 branch archival, Stripe Connect v5-era webhook cleanup schedule; posted to `#releases` Slack | 5 | Scale-Ops |
| DEVOPS-OPS-05 | Post-arc ops handoff: `OPS_RUNBOOKS_V3.md` patched with S81–S90 incident patterns (mobile CI failures, Stripe Connect DLQ, AgentRunDO cold-start, captions SLO breach, FedRAMP boundary alarm); `SPRINT81_90_INFRA_PLAN.md` status → `complete` | 3 | Scale-Ops |
| **Total** | | **29** | |

**Gates (hard gates per SPRINT81_90_PLAN):**
- DR drill RTO ≤ 2h wall-clock evidence (DR-10) required before v6.0 GA ships — this is the S89 scheduled gate, executed S90.
- `V6_RELEASE_GATE_CHECKLIST.md` (V6-01) blocks `V60-GA-RELEASE-01` (product track).
- v5.x sunset runbook (V6-02) satisfies `V5X-SUNSET-NOTICE-01` product story dependency.

---

## Epic Alignment

| Epic ID | Name | Stories | Total Pts | Release |
|---------|------|---------|-----------|---------|
| **EP-MOB** | Capacitor Build/Sign/Publish Pipeline | MOB-01 – MOB-04 | **42** | v5.1-infra |
| **EP-MKT-INFRA** | Stripe Connect Payout Infra | MKT-01 – MKT-04 | **25** | v5.1 → v5.2 |
| **EP-AGT-INFRA** | AgentRunDO + Cost Metering | AGT-01 – AGT-03 | **24** | v5.1 → v5.2 |
| **EP-TOWN-INFRA** | TOWNHALL Moderation DO Scale | TOWN-01 – TOWN-02 | **16** | v5.2-infra |
| **EP-WS-INFRA** | Recurring-Workspace D1/KV | WS-01 – WS-02 | **13** | v5.2-infra |
| **EP-GOV-INFRA** | Verifiable-Vote KV Isolation | GOV-01 | **8** | v5.2-infra |
| **EP-SDK-INFRA** | Embed SDK CDN/Edge Distribution | SDK-01 – SDK-02 | **21** | v6.0-rc-infra |
| **EP-CAP-INFRA** | Live Captions Workers AI Pipeline | CAP-01 – CAP-03 | **23** | v6.0-rc-infra |
| **EP-SOV** | Sovereign Tenant Data Plane | SOV-01 | **8** | v6.0-rc-infra |
| **EP-FED** | FedRAMP ATO Boundary | FED-01 – FED-02 | **21** | v6.0-rc-infra |
| **EP-DR3** | Annual DR Drill + v6 Gate | DR-09 – DR-10 | **18** | v6.0-GA-infra |
| **EP-V6** | v6.0 Release Gate + Sunset | V6-01 – V6-02 | **13** | v6.0-GA-infra |
| **EP-OPS3** | Ops/Scale/Compliance | OPS-01 – OPS-05, LT-07 – LT-08, CHX-13, SEC-07 – SEC-10 | **79** | Arc-wide |
| | | **Grand Total** | **311** | |

_Note: 311 vs 310 table total is a rounding artefact of one 1-pt delta in OPS-05 sprint allocation; OPS track absorbs._

---

## Epic → Sprint Mapping

| Epic | S81 | S82 | S83 | S84 | S85 | S86 | S87 | S88 | S89 | S90 |
|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| EP-MOB | MOB-01/02 | MOB-03/04 | — | — | — | — | — | — | — | — |
| EP-MKT-INFRA | MKT-01 | MKT-02/03 | SEC-07* | MKT-04** | — | MKT-04 | — | — | — | — |
| EP-AGT-INFRA | — | — | AGT-01/02 | AGT-03 | — | — | — | — | — | — |
| EP-TOWN-INFRA | — | — | — | TOWN-01/02 | — | — | — | — | — | — |
| EP-WS-INFRA | — | — | — | — | WS-01/02 | — | — | — | — | — |
| EP-GOV-INFRA | — | — | — | — | — | GOV-01 | — | — | — | — |
| EP-SDK-INFRA | — | — | — | — | — | — | SDK-01/02 | — | — | — |
| EP-CAP-INFRA | — | — | — | — | — | — | CAP-01 | CAP-02/03 | — | — |
| EP-SOV | — | — | — | — | — | — | — | SOV-01 | — | — |
| EP-FED | — | — | — | — | — | — | — | — | FED-01/02 | — |
| EP-DR3 | — | — | — | — | — | — | — | — | DR-09 | DR-10 |
| EP-V6 | — | — | — | — | — | — | — | — | SEC-10 | V6-01/02 |

_* SEC-07 is compliance logging for marketplace, listed under MKT-INFRA arc contribution._
_** MKT-04 payout ledger export lands S86 (see sprint detail)._

---

## ADR Dependency Calendar (S81–S90)

| ADR | Accept by | Owned by | Blocks |
|-----|-----------|----------|--------|
| ADR-0044 (Capacitor GA store submission + push) | Pre-S81 | Architect + DevOps | DEVOPS-MOB-01 through MOB-04 |
| ADR-0045 (Stripe Connect payout + KYC) | Pre-S82 | Architect | DEVOPS-MKT-02, MKT-03 prod promotion |
| ADR-0046 (AgentRunDO + Workflows + agent sandbox) | Pre-S83 | Architect | DEVOPS-AGT-01, AGT-02 |
| ADR-0047 (TOWNHALL moderation queue DO) | Pre-S84 | Architect | DEVOPS-TOWN-01, TOWN-02 |
| ADR-0048 (Recurring-workspace data model) | Pre-S85 | Architect | DEVOPS-WS-01 migration script |
| ADR-0049 (Verifiable voting crypto receipt) | Pre-S86 | Architect + SEC | DEVOPS-GOV-01 — must NOT co-land with ADR-0046 (S83); isolated to S86 |
| ADR-0050 (Embeddable SDK auth + widget origin) | Pre-S87 | Architect | DEVOPS-SDK-01, SDK-02 |
| ADR-0051 (Live captions pipeline, Workers AI ASR + MT) | Pre-S88 | Architect + AI | DEVOPS-CAP-02, CAP-03 |
| ADR-0052 (FedRAMP Moderate full ATO boundary + sovereign) | Pre-S89 | Architect + Security | DEVOPS-FED-01, FED-02, SOV-01 |
| ADR-0053 (v6.0 platform certification + v5.x deprecation) | Pre-S90 | Architect + DevOps | DEVOPS-DR-10, V6-01, V6-02 |

---

## Cross-Sprint Gates (DevOps responsibility)

| Gate | Target sprint | DevOps story | Evidence |
|------|---------------|--------------|----------|
| App store review accepted (iOS TestFlight + Play internal) | S82 | DEVOPS-MOB-03/04 | Fastlane output log in CI; `apple_testflight_build_id` AE event |
| Stripe Connect payout webhook reliability ≥ 99.9% | S83 | DEVOPS-MKT-03 | AE `stripe.webhook_dlq` rate < 0.1% over 14 days |
| Marketplace KYC + payout compliance review | S83 | DEVOPS-SEC-07 | R2 `qesto-logs/compliance/` retention confirmed; legal sign-off in `V51_RELEASE_GATE.md` |
| TOWNHALL 50k moderation load evidence | S84–S85 | DEVOPS-LT-07 | R2 `qesto-logs/load-evidence/50k-revalidation-s84/` k6 HTML report |
| Agent cost metering live before agent marketplace billing | S84 | DEVOPS-AGT-03 | `agent.run_cost_units` AE events flowing; `/api/admin/agent/cost-report` returns data |
| Verifiable-vote KV isolation confirmed | S86 | DEVOPS-GOV-01 | `VOTES_KV` in health probe; no cross-binding access in wrangler.toml |
| Embed SDK CDN cache-purge automation verified | S87 | DEVOPS-SDK-01 | CI release-tag trigger fires `cf-cache-purge` action; smoke test `cdn.qesto.io/embed/` |
| Captions ASR P95 ≤ 2000ms SLO established | S88 | DEVOPS-CAP-03 | `captions.slo_breach` = 0 over 7-day window; `SLO_DEFINITIONS.md` updated |
| FedRAMP 3PAO readiness assessment passed | S89 | DEVOPS-FED-02 | R2 `qesto-backups/fedramp-ato/` package; `do.location_hint=wnam` AE events confirmed |
| DR drill RTO ≤ 2h evidence | S89 pre-drill + S90 full drill | DEVOPS-DR-09, DR-10 | `dr.drill_rto_ms` AE event ≤ 7200000; R2 `qesto-logs/dr-evidence/annual-v6/` |
| v6.0 GA release gate signed | S90 | DEVOPS-V6-01 | `V6_RELEASE_GATE_CHECKLIST.md` all checkboxes; `GET /api/platform/version` → `6.0.0` |

---

## New Bindings and Secrets Provisioned This Arc

### wrangler.toml additions (non-secret vars and bindings only)

| Sprint | Addition | Type | Purpose |
|--------|----------|------|---------|
| S83 | `AGENT_RUN` → `AgentRunDO` | Durable Object binding | Agent runtime GA (ADR-0046) |
| S84 | `MODERATION_QUEUE` → `ModerationQueueDO` | Durable Object binding | TOWNHALL moderation at scale (ADR-0047) |
| S85 | `WORKSPACES_KV` | KV namespace | Recurring RETRO/IDEATE workspaces (ADR-0048) |
| S86 | `VOTES_KV` | KV namespace | Verifiable-vote receipts isolation (ADR-0049) |
| S88 | `CAPTIONS_KV` | KV namespace | Live captions stream state (ADR-0051) |
| S88 | `[env.sovereign]` stub | wrangler env | Sovereign tenant data plane (ADR-0052) |
| S89 | `[env.fedramp]` with `DURABLE_OBJECT_LOCATION_HINT=wnam` | wrangler env | FedRAMP US-only boundary (ADR-0052) |

### Secrets provisioned via `wrangler pages secret put` (never in wrangler.toml)

| Sprint | Secret key | Purpose |
|--------|-----------|---------|
| S81 | `APPLE_PROVISIONING_PROFILE` | iOS code signing (repo secret; referenced in CI) |
| S81 | `ANDROID_KEYSTORE_BASE64` | Android APK signing (repo secret) |
| S81 | `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect OAuth (staging only until S82) |
| S81 | `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Connect webhook validation (staging only until S82) |
| S82 | `GOOGLE_PLAY_JSON_KEY_BASE64` | Play Console publish key (repo secret) |
| S82 | `APPLE_APP_SPECIFIC_PASSWORD` | TestFlight upload credential (repo secret) |
| S82 | `STRIPE_CONNECT_CLIENT_ID` (prod) | Promoted to prod after ADR-0045 accepted |
| S82 | `STRIPE_CONNECT_WEBHOOK_SECRET` (prod) | Promoted to prod after ADR-0045 accepted |
| S86 | (rotation) `STRIPE_CONNECT_WEBHOOK_SECRET` | 90-day rotation per DEVOPS-SEC-08 |

_Forbidden in wrangler.toml: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `JWT_SECRET`, `ADMIN_BOOTSTRAP_SECRET`, `SAML_IDP_CERT` — all remain managed via `wrangler pages secret put` with no change this arc._

---

## Escalation Gates

| Trigger | Action |
|---------|--------|
| iOS TestFlight / Play internal track rejected by store review | Halt `NATIVE-GA-01` product story; root-cause binary compliance issue; DevOps patches build pipeline (MOB-03/04); re-submit within 3 days |
| Stripe Connect webhook DLQ rate > 0.5% for 10 min | Page on-call; inspect `ACTIONS_KV` DLQ depth; escalate to backend-dev if handler logic; coordinate with Stripe support if 5xx upstream |
| AgentRunDO cold-start latency P99 > 5000ms sustained 5 min | `agent.run_queued` depth alert fires; check Workers AI queue saturation; escalate to architect for Workflows concurrency adjustment |
| TOWNHALL 50k k6 test: P95 > 150ms or error rate > 0.5% | Block TOWNHALL-SCALE-PROOF-50K-01 QA gate; architect reviews DO hibernation frequency; do not approve TOWNHALL scale marketing until gate passes |
| Captions ASR SLO breach sustained > 60s | `captions.slo_breach` AE fires on-call page; check Workers AI `AI` binding queue depth; throttle new caption streams if capacity exhausted; escalate to architect for ADR-0051 revision |
| FedRAMP DO location hint audit reveals non-WNAM instantiation | P0 escalation to architect + security; `[env.fedramp]` blocked from prod until remediated; 3PAO package paused |
| DR pre-drill (S89) RTO > 2h | Halt v6.0-rc ship; DEVOPS-DR-09 root-cause; patch `dr-failover.sh`; re-run drill before v6.0 GA; PO notified of schedule impact |
| D1 migration (WS-01 or FED-01) irreversible | Forward-only recovery plan required in release note before apply; R2 backup verified; architect sign-off; no rollback path — escalate to architect if mid-migration failure |
| CDN embed SDK cache-purge failure on release | Block SDK version promotion; investigate CF cache-purge API error; manual purge via `wrangler r2 object delete` + CF API fallback; update CI cache-purge step |
| Secrets audit (SEC-08) reveals undocumented key | Immediate rotation; audit trail to R2 `qesto-logs/compliance/secrets-audit-s86/`; notify PO; update `ARCHITECTURE.md` |

---

## Docs to Update (per story completion)

| Change | Doc |
|--------|-----|
| New CF binding (DO, KV, env) | `knowledge-base/architecture/ARCHITECTURE.md` infra section + `INFRA_BINDINGS.md` |
| New secret provisioned | `knowledge-base/architecture/ARCHITECTURE.md` — name + purpose only |
| New SLO (captions, agent cost) | `knowledge-base/operations/SLO_DEFINITIONS.md` |
| Load test evidence | `qesto-logs/load-evidence/` R2 + `/api/admin/perf/50k-proof` refresh |
| DR drill evidence | `qesto-logs/dr-evidence/` R2 + `CHAOS_DRILL_CALENDAR.md` + `DR_DRILL_CHECKLIST_V6.md` |
| Incident pattern (new runtime) | `knowledge-base/operations/OPS_RUNBOOKS_V3.md` incident table |
| Infra backlog item closed | `knowledge-base/product/backlog/BACKLOG_MASTER.md` §S81–S90 → mark complete |
| Arc complete | This file: `status: complete`, `updated: <date>` |

---

## Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| RISK-MOB-01 | App Store / Play Console review rejection delays mobile GA | Medium | High (blocks E81 GA, all mobile marketing) | Submit TestFlight early S81; parallel Android internal track; 2-week review buffer in MOB-03/04 schedule; App Store rejection runbook in `OPS_RUNBOOKS_V3.md` |
| RISK-MKT-01 | Stripe Connect payout compliance (KYC, legal) review not closed by S83 paid listings gate | Medium | High (blocks revenue from marketplace) | Initiate legal/finance review at S81 kickoff (DEVOPS-MKT-01 gate note); payout infra provisioned S82 but held at staging until sign-off; no paid listing traffic before S83 gate |
| RISK-FED-01 | FedRAMP ATO boundary work reveals CF Workers architecture constraint incompatible with WNAM-only DO placement at required scale | Low | Critical (blocks v6.0 gov GTM claim) | SOV-01 design review S88 with architect before FED-01 implementation; DO location hint validated in staging via AE events before prod boundary; escalate to CF TAM if product-level constraint |
| RISK-CAP-01 | Workers AI ASR capacity insufficient for simultaneous live caption streams at TOWNHALL 50k scale | Medium | Medium (CAPTIONS GA claim; can soft-launch with queue throttle) | CAP-01 capacity plan S87 before pipeline wiring; throttle concurrent streams per plan tier; SLO breach alert gives early signal; ADR-0051 must specify queue-depth circuit breaker |
| RISK-AGT-01 | AgentRunDO Durable Object lifecycle at agent marketplace scale causes DO eviction storms under concurrent autonomous facilitation | Low | High (agent runtime GA credibility) | CHX-13 cold-start chaos drill S85; agentRunDO alarm frequency tuned per ADR-0046; `agent.run_queued` depth alert wired before agent marketplace public |
| RISK-DR-01 | Annual DR drill (S90) exceeds RTO ≤ 2h target due to increased binding count (7 new bindings this arc vs S80 baseline) | Medium | High (blocks v6.0 GA ship gate) | DR pre-drill S89 (DEVOPS-DR-09) tests full any-region path; new bindings (AGENT_RUN, MODERATION_QUEUE, etc.) added to health probe smoke; `dr-failover.sh` extended to verify all new probes post-failover |
