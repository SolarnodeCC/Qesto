---
id: SPRINT91_99_STORIES
type: planning
domain: product
category: planning
status: proposed
version: 1.0
created: 2026-06-11
updated: 2026-06-11
tags:
  - planning
  - epics
  - sprints-91-99
  - v6.1
  - v6.2
  - v7.0
  - reactions-ga
  - pulse-analytics
  - copilot-ga
  - learn-embed
  - sovereign
  - connect-federation
  - studio-authoring
  - xr-beta
relates_to:
  - MARKET_VALIDATION_S85_99
  - SPRINT85_99_ARCH_NOTES
  - NEXT_5_EPICS_PLAN
  - ROADMAP_FULL
  - BACKLOG_MASTER
---

# Sprint 91–99 Story Breakdown — v6.1 → v7.0 GA Horizon

_Created: 2026-06-11 (UTC). Product Owner synthesis aligned to [`MARKET_VALIDATION_S85_99.md`](../research/MARKET_VALIDATION_S85_99.md) and [`SPRINT85_99_ARCH_NOTES.md`](./SPRINT85_99_ARCH_NOTES.md). 9-working-day sprint cadence; v6.0 GA at S90 baseline._

_**Status: Proposed** — for PO + Architect sign-off. Stories are backlog-ready; final sprint allocation occurs at S91 kickoff._

---

## Executive summary

This document expands **eight market-validated net-new epics** (S91–S99 horizon) into **story-level backlog entries**. Each epic is positioned as a new-buyer unlock or moat-defence surface, respecting the **do-not-co-land ADR discipline** and the **two-sprint RC rule** for major releases (v6.1 RC at S93, v7.0 RC at S97/S98).

| Epic | Sprints | Target release | Stories | Pts | New buyer / signal |
|------|---------|-----------------|---------|-----|-------------------|
| **1. REACTIONS GA** | S91–S92 | v6.1 | 8 | 68 | Creators/webinar hosts; edge latency |
| **2. PULSE** | S91–S93 | v6.2 | 10 | 91 | HR/People-ops analytics; fastest-growing segment |
| **3. COPILOT GA** | S92–S93 | v6.1 | 8 | 67 | Defend Mentimeter AI; upsell base |
| **4. LEARN** | S93–S95 | v6.2 | 7 | 61 | Corporate L&D / LMS; embed monetization |
| **5. SOVEREIGN+** | S93–S95 | v6.2 | 8 | 68 | EU/DACH public sector; residency moat |
| **6. CONNECT** | S95–S97 | v7.0-rc | 10 | 92 | Multi-org federation; network moat |
| **7. STUDIO** | S96–S98 | v7.0 | 9 | 81 | Content/enablement; AI lifecycle depth |
| **8. XR** | S98–S99 | v7.0 (beta) | 6 | 47 | Innovation flag; speculative |

**Total: 66 stories / ~575 product-engineering points** across 9 sprints (capacity: 120–150 pts/sprint @ ~9 dev days). Parallel **QA, security, i18n, and compliance tracks** add ~20–30% overhead per epic (budgeted in role plans, not here).

---

## Release narrative

| Release | Close | Sprints | Epics GA | North star |
|---------|-------|---------|----------|-----------|
| **v6.1** | ~S92 | S91–S92 | REACTIONS, COPILOT GA (partial) | Creator reach + live AI co-pilot |
| **v6.2** | ~S95 | S93–S95 | PULSE, LEARN, SOVEREIGN+ | Data product + vertical expansion + governance |
| **v6.3 / v7.0-rc** | ~S97 | S95–S97 | CONNECT (partial), STUDIO (partial) | Federation debut; network moat |
| **v7.0 GA** | ~S99 | S97–S99 | CONNECT GA, STUDIO GA, XR beta | Engagement Intelligence Network GA |

---

## Epic 1 — REACTIONS GA: Ephemeral High-Throughput Reaction Layer

**Market position:** 🟡 Validated with caution — moat showcase + first-to-market edge-latency demo (S91 anchor).  
**Competitive gap:** Mentimeter/Slido have no ephemeral reaction layer; StreamYard lacks polling depth.  
**New buyer:** Creators, webinar & livestream hosts.  
**Sprints:** S91 (foundation) → S92 (GA)  
**Release:** v6.1 (S92)

### Context & reuses

- **Realtime:** `SessionRoom` DO (ADR-0038 realtime v3 delta), `ModQueueDO` backpressure (ADR-0047)
- **Question engine:** reuse `reaction` question type (emote set, no text)
- **Rate limiting:** existing `planMiddleware` usage budgets
- **Anonymity:** zero-knowledge mode for anon reaction channels

### Net-new (ADR-0055 scope)

- High-frequency low-payload broadcast over realtime v3 delta
- Per-session reaction rate budget (msgs/min, per plan tier)
- Reaction flood/abuse control with exponential backoff
- Client-side emoji-render optimization (<16ms frame)
- Reaction-only sub-channel (does not block vote/Q&A)

### Story breakdown (~68 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| REACTIONS-00 | ADR-0055 acceptance: reaction channel design, rate budgets, flood model | 3 | P0 | S91 | Architect + performance sign-off |
| REACTIONS-CHANNEL-01 | Reaction channel server: broadcast, rate limit, flood backoff | 13 | P0 | S91 | Reaction broadcasts <100ms latency @ 1000 msg/sec |
| REACTIONS-TYPE-01 | Reaction question type: emoji set picker, no open text | 8 | P0 | S91 | `type='reaction'` in question JSON |
| REACTIONS-BUDGET-01 | Per-session reaction rate tiers (plan-gated): free 100/min, pro 500/min | 8 | P0 | S91 | Overage → 429 backoff |
| REACTIONS-ZEROK-01 | Zero-knowledge reaction channel: aggregate-only stats | 8 | P1 | S91 | ZK sessions report emoji distribution, not per-user |
| FE-REACTIONS-RENDER-01 | Client reaction animation + render optimization (<16ms per frame) | 13 | P0 | S92 | p99 render <16ms; 60 fps sustained |
| REACTIONS-ABUSE-01 | Flood-control + rate-reset per user per session | 5 | P0 | S92 | Attacker blocked after 3× overage in 30s |
| QA-REACTIONS-LOAD-01 | E2E load: 10k concurrent, 1000 reactions/sec peak | 8 | P0 | S92 | No message loss; latency p95 <150ms |
| I18N-REACTIONS-01 | i18n: emoji alt-text in 5 locales (optional, theme-specific) | 3 | P1 | S92 | Check:i18n green |

