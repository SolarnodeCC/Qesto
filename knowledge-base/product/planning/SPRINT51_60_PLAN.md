---
id: SPRINT51_60_PLAN
type: planning
domain: product
category: planning
status: proposed
version: 1.0
created: 2026-05-24
relates_to:
  - SPRINT30_39_PLAN
  - ROADMAP_FULL
  - BACKLOG_MASTER
  - WIN_LOSS_ANALYSIS
  - ADR-0022
---

# Sprint 51–60 Plan — v3.1 to v3.5 Horizon (Seven Epics, 10 Sprints)

_Created: 2026-05-24._  
_Planning basis: Post-v3.0 RC (S50 shipped); WIN_LOSS_ANALYSIS priorities; deferred items from S40–S50 (ADR-0022 write sharding, LDAP full sync, ARCH-HONO-02, GAM-05 tournaments, INT-WEBHOOK-02, KB-RAG-01); SOC2 Type II roadmap; partner tier completion._

---

## Arc Goal

Ten two-week sprints build Qesto from **v3.1 multi-region write foundation** (S51–S52) through **v3.2 integrations + LDAP deepening** (S53–S54) to **v3.3–v3.5 competitive moat** (S55–S60): ADR-0022 write sharding, LDAP full sync + group mapping, vendor webhooks (Workday/BambooHR), partner OAuth beyond status skeletons, **LIVE** tournament gameplay (REST bracket exists from v2.4), AI coaching + KB-RAG **maturity** (coaching API shipped S42), Public API v2 expansion, SOC2 Type II evidence + pentest #2 remediation.

**Shipped baseline entering S51 (S40–S50):** Zoom/SF/Notion OAuth, Public API v1 + v2 realtime discovery, multi-region read opt-in, PWA offline votes, forensic audit export, JS/Python SDKs, partner status routes, distributed tracing, v3.0 RC packaging (S50).

**Capacity rule:** P0 first, then P1; stories ≤ 13 pts; target **40–50 pts** per sprint (parity with S30–S50 arcs).

---

## Seven Epics (S51–S60)

### EPIC-KB — Internal Knowledge Base (Obsidian) (S51)

**Goal**: Complete migration from Notion to the in-repo **Obsidian vault** (`knowledge-base/`). No new internal docs in Notion; plugins and governance documented for wiki-style pages.

**Primary backlog IDs:**
- KB-OBSIDIAN-01 (new: vault standard, community plugin baseline, team onboarding)
- KB-NOTION-DEPRECATE-01 (new: Notion workspace sunset + archive imports)

**Governance:** [`OBSIDIAN_KB_STANDARD.md`](../../governance/OBSIDIAN_KB_STANDARD.md)

**Note:** Customer-facing Notion OAuth in the app is **legacy**; S51–S60 does **not** schedule new Notion product features (`INT-WEBHOOK-02-NOTION` removed). Prefer Markdown/Obsidian-compatible exports for new export work.

---

### EPIC-MULTI — Multi-Region & Scaling (S51–S52)

**Goal**: Complete the distributed foundation: write-path sharding, failover reads, operator runbooks.

**Primary backlog IDs:**
- ADR-0022 write sharding (deferred from S46; ADR-0022 Phase 1 read-only shipped in S46, Phase 2 write in S51)
- MULTI-REGION-WRITE-01 (new: write sharding framework)
- MULTI-REGION-FAILOVER-01 (new: read replica promotion on primary outage)
- MULTI-REGION-RUNBOOKS-01 (new: operator runbooks for failover, reconciliation)
- RES-DO-02 (new: DO cross-region state sync on write)

**Dependencies**: ADR-0022 accepted; multi-region phase 2 env vars staged.

---

### EPIC-AUTH-DEEP — Directory Integration & SSO Depth (S51, S53–S54)

**Goal**: Complete SAML+LDAP maturity; reduce churn from HR automation needs.

**Primary backlog IDs:**
- LDAP-FULL-SYNC-01 (deferred from S40 as "LDAP-01-FULL"; 13 pts; full Active Directory sync with filtering)
- LDAP-GROUP-MAP-01 (deferred from S38 as "LDAP-02"; group → team role mapping + sync automation)
- LDAP-ONBOARD-01 (new: team admin wizard for LDAP config + test sync)
- SAML-REFRESH-01 (new: SAML token refresh fallback for long-running sessions)
- ADR-0019 (existing; LDAP/Salesforce sync model)

**Win/loss tie**: LDAP is a stated loss reason for HR teams (see WIN_LOSS_ANALYSIS §HR & People Operations).

**Dependencies**: ADR-0019 accepted; INTEGRATIONS_KV operational (from S31).

---

### EPIC-INT-VENDOR — Vendor Webhooks & Workday/BambooHR (S53–S54)

**Goal**: Close integration gaps for HR-to-session pipelines (Workday, BambooHR).

**Primary backlog IDs:**
- INT-WEBHOOK-02 (backlog; Workday + BambooHR templates)
- INT-WEBHOOK-RETRY-01 (new: DO alarm-based retry + dead-letter queue)
- INT-WEBHOOK-AUDIT-01 (new: delivery log with error traces for ops)

**Dependencies**: WEBHOOK-01 (S33); INT-PROVIDER-01 (S31); INTEGRATIONS_KV provisioned.

---

### EPIC-GAM-ADV — Advanced Gamification (S55–S57)

**Goal**: Move tournaments from **REST seeding** (`GAM-05` bracket API, v2.4) to **LIVE SessionRoom** play (battle royale rounds + bracket progression)—key differentiator vs. Kahoot.

