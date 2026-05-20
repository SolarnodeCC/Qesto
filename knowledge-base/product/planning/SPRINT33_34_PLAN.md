---
id: SPRINT33_34_PLAN
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-05-20
updated: 2026-05-20
tags:
  - planning
  - sprints
  - v2.3
  - integrations
  - compliance
  - ai-depth
relates_to:
  - SPRINT26_32_PLAN
  - ROADMAP_FULL
  - BACKLOG_MASTER
---

# Sprint 33-34 Plan — v2.3 Integration Suite, Compliance & AI Depth

_Created: 2026-05-20._
_Planning basis: All specialist agent reviews completed 2026-05-20. Incorporates security (SSRF), architect (ADR gaps), backend (IntegrationHttpClient bug), analytics (missing AE events), frontend (ANON-DEPTH-01 scope), tester (i18n story coverage), DevOps (webhook retry mechanism), product-owner (Sprint 32 risk), market research (competitive positioning), and AI strategy (maturity gate) findings._

## Arc Goal

Sprints 33-34 take Qesto from v2.2 to the v2.3 integration + compliance + AI depth release. The sequence fills the #1 lost-deal reason (integrations), starts the enterprise compliance story required by EU procurement, and extends AI from generation-only (L1.7) toward session-aware inference (target L2+).

## Guardrails

- Integration providers extend `IntegrationHttpClient` (ADR-0008 pattern) — no ad-hoc fetch() in route handlers.
- WEBHOOK-01 must include SSRF controls (URL allowlist, RFC1918 rejection, domain confirmation handshake) before public-facing webhooks ship. Alternatively Sprint 33 ships vetted-targets-only (Slack/Teams/Zapier known domains) with full SSRF controls added in Sprint 34.
- AI-SENTIMENT-01 requires ADR-0011 and DPIA completed in Sprint 33 before implementation starts in Sprint 34.
- Compliance claims (EU residency, GDPR badge) must have matching implementation evidence files before marketing copy is updated.
- D1 EU residency: existing `qesto_3_db` has no location hint and this is irreversible at database creation. ENT-RESIDENCY-01 is a documentation and contractual deliverable — not a database migration.

---

## Sprint 33 — Integration Suite + Compliance Foundation + AI Context

**Window:** 2026-07-08 to 2026-07-22
**Release posture:** v2.3 foundation. Integrations ship incrementally; compliance evidence starts accumulating; AI context schema is the prerequisite for Sprint 34 AI features.
**Theme:** Fill the #1 loss reason (integrations), start the enterprise compliance story, lay the AI infrastructure Sprint 34 depends on.

**Pre-condition gates:**
- v2.2 RC (Sprint 32) shipped clean.
- ADR-0008 provider pattern accepted and INT-PROVIDER-01 merged (Sprint 31).
- ADR-0011 written and accepted (in this sprint) before DPIA scope is locked.

**DevOps provisioning required (before SLACK-01/TEAMS-01 merge):**
- `wrangler pages secret put SLACK_CLIENT_ID` (prod + staging)
- `wrangler pages secret put SLACK_CLIENT_SECRET` (prod + staging)
- `wrangler pages secret put TEAMS_CLIENT_ID` (prod + staging)
- `wrangler pages secret put TEAMS_CLIENT_SECRET` (prod + staging)
- Decide webhook retry mechanism: DO alarm pattern (preferred — no extra infra) vs. `*/5 * * * *` cron (simpler but coarser). Decision required before WEBHOOK-01 implementation starts.

### Committed Items (~43 pts)