### Epic acceptance

A webinar host enables reactions on a poll. Attendees (10k concurrent) submit emojis; they appear in real time (p95 <100ms), aggregate visually, and rate-limit enforces plan tiers. Zero-knowledge sessions report emoji distribution only. Clients render at 60 fps without frame drops. Flood attacks are throttled with exponential backoff.

### KPIs (REACTIONS)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Creator pilot adoption | ≥5 Qesto Stream / livestream host pilots by S92 | Sales pipeline |
| Reaction latency | p95 <100ms broadcast | AE `reaction.broadcast_latency` histogram |
| Abuse incidents | <1% of sessions hit overage block | `session.reaction_overage` rate |

---

## Epic 2 — PULSE: Continuous HR Engagement Analytics Product

**Market position:** 🟢 Validated — highest-value candidate; strongest documented demand (40 pain-point mentions).  
**Competitive gap:** Culture Amp / Officevibe price per-seat; none are GDPR-edge-native.  
**New buyer:** HR / People-ops as a standalone analytics buyer (expand).  
**Sprints:** S91 (foundation) → S93 (GA)  
**Release:** v6.2 (S95)

### Context & reuses

- **Data model:** workspace model (ADR-0048), DECISIONS_VECTORIZE for theme clustering
- **Analytics pipeline:** INSIGHTS+ cross-session patterns, aggregation store
- **AI insights:** Workers AI theme extraction + anomaly flagging
- **Anonymity:** zero-knowledge rollups (k-anonymity threshold, configurable)
- **Auth:** team roles (owner/member/viewer with audit-log read)

### Net-new (ADR-0057 scope: analytics data model)

- Cross-team / cross-session aggregation plane (read-optimized, time-series)
- Longitudinal trend analysis (participation, sentiment, action velocity)
- AI narration over aggregates (Workers AI only)
- GDPR retention tiers (anonymized 7y, PII 90d)
- Audit-log for all aggregation queries (who, when, cohort size)

### Story breakdown (~91 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| PULSE-00 | ADR-0057 acceptance: aggregation data model, k-anonymity rules, audit | 3 | P0 | S91 | DPO + architect sign-off |
| PULSE-STORE-01 | Analytics aggregation store: time-series rollup of session results (D1) | 21 | P0 | S91 | Rollup triggers on session close; lag <5min |
| PULSE-LONGITUDINAL-01 | Trend features: N-session participation, sentiment arc, action completion % | 13 | P0 | S92 | Query returns ≥3-session trends |
| PULSE-KANON-01 | k-anonymity enforcement: min cohort size before roll-up visible | 13 | P1 | S92 | Cohort <k masked in UI + API |
| PULSE-RETENTION-01 | GDPR retention policy: anonymize after 90d, delete after 7y | 8 | P0 | S92 | Daily cron redacts PII; audit log immutable |
| PULSE-AUDIT-01 | Aggregation query audit log: who queried, cohort size, timestamp | 8 | P0 | S93 | Every query logged; DPO-readable export |
| PULSE-AI-NARRATION-01 | AI trend summary: Workers AI narrates 3-session arc (themes + anomalies) | 13 | P1 | S93 | Summary on dashboard; eval-gated |
| FE-PULSE-DASHBOARD-01 | HR dashboard: trend charts, anomaly flags, action-item velocity | 13 | P1 | S93 | WCAG 2.1 AA; export JSON/CSV |
| SEC-PULSE-ISOLATION-01 | Cross-team isolation: team A cannot query team B aggregates | 8 | P0 | S92 | Contract tests; audit trail confirms isolation |
| I18N-PULSE-01 | i18n: dashboard labels, trend chart axes in 5 locales | 3 | P1 | S93 | Check:i18n green |

### Epic acceptance

An HR admin creates a recurring engagement workspace, runs pulse surveys monthly. After ≥3 runs, the analytics dashboard shows participation + sentiment trends (k-anonymity respected). AI narrates anomalies ("engagement dropped 20% week-of-X"). Audit log records all dashboard queries with cohort metadata. Zero-knowledge sessions never leak individual participant data. GDPR retention auto-redacts PII after 90d. Export is formula-injection safe.

### KPIs (PULSE)

| KPI | Target | Measurement |
|-----|--------|-------------|
| HR-analytics new customers | ≥8 HR teams on PULSE by S95 close | `pulse.workspace_created` AE |
| Longitudinal adoption | ≥60% of PULSE workspaces run ≥3 surveys by S95 | Workspace survey count |
| Dashboard engagement | ≥40% DAU view dashboard ≥1x/week | `pulse.dashboard_viewed` AE |
| Compliance confidence | 0 GDPR audit findings on PII retention | DPO sign-off |

---

## Epic 3 — COPILOT GA: Live AI Facilitator Co-pilot, Productised

**Market position:** 🟢 Validated — moat defence + upsell to base; risk signal #1 mitigation.  
**Competitive gap:** Mentimeter "AI coaching" has egress; Qesto keeps inference on Workers AI, no transcript out.  
**New buyer:** Existing base upsell + Mentimeter AI-coaching switchers.  
**Sprints:** S92 (foundation) → S93 (GA)  
**Release:** v6.1 (S92, partial) → v6.2 (S95, GA)

### Context & reuses

- **Agent runtime:** `AgentRunDO` (ADR-0046), tool sandbox, execution policy
- **AI model:** Workers AI Llama 3.3, inference-only (no egress)
- **Session context:** question types, participation data, realtime transcript
- **Anonymity:** never surface individual participant names in suggestions
- **Rate limits:** per-session co-pilot queries (plan-gated)

### Net-new (ADR-0056 scope: agentic maturity L2)

- Bounded multi-step autonomy (co-pilot asks clarifying questions, suggests next steps)
- Human-in-the-loop checkpoints (facilitator approves suggestions before broadcast)
- Expanded tool surface (theme clustering, anomaly detection, next-question recommendation)
- Extended agent safety eval (`SEC-AGENT-EVAL-02`)