**Primary backlog IDs:**
- GAM-05 (backlog) — battle royale + bracket **LIVE** loops
- GAM-05-QA (backlog) — idempotency + reconnect tests
- GAM-05-LIVE-01 (new: DO protocol frames for bracket match advance + battle royale elimination)
- GAM-05-WINNER-CERT-01 (new: signed export; ties to EXPORT-PDF-01 deferred from S35)
- ADR-0017 (accepted; implement + verify in LIVE)

**Dependencies**: Quick Finger / Team Quiz LIVE patterns (S27–S28); ADR-0005 protocol v1.

---

### EPIC-AI-COACH — AI Coaching & Knowledge Base (S55–S60)

**Goal**: **Mature** coaching (multi-turn + export shipped S42) with Insights UX, Vectorize grounding, and team-level personalization—competitive moat vs. Mentimeter.

**Primary backlog IDs:**
- AI-COACHING-02 (backlog) — coaching card in Insights (UI deferred from S39)
- KB-RAG-01 (backlog) — agent grounding via DECISIONS_VECTORIZE
- KB-RAG-SEARCH-01 (new: “similar sessions” in Insights)
- AI-COACHING-03 / AI-MULTI-TENANT-01 (new: team vertical personalization)
- ADR-0018 (accepted; production quality bar + seed data)

**Dependencies**: AI-CONTEXT-01 (S33); coaching route stable; ≥500 closed-session embeddings for RAG cold-start.

---

### EPIC-PARTNER — Partner Tier Completion & GTM (S51–S60)

**Goal**: Complete partner tier infrastructure; enable reseller/white-label GTM motion.

**Primary backlog IDs:**
- PARTNER-TIERS-01 (shipped S50 docs) — tier enforcement in product
- PARTNER-OAUTH-01 (new: partner app registration + secret rotation; 8 pts)
- PARTNER-INTEG-01 (new: complete Workday/Jira/Mattermost OAuth beyond status routes from S45)
- PARTNER-OAUTH-02 (new: partner dashboard for app monitoring + usage metrics; 8 pts)
- PARTNER-BRANDING-01 (new: partner branding in session + emails; 5 pts)
- PARTNER-MARKETPLACE-01 (new: partner app listing on `/marketplace`; 5 pts)
- PARTNER-SLA-01 (new: SLA metrics dashboard + uptime guarantee page; 5 pts)
- COMPLIANCE-05 (new: SOC2 Type II final audit + certification; 13 pts)

**Win/loss tie**: Enterprise features (white-label, partner OEM) are part of "enterprise feature completeness" (WIN_LOSS_ANALYSIS §Loss 2).

**Dependencies**: v3.0 partner tier docs (S50) shipped; Stripe connected accounts optional (out of S51–S60 scope).

---

---

## Ten Sprints (S51–S60): Detailed Plan

### Sprint 51 — Obsidian KB Migration + Multi-Region Write + LDAP Start

**Window:** 2027-03-31 → 2027-04-14 (two weeks, Tue–Mon; adjust per internal sprint calendar)  
**Release target:** v3.1 (feature branch `feat/sprint-51-v31-multi-region-write`)  
**Capacity:** ~49 pts (P0 first, then P1)

#### P0 Items (~40 pts)

| ID | Title | Pts | Status | Sprint gate |
|:---|:------|----:|:------:|:-----------|
| KB-OBSIDIAN-01 | **Obsidian KB standard:** finalize [`OBSIDIAN_KB_STANDARD.md`](../../governance/OBSIDIAN_KB_STANDARD.md), commit agreed community plugins to `.obsidian/`, folder-note indexes, team onboarding (open vault, git pull workflow) | 8 | Planned | No new internal docs in Notion after merge |
| KB-NOTION-DEPRECATE-01 | **Notion sunset:** export stragglers → `archive/notion-import/`, remove Notion links from active KB, update README/CONTRIBUTING/AGENTS.md; cancel doc-only Notion seats | 3 | Planned | Search `notion.so` in `knowledge-base/` → 0 active refs |
| ADR-0022-PHASE-2 | ADR-0022 write sharding acceptance (amendment doc) | 3 | Planned | Blocks MULTI-REGION-WRITE-01 |
| MULTI-REGION-WRITE-01 | D1 write routing: session mutations → primary; reads use `resolveReadRegion()` | 8 | Planned | Staging validation |
| MULTI-REGION-FAILOVER-01 | Failover detection + promotion flag + AE `multi_region.failover_triggered` | 5 | Planned | Runbook draft in S51 |
| LDAP-01 | Full LDAP/AD sync (maps to backlog LDAP-01; deferred S40) | 13 | Planned | No PII in logs; Enterprise plan gate |

#### P1 Items (~9 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| LDAP-FILTER-01 | OU/group filter validation on sync payload | 3 | Stretch → S52 |
| OBS-MULTI-01 | AE events: `multi_region.write_routed`, `multi_region.failover_*` | 3 | |
| DEVOPS-MULTI-KV-01 | Provision `MULTI_REGION_STATE_KV` (prod + staging) | 3 | DevOps blocker for S52 |

#### Dependencies & Gates
- **Blocker**: ADR-0022 Phase 2 (write) must be accepted by architect before sprint merge
- **DevOps**: `MULTI_REGION_PRIMARY`, `MULTI_REGION_REPLICAS` env vars + `MULTI_REGION_STATE_KV` provisioned before S52
- **Staging validation**: Failover test with simulated primary outage on staging