| ID | Item | Epic | Pts | Pri | Acceptance Signal |
|---|---|---|---|---|---|
| SLACK-01 | SlackProvider: session results push notification | INT | 8 | P1 | Host can connect Slack workspace via OAuth2; session close triggers summary message to configured channel; OAuth2 flow complete; token encrypted at rest via `EncryptedTokenStore`; i18n for OAuth consent copy. |
| SLACK-02 | Slack: settings UI + OAuth management + event filtering | INT | 8 | P1 | Team Settings shows Slack connection status; host selects which events trigger (close, live, energizer summary); disconnect flow works; `TeamSettings.tsx` extended cleanly. |
| TEAMS-01 | Microsoft Teams: session results adaptive card | INT | 8 | P1 | Host can authorize Teams via OAuth2; session close sends adaptive card to configured Teams channel; token encrypted; i18n for consent copy. |
| WEBHOOK-01 | Generic webhook: HTTP POST with HMAC-SHA256 + SSRF controls | INT | 8 | P0 | `POST /api/teams/:id/webhooks` CRUD; on session events, Worker posts signed payload; SSRF controls: URL allowlist, RFC1918 block, domain confirmation handshake before first delivery; failures retry via DO alarm (3× with exponential backoff); admin sees delivery log via AE `webhook.delivery_attempted` events; `webhook-verify` HMAC tested. |
| AI-CONTEXT-01 | `SessionAIContext` schema + `aiPipeline()` + `aiOverride()` helpers | AI | 8 | P1 | `functions/api/lib/ai/session-context.ts` defines `SessionAIContext` (model, version, sessionId, teamId, plan, anonymityLevel); `aiPipeline()` reads context and selects model; `aiOverride()` allows per-call overrides; Sprint 34 AI features extend this — not implementing twice. |
| ADR-0011 | Live sentiment inference ADR + DPIA scope | ARCH | 3 | P0 | ADR defines model choice (`distilbert-sst-2-int8`, English-only gate), aggregate-only output (k≥5 respondents before signal emitted), disabled in zero-knowledge sessions, DPIA scope documented; accepted before Sprint 34 AI-SENTIMENT-01 starts. |

**Stretch (do not start until committed items pass QA):**
- EXPORT-PDF-01: PDF signed session summary (8 pts)
- COMPLIANCE-01: SOC 2 evidence framework scaffolding (5 pts)
- ZOOM-01: Zoom integration stub (3 pts)

**Total committed: ~43 pts | With stretch: 59 pts (pick max 1 stretch item)**

### Quality Gates

- Integration provider contract tests: Slack + Teams OAuth round-trip in staging
- Webhook delivery log integration tests: HMAC signature verified, RFC1918 URL rejected, delivery logged
- `AI-CONTEXT-01` unit tests: pipeline selects correct model by plan tier
- `npm test` — target 900+ tests green (840 RC + new integration tests)
- `npm run typecheck` — 0 errors
- `npm run check:i18n` — OAuth consent strings in all 5 locales
- Staging WebSocket smoke (regression — no new WS surface in this sprint)
- Analytics: `webhook.delivery_attempted` events visible in AQL on `qesto_metrics`
- Analytics: `integration.connected` event emitted on Slack/Teams OAuth completion

---

## Sprint 34 — Compliance Evidence + AI Depth + Anonymous Leadership

**Window:** 2026-07-22 to 2026-08-05
**Release posture:** v2.3 closes. Compliance claims become marketable. AI becomes a competitive moat against Vevox and Mentimeter.
**Theme:** Own three vectors — privacy-native compliance, deep AI insight, and anonymous engagement leadership.

**Pre-condition gates:**
- ADR-0011 accepted (Sprint 33).
- `AI-CONTEXT-01` merged (Sprint 33) — AI-RECAP-PROV-01 and AI-SENTIMENT-01 extend it.
- `ANON-DEPTH-01` merged (Sprint 31 or 32 stretch) — ANON-DEPTH-02 builds on it.
- DPIA completed (Sprint 33 ADR-0011) — required before AI-SENTIMENT-01 implementation.

### Committed Items (~42 pts)

