# Qesto Promise-to-Implementation Audit
**Date:** June 15, 2026  
**Audit Level:** STRICT (customer-facing commitments)  
**Status:** ⚠️ **GAPS IDENTIFIED** — See Action Items

---

## Executive Summary

This audit maps **every public-facing promise** in marketing, pricing, security, and audit pages against actual implementation. 

**Key Findings:**
- ✅ **GDPR/Privacy:** Mostly implemented; some gaps in automated features
- ✅ **Audit logging:** Core functionality present; retention policy needs clarification
- ⚠️ **SOC 2 certification:** Marketing claims are FORWARD-LOOKING; not yet certified
- ⚠️ **Pricing features:** Some roadmap items marked as "roadmap" in matrix are still in copy
- ❌ **Webhook integrations:** Promised as "roadmap" but unclear to customers
- ❌ **Residency guarantee:** Mentioned on Chorus tier but not actually offered

---

## 1. PRICING PAGE AUDIT

### Promise vs Implementation

| Feature | Pricing Tier | Promise | Implemented | Deployed | Status |
|---------|--------------|---------|-------------|----------|--------|
| **Sessions per month** | Pulse | ≤5 | ✅ `sessionsPerMonth: 5` | ✅ Yes | **GOOD** |
| **Sessions per month** | Signal | ≤75 | ✅ `sessionsPerMonth: 75` | ✅ Yes | **GOOD** |
| **Sessions per month** | Chorus | Unlimited | ✅ Configurable (no hard limit) | ✅ Yes | **GOOD** |
| **Participants per session** | Pulse | ≤50 | ✅ `participantsPerSession: 50` | ✅ Yes | **GOOD** |
| **Participants per session** | Signal | ≤500 | ✅ `participantsPerSession: 500` | ✅ Yes | **GOOD** |
| **Participants per session** | Chorus | ≤5000 | ✅ `participantsPerSession: 5000` | ✅ Yes | **GOOD** |
| **Data retention** | Pulse | 30 days | ✅ Implemented in KV TTL | ✅ Yes | **GOOD** |
| **Data retention** | Signal | 365 days | ✅ Implemented in D1 retention | ✅ Yes | **GOOD** |
| **Data retention** | Chorus | 7d - 7yr custom | ❓ UNCLEAR | ⚠️ Configurable but no evidence of enforcement | **⚠️ GAP** |
| **CSV export** | Pulse | ✅ Included | ✅ Implemented | ✅ Yes | **GOOD** |
| **CSV export** | Signal/Chorus | ✅ Included | ✅ Implemented | ✅ Yes | **GOOD** |
| **Audit exports** | Pulse | ❌ Not included | ❌ Not implemented | N/A | **GOOD** |
| **Audit exports** | Signal | ✅ "365-day retention, audit exports" | ✅ `/api/admin/audit/forensic.csv` exists | ✅ Yes | **GOOD** |
| **Audit exports** | Chorus | ✅ Included | ✅ `/api/admin/audit/forensic.csv` | ✅ Yes | **GOOD** |
| **Anonymity modes** | All tiers | Full & cohort anonymity | ✅ `anonymity_mode: 'full'\|'partial'\|'none'` | ✅ Yes | **GOOD** |
| **Identified mode + consent log** | Pulse | ❌ Not included | ❌ Not available | N/A | **GOOD** |
| **Identified mode + consent log** | Signal/Chorus | ✅ Included | ✅ `consentMode` flag + audit_log | ✅ Yes | **GOOD** |
| **AI drafts** | Pulse | "5 / month limit" | ✅ Enforced via quota | ✅ Yes | **GOOD** |
| **AI drafts** | Signal/Chorus | "Unlimited" | ✅ No per-session limit | ✅ Yes | **GOOD** |
| **Evidence-anchored recap (AI insights)** | Pulse | ❌ Not included | ❌ Not available | N/A | **GOOD** |
| **Evidence-anchored recap (AI insights)** | Signal/Chorus | ✅ "Same-day evidence-anchored recap" | ✅ `insightsAI: true` flag | ⚠️ Partially deployed | **⚠️ GAP** |
| **Townhall Q&A board** | Pulse/Signal | ❌ Not included | ❌ Not implemented | N/A | **GOOD** |
| **Townhall Q&A board** | Chorus | ✅ "Townhall Q&A board (moderated, 5000 participants)" | ✅ `townhallQA: true` flag | ❓ Unknown | **⚠️ UNCLEAR** |
| **SAML SSO** | Pulse/Signal | ❌ Not included | ❌ Not available | N/A | **GOOD** |
| **SAML SSO** | Chorus | ✅ "SAML SSO and role scopes" | ✅ Routes exist in codebase | ✅ Yes | **GOOD** |
| **Webhooks** | All tiers | "Roadmap — contact sales" | ⚠️ Routes exist but feature flagged | ❓ Not GA | **⚠️ GAP** |
| **Custom retention & residency** | Chorus | ✅ "Custom retention & residency" | ⚠️ Retention possible; residency unclear | ⚠️ Partial | **⚠️ GAP** |
| **Customer-managed keys** | Chorus | "Roadmap" | ❌ Not implemented | ❌ No | **GOOD** (correctly marked roadmap) |
| **Nonprofit pricing** | All | "40% off Chorus" | ✅ Documented | ⚠️ Manual process | **⚠️ PROCESS GAP** |