### Story breakdown (~67 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| COPILOT-00 | ADR-0056 acceptance: L2 autonomy bounds, checkpoint model, tool whitelist | 3 | P0 | S92 | Security + architect sign-off |
| COPILOT-RUNTIME-01 | Extended agent runtime: multi-step plans with facilitator approval gates | 21 | P0 | S92 | Co-pilot suggests 3-step action (cluster → theme → next Q) |
| COPILOT-TOOLS-01 | Tool expansion: theme clustering, anomaly detection, participation alerts | 13 | P0 | S92 | Tools callable within sandbox; output schema validated |
| COPILOT-CHECKPOINT-01 | Facilitator approval UI: co-pilot suggestion → "approve / edit / dismiss" | 13 | P0 | S93 | Broadcast only after explicit facilitator click |
| COPILOT-CONTEXT-01 | Session context injection: anonymized Q&A, results, participant sentiment | 8 | P1 | S93 | Context never includes participant names |
| FE-COPILOT-PANEL-01 | Co-pilot side panel: suggestion stream, pending approvals, action history | 13 | P1 | S93 | WCAG 2.1 AA; collapse/expand panel |
| SEC-COPILOT-SANDBOX-01 | Tool sandbox hardening: no session write, no cross-session read | 8 | P0 | S93 | Pentest #6 agent surface |
| I18N-COPILOT-01 | i18n: suggestion phrases, button labels in 5 locales | 3 | P1 | S93 | Check:i18n green |

### Epic acceptance

During a live session, a facilitator enables COPILOT. After a poll closes, the co-pilot analyzes anonymized results and suggests a follow-up question or next step. The facilitator reviews in the side panel and approves or edits before it broadcasts to participants. All suggestions are checked against the tool sandbox (no session mutation, no cross-session context leak). Zero-knowledge sessions anonymize participant names in the context window.

### KPIs (COPILOT GA)

| KPI | Target | Measurement |
|-----|--------|-------------|
| COPILOT activation | ≥40% of sessions enable co-pilot by S95 | `session.copilot_enabled` rate |
| Facilitator approval rate | ≥50% of suggestions approved (not dismissed) | `copilot.suggestion_approved` / total |
| Mentimeter switchers | ≥5 deal wins attributed to COPILOT by S95 | CRM tag |
| Agent safety eval | SEC-AGENT-EVAL-02 green | Security sign-off |

---

## Epic 4 — LEARN: LMS-Embedded Assessment & Learning Engagement

**Market position:** 🟡 Validated with caution — gated on EMBED (S87) traction.  
**Competitive gap:** Kahoot/Poll Everywhere own LMS but are gamified/legacy; no GDPR-edge embed.  
**New buyer:** Corporate L&D / training-ops; LMS platforms (via EMBED rails).  
**Sprints:** S93 (foundation) → S95 (GA)  
**Release:** v6.2 (S95)

### Context & reuses

- **EMBED SDK:** `@qesto/embed` JS SDK (shipped S88), origin sandbox (ADR-0050), scoped tokens
- **Question engine:** `assessment` mode (quiz-style with scoring), ranked, consent types
- **LMS interop:** LTI v1.1 + LMS grade passback (Canvas/Blackboard/Moodle)
- **Workspace model:** course-scoped recurring assessment (ADR-0048)

### Net-new

- LTI consumer implementation (Canvas/Blackboard/Moodle launch)
- LMS grade passback (assessment score → LMS gradebook)
- Assessment scoring schema (configurable weighting, partial credit)
- Course-scoped assessment workspace
- L&D-specific session templates (pre/post quizzes, knowledge-check formative)

### Story breakdown (~61 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| LEARN-00 | EMBED traction checkpoint: ≥10 live embeds, 0 security incidents | 0 | P0 | S93 | Gate logic: proceed iff threshold met; else defer epic |
| LEARN-LTI-01 | LTI v1.1 consumer: Canvas/Blackboard/Moodle launch flow | 21 | P0 | S93 | Tool launches from LMS; session links to course context |
| LEARN-GRADE-01 | LMS grade passback: assessment score syncs to gradebook (configurable) | 13 | P0 | S94 | POST to LMS outcomes API; audit-logged |
| LEARN-SCORING-01 | Assessment scoring engine: per-question weights, partial credit, curves | 8 | P0 | S94 | Instructor configures weights; score calculated on close |
| LEARN-TEMPLATES-01 | L&D session templates: pre-quiz, formative check, post-assess | 8 | P1 | S94 | Template gallery ships; instructors can clone + customize |
| FE-LEARN-INSTRUCTOR-01 | Instructor view: score distribution, difficulty analytics, export for reporting | 13 | P1 | S95 | WCAG 2.1 AA; CSV export of per-student results |
| I18N-LEARN-01 | i18n: template names, scoring labels, LMS field mappings in 5 locales | 3 | P1 | S95 | Check:i18n green |

### Epic acceptance

An instructor creates an assessment session in their Canvas course via LTI launch. Students take the quiz (multiple-choice, ranked, consent types). Scores sync to the Canvas gradebook with configurable weighting. Instructor views score distribution and difficulty heatmap. Export captures per-student item-level performance. L&D templates include pre/post + formative check types. Integration with Canvas, Blackboard, Moodle confirmed.

### KPIs (LEARN)

| KPI | Target | Measurement |
|-----|--------|-------------|
| LMS pilot activations | ≥3 pilot institutions (Canvas / Blackboard) by S95 | Sales pipeline |
| Assessment adoption | ≥50 assessment sessions in 30d post-GA | `session.mode='assessment'` count |
| Grade passback success | >99% of scores sync to LMS | `lms.grade_passback_success` rate |
| Lost-deal recovery | ≥2 L&D wins attributed to LEARN | CRM tag |

---

## Epic 5 — SOVEREIGN+: Data-Residency & Sovereign Deployment Expansion

**Market position:** 🟢 Validated — defends the deepest moat; extends S89 sovereign tier.  
**Competitive gap:** No competitor pairs per-region edge residency with verifiable audit.  
**New buyer:** EU/DACH public sector, regulated enterprise, gov-adjacent.  
**Sprints:** S93 (foundation) → S95 (GA)  
**Release:** v6.2 (S95)

### Context & reuses