| ID | Item | Epic | Pts | Pri | Acceptance Signal |
|---|---|---|---|---|---|
| ENT-RESIDENCY-01 | EU data residency: routing evidence + DPA template | ENT | 5 | P0 | Cloudflare regional routing documented with evidence (Cloudflare dashboard screenshots + regional config); DPA template for EU customers available for download; ops runbook for residency requests; marketing can claim "EU-hosted" with proof document. Note: D1 location hint is irreversible — this is a documentation and contractual deliverable, not a migration. |
| COMPLIANCE-02 | DPA/SCC template + compliance claim CI gate | ENT | 5 | P0 | `compliance-claim-gate.ts` CI check rejects marketing copy PRs that add EU residency or compliance claims without a matching evidence file commit; DPA/SCC template published. |
| COMPLIANCE-01 | SOC 2 evidence framework: sub-processor registry + control mapping | ENT | 5 | P1 | `/knowledge-base/security/SOC2_EVIDENCE.md` with control inventory; sub-processor list complete; gaps documented with sprint assignments; COMPLIANCE-03 (full Type I audit, 13 pts) scoped as post-Sprint 34 work. |
| AI-RECAP-PROV-01 | AI recap provenance: edit history + evidence links + export metadata | AI | 8 | P1 | AI recap shows model used, generation timestamp, whether host-edited; export JSON includes provenance block; builds on `SessionAIContext` from AI-CONTEXT-01; marketing AI recap claims re-enabled after this ships. |
| AI-SENTIMENT-01 | Real-time session sentiment via Workers AI (`distilbert-sst-2-int8`) | AI | 10 | P1 | During LIVE session, Workers AI runs sentiment pass on open-question responses (English-only gate); presenter sees aggregate mood signal (positive/neutral/concerning); k≥5 respondents required before signal emitted; disabled in zero-knowledge sessions; no individual attribution; `ai.sentiment_analysis` AE event emitted; privacy review passes; builds on `SessionAIContext`. |
| ANON-DEPTH-02 | Zero-knowledge trust documentation + Vevox competitive proof | UX/SEC | 5 | P1 | Session shows "Zero-knowledge mode: your identity is never stored"; technical proof doc in KB (how voter dedup works without PII); sales comparison doc vs. Vevox available for sales team; `ANON-DEPTH-01` (trust badge) must be merged first. |
| GDPR-BADGE-01 | GDPR compliance badge: evidence + deletion automation test | SEC | 5 | P1 | Marketing can display GDPR badge (evidence doc exists); GDPR right-to-deletion test passes; `gdpr.deletion_requested` + `gdpr.deletion_completed` AE events defined; data-subject-request runbook exists. |

**Total committed: ~43 pts**

**Stretch (pick max 2, only after committed items pass QA):**
- AI-COACHING-01: Post-session facilitator coaching suggestions (5 pts) — requires `DECISIONS_VECTORIZE` non-empty; gate: Vectorize pipeline has ≥100 closed-session embeddings in staging
- EXPORT-PDF-01: PDF signed session summary (8 pts) — if not completed in Sprint 33 stretch
- ZOOM-01: Zoom integration (8 pts) — if not in Sprint 33 stretch

### Quality Gates

- 0 marketing copy PRs merge with EU residency or compliance claims without matching evidence file (CI gate)
- AI sentiment integration test: `distilbert-sst-2-int8` invoked per open-question batch; sanitized output; no participant ID in payload; k<5 returns no signal
- Anonymity proof reviewed by security role (CSO sign-off required)
- GDPR deletion test: `DELETE /api/users/:id/gdpr-delete` triggers deletion and fires `gdpr.deletion_completed` event within SLA
- `AI-RECAP-PROV-01`: provenance block present in JSON export; edit history logged
- `npm test` — target 950+ tests green
- `npm run typecheck` — 0 errors
- `npm run check:i18n` — all new AI recap, sentiment, and compliance strings in 5 locales

---

## Sprint 33-34 Scorecard

