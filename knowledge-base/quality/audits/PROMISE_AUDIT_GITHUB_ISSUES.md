# Promise Audit — GitHub Issues to File

**Created:** 2026-07-01  
**Source:** `PROMISE_AUDIT_RESOLUTION_2026-07-01.md`

File these issues on `SolarnodeCC/Qesto` for engineering work deferred from the promise-to-implementation audit.

---

## Issue 1 — Chorus custom retention auto-purge

**Title:** `Chorus custom retention: implement automatic age-based purge (7d–7yr)`  
**Labels:** `compliance`, `backend`  
**Milestone:** Next release train

### Context
Chorus is marketed with configurable retention (7 days – 7 years) but ordinary closed-session data is not automatically purged. Marketing/help copy now discloses that plan-level retention targets are not yet auto-enforced.

### Acceptance criteria
- [ ] Worker cron purges closed-session data per team/workspace `retention_days` (7–3650)
- [ ] Pulse (30d) and Signal (365d) defaults enforced without manual host action
- [ ] Audit event `retention.purged` emitted with subject counts
- [ ] Vitest coverage for purge logic and plan-tier defaults
- [ ] Help copy updated when enforcement ships

### References
- `functions/api/routes/team-workspaces.ts`
- `knowledge-base/help/privacy-gdpr.md`

---

## Issue 2 — EU data residency routing guarantee

**Title:** `EU data residency: implement region pinning for enterprise tenants`  
**Labels:** `compliance`, `security`, `backend`  
**Milestone:** Enterprise roadmap

### Context
Chorus marketing previously implied residency availability. Copy now marks residency as roadmap. EU enterprise customers need contractual routing guarantees beyond DPA language.

### Acceptance criteria
- [ ] SOVEREIGN region policy enforced on mutations (`residency-enforce.ts` wired globally)
- [ ] Join/connect denied cross-region when tenant policy requires EU
- [ ] Customer-facing procurement packet documents actual routing behavior
- [ ] Integration tests for EU-only tenant isolation

### References
- `functions/api/lib/residency-enforce.ts`
- `knowledge-base/operations/compliance/EU_DATA_RESIDENCY.md`

---

## Issue 3 — Public SOC 2 certification roadmap page

**Title:** `Trust center: add /trust/soc2/roadmap public timeline page`  
**Labels:** `marketing`, `compliance`  
**Milestone:** Next release train

### Context
SOC 2 Type II copy is corrected to "in progress (2027 Q3)". Customers need a public timeline page, not only KB-internal docs.

### Acceptance criteria
- [ ] Route `/trust/soc2/roadmap` with timeline from `SOC2_TYPE2_ROADMAP.md`
- [ ] Linked from `Soc2TrustPage` FAQ
- [ ] i18n strings for EN + NL/DE/FR/ES stubs
- [ ] E2E smoke test for public route

---

## Issue 4 — GDPR-BADGE-01 automated deletion tests

**Title:** `GDPR-BADGE-01: ship automated deletion test suite + public badge`  
**Labels:** `compliance`, `qa`  
**Milestone:** RT-2026-07

### Context
GDPR trust page notes badge and evidence pack are roadmap. Self-service deletion exists; public badge requires automated test evidence.

### Acceptance criteria
- [ ] `npm run test:gdpr` (or eval gate) covers deletion cascade fixtures
- [ ] Public GDPR badge component on trust page when green
- [ ] Downloadable evidence pack PDF (or JSON export) for enterprise admins

---

## Issue 5 — Multi-language sessions marketing

**Title:** `Product marketing: confirm GA status for multi-language sessions`  
**Labels:** `product`, `marketing`  
**Milestone:** Backlog

### Context
`presentation_language` exists in code but is not marketed on pricing. PO to confirm GA vs beta before adding to feature matrix.

---

## Issue 6 — Sentiment analysis GA status

**Title:** `Clarify sentiment analysis ship status (GA vs deprecate)`  
**Labels:** `product`, `ai`  
**Milestone:** Backlog

### Context
Sentiment analysis appears in SOC2 evidence references but is not on pricing page. Decide GA, beta label, or removal.

---

## Issue 7 — Nonprofit self-service application form

**Title:** `Nonprofit pricing: self-service application form (replace mailto interim)`  
**Labels:** `growth`, `frontend`  
**Milestone:** Backlog

### Context
Pricing and Nonprofit pages now use `mailto:support@qesto.cc` with structured subject/body. A lightweight form or `/api/nonprofit-application` would improve conversion tracking.

### Acceptance criteria
- [ ] Public form collects org name, registration number, country, contact email
- [ ] Submissions create support ticket or Resend notification
- [ ] Rate-limited endpoint; no PII stored without consent
