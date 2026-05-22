---
id: SPRINT30_39_PLAN
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-05-22
updated: 2026-05-22
tags:
  - planning
  - sprints
  - v2.2
  - v2.3
  - v2.4
relates_to:
  - SPRINT26_32_PLAN
  - SPRINT33_34_PLAN
  - ROADMAP_FULL
  - BACKLOG_MASTER
---

# Sprint 30–39 Plan — v2.2 RC → v2.4 Horizon

_Created: 2026-05-22._  
_Planning basis: ROADMAP_FULL, BACKLOG_MASTER, quality audits, agent reviews (PO, architect, security)._

## Arc goal

Ten two-week sprints take Qesto from **v2.2 resilience + RC** (S30–S32) through **v2.3 integrations + compliance + AI depth** (S33–S34) to **v2.4 enterprise scale** (S35–S39): SOC 2 Type I, Zoom, white-label, mobile PWA, Salesforce, LDAP, tournaments, AI coaching.

**Capacity rule:** P0 first, then P1; stories ≤ 13 pts; target **40–50 pts** per sprint.

## Release map

| Release | Ship date (target) | Sprints |
|---------|-------------------|---------|
| v2.2 | 2026-07-08 | S30–S32 |
| v2.3 | 2026-08-05 | S33–S34 |
| v2.4 | 2026-10-14 | S35–S39 |

**Detailed S30–S32:** [`SPRINT26_32_PLAN.md`](./SPRINT26_32_PLAN.md) (S26–29 shipped).  
**Detailed S33–S34:** [`SPRINT33_34_PLAN.md`](./SPRINT33_34_PLAN.md).

---

## Sprint 30 — Resilience P0 + Observability (active)

**Window:** 2026-05-27 → 2026-06-10 | **~38 pts**

| ID | Pts | Pri | Status |
|----|-----|-----|--------|
| RES-PII-01, RES-TIMEOUT-01, RES-D1-01, RES-ERR-01 | 14 | P0 | ✅ Delivered |
| PRIVACY-GAM-01, OBS-VOTE-01, ADMIN-OPS-02 | 11 | P0/P1 | ✅ Delivered |
| RES-RETRY-01, OBS-ENERGIZER-FIX-01 | 5 | P1 | Planned / partial |
| **RES-DO-01** | 3 | P0 | ✅ Delivered (WS outer try/catch + `do.storage_fault`) |
| **SEC-CSV-01** | 2 | P0 | ✅ Delivered (`lib/csv.ts`) |
| RES-D1-02 | 2 | P0 | ✅ N/A (plan middleware already degrades to free) |

**Gate:** No LIVE energizer flag-on until PRIVACY-GAM-01 green.

---

## Sprint 31 — Enterprise + Circuit Breakers + Integration Foundation

**Window:** 2026-06-10 → 2026-06-24 | **~48 pts** | **Status:** Implementation in progress (2026-05-22)

See [`SPRINT26_32_PLAN.md`](./SPRINT26_32_PLAN.md) §Sprint 31 and [`sprints/SPRINT31_IMPLEMENTATION_SPEC.md`](./sprints/SPRINT31_IMPLEMENTATION_SPEC.md).

| ID | Status |
|----|--------|
| INT-PROVIDER-01 | ✅ AES-GCM token store |
| CB-01 / CB-02 | ✅ Wired; KV binding prefers `CIRCUIT_BREAKER_KV` |
| AUTHZ-GAM-01 | ✅ Pre-shipped v2.2 RC |
| ADR-0010 / ADR-0007-amend | ✅ Accepted |
| GDPR-TRUST-PAGE-01 | ✅ `/trust/gdpr` |
| AUDIT-GAM-01 | ✅ Action labels + `ws.energizer_answered` |
| DEPLOY-GAM-01 / QA-ENT-02 | Checklists + tests exist; staging smoke manual |
| ANON-DEPTH-01 | Stretch → S32 (wizard + join badge already live) |

**DevOps blockers (before prod merge):** `CIRCUIT_BREAKER_KV`, `INTEGRATIONS_KV`, `OAUTH_TOKEN_MEK`.

---

## Sprint 32 — v2.2 Release Candidate

**Status (2026-05-22):** `feat/sprint-32-v22-rc` — CODE-SPLIT-01 complete; run `npm run check:rc` before merge.

**Window:** 2026-06-24 → 2026-07-08 | **~38 pts** | **🚀 v2.2**

RC-REGRESSION-01, RC-DOCS-01, RC-ROLLOUT-01, RC-OBS-01, EXPORT-RICH-01-A, PERF-PROOF-01, CODE-SPLIT-01 (land in S31 week 2, verify in S32).

**Release blocker:** [`GAM_STAGING_SMOKE_CHECKLIST.md`](../../operations/GAM_STAGING_SMOKE_CHECKLIST.md).

---

## Sprint 33 — Integration Suite + AI Context

**Status (2026-05-22):** `feat/sprint-33-v23-integrations` — AI-CONTEXT-01, ADR-0011, SSRF, AE events, Slack prefs, Teams UI. See [`sprints/SPRINT33_IMPLEMENTATION_SPEC.md`](./sprints/SPRINT33_IMPLEMENTATION_SPEC.md).