#### Definition of Done
- [ ] Obsidian vault is the **only** internal doc surface; Notion sunset checklist complete
- [ ] `OBSIDIAN_KB_STANDARD.md` linked from KB README + CONTRIBUTING
- [ ] ADR-0022 Phase 2 accepted in PR review
- [ ] All write routes use `resolveWriteRegion()`; reads prefer replica if available
- [ ] Failover detection + promotion tested (unit + integration)
- [ ] LDAP full sync handles ≥1000 users; sanitizes PII in logs
- [ ] `npm test` green; `tsc --noEmit` passes; `check:pii-log` passes
- [ ] Release notes updated: "Obsidian KB standard; multi-region write foundation; LDAP full sync ready for rollout"

---

### Sprint 52 — Multi-Region Operator Runbooks + LDAP Group Mapping

**Window:** 2027-04-14 → 2027-04-28  
**Release target:** v3.1 continuation  
**Capacity:** ~45 pts

#### P0 Items (~35 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| MULTI-REGION-RUNBOOKS-01 | Operator runbooks: failover checklist, rollback steps, reconciliation procedure; runbook @ `/knowledge-base/operations/MULTI_REGION_RUNBOOK.md` | 5 | Planned |
| MULTI-REGION-TESTING-01 | Staging failover drill + playbook acceptance sign-off | 3 | Planned |
| LDAP-02 | LDAP group → team role mapping + background sync (backlog LDAP-02) | 8 | Planned |
| LDAP-DEPROVISIONING-01 | LDAP user removal → team member removal; soft delete + audit trail | 5 | Planned |
| RES-DO-02 | DO cross-region state sync: active energizer state replicated on write failure; circuit breaker fallback | 5 | Planned |
| LDAP-FILTER-01 | LDAP OU/group filtering UI + backend filter validation | 4 | Planned |

**Subtotal P0: 35 pts**

#### P1 Items (~10 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| LDAP-ONBOARD-01 | (from S51) LDAP team admin setup wizard finalized | 5 | If deferred from S51 |
| COMPLIANCE-LDAP-01 | LDAP audit trail: sync events, user provisioning, role assignments | 5 | Stretch |

**Subtotal P1: 10 pts**

#### ADR Calendar
- **No new ADRs** (ADR-0019 already accepted)

#### Definition of Done
- [ ] Operator runbooks reviewed by DevOps + production team
- [ ] Failover drill completed on staging; rollback tested
- [ ] LDAP group sync running every 5 min on production; no PII in logs
- [ ] Deprovisioning audit events emitted + logged
- [ ] DO state sync handles network partitions gracefully
- [ ] `npm test` green; all LDAP tests passing

---

### Sprint 53 — Vendor Webhooks + ARCH-HONO-02 Auth Centralization

**Window:** 2027-04-28 → 2027-05-12  
**Release target:** v3.2 (feature branch `feat/sprint-53-v32-integrations`)  
**Capacity:** ~47 pts

#### P0 Items (~36 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| ARCH-HONO-02 | Centralize auth policy in `app.ts` + `public-api-paths.ts` (backlog; deferred since S34) | 8 | Planned |
| INT-WEBHOOK-02 | Workday + BambooHR webhook templates (backlog INT-WEBHOOK-02) | 8 | Planned |
| INT-WEBHOOK-RETRY-01 | Webhook retry queue via DO alarm (≤24h window) | 5 | Planned |
| INT-WEBHOOK-AUDIT-01 | Delivery log in admin (request/response, retries, errors) | 5 | Planned |
| I18N-S53-01 | i18n for Workday/BambooHR webhook admin UI (5 locales) | 2 | Planned |
| OBS-INT-WEBHOOK-01 | AE: `webhook.delivered`, `webhook.failed`, `webhook.retried` | 5 | Planned |
| INT-WEBHOOK-RATE-LIMIT-01 | Rate-limit 100/min per integration | 3 | Planned |

#### P1 Items (~11 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| WEBHOOK-TESTING-SANDBOX-01 | Webhook test UI (mock event + payload inspect) | 3 | Frontend |

#### Stretch (if P0+P1 early)
- Partner marketplace search integration (low priority, S60 scope)

#### Dependencies & Gates
- **Blocker**: INT-PROVIDER-01 (S31) + INTEGRATIONS_KV must be operational
- **Blocker**: WEBHOOK-01 (S33) must be deployed to production
- **Gate**: SSRF controls + rate-limit tests passing before webhook template PRs merge

#### Definition of Done
- [ ] Workday and BambooHR webhook templates tested with sandbox accounts
- [ ] Delivery log visible in admin panel with sortable columns
- [ ] Retry queue functioning; dead-letter queue for 5+ failures
- [ ] AE events emitted for all webhook states
- [ ] `npm test` includes webhook integration tests
- [ ] Release notes: "Vendor webhook templates ship; BambooHR/Workday HR automation GTM live"

---

### Sprint 54 — Vendor Integration Completion + Partner OAuth Prep

**Window:** 2027-05-12 → 2027-05-26  
**Release target:** v3.2 continuation → v3.2 release  
**Capacity:** ~43 pts

#### P0 Items (~26 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| INT-WEBHOOK-STATUS-01 | Webhook delivery dashboard: success %, latency, error histogram; team-scoped | 5 | Planned |
| INT-WEBHOOK-TESTING-01 | Webhook test runner: inject fake event, inspect routing, replay | 5 | Planned |
| PARTNER-OAUTH-01 | Partner OAuth 2.0 app registration + scopes | 8 | Planned |
| PARTNER-INTEG-01 | Workday/Jira/Mattermost OAuth completion (beyond S45 status routes) | 8 | Planned |
| API-V2-EXPAND-01 | `POST /api/v2/sessions` + results read for integrators (ADR-0024 follow-up) | 5 | Planned |
| ADR-0023 | Partner OAuth scoping ADR | 3 | Planned |