- **Sovereign tier:** S89 FedRAMP Moderate boundary (ADR-0052), gov-cloud data plane
- **Audit infrastructure:** AUDIT_KV + audit-log viewer (shipped DELIBERATE)
- **GDPR compliance:** retention policies, DPA signature, data-residency config
- **Per-region deployment:** EU/UK/Canada region-pairs

### Net-new

- Per-region data residency (US-gov / EU-only / UK-only / Canada-only) with hard boundary enforcement
- Verifiable audit API: third-party access log + cryptographic chain-of-custody
- Sovereign-tier feature exclusion (no CONNECT federation, no partner egress)
- Regional compliance posture (e18n: NL works-council + DE data-protection labels)

### Story breakdown (~68 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| SOVEREIGN-00 | Region-residency enforcement: hard boundary, no cross-region data leak | 3 | P0 | S93 | Architect + DPO sign-off |
| SOVEREIGN-REGIONS-01 | Multi-region deployment: eu-001, uk-001, ca-001 CF Workers bindings | 21 | P0 | S93 | Session data stays in region; KV namespaced by region |
| SOVEREIGN-AUDIT-API-01 | Audit API: third-party read access to compliance audit log (scoped) | 13 | P0 | S94 | Signed audit export; timestamp + action immutable |
| SOVEREIGN-EXCLUSION-01 | Sovereign-tier feature exclusion: CONNECT federation + egress opt-out | 8 | P0 | S94 | D1 query rejects federation join attempts from sovereign |
| SOVEREIGN-POSTURE-01 | Compliance posture UI: per-tenant claims (FedRAMP, GDPR, regional cert) | 13 | P1 | S94 | Tenant admin sees checkmark matrix |
| SOVEREIGN-I18N-01 | Regional compliance labels: DE "Datenschutzerklärung", NL "Verwerkingsregister" | 8 | P1 | S95 | Locale auto-selected by region |
| SEC-SOVEREIGN-ISOLATION-01 | Cross-region isolation proof: no data leakage in staging + production | 13 | P0 | S95 | Pentest #6 scope; zero findings |
| I18N-SOVEREIGN-01 | i18n: residency UI, audit labels in 5 locales | 3 | P1 | S95 | Check:i18n green |

### Epic acceptance

A German public-sector agency signs up and selects "EU-only residency + FedRAMP." Their session data is stored exclusively in the EU-001 region; no cross-border egress. They export the compliance audit log (immutable, cryptographically signed) showing all access. CONNECT federation is unavailable (feature exclusion). The posture UI displays "FedRAMP: Yes / GDPR: Full / Residency: EU-only." German language shows "Datenschutzerklärung."

### KPIs (SOVEREIGN+)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Public-sector pilots | ≥2 EU/DACH public-sector pilots by S95 | Sales pipeline |
| Residency opt-in | ≥40% of PULSE/LEARN customers select regional residency | Tenant config survey |
| Audit export usage | ≥50% of sovereign tenants export audit log ≥1x/quarter | `audit.export_count` AE |
| Compliance cert wins | ≥3 deals won on "verifiable audit + regional residency" | CRM tag |

---

## Epic 6 — CONNECT: Federated Cross-Tenant Engagement Network

**Market position:** 🔵 Validated — highest-moat strategic bet; v7.0 centrepiece.  
**Competitive gap:** No incumbent offers cross-tenant federated sessions with preserved anonymity.  
**New buyer:** Multi-org events, associations, partner ecosystems, agencies.  
**Sprints:** S95 (foundation) → S97 (GA)  
**Release:** v7.0-rc / v7.0 GA (S99)

### Context & reuses

- **Realtime:** `SessionRoom` DO for federated realtime coordination
- **Question engine:** all question types (federation-neutral)
- **Anonymity:** zero-knowledge mode, k-anonymity across tenant boundaries
- **Audit:** AUDIT_KV + federation-join log
- **Plan middleware:** multi-tenant isolation enforcement

### Net-new (ADR-0059 scope: ecosystem egress + ADR-0062 scale proof)

- **Federation trust model:** tenant A invites tenant B to a session (signed, scoped, time-limited)
- **Federated anonymity:** preserves zero-knowledge guarantees across tenant boundary; no per-tenant participant list visible to other tenants
- **Cross-tenant isolation proof:** load test at v7.0 scale; confirm no data leakage
- **Opt-out mechanism:** sovereign tenants hard-excluded; all data-residency rules hold across federation
- **Federation audit:** join events, per-tenant aggregates, query log

### Story breakdown (~92 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| CONNECT-00 | ADR-0062 acceptance: federation trust model, anonymity proof, scale evidence | 3 | P0 | S95 | Architect + security review; white-paper draft |
| CONNECT-INVITE-01 | Federation invite: tenant A creates invite token for tenant B (scoped, TTL) | 21 | P0 | S95 | POST /api/federation/invites; token valid 7d |
| CONNECT-JOIN-01 | Federated session join: tenant B accepts invite, session becomes multi-tenant | 21 | P0 | S96 | Session.federated_tenants array grows; realtime syncs |
| CONNECT-ZEROK-01 | Federated zero-knowledge: per-tenant participant list never visible cross-tenant | 13 | P0 | S96 | Aggregates visible; identifiers never leak |
| CONNECT-ISOLATION-01 | Cross-tenant data isolation: tenant A queries never return tenant B raw data | 13 | P0 | S96 | Contract tests; audit confirms per-tenant filtering |
| CONNECT-SOVEREIGN-01 | Sovereign exclusion: federated join rejected for sovereign tenants (hard) | 8 | P0 | S96 | D1 constraint: federation_status NULL for sovereign |
| CONNECT-AUDIT-01 | Federation audit: join events, per-tenant aggregate log, query attribution | 13 | P1 | S96 | Audit export shows federation membership + queries |
| FE-CONNECT-JOIN-UI-01 | Federation UI: accept invite, view co-tenant aggregate stats (anonymized) | 13 | P1 | S97 | WCAG 2.1 AA; shows "3 organizations joined" not names |
| QA-CONNECT-SCALE-01 | Scale proof: 5 tenants × 50k participants × 100 queries, zero leakage | 8 | P0 | S97 | Load-test evidence + isolation audit |
| I18N-CONNECT-01 | i18n: federation labels, isolation warnings in 5 locales | 3 | P1 | S97 | Check:i18n green |

### Epic acceptance