**Window:** 2026-07-08 → 2026-07-22 | **~43 pts**

WEBHOOK-01, SLACK-01/02, TEAMS-01, AI-CONTEXT-01, ADR-0011. Stretch: ZOOM-01 (commit if event-organizer GTM is active).

**ADR gate:** ADR-0012 (service/repo boundaries) accepted before sprint start.

---

## Sprint 34 — Compliance + AI Depth

**Status (2026-05-22):** `feat/sprint-34-35-v24` — GDPR delete API, AI sentiment (presenter), recap provenance export, compliance KB. See [`sprints/SPRINT34_IMPLEMENTATION_SPEC.md`](./sprints/SPRINT34_IMPLEMENTATION_SPEC.md).

**Window:** 2026-07-22 → 2026-08-05 | **~43 pts** | **🚀 v2.3**

ENT-RESIDENCY-01, COMPLIANCE-01, AI-RECAP-PROV-01, AI-SENTIMENT-01, ANON-DEPTH-02, GDPR-BADGE-01.

**Gate:** ADR-0011 + DPIA + AI-CONTEXT-01 before AI-SENTIMENT-01.

---

## Sprint 35 — SOC 2 + Zoom + Export Completion

**Status (2026-05-22):** Same branch — GAM-06 CSV export, Zoom OAuth skeleton, ADR-0013, COMPLIANCE-03 scaffold. See [`sprints/SPRINT35_IMPLEMENTATION_SPEC.md`](./sprints/SPRINT35_IMPLEMENTATION_SPEC.md).

**Window:** 2026-08-05 → 2026-08-19 | **~45 pts**

| ID | Pts | Pri |
|----|-----|-----|
| COMPLIANCE-03 | 13 | P0 |
| ZOOM-01 | 8 | P1 |
| EXPORT-PDF-01 | 8 | P1 |
| GAM-06 | 5 | P1 |
| ADR-0013 | 3 | P0 |
| ARCH-HONO-02 | 5 | P2 |

---

## Sprint 36 — White-Label + Branding

**Status (2026-05-22):** `feat/sprint-36-39-v24` — see [`sprints/SPRINT36_39_IMPLEMENTATION_SPEC.md`](./sprints/SPRINT36_39_IMPLEMENTATION_SPEC.md).

**Window:** 2026-08-19 → 2026-09-02 | **~42 pts**

BRAND-01/02/03, ADR-0016, SEC-RATELIMIT-01, DX-SERVICE-01.

---

## Sprint 37 — Mobile PWA + Salesforce

**Status (2026-05-22):** Same branch — PWA manifest/SW, touch CSS, Salesforce skeleton.

**Window:** 2026-09-02 → 2026-09-16 | **~44 pts**

MOBILE-01/02/03, SF-01/02, ADR-0015, SEC-WS-CAP-01.

---

## Sprint 38 — LDAP + Enterprise Integrations

**Status (2026-05-22):** LDAP/Notion skeletons, webhook HR templates, COMPLIANCE-04 doc.

**Window:** 2026-09-16 → 2026-09-30 | **~46 pts**

LDAP-01/02, INT-WEBHOOK-02, NOTION-01, ADR-0019, COMPLIANCE-04.

---

## Sprint 39 — Tournaments + AI Coaching + v2.4 Close

**Status (2026-05-22):** Bracket API, coaching endpoint, agent grounding, v2.4 RC notes.

**Window:** 2026-09-30 → 2026-10-14 | **~47 pts** | **🚀 v2.4**

GAM-05, GAM-05-QA, AI-COACHING-01/02, ADR-0017/0018, KB-RAG-01, RC-V24-01.

---

## ADR calendar (S30–S39)

| ADR | Sprint to accept | Blocks |
|-----|------------------|--------|
| ADR-0010 | S31 | ANON-DEPTH-01 |
| ADR-0007-amend | S31 | CB-01 |
| ADR-0012 | S32 | S33+ AI/integration routes |
| ADR-0011 | S33 | AI-SENTIMENT-01 |
| ADR-0013 | S35 | GAM-05 |
| ADR-0015 | S37 | MOBILE-* |
| ADR-0016 | S36 | BRAND-* |
| ADR-0017 | S39 | GAM-05 |
| ADR-0018 | S39 | KB-RAG-01 |
| ADR-0019 | S38 | LDAP-01 |

**Specs (no ADR number):** [`AI_CONTEXT_SPEC.md`](../../architecture/AI_CONTEXT_SPEC.md) — draft in S32 RC window.

---

## Out of scope (S30–S39)

Native iOS/Android, multi-region D1 sharding, dark mode, external AI APIs, Microsoft OAuth login, pricing model changes unrelated to integrations/compliance.

---

## Verification (every sprint)

`npm test`, `npm run typecheck`, `npm run check:i18n`, `npm run check:tokens-drift`, `npm run check:pii-log`, `npm run check:compliance-claims` (from S31), staging WebSocket smoke when touching SessionRoom.