**Subtotal P0: 26 pts**

#### P1 Items (~17 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| PARTNER-OAUTH-02 | Partner app dashboard: installed apps, secrets, usage metrics | 8 | Planned |
| PARTNER-BRANDING-01 | Partner logo/name in session + email footers (config on per-app basis) | 5 | Planned |
| COMPLIANCE-WEBHOOK-01 | Webhook GDPR/data handling compliance KB page | 4 | Planned |

**Subtotal P1: 17 pts**

#### ADR Calendar
- **ADR-0023** (Partner OAuth scoping) must be accepted before PARTNER-OAUTH-01 merge

#### Release Milestone
- **v3.2 ships** end of S54: integrations + LDAP maturity + webhook automation complete

#### Definition of Done
- [ ] All webhook templates + retry logic tested in production-like environment
- [ ] Partner OAuth credentials managed with CI rotation policy
- [ ] Partner API docs auto-generated from OpenAPI spec
- [ ] ADR-0023 accepted by architect + security
- [ ] `npm test` green; audit events for all OAuth flows
- [ ] Release notes: "v3.2: Vendor integrations + partner OAuth; LDAP/BambooHR/Workday GTM live"

---

### Sprint 55 — Tournaments Foundation (Battle Royale, Bracket) + AI Coaching Start

**Window:** 2027-05-26 → 2027-06-09  
**Release target:** v3.3 (feature branch `feat/sprint-55-v33-tournaments-coaching`)  
**Capacity:** ~47 pts

#### P0 Items (~31 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| GAM-05-LIVE-01 | LIVE bracket + battle royale in SessionRoom (extends REST `GAM-05`) | 13 | Planned |
| GAM-05-QA | Tournament idempotency + reconnect suite (backlog) | 5 | Planned |
| ADR-0017 | Verify ADR-0017 against LIVE implementation | 2 | Planned |
| AI-COACHING-02 | Coaching card in Insights tab (backlog; API exists) | 5 | Planned |
| OBS-GAM-TOURNAMENT-01 | AE: `tournament.started`, `tournament.completed` | 3 | Planned |

**Subtotal P0: 28 pts**

#### P1 Items (~16 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| GAM-05-QA-01 | Tournament idempotency + reconnect tests; bracket mutation safety | 5 | Planned |
| AI-COACHING-02 | Coaching card in Insights tab with accept/dismiss + action tracking | 5 | Planned |
| I18N-S55-01 | i18n for tournament UI (tournament name, round labels, match-up cards) | 3 | Planned |
| OBS-GAM-TOURNAMENT-01 | AE events: `tournament.created`, `tournament.started`, `tournament.completed` | 3 | Planned |

**Subtotal P1: 16 pts**

#### Dependencies & Gates
- **Blocker**: ADR-0017 must be accepted before tournament state machine implementation starts
- **Blocker**: GAM-SCORE-01 (S29) + energizer foundation must be solid (tournament is built on energizer protocol v1)
- **Gate**: Tournament tests cover reconnection, match result disputes, tie-breaking

#### Definition of Done
- [ ] Battle royale test: 16 participants, 3 rounds, 75% elimination per round; all matches complete correctly
- [ ] Bracket test: 8-person single elimination; winner certification exported
- [ ] ADR-0017 accepted by architect
- [ ] Coaching suggestions appearing in Insights for ≥3 past sessions
- [ ] `npm test` green; 40+ tournament tests
- [ ] No integration regressions in existing energizer types (Quick Finger, Team Quiz)

---

### Sprint 56 — Tournaments Completion + AI Coaching Depth

**Window:** 2027-06-09 → 2027-06-23  
**Release target:** v3.3 continuation  
**Capacity:** ~44 pts

#### P0 Items (~28 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| GAM-05-LEADERBOARD-TOURN-01 | Tournament-aware leaderboard: match results, round-by-round scoring, winner badges | 5 | Planned |
| GAM-05-WINNER-CERT-01 | Winner certification export (PDF signed, printable); tournament brackets as appendix | 8 | Planned |
| AI-COACHING-03 | Coach personalization: per-facilitator learning profile (style preferences, audience size, topic); coaching suggestions adapt | 5 | Planned |
| KB-RAG-01 | Knowledge Base RAG: agent grounding on DECISIONS_VECTORIZE; coach suggests decisions similar to current session | 8 | Planned |
| KB-RAG-SEED-01 | RAG seed data: embed ≥500 closed-session decisions for cold-start quality | 2 | Planned |

**Subtotal P0: 28 pts**

#### P1 Items (~16 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| GAM-ANALYTICS-ADV-01 | Tournament analytics export: all rounds, match results, scoring formula, winner list | 5 | Planned |
| KB-RAG-EVAL-01 | RAG quality metrics: relevance score, coach suggestion acceptance rate | 5 | Planned |
| AI-COACHING-PROFILE-01 | Coach profile UI: facilitator can set style preferences for personalization | 3 | Planned |
| OBS-KB-RAG-01 | AE events: `kb_rag.query`, `kb_rag.result_returned` | 3 | Planned |

**Subtotal P1: 16 pts**

#### ADR Calendar
- **ADR-0018** (KB RAG activation) acceptance required before KB-RAG-01 merge