### Critical Pricing Gaps

| Gap | Severity | Action |
|-----|----------|--------|
| **Townhall Q&A board**: Marketed to Chorus customers but unclear if fully deployed or beta | HIGH | Verify deployment status; if beta, add disclaimer |
| **Custom retention on Chorus**: Promised but no enforcement mechanism visible | HIGH | Implement retention enforcement or remove from marketing |
| **Residency guarantee on Chorus**: Mentioned in pricing ("Custom retention & residency") but only documented as "on the roadmap" in SOC2 evidence | HIGH | Clarify: Is this available now or roadmap? If roadmap, remove from pricing tier description |
| **AI insights (Signal)**: Promised as "same-day evidence-anchored recap" but `insightsAI` is only on Team/Chorus plan | HIGH | Either enable on Signal or correct marketing copy |
| **Webhook integrations**: Promised as "roadmap" but routes exist — unclear if customers can use this | MEDIUM | Either GA webhooks or add clear "beta" disclaimer |
| **Nonprofit 40% discount**: No documented process for applicants to request discount | MEDIUM | Create `/nonprofit-application` endpoint or link to form |

---

## 2. SOC 2 TRUST PAGE AUDIT

### Promise vs Implementation

| Promise | Source | Status | Evidence | Deployment |
|---------|--------|--------|----------|------------|
| **"SOC 2 Type II report issued"** | `soc2.badgeDescription` in i18n | ❌ MISLEADING | Report roadmapped for 2027 Q3 (SOC2_TYPE2_ROADMAP.md) | ❌ NOT CERTIFIED YET |
| **"Contact sales for attestation letter under NDA"** | i18n badge copy | ❌ FORWARD-LOOKING | No auditor has issued a letter; SOC 2 Type I exists but not Type II | ❌ EXPIRED/INACCURATE |
| **"Access control and least-privilege IAM"** | `soc2.controlAccess` | ✅ TRUE | `rbacMiddleware`, JWT auth, Cloudflare TLS | ✅ Deployed |
| **"Change management with peer review, CI gates"** | `soc2.controlChange` | ✅ TRUE | GitHub PR enforcement, CI pipeline | ✅ Deployed |
| **"Continuous monitoring via Analytics Engine"** | `soc2.controlMonitoring` | ✅ PARTIAL | Rate limit events, error events logged | ⚠️ Partial dashboard |
| **"Incident response playbooks"** | `soc2.controlIncident` | ✅ TRUE | Runbooks in `knowledge-base/operations/incidents/` | ✅ Deployed |
| **"Annual third-party penetration tests"** | `soc2.pentestBody` | ✅ TRUE | PENTEST_02_SCOPE.md, PENTEST_4_SCOPE.md exist | ✅ Done (Pen 1–2) |
| **"Critical findings remediated before claims"** | `soc2.pentestBody` | ✅ TRUE | Remediation tracked in `security/reviews/` | ✅ Done |

