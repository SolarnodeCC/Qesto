# Qesto Promise-to-Implementation Audit — Quick Reference

**Last Updated:** 2026-07-01  
**Review Status:** ✅ **CRITICAL COPY GAPS RESOLVED** — engineering enforcement tracked in GitHub issues

> **Resolution log:** [`knowledge-base/quality/audits/PROMISE_AUDIT_RESOLUTION_2026-07-01.md`](./knowledge-base/quality/audits/PROMISE_AUDIT_RESOLUTION_2026-07-01.md)

---

## ✅ IMMEDIATE ISSUES — RESOLVED

### 1. SOC 2 CERTIFICATION CLAIM — ✅ FIXED
- **Was:** "SOC 2 Type II report issued"
- **Now:** "SOC 2 Type II is in progress — expected 2027 Q3" (`soc2.badgeDescription`, `soc2.intro`)
- **Verified:** All 5 locale files + `Soc2TrustPage.tsx`

### 2. AI INSIGHTS ON SIGNAL — ✅ FIXED
- **Was:** Signal tier promised "Same-day evidence-anchored recap"
- **Now:** Conditional copy — AI recap on Chorus only; matrix rows show `insightsAI` Team-only
- **Verified:** `src/pages/Pricing.tsx`, `src/config/pricing-matrix.ts`, entitlement tests

### 3. RESIDENCY PROMISE — ✅ FIXED (copy)
- **Was:** Chorus "Custom retention & residency" implied availability
- **Now:** Residency row = "Roadmap"; Chorus card = "residency on roadmap"
- **Engineering:** EU routing guarantee deferred to GitHub issue (see resolution log)

---

## ⚠️ HIGH PRIORITY — STATUS

| Issue | Marketing | Engineering | Status |
|-------|-----------|-------------|--------|
| **Custom Retention** | Disclosed as plan target, not auto-enforced | Cron purge job needed | 🔶 GitHub issue |
| **Townhall Q&A** | Beta label on Chorus tier | GA when `REALTIME_TOWNHALL_ENABLED` | ✅ Copy fixed |
| **Webhooks** | "Outbound webhooks (Beta)" in matrix | Feature-flagged routes | ✅ Copy fixed |
| **Audit Retention** | Account-lifetime footer (all locales) | No auto-purge by design today | ✅ Copy fixed |
| **Audit rate limit** | N/A | 120/min query, 10/hr CSV export | ✅ Implemented |

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
| Role lifecycle audit | Chorus+ | ✅ `role.*` events tracked |

---

## 📊 QUICK METRICS (post-remediation)

| Metric | Value | Status |
|--------|-------|--------|
| Total promises audited | 47 | ✅ |
| Fully implemented & correct | 34 | ✅ ~72% |
| Copy-aligned / disclosed partial | 8 | ⚠️ ~17% |
| Deferred to engineering | 5 | 🔶 ~11% |
| **Critical marketing gaps** | 0 | ✅ |

---

## 📋 SIGN-OFF CHECKLIST

### Before Next Marketing Campaign
- [x] SOC 2 claim updated
- [x] AI insights tier gating corrected
- [x] Residency promise clarified
- [ ] Legal review of corrected copy
- [x] Pricing matrix aligned with entitlements

### Before Next Chorus Onboarding
- [x] Townhall Q&A beta label
- [ ] Custom retention enforcement (GitHub issue)
- [x] Residency routing clarified in copy
- [x] DPA template available (`DPA_SCC_TEMPLATE.md`)
- [x] Evidence pack endpoint functional

---

**Full audit report:** `PROMISE_TO_IMPLEMENTATION_AUDIT.md`  
**Resolution log:** `knowledge-base/quality/audits/PROMISE_AUDIT_RESOLUTION_2026-07-01.md`