A non-profit association invites 5 member organizations to a federated governance session. Each tenant's participants join anonymously (zero-knowledge mode). The association sees aggregate vote counts and theme clusters across all tenants, but never sees which tenant contributed which idea. A sovereign tenant's invite is rejected at the API boundary. After the session, the association exports a per-tenant audit log showing org A contributed 150 votes, org B 200, etc. (no participant leakage). Load test confirms 5 tenants × 50k participants at <200ms latency with zero cross-tenant data visible.

### KPIs (CONNECT)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Federation pilots | ≥3 multi-org event pilots by S97 | Sales pipeline |
| Federated session adoption | ≥20 federated sessions live by S99 | `session.federated_tenant_count` > 1 |
| Isolation audit | Zero cross-tenant leakage findings | Security sign-off + pentest #6 |
| Anonymity confidence | 100% of ZK federated sessions pass k-anonymity check | QA automation |

---

## Epic 7 — STUDIO: Privacy-Native AI Session Authoring & Content Intelligence

**Market position:** 🟢 Validated — AI-depth / retention epic; lifecycle coverage.  
**Competitive gap:** Mentimeter "AI build-a-poll" is shallow; no privacy-native AI authoring with CANVAS theme intelligence.  
**New buyer:** Content/enablement teams, agencies, course creators (expand + net-new).  
**Sprints:** S96 (foundation) → S98 (GA)  
**Release:** v7.0 (S99)

### Context & reuses

- **CANVAS theme engine:** S88 theme + adaptive dataviz (shipped)
- **AI models:** Workers AI Llama 3.3 for content generation
- **DECISIONS_VECTORIZE:** semantic search over past questions for suggestions
- **Question engine:** all types generatable
- **Workspace model:** course/content library workspace (ADR-0048)

### Net-new (ADR-0060 scope: analytics insight intelligence)

- **Authoring co-pilot:** "Generate a quiz about X" → Workers AI drafts questions respecting CANVAS theme
- **Content library:** save + remix authored questions; AI suggestions for next questions
- **Theme-aware generation:** drafts inherit brand colors, font, tone from selected theme
- **Eval gating:** output schema validated (`npm run test:eval` golden fixtures required)

### Story breakdown (~81 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| STUDIO-00 | ADR-0060 acceptance: authoring co-pilot model, theme embedding, eval gates | 3 | P0 | S96 | Architect + AI engineer sign-off |
| STUDIO-COPILOT-01 | Authoring co-pilot: "Generate questions about X" → Workers AI + prompt | 21 | P0 | S96 | Co-pilot returns 3 question drafts (configurable type) |
| STUDIO-THEME-01 | Theme-aware generation: drafts inherit CANVAS theme (colors, font, tone) | 13 | P0 | S96 | Generated UI respects theme CSS variables |
| STUDIO-LIBRARY-01 | Content library: save authored questions, remix + fork, usage tracking | 13 | P1 | S97 | Creator saves question; others can "fork" (copy + edit) |
| STUDIO-SUGGEST-01 | Next-question suggestions: based on DECISIONS_VECTORIZE semantic match | 8 | P1 | S97 | After Q1, co-pilot suggests topically-related Q2 |
| FE-STUDIO-AUTHORING-01 | Authoring UI: prompt input, theme selector, draft preview + edit | 13 | P1 | S97 | WCAG 2.1 AA; dark-mode support |
| AI-STUDIO-EVAL-01 | Eval harness: golden fixtures for authoring output schema (e.g., question JSON) | 13 | P0 | S97 | `npm run test:eval` includes STUDIO fixtures |
| SEC-STUDIO-PROMPT-01 | Prompt injection hardening: no SQL/code execution in generated content | 8 | P0 | S97 | Pentest #6 AI safety scope |
| I18N-STUDIO-01 | i18n: authoring labels, theme names, suggestion phrases in 5 locales | 3 | P1 | S98 | Check:i18n green |

### Epic acceptance

A course creator opens STUDIO and prompts: "Generate 5 assessment questions about GDPR." The co-pilot (Workers AI) returns 5 draft questions respecting the creator's chosen theme (fonts, brand colors auto-inherited). The creator edits and saves them to their content library. Next session, STUDIO suggests 3 topically-related questions. All drafts are eval-gated; output schema is validated against golden fixtures before rendering. No prompt injection risk (hardened in pentest #6).

### KPIs (STUDIO)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Authoring adoption | ≥100 creators use STUDIO co-pilot by S99 | `studio.copilot_used` AE |
| Content library size | ≥500 public questions in library by S99 | `library.question_count` |
| Theme usage | ≥60% of authored questions inherit theme styling | STUDIO-THEME-01 adoption |
| AI confidence | SEC eval + Pentest #6 zero AI-related findings | Security sign-off |

---

## Epic 8 — XR: Spatial / Immersive Session Mode (Beta)

**Market position:** 🟡 Conditionally validated as **v7.0 innovation beta only** — change-5, thin demand.  
**Competitive gap:** No facilitation incumbent has credible spatial mode.  
**New buyer:** Hybrid-event & enterprise innovation buyers; XR-curious (speculative).  
**Sprints:** S98 (spike) → S99 (beta ship)  
**Release:** v7.0 (beta only, not GA)

### Context & reuses

- **Question engine:** all types displayable in 3D space
- **Realtime:** `SessionRoom` DO broadcasts 3D participant state
- **WebGL rendering:** Three.js / Babylon.js adapter (TBD; not Workers AI, browser-side)
- **Fallback:** 2D mode for non-XR browsers

### Net-new (flagged as beta / innovation only)

- **Spatial session mode:** questions appear as 3D objects in shared space
- **Avatar system:** participant avatars in space (non-photorealistic, privacy-safe)
- **Interaction model:** vote/Q&A via spatial gestures or traditional buttons (fallback)
- **Device support:** Meta Quest 3 + iOS/Android WebXR (limited beta)

### Story breakdown (~47 pts)