### Critical SOC 2 Gaps

| Gap | Severity | Action |
|-----|----------|--------|
| **Marketing claims SOC 2 Type II certification when it's only 2027 roadmap** | CRITICAL | Update copy immediately: Change "SOC 2 Type II" badge to "SOC 2 Type II in Progress" or remove the badge entirely until certification is live |
| **"Report issued" — no auditor letter exists yet** | CRITICAL | Remove the sentence about "auditor attestation letter" or change to "certification expected Q3 2027" |
| **Monitoring claim is overstated** | MEDIUM | Add "baseline" to "continuous monitoring" — only error patterns + rate limits are monitored, not full SLO dashboard |
| **No formal certification roadmap visible to customers** | MEDIUM | Add link to SOC2_TYPE2_ROADMAP.md or create a `/trust/soc2/roadmap` page showing certification timeline |

---

## 3. GDPR TRUST PAGE AUDIT

### Promise vs Implementation

| Promise | Source | Implemented | Deployed | Status |
|---------|--------|-------------|----------|--------|
| **"Data processed close to participants with privacy-by-default"** | GdprTrustPage hero | ✅ TRUE | Cloudflare edge network | ✅ Yes |
| **"Zero-knowledge sessions where individual identity never stored"** | GdprTrustPage hero | ✅ TRUE | `anonymity='zero_knowledge'` mode | ✅ Yes |
| **"Session data is processed at edge"** | GdprTrustPage | ✅ TRUE | Cloudflare Workers runtime | ✅ Yes |
| **"Anonymity modes available"** | GdprTrustPage FAQ | ✅ TRUE | UI implements 3 modes | ✅ Yes |
| **"Account holders can export/delete personal data"** | GdprTrustPage FAQ | ✅ PARTIAL | `/api/users/me/gdpr-delete` exists; export not fully implemented | ⚠️ Partial |
| **"Automated deletion tests on roadmap for v2.3"** | GdprTrustPage FAQ | ✅ TRUE | GDPR_DATA_SUBJECT_RUNBOOK.md exists | ✅ Documented (Sprint 34) |
| **"Public GDPR badge on roadmap"** | GdprTrustPage FAQ | ✅ TRUE | Documented in GDPR-BADGE-01 | ⚠️ Roadmap (not live) |
| **"Full sub-processor registry"** | GdprTrustPage FAQ (DPA) | ✅ TRUE | SOC2_EVIDENCE.md has complete registry | ✅ Yes |
| **"DPA template for enterprise customers"** | GdprTrustPage FAQ | ✅ TRUE | DPA_SCC_TEMPLATE.md exists | ✅ Yes |
| **"Audit events with sanitized labels — no raw participant text"** | GdprTrustPage FAQ | ✅ TRUE | `safeLogContext()` PII sanitization | ✅ Yes |
| **"Data retained for 30 days by default"** | Help article | ⚠️ OUTDATED | Pulse = 30d; Signal = 365d; Chorus = custom | ⚠️ Misleading |
| **"Participants have 30-day retention for analytics"** | Help article | ⚠️ OUTDATED | Only true for Pulse; Signal/Chorus have longer retention | ⚠️ Unclear |

### Critical GDPR Gaps

| Gap | Severity | Action |
|-----|----------|--------|
| **Data retention claims are tier-dependent but help article implies universal 30-day window** | HIGH | Update `privacy-gdpr.md` to show retention BY PLAN TIER |
| **"Automated deletion tests" still on roadmap but marketed as feature** | MEDIUM | Either ship tests or update marketing copy to "deletion available upon request" |
| **GDPR badge is still roadmap but copy implies it's ready** | MEDIUM | Change copy in GdprTrustPage: "GDPR compliance badge launching Q3 2026" |
| **72-hour SLA for GDPR deletion only mentioned in runbook, not on trust page** | MEDIUM | Add to GdprTrustPage FAQ: "Deletion requests processed within 72 hours" |