#### Definition of Done
- [ ] Tournament brackets displayed correctly with all round results
- [ ] Winner certificates generated and signed (R2 storage)
- [ ] Coach suggestions include similar decisions from KB (RAG context in prompt)
- [ ] Coach personalization stored per facilitator; suggestions adapt in realtime
- [ ] RAG seed data embedded and indexed in DECISIONS_VECTORIZE
- [ ] `npm test` green; KB-RAG quality tests for relevance

---

### Sprint 57 — AI Coaching UX + SOC2 Type II Prep

**Window:** 2027-06-23 → 2027-07-07  
**Release target:** v3.3 release  
**Capacity:** ~40 pts

#### P0 Items (~24 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| AI-COACHING-02-FINAL | Coaching card UI: action buttons (accept suggestion, save to template, dismiss), history of prior suggestions | 8 | Planned |
| AI-COACHING-EXPORT-01 | Coaching insights export: facilitator receives email with suggestions + performance metrics | 5 | Planned |
| COMPLIANCE-05-PREP | SOC2 Type II preparation: control inventory, evidence collection, audit scope finalization | 5 | Planned |
| I18N-S57-01 | i18n for coaching UI + export email copy (5 locales) | 3 | Planned |
| SOC2-PENTEST-01 | Penetration test engagement scheduled + scope agreed with pentest vendor | 3 | Planned |

**Subtotal P0: 24 pts**

#### P1 Items (~16 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| KB-RAG-COACHING-DEPTH-01 | Coach suggestions include historical decisions + outcomes; "Transparency improved when you used open questions (60% adoption)" | 8 | Planned |
| COMPLIANCE-PENTEST-KICKOFF-01 | Pentest execution starts (2-week engagement) | 5 | Planned |
| OBS-COMPLIANCE-01 | AE events for compliance: `compliance.pentest_started`, `compliance.audit_*` | 3 | Planned |

**Subtotal P1: 16 pts**

#### Release Milestone
- **v3.3 ships** end of S57: Tournaments + AI coaching + Knowledge Base RAG complete

#### Dependencies & Gates
- **Gate**: AI coaching quality metrics acceptable (coach suggestion acceptance ≥30%)
- **Gate**: KB-RAG relevance tests passing
- **Blocker**: SOC2 audit scope + control inventory finalized before compliance work continues in S58

#### Definition of Done
- [ ] Coaching card visible in Insights with action buttons working
- [ ] Export email generated + sent to facilitators after session
- [ ] SOC2 Type II audit scope document signed
- [ ] Pentest vendor engaged + kick-off meeting completed
- [ ] `npm test` green; no a11y regressions in new coaching UI
- [ ] Release notes: "v3.3: Tournaments, AI coaching, Knowledge Base RAG, and pentest engagement"

---

### Sprint 58 — SOC2 Type II Execution + Partner Tier Deepening

**Window:** 2027-07-07 → 2027-07-21  
**Release target:** v3.4 (feature branch `feat/sprint-58-v34-soc2-partner`)  
**Capacity:** ~46 pts

#### P0 Items (~33 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| COMPLIANCE-05 | SOC2 Type II audit execution: evidence review + auditor interviews + control testing (13 pts; spans S58–S59) | 13 | Planned |
| SOC2-EVIDENCE-KB-01 | SOC2 Type II evidence KB: control descriptions, design operating effectiveness, test results | 8 | Planned |
| PARTNER-MARKETPLACE-01 | Partner app marketplace: `/marketplace` listing page + search + integration store frontend | 5 | Planned |
| PARTNER-SLA-01 | SLA metrics dashboard for partners: uptime %, P95 latency, error rate; public SLA page | 5 | Planned |
| I18N-S58-01 | i18n for marketplace + SLA page (5 locales) | 2 | Planned |

**Subtotal P0: 33 pts**

#### P1 Items (~13 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| PARTNER-BRANDING-01-FINAL | Partner branding in session + email templates finalized; theme preview page | 5 | Planned |
| SOC2-PENTEST-REMEDIATION-01 | Pentest findings assessment + remediation plan | 5 | Planned |
| COMPLIANCE-WEBHOOK-AUDIT-01 | Webhook audit trail compliance check + DPA addendum | 3 | Planned |

**Subtotal P1: 13 pts**

#### ADR Calendar
- **No new ADRs** (ADR-0019 LDAP already accepted; ADR-0023 Partner OAuth from S54)

#### Definition of Done
- [ ] SOC2 Type II audit in progress; auditor interviews completed
- [ ] Partner marketplace live on production
- [ ] SLA page public; uptime dashboard operational
- [ ] Pentest findings triaged + remediation priority assigned
- [ ] All compliance evidence documents stored in `/knowledge-base/security/SOC2_TYPE_II_EVIDENCE/`
- [ ] `npm test` green; no compliance regressions

---

### Sprint 59 — SOC2 Type II Completion + Partner Tier GTM

**Window:** 2027-07-21 → 2027-08-04  
**Release target:** v3.4 continuation → v3.4 release  
**Capacity:** ~45 pts

#### P0 Items (~32 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| COMPLIANCE-05-FINAL | SOC2 Type II audit completion: final report signed off, certification issued | 5 | Planned |
| SOC2-TRUST-PAGE-01 | SOC2 Type II trust page: certification link + compliance badge + compliance roadmap | 5 | Planned |
| SOC2-PENTEST-REMEDIATION-02 | Pentest findings remediation complete + retesting | 8 | Planned |
| PARTNER-OAUTH-ROTATE-01 | Partner app secret rotation automation + audit trail | 5 | Planned |
| PARTNER-GTM-01 | Partner GTM launch: app marketplace announcement + partner onboarding docs | 5 | Planned |
| OBS-COMPLIANCE-FINAL-01 | Compliance AE events: `compliance.soc2_type2_completed`, `compliance.pentest_resolved` | 4 | Planned |

