---
id: PLAN
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
  - BACKLOG_MASTER
  - ROADMAP_FULL
  - SPRINT26_32_PLAN
---

# Sprint 33–34 Plan — v2.3 Integration Suite + Compliance + AI Depth

_Created: 2026-05-20. Based on: resilience audit (4/10 score resolved in Sprint 30), WIN_LOSS_ANALYSIS.md (integrations = #1 lost-deal reason), market pulse (Vevox competing on HR anonymous feedback)._

## Arc Goal

Sprints 33–34 complete the v2.3 arc: fill the #1 loss reason with integrations, start the enterprise compliance story for EU deals, and deepen AI into a competitive moat.

**Prerequisites:**
- Sprint 30 resilience P0 merged (PII gate, circuit breakers)
- v2.2 shipped (Sprint 32 RC gate green)
- ADR-0008 integration provider library complete (Sprint 31)

---

## Sprint 33 — v2.3 Integration Suite + Compliance Foundation ✓ SHIPPED

**Window:** 2026-07-08 to 2026-07-22 (executed 2026-05-20)
**Release posture:** v2.3 foundation. Integrations ship incrementally; compliance evidence starts accumulating.
**Theme:** Fill the #1 loss reason (integrations), start the enterprise compliance story.

### Committed Items (~42 pts)

| ID | Item | Size | Epic | Pri | Status | Acceptance Signal |
|---|---|---:|---|---|---|---|
| SLACK-02 | Slack: settings UI + webhook config + event filtering + team-level OAuth management | 8 | INT | P1 | ✅ Shipped | Integrations section in TeamSettings; Slack connect/disconnect/test; event filter checkboxes; i18n 5 locales (new 'team' namespace) |
| TEAMS-01 | Microsoft Teams integration: session results notification (ADR-0008 provider) | 8 | INT | P1 | ✅ Shipped | TeamsProvider with PKCE OAuth2; Adaptive Card v1.4; notifyTeamsSessionClosed() fires on session close; MICROSOFT_CLIENT_ID/SECRET/TENANT_ID env vars |
| WEBHOOK-01 | Generic webhook: HTTP POST with HMAC-SHA256 signing, retry backlog, admin log | 8 | INT | P0 | ✅ Shipped | `/api/teams/:id/webhooks` CRUD; X-Qesto-Signature-256 header; 3× retry (1s/2s/4s); delivery log last 50; 10 webhook limit per team; secret returned once then masked |
| EXPORT-PDF-01 | Print-ready signed HTML export (browser Save-as-PDF) | 8 | ENT | P1 | ✅ Shipped | `GET /api/sessions/:id/export.html` returns signed HTML; HMAC-SHA256 authenticity footer; inline bar charts; team plan only |
| COMPLIANCE-01 | SOC 2 evidence framework: sub-processor registry, control mapping, evidence schema | 5 | ENT | P1 | ✅ Shipped | `knowledge-base/security/SOC2_EVIDENCE.md` — sub-processor registry, CC6/CC7/CC8/CC9/A1/P control inventory, known gaps with sprint assignments |
| CODE-SPLIT-01 | Split `sessions.ts` (2487→2239 lines) — exports subrouter extracted | 5 | DX | P1 | ✅ Shipped | Export routes in `functions/api/routes/sessions/exports.ts`; 797 tests green; 0 typecheck errors; no behavior change |

**Total: 42 pts — all shipped**

### Quality Gate Results
- `npm test`: 797 tests passed ✓
- `npm run typecheck`: 0 errors ✓
- sessions.ts: 2487 → 2239 lines (exports extracted to subrouter) ✓
- EXPORT-PDF-01: HTML export route wired; HMAC-SHA256 authenticity footer ✓
- COMPLIANCE-01: SOC 2 evidence framework established ✓

---

## Sprint 34 — Compliance Evidence + AI Depth + Anonymous Leadership

**Window:** 2026-07-22 to 2026-08-05
**Release posture:** v2.3 closes; compliance claims become marketable; AI becomes a competitive moat.
**Theme:** Own three vectors: privacy-native compliance, deep AI, and anonymous engagement leadership.

### Committed Items (~39 pts)

| ID | Item | Size | Epic | Pri | Acceptance Signal |
|---|---|---:|---|---|---|
| ENT-RESIDENCY-01 | EU data residency: routing evidence, contractual language, DPA data-processing addendum | 8 | ENT | P0 | Cloudflare regional routing documented with evidence; DPA template for EU customers; ops runbook; marketing can claim "EU-hosted" with proof |
| COMPLIANCE-02 | DPA/SCC template + sub-processor update + compliance claim validation gate | 5 | ENT | P0 | `compliance-claim-gate.ts` rejects marketing copy changes without matching evidence file; DPA/SCC template available for customer download |
| AI-RECAP-PROV-01 | AI recap provenance: edit history, evidence links, export provenance metadata | 8 | AI | P1 | AI recap shows: model used, generation timestamp, whether edited; export JSON includes provenance block; marketing AI claims re-enabled |
| AI-SENTIMENT-01 | Real-time session sentiment tracking via Workers AI (per-question mood signal) | 8 | AI | P1 | Workers AI runs lightweight sentiment on open-question responses; presenter sees aggregate mood (positive/neutral/concerning); no individual attribution; privacy review passes |
| ANON-DEPTH-02 | Zero-knowledge anonymity: trust documentation, marketing proof, participant-visible guarantee | 5 | UX/SEC | P1 | Session shows "Zero-knowledge mode: your identity is never stored"; technical proof doc in KB; Vevox comparison ready for sales team |
| GDPR-BADGE-01 | GDPR compliance badge: evidence docs, marketing proof, right-to-deletion automation test | 5 | SEC | P1 | Marketing can display GDPR badge; GDPR right-to-deletion test passes; data-subject-request runbook exists |

**Total committed: 39 pts**

**Stretch (pick 2 max):**
- AI-COACHING-01: Post-session AI coaching suggestions for facilitators (5 pts)
- ZOOM-01: Zoom integration (if not in Sprint 33 stretch) (8 pts)
- KB-VECTOR-01: KB vector embedding pipeline foundation (ADR-040, 5 pts)

### Quality Gates
- 0 marketing copy references EU residency without matching evidence commit
- AI sentiment integration test: Workers AI invoked per open-question batch, sanitized output, no participant ID in payload
- Anonymity proof reviewed by security role
- `compliance-claim-gate.ts` CI check blocking marketing copy changes without evidence
- `npm test` green | `npm run typecheck` 0 errors | `npm run check:i18n`

---

## Updated v2.3 Release Gate

v2.3 ships at end of Sprint 34 (2026-08-05) when:
1. v2.2 is clean (Sprint 32 RC gate passed)
2. SLACK-01 staging smoke passed
3. SOC 2 evidence framework started (COMPLIANCE-01 merged)
4. ENT-RESIDENCY-01 evidence committed
5. AI recap provenance marketing claims re-enabled
6. Full test suite green (738+ baseline)

---

## Out of Scope for Sprints 33–34

- Battle royale / bracket tournament public rollout (Sprint 35+)
- Mobile app
- White-label / custom branding (Sprint 35+)
- Salesforce integration (Sprint 35+)
- Microsoft LDAP/AD sync (Sprint 35+)
- Pricing model changes unrelated to integration or compliance

---

## Post-Sprint 34 Horizon (v2.4, Sprint 35+)

- AI facilitator coaching (if not Sprint 34 stretch)
- Zoom + Salesforce integrations
- White-label / custom branding
- Tournament mechanics (battle royale, brackets)
- LDAP/AD sync for enterprise
- AI personalization (per-participant engagement scoring)
- KB RAG pipeline (ADR-040)