| ID | Story | Pts | Pri | Sprint | Acceptance signal |
|----|-------|----:|-----|--------|-------------------|
| XR-00 | **Spike: XR demand validation** (design-partner interviews, kill-criterion set) | 13 | P0 | S98 | ≥3 design-partner commitments to proceed; else kill |
| XR-SPATIAL-01 | Spatial question rendering: 3D object layout in shared WebGL space | 13 | P1 | S98 | Question appears in center; vote UI overlaid |
| XR-AVATAR-01 | Avatar system: non-photorealistic, privacy-safe participant presence | 8 | P1 | S98 | 50 concurrent avatars at <30fps |
| XR-FALLBACK-01 | 2D fallback for non-XR browsers: button-based interaction (graceful degrade) | 8 | P1 | S99 | Safari/Chrome non-XR users see 2D poll |
| FE-XR-LAUNCHER-01 | XR launcher: "Enter immersive mode" button, device detection, WebXR API | 5 | P1 | S99 | Detects Quest 3, iOS Safari 16+, Android Chrome |

### Epic acceptance

**Beta only.** A design partner launches a session in Meta Quest 3. The session appears as a 3D space with participant avatars and a question object in the center. They vote via spatial gesture or button fallback. Non-XR browser users see a 2D version with traditional buttons. Latency <200ms. The feature is hidden behind a `beta-xr` feature flag and not marketed as GA.

### KPIs (XR beta)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Design-partner engagement | ≥3 partners complete beta session | Sprint intake |
| Session latency | p95 <200ms avatar sync in XR | AE `xr.avatar_sync_latency` |
| **Kill criterion** | If <1 design-partner pull by S99 week 2 → defer to v7.1 | Escalation trigger |

---

## Cross-sprint quality & risk gates (S91–S99)

| Gate | Cadence / complete by | Blocks | Notes for 9-day cadence |
|------|------------------------|--------|-------------------------|
| **Pentest #6** (agent L2/L3 + analytics + ecosystem egress) | Prep S94, run S95–S96, closed by **S97** | v7.0 RC | New surfaces = high-stakes; remediation decoupled from sprint clock |
| **RC soak — two-sprint rule for majors** | v6.1: S91 (1-sprint), v6.2: S93→S95, v7.0: **S97/S98→S99** | Major GA | 1-sprint sprints only if no realtime/crypto/auth surface changed |
| **`check:compliance-claims` green** | **Continuous (per PR touching copy)** | All public-facing claims | Compressed sprint tail cannot be the first check |
| **AI eval gate `npm run test:eval` green** | **Continuous (per PR touching prompts/models/schemas)** | COPILOT, PULSE AI, STUDIO | REV-10 hard rule; golden fixtures extended before each GA |
| **Agent safety eval** SEC-AGENT-EVAL-02 (L2) / EVAL-03 (L3) | EVAL-02 by **S93** (COPILOT), EVAL-03 by **S96** (future L3) | Agentic maturity GA | No autonomy escalation ships without tier-specific eval; L3 is arc's top risk |
| **Federation-trust security review** | By **S96** (pre-CONNECT GA) | CONNECT GA @ S97+ | New cross-tenant attack surface; independent review required |
| **Tenant isolation proof** (CONNECT + PULSE aggregation) | By **S97** (ADR-0062) | v7.0 RC | Cross-tenant aggregation + federation must prove no leakage at scale |
| **Data-egress consent audit** | By **S94** onward (ADR-0059) | Partner integrations | Scoped, consented, allowlisted egress only; GDPR DPA alignment |
| **DR drill RTO ≤2h** | v7.0 by **S98** (not GA sprint) | v7.0 GA claim | Drill evidence predate GA sprint |
| **WCAG AAA conformance** | New v7.0 UIs by **S98** | AAA GA claim | REACTIONS, PULSE, STUDIO dashboards + CONNECT federation UI |
| **XR kill-criterion** | **S98 week 2** | XR beta continuation | <1 design-partner pull → defer to v7.1 |

---

## Do-not-co-land discipline (S91–S99)

Inherited from ADR-0055–0063 notes:

| Must not co-land in same RC | Reason |
|---|---|
| **ADR-0056 (COPILOT agentic L2) + ADR-0057 (PULSE cross-tenant aggregation)** | Two simultaneous autonomy/data escalations split pentest/eval focus |
| **ADR-0059 (CONNECT/STUDIO egress) + ADR-0060 (PULSE AI narration)** | Data-out trust + AI-output trust must be isolated |
| **ADR-0061 (agentic L3 if shipped later) + any data-egress/analytics-AI GA** | L3 is autonomy ceiling and top risk; owns its RC alone |
| **REACTIONS (S91–S92) not in same RC as COPILOT (S92–S93 foundation)** | Realtime protocol change (REACTIONS channel) + agent autonomy escalation (COPILOT) would couple unrelated correctness risks |

**Placement guarantee:** PULSE (S91–S93) intentionally staggered before CONNECT (S95–S97) to separate data-aggregation foundation from federation gate; STUDIO (S96–S98) starts after CONNECT gates so AI-over-aggregates does not debut during CONNECT federation-trust review.

---

## Per-epic parallel tracks (QA, Security, i18n, Compliance)

For each epic, the following work runs in parallel with product-engineering stories:

### QA: Vitest unit + Playwright E2E + k6 load (per epic)

| Epic | E2E scenarios | Load scenario | Soak duration |
|------|---|---|---|
| REACTIONS | 1000 concurrent, 1000 reactions/sec flood control | k6 spike test | 24h realtime |
| PULSE | Dashboard navigation, trend chart render, export formula injection | k6 ramp-up to 500 queries/min | 48h aggregation stability |
| COPILOT | Tool execution + facilitator approval flow, contextual suggestion edge cases | k6 suggestion throughput (100 req/s) | 24h agent sandbox |
| LEARN | LTI launch, grade passback, concurrent student submissions | k6 gradebook sync (50 updates/s) | 12h (low-risk) |
| SOVEREIGN | Cross-region data isolation, audit log immutability, exclusion boundary | k6 multi-region queries | 24h residency enforcement |
| CONNECT | Federation join, federated aggregates, cross-tenant isolation | k6 5-tenant × 50k participants | 48h federation realtime |
| STUDIO | Authoring co-pilot prompt injection, theme rendering, library search | k6 co-pilot requests (100 req/s) | 24h AI output validation |
| XR | Avatar sync, spatial interaction latency, fallback 2D mode | k6 50 concurrent XR + 50 2D | 24h device detection |

### Security: Pentest #6 + ADR-specific review