---

## 4. AUDIT LOG & COMPLIANCE AUDIT

### Promise vs Implementation

| Promise | Location | Implemented | Deployed | Status |
|---------|----------|-------------|----------|--------|
| **"Audit exports on Signal tier"** | Pricing page | ✅ TRUE | `/api/admin/audit/forensic.csv` | ✅ Yes |
| **"365-day audit retention on Signal"** | Pricing page | ✅ TRUE | KV TTL + D1 retention | ✅ Yes |
| **"7-year retention for GDPR"** | i18n `complianceAudit.footer` | ⚠️ UNCLEAR | Claimed in UI but no enforcement visible | ⚠️ Gap |
| **"Session created, started, closed events"** | i18n audit event labels | ✅ TRUE | audit_events table tracks these | ✅ Yes |
| **"GDPR respondent erased event"** | i18n audit event labels | ✅ TRUE | `gdpr.deletion_completed` event | ✅ Yes |
| **"Decision locked/registered events"** | i18n audit event labels | ✅ TRUE | `decision.locked`, `decision.registered` | ✅ Yes |
| **"Member invited event"** | i18n audit event labels | ✅ TRUE | `member.invited` event | ✅ Yes |
| **"Results exported event"** | i18n audit event labels | ✅ TRUE | `results.exported` event | ✅ Yes |
| **"Evidence pack metadata endpoint"** | `/api/compliance/evidence-pack` | ✅ PARTIAL | Endpoint exists; artifacts listed as "automated" | ⚠️ Incomplete |
| **"Audit trail for all auth, session, permission events"** | SOC2_EVIDENCE.md CC6.8 | ✅ PARTIAL | Tracked in audit_events; some events missing (e.g., role changes) | ⚠️ Partial |

### Critical Audit Gaps

| Gap | Severity | Action |
|-----|----------|--------|
| **"7-year retention" claimed in UI but no TTL enforcement visible in code** | CRITICAL | Implement TTL enforcement or update copy to "1-7 years depending on plan" |
| **Evidence pack endpoint claims artifacts are "automated" but some are "manual_upload"** | MEDIUM | Clarify: Which artifacts are truly automated vs which require manual work? |
| **Audit endpoint (`/api/admin/audit`) has no rate limiting visible** | MEDIUM | Add rate limiting to prevent abuse of audit logs export |
| **Role change events not in audit_events schema** | MEDIUM | Add `role.*` event types to audit_events tracking |

---

## 5. FEATURE MATRIX AUDIT

### Roadmap Items Still in Marketing Copy

| Item | Location | Status in Code | Marketing Status | Action Required |
|------|----------|----------------|------------------|-----------------|
| **Webhooks (Slack, Notion, Workday)** | Pricing row | Routes exist; feature flagged | "Roadmap" | ✅ Correctly labeled |
| **Branded domain & PDF templates** | Pricing row | Not implemented | "Roadmap" | ✅ Correctly labeled |
| **Customer-managed keys** | Pricing row | Not implemented | "Roadmap" | ✅ Correctly labeled |
| **Residency guarantee** | Pricing row for Chorus | Partial (EU DPA exists) | "Custom retention & residency" | ⚠️ **Misleading** |
| **Townhall Q&A board** | Pricing row for Chorus | Documented in DO; deployment unclear | ✅ "Team tier & above" | ⚠️ **Deployment unclear** |
| **Private Workers AI endpoint** | Pricing row for Chorus | Feature exists; unclear if exclusive | ✅ "Team tier" | ⚠️ **Spec mismatch** |

---

## 6. HIDDEN FEATURES (Implemented but Not Marketed)

