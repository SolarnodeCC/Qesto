# Promise-to-Implementation Audit — Resolution Log

**Review date:** 2026-07-01  
**Prior audit:** 2026-06-15 (`PROMISE_TO_IMPLEMENTATION_AUDIT.md`)  
**Branch:** `cursor/promise-audit-remediation-b218`

This log records what was verified, fixed in this remediation pass, or deferred to GitHub issues.

---

## Resolved in codebase (prior to or during this pass)

| Finding | Severity | Resolution | Evidence |
|---------|----------|------------|----------|
| SOC 2 Type II "report issued" claim | CRITICAL | Copy updated to "in progress — expected 2027 Q3" | `public/locales/*/common.json` → `soc2.badgeDescription`, `soc2.intro` |
| AI insights promised on Signal | CRITICAL | Pricing copy gates recap to Chorus; matrix shows Team-only AI rows | `src/pages/Pricing.tsx`, `src/config/pricing-matrix.ts` |
| Residency on Chorus pricing | HIGH | Residency marked "Roadmap"; Chorus card says "residency on roadmap" | `pricing-matrix.ts`, `Pricing.tsx` |
| 7-year audit footer (EN) | MEDIUM | Footer: account lifetime, not 7-year claim | `public/locales/en/common.json` |
| Townhall Q&A deployment unclear | HIGH | Beta label on Chorus tier | `Pricing.tsx` |
| Webhooks ambiguous | MEDIUM | "Outbound webhooks (Beta)" in matrix | `pricing-matrix.ts` |
| Evidence pack automated vs manual | MEDIUM | Endpoint documents `automated` vs `manual_upload` per artifact | `functions/api/routes/compliance.ts` |
| Role change audit events | MEDIUM | `role.*` + `team.role.*` in audit schema and teams routes | `functions/api/lib/audit.ts`, `teams.ts` |
| Tier-based retention in help | HIGH | `privacy-gdpr.md` + seed help docs updated | `knowledge-base/help/privacy-gdpr.md` |
| Semantic search hidden | LOW | Listed in pricing matrix for Signal+ | `pricing-matrix.ts` |
| GDPR consent 30-day promise | MEDIUM | Participant copy references host plan + Privacy Policy | `public/locales/*/vote.json` |

---

## Fixed in this remediation pass (2026-07-01)

| Finding | Action |
|---------|--------|
| NL locale still claimed 7-year audit retention | Updated `public/locales/nl/common.json` `complianceAudit.footer` |
| SOC 2 monitoring overstated | `soc2.controlMonitoring` → "Baseline continuous monitoring…" (all locales) |
| SOC 2 trust page bottom CTA implied certification | `soc2.bottomSubheading` i18n key + `Soc2TrustPage.tsx` |
| GDPR trust page missing 72h SLA + tier retention | New FAQ items on `GdprTrustPage.tsx` |
| Audit export abuse surface | Rate limits on `GET /api/admin/audit` (120/min) and forensic CSV (10/hr) |
| Role events missing from audit UI labels | `AuditLogViewer.tsx` + `complianceAudit.events.role.*` i18n |
| Outdated FAQ "1 year retention" | `functions/api/seed/help-documents.json` faq-003 |
| Chorus retention inconsistent in billing help | `knowledge-base/help/billing.md` → 7 days – 7 years |
| Nonprofit 40% discount process gap | Mailto application link on Pricing + Nonprofit pages |
| GDPR runbook 72h SLA | `privacy-gdpr.md` updated |

---

## Deferred — GitHub issues for future releases

| Finding | Severity | GitHub issue | Rationale |
|---------|----------|--------------|-----------|
| Custom retention enforcement (Chorus 7d–7yr auto-purge) | CRITICAL | #665 | Requires cron/worker + D1 purge job; marketing already discloses "not yet enforced" |
| EU data residency routing guarantee | HIGH | #666 | Needs SOVEREIGN region pinning + contractual DPA workflow |
| Public SOC 2 certification roadmap page | MEDIUM | #667 | `/trust/soc2/roadmap` — content exists in KB only |
| GDPR-BADGE-01 automated deletion test suite | MEDIUM | #668 | Engineering badge + public evidence pack |
| Multi-language sessions marketing | LOW | #669 | Feature exists (`presentation_language`); needs GA confirmation |
| Sentiment analysis GA status | LOW | #670 | Clarify ship status or deprecate |
| Nonprofit self-service application form | LOW | #671 | Mailto interim; full form/API is process improvement |

---

## Sign-off checklist (updated)

- [x] SOC 2 claim updated
- [x] AI insights tier gating corrected
- [x] Residency promise clarified
- [x] Townhall Q&A beta label
- [x] Webhooks beta label
- [x] Audit TTL copy corrected (all locales)
- [x] Audit endpoint rate limiting
- [x] GDPR trust page 72h SLA + tier retention FAQ
- [ ] Custom retention enforcement (deferred #665)
- [ ] EU residency routing (deferred #666)
- [ ] Legal re-review of corrected copy (manual)
