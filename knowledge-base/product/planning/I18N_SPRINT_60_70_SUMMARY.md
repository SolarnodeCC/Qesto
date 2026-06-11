# i18n Sprint 60–70 Estimation — Executive Summary

**Date:** 2026-05-25 (UTC)  
**Prepared by:** qesto-i18n (Cloud Agent, Haiku)  
**Status:** ✅ Ready for backlog integration

---

## Deliverables

Three comprehensive documents committed to repository (1,096 + 458 lines):

### 1. **I18N_SPRINT_60_70_PLAN.md** (464 lines)
Master planning document covering:
- **Overview:** 5-language workload across 11 sprints (S60–S70)
- **Features covered:** AI Copilot, Compliance, Multi-Region Admin, Partner Portal, Zero-Knowledge v2
- **Workload summary:** 110 total points; 321–385 new strings; 12 namespaces; 63–92 days review cycle
- **Story pattern:** I18N-SPRINT##-01 template with pts, AC, dependencies, technical notes
- **Individual sprint plans:** S60–S70 breakdown (feature, strings scope, namespace, effort, dependencies)
- **Native speaker coordination:** Timeline, staffing, review cycle bottleneck analysis
- **Risk mitigation:** Review bottleneck, German layout overages, compliance churn, feature scope creep
- **Long-term roadmap:** Wave 3 (S71–S75) and Wave 4 (S76+) placeholder

