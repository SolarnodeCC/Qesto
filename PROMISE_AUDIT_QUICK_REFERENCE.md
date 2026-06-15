# Qesto Promise-to-Implementation Audit — Quick Reference

**Last Updated:** June 15, 2026  
**Review Status:** ⚠️ **CRITICAL GAPS IDENTIFIED**

---

## 🚨 IMMEDIATE ISSUES (Fix in 48 hours)

### 1. FALSE SOC 2 CERTIFICATION CLAIM
- **Current Copy:** "SOC 2 Type II report issued. Contact sales@qesto.cc for auditor attestation letter."
- **Reality:** SOC 2 Type II certification roadmapped for Q3 2027; not yet certified
- **Risk:** Enterprise deals signed expecting SOC 2; later find it's not certified → breach of contract
- **Fix:** Change copy to "SOC 2 Type II certification in progress (expected Q3 2027)" or remove badge

### 2. AI INSIGHTS PROMISED ON SIGNAL, GATED TO TEAM
- **Current Copy:** Signal tier: "Same-day evidence-anchored recap"
- **Reality:** `insightsAI` flag is Team/Chorus only; Signal customers cannot access
- **Risk:** Customers upgrade to Signal for AI features; features unavailable → complaints + refunds
- **Fix:** Either (a) enable on Signal or (b) change copy to "Team tier only"

### 3. RESIDENCY PROMISE WITHOUT ENFORCEMENT
- **Current Copy:** Chorus: "Custom retention & residency"
- **Reality:** Residency is roadmap (EU_DATA_RESIDENCY.md); data routes through global Cloudflare network
- **Risk:** EU enterprise customers expect data to stay in EU; routing not controlled
- **Fix:** Remove "residency" from Chorus or add disclaimer: "Routing on roadmap"

---

## ⚠️ HIGH PRIORITY ISSUES (Fix Before Next Release)

| Issue | Promised | Actual | Risk | Fix By |
|-------|----------|--------|------|--------|
| **Custom Retention** | Chorus: 7d–7yr custom | No enforcement layer visible | Customers pay for custom retention; data deleted per default | Sprint 35 |
| **Townhall Q&A** | Chorus: "moderated, 5000 participants" | Code exists; live status unknown | Customers expect feature; unclear if beta/complete | Sprint 35 |
| **Webhooks** | "Roadmap" but routes exist | Feature-flagged; unclear if GA | Customers confused whether to integrate | Sprint 35 |
| **7-Year Audit Retention** | UI claims "retained for 7 years under GDPR" | No TTL enforcement visible | Compliance auditors note gap | Sprint 36 |

---

## ✅ WHAT'S WORKING CORRECTLY

| Feature | Tier | Status |
|---------|------|--------|
| Session/participant quotas | All | ✅ Enforced in code |
| GDPR deletion endpoint | All | ✅ Working (`/api/users/me/gdpr-delete`) |
| Anonymity modes | All | ✅ Full, partial, zero_knowledge |
| Audit log exports | Signal+ | ✅ CSV export working |
| Consent logging | Signal+ | ✅ Tracked in audit_events |
| Encryption in transit | All | ✅ HTTPS/WSS |
| SAML SSO | Chorus | ✅ Routes implemented |
| Slack/Teams integrations | All | ✅ Minimal data sharing (aggregate only) |

---

## 📊 QUICK METRICS

| Metric | Value | Status |
|--------|-------|--------|
| Total promises audited | 47 | ✅ |
| Fully implemented & correct | 28 | ✅ 60% |
| Partially correct | 12 | ⚠️ 25% |
| Gaps / misleading | 7 | ❌ 15% |
| **Critical severity** | 3 | 🚨 |
| **High severity** | 4 | 🔴 |

---

## 📋 SIGN-OFF CHECKLIST

### Before Next Marketing Campaign
- [ ] SOC 2 claim updated or removed
- [ ] AI insights tier gating corrected
- [ ] Residency promise clarified or removed
- [ ] Legal review of corrected copy
- [ ] Pricing matrix updated in code

### Before Next Chorus Onboarding
- [ ] Townhall Q&A status confirmed (GA vs beta)
- [ ] Custom retention enforcement implemented or removed
- [ ] Residency routing clarified to customer
- [ ] DPA signed for EU customers
- [ ] Evidence pack endpoint functional

### Before Next SOC 2 Claims
- [ ] Update copy to show Q3 2027 target
- [ ] Remove "auditor letter" language
- [ ] Add monitoring dashboard link
- [ ] Evidence collection process documented

---

## 🔍 FOR STAKEHOLDERS

**PO:** Townhall Q&A, webhooks, and multi-language sessions need GA status confirmation  
**Legal:** SOC 2 claim requires immediate correction  
**Ops:** Retention enforcement and audit TTL need implementation  
**Sales:** Residency and custom retention require clearer positioning  
**Marketing:** Update all mentions of SOC 2 and AI features  

---

## 📝 EVIDENCE LINKS

- Pricing implementation: `/home/user/Qesto/src/config/pricing-matrix.ts`
- SOC 2 roadmap: `/home/user/Qesto/knowledge-base/operations/compliance/SOC2_TYPE2_ROADMAP.md`
- GDPR implementation: `/home/user/Qesto/functions/api/routes/gdpr.ts`
- Audit logging: `/home/user/Qesto/functions/api/routes/admin/audit.ts`
- Feature gates: `/home/user/Qesto/functions/api/lib/entitlements.ts`
- Trust pages: `/home/user/Qesto/src/pages/{Soc2TrustPage,GdprTrustPage}.tsx`
- Marketing strings: `/home/user/Qesto/public/locales/en/common.json` (soc2.*, sla.*, gdpr.*)

---

## ⏱️ TIMELINE TO RESOLVE

| Timeline | Action | Owner |
|----------|--------|-------|
| **48 hours** | Fix SOC 2, AI insights, residency marketing copy | Product/Marketing |
| **1 week** | Confirm Townhall & webhook status; create feature roadmap | Product |
| **2 weeks** | Implement retention enforcement or remove from spec | Backend |
| **1 sprint** | Implement audit TTL enforcement; update help articles | Backend/Ops |
| **2 sprints** | Complete evidence collection for SOC 2 audit prep | Ops/Security |

---

**Full audit report:** `PROMISE_TO_IMPLEMENTATION_AUDIT.md`  
**Questions?** Review the detailed audit document or escalate to security@qesto.cc