**Subtotal P0: 32 pts**

#### P1 Items (~13 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| PARTNER-SUPPORT-01 | Partner support channel: Slack/email SLA for partner apps | 5 | Planned |
| PARTNER-REVENUE-01 | Partner revenue tracking: session fees attributed to partner app; reporting dashboard | 5 | Planned |
| COMPLIANCE-ROADMAP-UPDATE-01 | Compliance roadmap update: v3.4 + v3.5 milestones | 3 | Planned |

**Subtotal P1: 13 pts**

#### Release Milestone
- **v3.4 ships** end of S59: SOC2 Type II certified, pentest resolved, partner tier GTM live

#### Dependencies & Gates
- **Gate**: SOC2 Type II report signed + certification issued before trust page ships
- **Gate**: All pentest findings remediated + retesting green before certification claim

#### Definition of Done
- [ ] SOC2 Type II Report signed by auditor
- [ ] Certification badge + link on `/trust/soc2`
- [ ] Pentest final report reviewed + all critical findings resolved
- [ ] Partner marketplace active with ≥2 partner apps in closed beta
- [ ] Partner support SLA documented + team assigned
- [ ] Revenue tracking queries validated
- [ ] Release notes: "v3.4: SOC2 Type II certified, pentest cleared, partner marketplace live"

---

### Sprint 60 — v3.5 Multi-Tenant AI + Competitive Moat Completion

**Window:** 2027-08-04 → 2027-08-18  
**Release target:** v3.5 (final sprint, feature branch `feat/sprint-60-v35-ai-moat`)  
**Capacity:** ~42 pts

#### P0 Items (~28 pts)

| ID | Title | Pts | Status |
|:---|:------|----:|:------:|
| AI-MULTI-TENANT-01 | Multi-tenant AI coaching: coaching model awareness (team size, vertical, use case); per-team coaching personalization | 8 | Planned |
| KB-RAG-FINAL-01 | Knowledge Base RAG maturity: refined embeddings, similarity tuning, feedback loop | 5 | Planned |
| KB-RAG-SEARCH-01 | RAG search in Insights: "Find sessions similar to this one" + faceted filtering by theme/outcome | 5 | Planned |
| RC-V35-01 | v3.5 RC: release notes, roadmap close-out, backward compatibility verification | 5 | Planned |
| COMPETITIVE-MOAT-01 | Competitive positioning doc: tournaments vs. Kahoot, AI coaching vs. Mentimeter, Knowledge Base RAG vs. all competitors | 5 | Planned |

**Subtotal P0: 28 pts**

#### P1 Items (~14 pts)

| ID | Title | Pts | Notes |
|:---|:------|----:|:------|
| PARTNER-MARKETPLACE-MONETIZE-01 | Partner app revenue share model (30/70 or 20/80 tier); payment flows | 5 | Planned |
| WIN-LOSS-FOLLOWUP-01 | Win/loss analysis refresh: post-v3.5 customer interviews, competitive comparison | 5 | Planned |
| ROADMAP-V40-PLANNING-01 | v4.0 planning (future arc): native AI agents, multi-language coaching, mobile native | 4 | Planned |

**Subtotal P1: 14 pts**

#### Release Milestone
- **v3.5 ships** end of S60: Competitive moat complete; AI coaching matured; Knowledge Base RAG search in Insights

#### Definition of Done
- [ ] Multi-tenant AI coaching deployed; coaching suggestions differ per team vertical
- [ ] RAG search query latency p95 <2s
- [ ] v3.5 RC green: `npm test`, `tsc --noEmit`, `check:i18n`, `check:tokens-drift`
- [ ] Competitive positioning documented + sales team trained
- [ ] Partner marketplace revenue tracking operational
- [ ] Release notes: "v3.5: AI coaching matured, Knowledge Base RAG search, competitive moat complete"

---

---

## Release Map (S51–S60)

| Release | Ship date (target) | Sprints | Key features |
|---------|-------------------|---------|---|
| **v3.1** | 2027-04-28 | S51–S52 | Multi-region write sharding, LDAP full sync + group mapping, failover runbooks |
| **v3.2** | 2027-05-26 | S53–S54 | Vendor webhooks (Workday, BambooHR), Partner OAuth 2.0, integration status dashboard |
| **v3.3** | 2027-07-07 | S55–S57 | Tournaments (battle royale, bracket), AI coaching + personalization, Knowledge Base RAG grounding |
| **v3.4** | 2027-08-04 | S58–S59 | SOC2 Type II certification, pentest clearance, partner marketplace GTM, partner app revenue tracking |
| **v3.5** | 2027-08-18 | S60 | Multi-tenant AI coaching, RAG search, competitive moat complete |

---

## ADR Calendar (S51–S60)

| ADR | Sprint to accept | Primary backlog | Blocks |
|-----|------------------|---|---|
| ADR-0022 Phase 2 (write sharding) | S51 | MULTI-REGION-WRITE-01 | All S51 multi-region work |
| ADR-0019 (LDAP/Salesforce sync) | S51 | LDAP-FULL-SYNC-01 | LDAP implementation |
| ADR-0023 (Partner OAuth scoping) | S54 | PARTNER-OAUTH-01 | Partner tier S54+ |
| ADR-0017 (Tournament state machines) | S55 | GAM-05-TOURNAMENTS-01 | Tournament implementation |
| ADR-0018 (KB RAG activation) | S56 | KB-RAG-01 | RAG grounding |