### 2. **I18N_SPRINT_60_70_BACKLOG.md** (632 lines)
11 detailed story cards (I18N-SPRINT##-01 pattern):
- **I18N-SPRINT60-01:** AI Copilot | 9 pts | ~25–30 strings
- **I18N-SPRINT61-01:** Compliance Audit | 6 pts | ~8–12 strings
- **I18N-SPRINT62-01:** DPIA + SOC 2 + Consent v2 | 11 pts | ~35–40 strings
- **I18N-SPRINT63-01:** Multi-Region Admin | 10 pts | ~24–28 strings
- **I18N-SPRINT64-01:** Regional Audit + Partner Prep | 8 pts | ~22–26 strings
- **I18N-SPRINT65-01:** Partner Portal + Branded Login | 13 pts | ~40–45 strings (largest)
- **I18N-SPRINT66-01:** Partner Analytics + ZK v2 Modes | 10 pts | ~24–28 strings
- **I18N-SPRINT67-01:** ZK v2 Participant Privacy | 12 pts | ~30–35 strings
- **I18N-SPRINT68-01:** ZK v2 Attestation + Coaching | 7 pts | ~16–20 strings
- **I18N-SPRINT69-01:** AI Copilot Logging + Moderation | 11 pts | ~26–30 strings
- **I18N-SPRINT70-01:** Final Compliance + Legal | 13 pts | ~28–32 strings (includes deprecation cleanup)

Each story card includes:
- Acceptance criteria (11–15 detailed checkpoints)
- Dependencies (feature spec freeze, namespace decisions, native speaker availability)
- Technical notes (Intl API patterns, email template specs, deprecation workflow)
- Review checklist (i18n, native speakers, PO, QA, legal/compliance role)

### 3. **I18N_CI_GATES_SPRINT_60_70.md** (458 lines)
Comprehensive CI validation spec with 10 gates:

**Automated Gates (CI/CD pipeline):**
1. `npm run check:i18n` — zero missing keys, no empty values, correct format
2. German layout audit — manual pseudo-locale test (100%/200% zoom, no truncation)
3. AI draft marking — JSON comments, native speaker approval or defer rationale
4. `npm run check:pii-log` — no emails, names, API keys, session IDs
5. Number/Date/Currency — Intl API verification (code review)
6. `npm run check:compliance-claims` — legal review gate (S62+)
7. Email template rendering — Litmus preview (S64+)
8. Namespace structure audit — correct component scoping (code review)

**Manual Gates (PR review):**
9. Spelling & tone review — PO sign-off
10. Deprecation cleanup — Wave 3 calendar finalized (S70 only)

Includes:
- Gate descriptions, checks, failure actions, evidence requirements
- Sprint-by-sprint gate matrix
- Failure modes & recovery procedures
- CI configuration template (.github/workflows/i18n-check.yml)
- Success metrics for S70 close

---

## Key Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Total effort** | 110 pts | Across 11 sprints (avg 10 pts/sprint, range 6–13) |
| **Total strings** | 321–385 | Avg 29–35 new keys per sprint |
| **Languages** | 5 | EN (source), NL/ES/DE/FR (native speaker review required) |
| **Namespaces** | 12 total | 8 existing extended, 4 new (copilot, compliance, partner, zk-v2, coaching, legal) |
| **Review cycle** | 5–9 days | Per language (3–5 for small sprints, 7–10 for large) |
| **Max concurrent strings** | ~45 | Sprint 65 (Partner Portal) — largest single sprint |
| **German layout** | +40% text | Pseudo-loc audit mandatory every sprint |
| **Email templates** | 4 sprints | S64, S68, S70 (partner invite, ZK attestation, breach notification) |
| **Compliance gates** | 5 sprints | S62, S66, S67, S68, S70 (DPIA, ZK v2, breach, attestation, legal) |

---

## Native Speaker Coordination Timeline

**Per-sprint cycle (14 days):**
- **Days 1–3:** EN extraction, AI draft generation (~3 hours)
- **Days 3–9:** Native speaker review (5–7 days across 4 languages = bottleneck)
- **Days 8–11:** Layout audit, pseudo-loc test (2–3 days)
- **Days 11–12:** CI gate validation, compliance review (if applicable)
- **Days 12–14:** PR merge, burndown

**Resource requirement:**
- **i18n engineer:** 1 FTE (key extraction, AI draft generation, layout audit, CI gates, deprecation)
- **Native speakers:** 4 reviewers (NL, ES, DE, FR), 20–30% capacity each (5–7 days per sprint × 4 = 20–28 days review load; staggered by language)
- **Optional contractor:** Part-time (S65–S70) for high-volume sprints (partner portal, compliance)

**Risk:** Native speaker review is critical path. Recommend pre-staging AI drafts by Sprint +2 (before dev feature finalization) to allow review + approval before sprint close.

---

## Namespace Expansion

**New namespaces (S60–S70):**
- `copilot.json` — AI coaching, conversation history, coaching hints (S60, extended S69)
- `compliance.json` — DPIA, SOC 2, breach notifications, legal copy (S62, extended S70)
- `partner.json` — Partner portal, partner dashboard, export formats (S64, extended S65–66)
- `zk-v2.json` — ZK v2 modes, trust score, privacy dashboard, attestation (S66, extended S67–68)
- `coaching.json` — Coaching hints, badges, skill assessment (S68, extended S69)
- `legal.json` — Legal copy snippets, policy references, terms (S70)

**Rationale:** One new namespace per 2–3 sprints avoids complexity sprawl; grouping related features (ZK v2 + privacy, compliance + legal) keeps string management maintainable.

---

## CI Gate Validation

**Pre-merge gates (all 10 must pass):**
1. ✅ `npm run check:i18n` (automated)
2. ✅ German layout audit (manual + pseudo-locale screenshots)
3. ✅ AI draft review (native speaker comment)
4. ✅ `npm run check:pii-log` (automated)
5. ✅ Intl API audit (code review)
6. ✅ `npm run check:compliance-claims` (legal review, S62+)
7. ✅ Email template Litmus preview (S64+)
8. ✅ Namespace structure (code review)
9. ✅ Spelling & tone (PO review)
10. ✅ Deprecation cleanup (S70 only)

**Approval roles:**
- i18n engineer: gates 1, 2, 3, 4, 5, 7, 8
- Product Owner: gate 9
- Legal/Compliance: gate 6 (if applicable)
- Release Manager: gate 10 (S70)

---

## Risk Assessment & Mitigation

### Risk 1: Native Speaker Review Bottleneck
**Likelihood:** High | **Impact:** Sprint close delay (5–7 days)

**Mitigation:**
- Batch review by language (NL, DE, ES, FR groups)
- Pre-stage AI drafts by Sprint +2 (before dev finalization)
- Glossary + tone guide provided by Sprint 59 week 4
- Optional contractor for S65–S70 (high-volume sprints)

### Risk 2: German Layout Failures (Overage)
**Likelihood:** Medium | **Impact:** UI regression, poor UX in German

**Mitigation:**
- Pseudo-locale test mandatory per sprint (non-negotiable CI gate)
- Design review enforces min-width/min-height (not fixed w/h)
- 2 pts per sprint allocated for German layout remediation
- Mobile viewport testing (375px) for S65+ (partner portal, legal)

### Risk 3: Compliance String Churn
**Likelihood:** High | **Impact:** Rework, late approval delays

**Mitigation:**
- String freeze 1 week before sprint close (no late edits)
- Legal review SLA: 3 business days max
- Compliance keys versioned by date (e.g., `compliance.gdpr.attestation_2026_06`)
- Deprecation workflow ready for Wave 3 EOL (Sprint 75)

### Risk 4: Feature Scope Creep
**Likelihood:** Medium | **Impact:** Out-of-scope strings, incomplete reviews

**Mitigation:**
- String freeze 2 weeks before sprint end (feature branches locked)
- Out-of-scope strings tagged `// FUTURE_SPRINT_##`
- Backlog hygiene every 2 sprints (audit `// AI draft` comments, close deferred reviews)

---

## Integration with Product Backlog

**Recommended action:**
1. Add 11 I18N-SPRINT##-01 stories to BACKLOG_MASTER.md (copy from I18N_SPRINT_60_70_BACKLOG.md)
2. Map each story to product epic (e.g., I18N-SPRINT60-01 depends on AI-COPILOT-01)
3. Set story dependencies: product feature spec must freeze 1 week before sprint start
4. Assign i18n engineer to each story (capacity: ~10 pts/sprint)
5. Add CI gate checklist to PR template (reference I18N_CI_GATES_SPRINT_60_70.md)

**Backlog positioning:**
- I18N stories are **P1** (critical path for product release)
- Estimated total effort: **110 pts** across 11 sprints
- Per-sprint allocation: **8–13 pts** (within typical product sprint capacity of 120–150 pts)

---

## Success Criteria (S70 Close)

- ✅ All 11 I18N-SPRINT##-01 stories completed and merged
- ✅ 100% of stories passed all 10 CI gates
- ✅ Zero PII leakage in production translations
- ✅ Zero failed compliance claims at GA
- ✅ Zero German layout regressions (200% zoom test)
- ✅ 100% of AI drafts reviewed by native speakers (or explicitly deferred + tracked)
- ✅ All email templates rendered correctly (EN/NL/DE/FR/ES)
- ✅ Deprecation calendar finalized for Wave 3 (S75+)
- ✅ 321–385 new strings in 12 namespaces, all 5 languages complete

---

## Next Steps

1. **Immediate (Sprint 59 week 4):**
   - Review and approve I18N_SPRINT_60_70_PLAN.md with Product Owner
   - Add 11 story cards to BACKLOG_MASTER.md
   - Publish CI gate spec to team (I18N_CI_GATES_SPRINT_60_70.md)
   - Coordinate native speaker availability (NL/ES/DE/FR) for S60 onboarding

2. **Sprint 59 close (Sprint 60 prep):**
   - Finalize AI Copilot spec (strings frozen)
   - Prepare glossary + tone guide for native speakers
   - Set up CI workflows (.github/workflows/i18n-check.yml)
   - Brief i18n engineer on 11-sprint roadmap

3. **Sprint 60 start:**
   - Execute I18N-SPRINT60-01 per story AC
   - Run through all 10 CI gates
   - Begin Wave 3 planning (S71–S75)

---

## Files Committed

```
I18N_SPRINT_60_70_PLAN.md       (464 lines)  — Master planning doc
I18N_SPRINT_60_70_BACKLOG.md    (632 lines)  — 11 detailed story cards
I18N_CI_GATES_SPRINT_60_70.md   (458 lines)  — CI validation spec (10 gates)
────────────────────────────────────────────────────────────────
Total: 1,554 lines | 3 documents | 110 pts of work | 5 languages | 11 sprints
```

---

## Questions & Contact

For questions on:
- **Planning & estimation:** Review I18N_SPRINT_60_70_PLAN.md §Overview + Workload Summary
- **Story details & AC:** See I18N_SPRINT_60_70_BACKLOG.md (11 story cards)
- **CI gates & validation:** Consult I18N_CI_GATES_SPRINT_60_70.md (10 gates, failure modes)
- **Native speaker coordination:** Reference I18N_SPRINT_60_70_PLAN.md §Native Speaker Coordination
- **Risk mitigation:** See I18N_SPRINT_60_70_PLAN.md §Risk & Mitigation

---

**Ready for backlog integration. ✅**