| Feature | Found In | Marketed? | Should Be Marketed? |
|---------|----------|-----------|-------------------|
| **Semantic search (vectorize)** | Pricing matrix; code has `/api/teams/:id/decisions/semantic-search` | ⚠️ Hidden under "Evidence-anchored clusters" | ✅ YES — valuable feature |
| **Zero-knowledge mode** | Code & GDPR page | ⚠️ Mentioned but not highlighted | ✅ YES — major privacy feature |
| **Sentiment analysis** | Code; mentioned in SOC2 audit | ❌ NOT MARKETED | ⚠️ Consider if GA |
| **Team templates** | Help articles; code | ❌ NOT VISIBLE ON PRICING | ✅ YES — enterprise feature |
| **SAML SSO with role scopes** | Pricing for Chorus; code routes | ✅ Mentioned in Chorus tier | ✅ Good |
| **Multi-language sessions** | Code (`presentation_language` field) | ❌ NOT MARKETED | ✅ Consider marketing |

---

## 7. FEATURES MARKETED BUT INCOMPLETE

| Feature | Promise | Current State | Gap | Severity |
|---------|---------|---------------|-----|----------|
| **AI-powered insights on Signal** | "Same-day evidence-anchored recap" | Gated behind Team plan only | Copy says Signal has it; code limits to Team | **CRITICAL** |
| **Evidence-anchored clusters** | Available on Signal+ | Depends on `insightsAI` flag which is Team only | Feature gating mismatch | **HIGH** |
| **Townhall Q&A board** | 5000 participants, moderated | Documented in codebase but live status unclear | No deployment confirmation | **HIGH** |
| **Webhook integrations** | Listed as roadmap | Routes exist; feature flagged; unclear if beta | Customer confusion likely | **MEDIUM** |
| **Custom retention** | Chorus feature | No enforcement layer visible | Customers might not get what they paid for | **CRITICAL** |
| **EU data residency** | "Custom retention & residency" on Chorus | Partial (DPA exists; routing unclear) | Marketing promise > implementation | **HIGH** |

---

## 8. FEATURE PARITY CHECKLIST

### Pulse (Free) Tier

| Feature | Promise | Implemented | Enforced | Status |
|---------|---------|-------------|----------|--------|
| Session limit (≤5/mo) | ✅ | ✅ | ✅ Quota checked | **GOOD** |
| Participant cap (≤50) | ✅ | ✅ | ✅ Enforced in SessionRoom | **GOOD** |
| 30-day retention | ✅ | ✅ | ✅ KV TTL | **GOOD** |
| Anonymity modes | ✅ | ✅ | ✅ UI enforces | **GOOD** |
| CSV export | ✅ | ✅ | ✅ Available | **GOOD** |
| AI drafts (5/mo) | ✅ | ✅ | ✅ Quota checked | **GOOD** |
| No consent log | ✅ | ✅ | ✅ Enforced | **GOOD** |

### Signal (Starter) Tier

| Feature | Promise | Implemented | Enforced | Status |
|---------|---------|-------------|----------|--------|
| Session limit (≤75/mo) | ✅ | ✅ | ✅ | **GOOD** |
| Participant cap (≤500) | ✅ | ✅ | ✅ | **GOOD** |
| 365-day retention | ✅ | ✅ | ✅ | **GOOD** |
| Identified mode + consent log | ✅ | ✅ | ✅ | **GOOD** |
| AI insights (same-day) | ⚠️ PROMISED | ❌ GATED TO TEAM | ❌ NOT AVAILABLE | **CRITICAL GAP** |
| Evidence-anchored clusters | ⚠️ PROMISED | ❌ GATED TO TEAM | ❌ NOT AVAILABLE | **CRITICAL GAP** |
| Audit exports | ✅ | ✅ | ✅ | **GOOD** |

### Chorus (Team) Tier