| Epic | Pentest focus | ADR gating | Approval SLA |
|------|---|---|---|
| REACTIONS | Flood/abuse, rate-limit bypass | ADR-0055 realtime protocol | S91 week 1 |
| PULSE | Aggregation leakage, k-anonymity boundary, GDPR retention | ADR-0057 data model | S93 week 1 |
| COPILOT | Agent sandbox escape, context injection, tool whitelist | ADR-0056 autonomy L2 | S92 week 2 |
| LEARN | LTI token validation, grade-passback injection, course isolation | None (low-risk) | S93 week 2 |
| SOVEREIGN | Cross-region data leak, audit immutability, feature exclusion | None (gated by CONNECT) | S94 week 2 |
| CONNECT | Federation trust boundary, cross-tenant isolation, anonymity proof | ADR-0062 scale/isolation | S97 week 1 (pre-GA) |
| STUDIO | Prompt injection, model output schema validation, eval evidence | ADR-0060 AI narration | S97 week 1 |
| XR | WebXR API abuse, avatar spoofing, 2D fallback XSS | None (beta/innovation) | S98 week 3 |

### i18n: Key extraction + translation (per epic, all locales: EN/NL/ES/DE/FR)

| Epic | Story count | Estimated keys | Extraction sprint | Translate sprint | Verification |
|---|---|---|---|---|---|
| REACTIONS | 9 | ~40 keys | S91 | S91–S92 | S92 |
| PULSE | 10 | ~90 keys | S92 | S92–S93 | S93 |
| COPILOT | 8 | ~50 keys | S92 | S92–S93 | S93 |
| LEARN | 7 | ~60 keys | S93 | S93–S94 | S94 |
| SOVEREIGN | 8 | ~70 keys | S93 | S93–S95 | S95 |
| CONNECT | 10 | ~100 keys | S95 | S95–S96 | S96 |
| STUDIO | 9 | ~80 keys | S96 | S96–S97 | S97 |
| XR | 6 | ~30 keys | S98 | S98–S99 | S99 |

---

## Sprint load allocation (capacity rule: 120–150 pts/sprint, 9 dev days)

| Sprint | Epics | Product pts | QA (budget) | SEC (budget) | Other | Total |
|--------|-------|---|---|---|---|---|
| S91 | REACTIONS (fnd), PULSE (fnd) | 130 | 18 | 8 | i18n 4 | ~160 |
| S92 | REACTIONS (GA), COPILOT (fnd), PULSE (cont) | 145 | 16 | 12 | i18n 5 | ~178 |
| S93 | COPILOT (GA), PULSE (GA), LEARN (fnd), SOVEREIGN (fnd) | 148 | 18 | 14 | i18n 6, v6.1 RC soak 8 | ~194 |
| S94 | LEARN (cont), SOVEREIGN (cont), CONNECT (fnd) | 140 | 16 | 10 | i18n 4 | ~170 |
| S95 | LEARN (GA), SOVEREIGN (GA), CONNECT (cont), STUDIO (fnd) | 142 | 18 | 12 | i18n 5, v6.2 RC cut | ~177 |
| S96 | CONNECT (cont), STUDIO (cont), COPILOT L3 / future | 136 | 14 | 14 | i18n 4, pentest #6 | ~168 |
| S97 | CONNECT (GA), STUDIO (cont), v7.0 RC cut | 134 | 16 | 16 | i18n 5 | ~171 |
| S98 | STUDIO (GA), XR (beta), v7.0 RC soak | 128 | 14 | 10 | i18n 4, DR drill 6 | ~162 |
| S99 | XR (GA?), v7.0 GA | 45 | 8 | 8 | i18n 2 | ~63 |

**Legend:** fnd=foundation; GA=general availability; cont=continuation; RC=release candidate; soak=hardening/stability phase; SEC=security/pentest work; budget=concurrent overhead, not counted in 120–150 pts.

---

## Story point rubric (for estimation calibration)

| Size | Scope | Examples |
|------|-------|----------|
| **3 pts** | Spec acceptance or gating story (ADR / review) | REACTIONS-00, PULSE-00, COPILOT-00 |
| **5 pts** | Small feature, 1–2 endpoints, no net-new integrations | REACTIONS-ABUSE-01, LEARN-TEMPLATES-01, XR-FALLBACK-01 |
| **8 pts** | Medium feature, 3–5 endpoints, 1 integration, moderate testing | REACTIONS-CHANNEL-01 (high-throughput), PULSE-AUDIT-01, COPILOT-CONTEXT-01 |
| **13 pts** | Larger feature, multi-endpoint, realtime or data-aggregation surface, full testing | REACTIONS-RENDER-01 (perf-critical), PULSE-STORE-01, COPILOT-RUNTIME-01 |
| **21 pts** | Major architectural surface, multi-sprint integration, Pentest/eval-gated | PULSE-STORE-01 (aggregation plane), COPILOT-RUNTIME-01 (agent scaffold), CONNECT-JOIN-01 (federation) |

---

## Dependencies & must-haves before each sprint

| Sprint | Must complete before sprint ends |
|--------|--|
| **S91** | ADR-0054 (cadence governance), ADR-0055 (REACTIONS protocol) accepted; REACTIONS foundation shipped |
| **S92** | REACTIONS GA, COPILOT foundation, v6.1 RC planning |
| **S93** | COPILOT GA, PULSE GA, ADR-0057 (analytics) accepted, v6.1 RC cut (soak), LEARN foundation, SOVEREIGN foundation |
| **S94** | LEARN mid-flight, SOVEREIGN mid-flight, CONNECT foundation start, pentest #6 prep |
| **S95** | LEARN GA, SOVEREIGN GA, CONNECT mid-flight, STUDIO foundation, v6.2 RC cut |
| **S96** | CONNECT mid-flight, STUDIO mid-flight, pentest #6 open and active |
| **S97** | CONNECT GA, STUDIO mid-flight, ADR-0062 (scale/isolation) evidence collected, v7.0 RC cut |
| **S98** | STUDIO GA, XR spike/beta, v7.0 RC soak active, DR drill complete, WCAG AAA re-attest complete |
| **S99** | v7.0 GA; XR continues as beta or deferred to v7.1 per kill-criterion |

---

## Escalation triggers & kill-criteria