---

## Key Gates & Dependencies

### S51 Gates (Critical Path)
1. **ADR-0022 Phase 2 (write sharding) accepted** — blocks all multi-region write work
2. **DevOps KV provisioning** (`MULTI_REGION_STATE_KV`, `MULTI_REGION_PRIMARY`, `MULTI_REGION_REPLICAS`) — blocks S52 failover
3. **Staging failover drill** — must pass before S52 production rollout

### S53–S54 Gates
1. **INT-PROVIDER-01 (S31) operational** — prerequisite for webhook templates
2. **WEBHOOK-01 (S33) deployed to production** — prerequisite for Workday/BambooHR
3. **SSRF controls + rate-limit tested** — gate before webhook template merge
4. **ADR-0023 (Partner OAuth) accepted** — gate before PARTNER-OAUTH-01 merge

### S55–S57 Gates (Tournaments + Coaching)
1. **ADR-0017 (Tournament state machines) accepted** — blocks GAM-05 implementation
2. **ADR-0018 (KB RAG) accepted** — blocks KB-RAG-01 merge
3. **Coaching quality metrics ≥30% acceptance** — gate before coaching feature flag on
4. **RAG seed data ≥500 embeddings** — cold-start quality requirement

### S58–S59 Gates (Compliance + Partner GTM)
1. **SOC2 Type II audit completion** — gate before certification page ships
2. **Pentest findings remediation 100%** — gate before certification badge displayed
3. **Partner marketplace closed-beta sign-offs** — gate before public launch

### S60 Gates (Moat Complete)
1. **Multi-tenant AI coaching deployment** — no feature flag, full rollout
2. **Competitive positioning validated** — sales team review + sign-off
3. **v3.5 RC green** — all tests + checks passing

---

## Out of Scope (S51–S60)

- **Stripe Connect marketplace** (payment splits; complex; S65+)
- **Native iOS/Android apps** (greenfield; out of Qesto scope; PWA sufficient for v3.5)
- **Dark mode** (design system maturity gate; v4.0 candidate)
- **External LLM APIs** (Anthropic, GPT; Workers AI only; keep cost control)
- **Multi-region D1 write** (sharding logic only; true multi-write not in this arc)
- **Notion as internal wiki** (use Obsidian vault only; see `OBSIDIAN_KB_STANDARD.md`)
- **New Notion product features** (legacy OAuth may remain; no new Notion webhook/import work in S51–S60)
- **Salesforce full OEM** (OAuth skeleton only; deep CRM sync S65+)

---

## Verification (Every Sprint)

```bash
npm test                           # All unit + integration tests
tsc --noEmit                       # TypeScript strict mode
npm run check:i18n                 # i18n key coverage + drift
npm run check:tokens-drift         # Design token drift
npm run check:pii-log              # PII sanitization gate (from S31)
npm run check:compliance-claims    # Compliance claim CI gate (from S31)
```

**Staging rituals:**
- WebSocket smoke test when touching SessionRoom (S51 failover, S55 tournaments, etc.)
- Webhook delivery test with sandbox accounts (S53)
- Multi-region failover drill (S52, pre-production rollout)
- SOC2 pentest readiness checklist (S57–S58)

---

## Deferred Item Resolution

### From S40–S50 Backlog
| Item | Deferred reason | Resolved in S51–S60 | Sprint |
|:---|:---|:---|---:|
| LDAP full sync | Larger scope than S40 estimate; needs full OU filtering | LDAP-FULL-SYNC-01 | S51 |
| ARCH-HONO-02 | Auth mount refactor; deferred since S34 | ARCH-HONO-02 | S53 |
| GAM-05 LIVE play | REST bracket shipped v2.4; LIVE DO loop open | GAM-05-LIVE-01 | S55 |
| INT-WEBHOOK-02 | Waited on webhook foundation (S33) | INT-WEBHOOK-02-* | S53–S54 |
| KB-RAG-01 | Grounding endpoint exists; production quality + seed | KB-RAG-01 | S56 |
| Partner OAuth completion | S45 status skeletons only | PARTNER-INTEG-01, PARTNER-OAUTH-01 | S54–S59 |
| EXPORT-PDF-01 | Deferred since S35 | GAM-05-WINNER-CERT-01 or dedicated sprint | S56 |
| Internal Notion wiki | Team docs in Notion | KB-OBSIDIAN-01, KB-NOTION-DEPRECATE-01 | S51 |
| INT-WEBHOOK-02-NOTION | Removed — internal KB uses Obsidian | — | — |
| ADR-0022 write sharding | Accepted Phase 1 (S46); Phase 2 deferred to demand | ARCH-ADR-0022-W | S51 |

---

## Continuity from S50

**Sprint 50 (v3.0 RC shipped)** delivered:
- Public API v1 + v2 stable
- Multi-region read foundation (ADR-0022 Phase 1)
- Observability complete (Analytics Engine instrumented)
- Partner tier docs + skeleton APIs

**S51 picks up:**
- Write sharding (ADR-0022 Phase 2; now unblocked by S50 RC stabilization)
- LDAP full maturity (from S40 deferral)
- Vendor integration acceleration (Workday, BambooHR pipelines)
- Tournaments + AI coaching (competitive moat stories)
- SOC2 Type II audit start (from S47 roadmap)

---

## Success Metrics (End of S60)