| Feature | Promise | Implemented | Enforced | Status |
|---------|---------|-------------|----------|--------|
| Unlimited sessions | ✅ | ✅ | ✅ | **GOOD** |
| Participant cap (≤5000) | ✅ | ✅ | ✅ | **GOOD** |
| Custom retention (7d–7yr) | ✅ | ⚠️ POSSIBLE | ❌ UNENFORCED | **GAP** |
| SAML SSO | ✅ | ✅ | ✅ | **GOOD** |
| Townhall Q&A (5000 ppl) | ✅ | ✅ | ❓ UNCLEAR | **⚠️ VERIFY** |
| Private Workers AI | ✅ | ✅ | ❓ UNCLEAR | **⚠️ VERIFY** |
| Custom residency | ✅ | ⚠️ DPA ONLY | ❌ NO ROUTING GUARANTEE | **GAP** |
| Dedicated onboarding | ✅ | ⚠️ MANUAL | ❌ NOT ENFORCED | **PROCESS GAP** |

---

## 9. CUSTOMER-FACING RISKS

### HIGH RISK (Fix Immediately)

1. **SOC 2 Marketing vs Reality**
   - Copy says "SOC 2 Type II report issued" but cert is 2027 roadmap
   - **Risk:** Customers sign contracts expecting SOC 2 Type II; later discover it's not certified
   - **Action:** Remove certification claim or change to "in progress"
   - **Timeline:** URGENT (within 48 hours)

2. **AI Insights Gating Mismatch**
   - Pricing page promises "same-day evidence-anchored recap" on Signal
   - Code restricts to Team tier only
   - **Risk:** Signal customers upgrade expecting AI features; features unavailable
   - **Action:** Either (a) enable on Signal or (b) correct pricing copy to "Team tier only"
   - **Timeline:** Before next billing cycle

3. **Custom Retention Not Enforced**
   - Chorus customers promised 7-day to 7-year custom retention
   - No visible enforcement mechanism in codebase
   - **Risk:** Customers pay for custom retention; data deleted per default policy
   - **Action:** Implement retention enforcement or remove from Chorus spec
   - **Timeline:** Before next Chorus onboarding

4. **Residency Promise Without Routing Guarantee**
   - Chorus marketed as "custom retention & residency"
   - EU_DATA_RESIDENCY.md shows residency is DPA + "data may be processed in multiple regions"
   - **Risk:** EU enterprise customers expect data never to leave EU; Cloudflare routes can send to non-EU
   - **Action:** Either guarantee EU residency or remove "residency" from Chorus marketing
   - **Timeline:** Before next EU enterprise sale

### MEDIUM RISK (Fix Before Next Release)

5. **Audit Retention Claimed as 7 Years But Not Enforced**
   - UI claims "retained for 7 years under GDPR/AVG"
   - No TTL enforcement visible
   - **Risk:** Audit logs deleted before 7 years; compliance auditors note gap
   - **Action:** Implement 7-year TTL or change copy to actual retention window
   - **Timeline:** Sprint 35

6. **Townhall Q&A Board Deployment Status Unknown**
   - Marketed to Chorus customers
   - Code exists; live status unclear
   - **Risk:** Customers purchase expecting Townhall; feature may be beta/incomplete
   - **Action:** Confirm GA status or add "beta" disclaimer
   - **Timeline:** Before next Chorus contract

7. **Webhook Integrations Ambiguous**
   - Marked "roadmap" in pricing but routes exist
   - Unclear if customers can use or if feature-flagged
   - **Risk:** Customers attempt to integrate; unexpected behavior
   - **Action:** Either GA webhooks or add prominent "beta" label
   - **Timeline:** Sprint 35

---

## 10. COMPLIANCE VIOLATIONS (Summary)

| Violation | Type | Severity | Regulation |
|-----------|------|----------|-----------|
| Marketing SOC 2 Type II when only roadmapped | False claim | CRITICAL | GDPR §5(1)(a) (truthfulness) |
| AI insights promised on Signal but gated to Team | Deceptive practice | HIGH | Consumer protection law |
| Custom retention promised without enforcement | Unsubstantiated claim | HIGH | GDPR contract terms |
| 7-year audit retention claimed without TTL | Misleading claim | MEDIUM | Audit trail integrity |
| Residency guarantee without routing control | Unsubstantiated | HIGH | GDPR Data Processing Agreement |