| Condition | Action | Escalation |
|---|---|---|
| **Pentest #6 critical finding in CONNECT federation trust** | Defer CONNECT GA to S98, re-test | PO + Security review |
| **ADR-0057 k-anonymity proof fails** | PULSE GA slips to S96, re-architect aggregation model | Architect + DPO |
| **EMBED traction <10 live embeds by S93** | Defer LEARN to S96; reallocate capacity to PULSE expansion | PO backlog decision |
| **XR design-partner pull <1 by S98 week 2** | Kill XR beta, defer to v7.1 | PO decision |
| **REACTIONS realtime protocol regression in soak** | Extend soak by 1 sprint, delay v6.1 RC | Dev lead + Architect |
| **Compliance-claims audit fails** | Halt copy → marketing for revision | Marketing + Legal |

---

## Marketing & GTM alignment (per release)

| Release | Lead epic | ICP | Key message | Launch campaign |
|---------|----------|-----|-------------|-----------------|
| **v6.1** (S92) | REACTIONS + COPILOT (partial) | Creators, presenters | "Live engagement, AI-powered" | `/vs/streamyard`, `/vs/mentimeter` (AI angle) |
| **v6.2** (S95) | PULSE + LEARN + SOVEREIGN+ | HR, L&D, public-sector | "Privacy-native analytics + verified engagement" | `/vs/culture-amp`, `/learn`, `/sovereign` hubs |
| **v7.0-rc** (S97) | CONNECT + STUDIO (partial) | Multi-org, agencies | "Engagement that spans organizations" | `/network` / `/federation` hub |
| **v7.0 GA** (S99) | CONNECT + STUDIO + XR beta | Enterprise + innovation | "Engagement Intelligence Network" | Full v7.0 positioning refresh |

---

## Docs to create / update post-groooming

_Not authored by this PO—delegated to role owners._

- **Each ADR** (`ADR-0054` through `ADR-0063`) — authored to `/knowledge-base/adr/` when accepted per the architecture brief
- **BACKLOG_MASTER.md §3 (New features)** — register all 66 stories with WSJF scores, updated by PO
- **BACKLOG_MASTER.md §1 (Defects)** — any P0 bugs found in grooming added here
- **SPRINT_PLAN_MASTER.md** — PO allocates stories to S91–S99 sprints, respects do-not-co-land
- **ROADMAP_FULL.md** — update release narrative (v6.1/v6.2/v7.0) with landing dates
- **Marketing PULSE-to-GTM** — coordinate `/vs/` pages + hub launches with each release

---

## Appendix: Reuse inventory (existing Qesto assets)

### Infrastructure / runtime

- ✅ **SessionRoom DO** (ADR-0038 realtime v3 delta) — realtime broadcast backbone for all epics
- ✅ **ModQueueDO** (ADR-0047) — moderation queue for all question types + REACTIONS backpressure
- ✅ **AgentRunDO** (ADR-0046) — agent sandbox for COPILOT L2 + L3, STUDIO co-pilot
- ✅ **Workspace model** (ADR-0048) — persistent team/course scope for RETRO, IDEATE, LEARN, PULSE
- ✅ **DECISIONS_VECTORIZE** — semantic search + clustering for IDEATE, PULSE themes, STUDIO suggestions
- ✅ **CANVAS theme engine** (S88) — brand/adaptive styling inherited by STUDIO authoring
- ✅ **EMBED SDK** `@qesto/embed` (S88) — embeddable widget for LEARN LMS integration

### Data stores

- ✅ **D1** — relational tables for sessions, aggregates (PULSE), federation (CONNECT), workspace (LEARN, COPILOT context)
- ✅ **DECISIONS_KV** — voting/results storage, reused for governance + analytics tiers
- ✅ **AUDIT_KV** — audit log infrastructure extended for SOVEREIGN audit API, federation join events
- ✅ **ACTIONS_KV** — action-item carryover (shipped RETRO) reused
- ✅ **USERS, TEAMS, SESSIONS, TEMPLATES** KV stores — multi-tenant isolation models reused

### AI / Workers AI

- ✅ **Workers AI Llama 3.3** — agentic inference for COPILOT tool-calling, PULSE AI narration, STUDIO co-pilot
- ✅ **AI insights pipeline** — theme extraction, anomaly detection (shipped INSIGHTS+)
- ✅ **Eval harness** (`npm run test:eval`, golden fixtures) — extended for COPILOT L2, STUDIO output schema

### Authentication & billing

- ✅ **Magic link + SAML SSO** (auth.ts) — no changes needed for new epics
- ✅ **planMiddleware** (rate limiting, feature gates) — extended for REACTIONS, PULSE, LEARN tier gating
- ✅ **Stripe billing** — usage metering for REACTIONS/PULSE/COPILOT queries

### Security & compliance

- ✅ **CMK envelope** (ADR-0041) — existing crypto infrastructure, reused for SOVEREIGN audit signing
- ✅ **Zero-knowledge anonymity mode** (ADR-0010) — reused for REACTIONS, PULSE, CONNECT, COPILOT anonymized context
- ✅ **GDPR retention policies** (ADR-0041 / S89) — extended for PULSE 90d + 7y lifecycle, SOVEREIGN regional

---

## Summary for backlog registry

| Epic | Stories | Pts | P0 count | P1 count | Target sprints | RC dependency |
|------|---------|-----|---------|---------|-----------------|---|
| REACTIONS GA | 8 | 68 | 6 | 2 | S91–S92 | v6.1 RC (S92) |
| PULSE | 10 | 91 | 6 | 4 | S91–S93 | v6.2 RC (S95) |
| COPILOT GA | 8 | 67 | 5 | 3 | S92–S93 | v6.1/v6.2 RC |
| LEARN | 7 | 61 | 3 | 4 | S93–S95 | v6.2 RC (S95) |
| SOVEREIGN+ | 8 | 68 | 5 | 3 | S93–S95 | v6.2 RC (S95) |
| CONNECT | 10 | 92 | 6 | 4 | S95–S97 | v7.0 RC (S97) |
| STUDIO | 9 | 81 | 5 | 4 | S96–S98 | v7.0 RC (S97) |
| XR beta | 6 | 47 | 1 | 5 | S98–S99 | v7.0 GA (S99) |
| **TOTAL** | **66** | **575** | **37** | **29** | S91–S99 | 4 RCs |