### Product
- Tournaments live: ≥5% of sessions use battle royale or bracket
- AI coaching deployed: ≥40% of facilitators view suggestions within 7 days post-session
- Knowledge Base RAG: ≥1000 similar-session recommendations per week
- Multi-region production traffic: ≥30% reads served from replicas
- LDAP synced teams: ≥20 enterprise customers on LDAP directory integration

### Compliance & Trust
- SOC2 Type II certified (signed report + badge on trust page)
- Pentest clearance: all critical findings resolved, medium findings remediated
- Partner marketplace: ≥3 ecosystem partners live + paying revenue share

### GTM & Retention
- Event organizer NPS improvement (post-tournament launch)
- HR team churn reduction (LDAP + Workday webhook synergy)
- Facilitator adoption of AI coaching (baseline ≥30% > Mentimeter feedback synthesis)
- Win rate vs. Slido on "advanced features" improved to ≥50% (from current ~40%)

---

## Cost & Risk Considerations

### Costs
- **Multi-region replication** (S51–S52): D1 replica read costs (~20–30% increase for replicated D1 rows)
- **SOC2 Type II audit** (S58–S59): ~$15K–$25K audit engagement + pentest $8K–$12K
- **Partner OEM infrastructure** (S54, S58): Stripe Connect marketplace (optional; not in S60 scope; estimated +$5K/month if added)

### Risks
1. **ADR-0022 write sharding complexity**: Multi-region write routing + failover is intricate; requires robust testing. *Mitigation*: Dedicated architect review; staging failover drill; 1-week buffer in S52.
2. **SOC2 audit schedule slippage**: Auditor availability in summer 2027 (busy season). *Mitigation*: Book auditor in S56; weekly check-ins; evidence collection in parallel (S58).
3. **LDAP sync PII leak**: Directory sync with customer data at scale. *Mitigation*: Strict PII logging gate; audit trail immutable; security review before S51 merge.
4. **RAG cold-start quality**: ≥500 embeddings needed; existing data may be sparse. *Mitigation*: Seed with customer-provided decision libraries (S56 parallel task); fallback to heuristic matching (S56 P1).
5. **Tournament state machine edge cases**: Reconnections, disputes, tie-breaking complex. *Mitigation*: ADR-0017 acceptance + property-based testing (S55); staged rollout (feature flag S55–S56).

---

## Handoff to Planning Ceremonies

**For S51 Kick-off (2027-03-24)**:
- [ ] Obsidian installed; vault opened at `knowledge-base/`; community plugins from `OBSIDIAN_KB_STANDARD.md` agreed
- [ ] Notion export dump scheduled for week 1 of S51
- [ ] ADR-0022 Phase 2 draft reviewed by architect + backend team (1-week pre-sprint review)
- [ ] DevOps provision KV namespaces by sprint start
- [ ] LDAP team finalize filtering requirements (UX story LDAP-FILTER-01)
- [ ] Staging failover drill scheduled for 2027-04-07 (mid-S51)

**For S53 Kick-off (2027-04-21)**:
- [ ] WEBHOOK-01 (S33) merged to production + stable for ≥2 weeks
- [ ] Workday/BambooHR sandbox accounts provisioned for testing
- [ ] SSRF controls + rate-limit reviewed by security team
- [ ] ADR-0023 (Partner OAuth) draft circulated ≥1 week before sprint

**For S55 Kick-off (2027-05-13)**:
- [ ] ADR-0017 (Tournament state machines) accepted + architecture review complete
- [ ] RAG seed data collection underway (≥300 embeddings from existing sessions)
- [ ] Coaching quality baseline measured (acceptance rate target ≥30%)
- [ ] Pentest vendor SOW signed

---

## Appendix: Epic → Sprint Mapping

| Epic | S51 | S52 | S53 | S54 | S55 | S56 | S57 | S58 | S59 | S60 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **EPIC-KB** | ✅ | — | — | — | — | — | — | — | — | — |
| **EPIC-MULTI** | ✅ | ✅ | — | — | — | — | — | — | — | — |
| **EPIC-AUTH-DEEP** | ✅ | ✅ | — | — | — | — | — | — | — | — |
| **EPIC-INT-VENDOR** | — | — | ✅ | ✅ | — | — | — | — | — | — |
| **EPIC-GAM-ADV** | — | — | — | — | ✅ | ✅ | ✅ | — | — | — |
| **EPIC-AI-COACH** | — | — | — | — | ✅ | ✅ | ✅ | — | — | ✅ |
| **EPIC-PARTNER** | ✅ | — | — | ✅ | — | — | — | ✅ | ✅ | — |

---

## References

- **SPRINT30_39_PLAN.md** — Prior 10-sprint horizon (S30–S39, v2.2–v2.4)
- **ROADMAP_FULL.md** — Release timeline + version targets
- **BACKLOG_MASTER.md** — Story registry (deferred items: LDAP-01-FULL, GAM-05, INT-WEBHOOK-02, KB-RAG-01, ADR-0022 Phase 2, ARCH-HONO-02)
- **WIN_LOSS_ANALYSIS.md** — Market priorities (LDAP, Zoom, integrations, audit, tournaments, AI coaching)
- **ADR-0022** — Multi-region foundation (Phase 1 shipped S46, Phase 2 deferred to S51)
- **ADR-0017, ADR-0018, ADR-0019, ADR-0023** — Tournament, RAG, LDAP, Partner OAuth (ADRs 0017, 0018, 0019 exist; ADR-0023 new)

---

**Document owner**: Product Owner  
**Last updated**: 2026-05-24 (Draft, ready for planning ceremony)  
**Approval gate**: Architect + Security review required before S51 sprint start