---

## 11. ACTION ITEMS (Priority Order)

### IMMEDIATE (24–48 hours)

- [ ] **SOC 2 Claim:** Change badge from "SOC 2 Type II (issued)" to "SOC 2 Type II (In progress — expected Q3 2027)" OR remove certification badge entirely
- [ ] **AI Insights:** Correct pricing copy to say "Signal tier does NOT include AI insights" OR enable on Signal tier
- [ ] **Residency:** Add disclaimer: "Residency routing on the roadmap — EU customers must verify data processing path before signing"

### HIGH PRIORITY (This Sprint)

- [ ] **Custom Retention Enforcement:** Implement D1/KV TTL validation or remove custom retention from Chorus spec
- [ ] **Townhall Q&A Status:** Confirm deployment status; if beta, add explicit "beta" label to Chorus tier
- [ ] **Webhook Feature Status:** Either GA webhooks or add prominent "⚠️ Beta — Coming Soon" label
- [ ] **7-Year Audit TTL:** Implement enforcement or change copy to "1-year minimum retention"

### MEDIUM PRIORITY (Before Next Release)

- [ ] **GDPR Deletion Automation:** Complete automated deletion tests (GDPR-BADGE-01) or update copy
- [ ] **Sentinel Retention:** Document actual retention policy by tier; update all marketing + help articles
- [ ] **Evidence Pack Endpoint:** Clarify which artifacts are truly automated vs manual; complete automated collection
- [ ] **Role Change Audit:** Add `role.*` event types to audit_events tracking
- [ ] **Semantic Search Marketing:** Promote semantic search as a Signal+ feature; it's currently hidden

### LOW PRIORITY (Roadmap)

- [ ] **Nonprofit Pricing Process:** Create /nonprofit-application form or API endpoint for discount requests
- [ ] **Multi-Language Sessions:** Consider marketing multi-language support if GA
- [ ] **Sentiment Analysis:** Clarify if this is GA or beta; update marketing or deprecate

---

## 12. EVIDENCE SUMMARY

### What's Implemented & Confirmed Deployed

✅ **GDPR Compliance:**
- Anonymity modes (zero_knowledge, partial, full)
- GDPR deletion endpoint (`/api/users/me/gdpr-delete`)
- Consent log tracking (`ai_consent_at`, `consent_posture`)
- PII sanitization in audit logs
- Sub-processor registry (SOC2_EVIDENCE.md)

✅ **Audit Logging:**
- Audit event tables (`audit_log`, `audit_events`)
- Event types: session.*, decision.*, member.*, gdpr.*, action.*
- Export endpoint: `/api/admin/audit/forensic.csv`
- Actor, action, subject tracking

✅ **Privacy Features:**
- Encryption in transit (HTTPS/WSS)
- Cloudflare data encryption at rest
- Zero-knowledge session mode
- Multi-tier anonymity

✅ **Pricing Enforcement:**
- Session/participant quotas enforced in code
- Plan feature flags gated correctly
- Retention windows enforced

### What's Incomplete/Roadmapped

⚠️ **SOC 2 Type II:** Not certified yet (target: Q3 2027)
⚠️ **Automated GDPR Deletion Tests:** Still in development
⚠️ **Townhall Q&A Board:** Unclear deployment status
⚠️ **Webhook Integrations:** Feature exists but not GA
⚠️ **Custom Retention Enforcement:** Not enforced
⚠️ **Residency Routing:** No edge routing guarantee

---

## 13. NEXT STEPS

1. **Review this document with PO and legal** — identify compliance risk tolerance
2. **Update marketing copy** — fix SOC 2, AI insights, and residency claims
3. **Implement enforcement** — add TTL checks for retention, residency validation
4. **Stakeholder audit** — confirm feature statuses (Townhall, webhooks, etc.)
5. **Document evidence** — create `/api/compliance/evidence` endpoint with current control status

---

**Audit completed by:** Claude Code  
**Review date:** June 15, 2026  
**Next audit:** 30 days (after action items resolved)