| Sprint | Goal | Committed | Resilience | Market Impact | Commercial Promise |
|---|---|---|---|---|---|
| Sprint 33 | Integration suite + AI context + ADR-0011 | ~43 pts | WEBHOOK SSRF controls | Integrations (#1 loss reason: Slack, Teams, webhooks) | INT-WEBHOOK-01 (partial), SLACK-01/02, TEAMS-01 |
| Sprint 34 | Compliance evidence + AI depth + anon leadership | ~43 pts | Compliance CI gate blocks bad claims | Vevox counter (ANON-DEPTH-02), AI moat (sentiment, recap) | ENT-RESIDENCY-01, AI-RECAP-PROV-01, ENT-COMPLIANCE-01 (partial) |

---

## New ADRs Produced in Sprint 33

| ADR | Title | Status |
|---|---|---|
| ADR-0011 | Live sentiment inference (model selection, aggregate-only, DPIA) | Authored in Sprint 33; must be accepted before Sprint 34 AI-SENTIMENT-01 starts |

---

## New Story IDs (for BACKLOG_MASTER.md)

```
EPIC-INT (Integrations):
  SLACK-01        Slack: session results push notification              8 pts  P1  S33
  SLACK-02        Slack: settings UI + OAuth management                8 pts  P1  S33
  TEAMS-01        Teams: session results adaptive card                 8 pts  P1  S33
  WEBHOOK-01      Generic webhook + HMAC + SSRF controls + retry + log 8 pts  P0  S33
  ZOOM-01         Zoom: integration (stretch S33 or S34)              8 pts  P2  S34+

EPIC-AI (AI Depth):
  AI-CONTEXT-01   SessionAIContext schema + aiPipeline() + aiOverride() 8 pts P1  S33
  AI-RECAP-PROV-01 AI recap provenance (on SessionAIContext)           8 pts  P1  S34
  AI-SENTIMENT-01  Real-time session sentiment (distilbert-sst-2-int8) 10 pts P1  S34
  AI-COACHING-01   Post-session facilitator coaching (stretch S34)     5 pts  P2  S34+

EPIC-ENT (Enterprise):
  ENT-RESIDENCY-01 EU routing evidence + DPA template (docs only)     5 pts  P0  S34
  COMPLIANCE-01   SOC 2 evidence framework + sub-processor registry   5 pts  P1  S34
  COMPLIANCE-02   DPA/SCC template + claim-gate CI check              5 pts  P0  S34
  COMPLIANCE-03   SOC 2 Type I full audit work                       13 pts  P1  S35+
  ANON-DEPTH-02   Trust documentation + Vevox competitive proof        5 pts  P1  S34
  GDPR-BADGE-01   GDPR badge + deletion test + runbook                5 pts  P1  S34
```

---

## Out of Scope for Sprints 33-34

- Battle royale / bracket tournament public rollout (Sprint 35+)
- Mobile app
- White-label / custom branding (Sprint 35+)
- Salesforce integration (Sprint 35+)
- Microsoft LDAP/AD sync (Sprint 35+)
- Pricing model changes unrelated to integration or compliance
- KB RAG pipeline (ADR-040) — Sprint 35+ at earliest unless Vectorize gate passes for AI-COACHING-01 stretch

---

## Post-Sprint 34 Horizon (Sprint 35+, v2.4)

- AI facilitator coaching (if not in Sprint 34 stretch)
- Zoom + Salesforce integrations
- White-label / custom branding
- Tournament mechanics (battle royale, brackets)
- LDAP/AD sync for enterprise
- SOC 2 Type I audit (COMPLIANCE-03, 13 pts)
- AI personalization (per-participant engagement scoring)
- KB RAG pipeline for agent grounding (ADR-040)

---

## Verification Plan

Before calling any sprint complete:
1. `npm test` — full suite green (baseline growing: S32=840+, S33=900+, S34=950+)
2. `npm run typecheck` — 0 errors
3. `npm run check:i18n` — no missing keys across 5 locales
4. `npm run check:tokens-drift` — design system unchanged
5. `npm run test:a11y` — 38+ a11y tests green
6. `npm run build` — clean build
7. Integration provider staging round-trip for any sprint adding providers
8. Webhook SSRF test: RFC1918 URL rejected, domain confirmation required
9. AI sentiment test: k<5 returns no signal; no participant ID in AE event
10. Compliance claim gate: any new public compliance/residency claim must reference evidence file in same PR commit

For v2.3 close (Sprint 34): EU residency claim gate must pass before marketing copy update. AI-SENTIMENT-01 DPIA must be completed before feature is flag-enabled in production.
