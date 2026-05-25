# i18n Sprints 60–70 — Quick Reference Card

## At a Glance

| Item | Value |
|------|-------|
| **Total effort** | 110 pts (8–13 pts/sprint) |
| **Strings** | 321–385 new keys (29–35/sprint avg) |
| **Languages** | 5: EN (source), NL/ES/DE/FR (native review) |
| **Namespaces** | 12 total (8 extended, 4 new) |
| **Review cycle** | 5–9 business days (bottleneck: native speaker) |
| **CI gates** | 10 (8 automated, 2 manual) |
| **Largest sprint** | S65 (Partner Portal): 13 pts, ~45 strings |
| **Smallest sprint** | S61 (Compliance Audit): 6 pts, ~8–12 strings |

---

## Sprints 60–70 Story Matrix

| # | Sprint | Story | Pts | Strings | Feature | Namespaces |
|---|--------|-------|-----|---------|---------|-----------|
| 1 | 60 | I18N-SPRINT60-01 | 9 | 25–30 | AI Copilot | copilot, admin, results |
| 2 | 61 | I18N-SPRINT61-01 | 6 | 8–12 | Compliance Audit | common, admin |
| 3 | 62 | I18N-SPRINT62-01 | 11 | 35–40 | DPIA + SOC 2 + Consent | compliance, admin |
| 4 | 63 | I18N-SPRINT63-01 | 10 | 24–28 | Multi-Region Admin | admin, team, settings |
| 5 | 64 | I18N-SPRINT64-01 | 8 | 22–26 | Regional Audit + Partner Prep | admin, results, partner |
| 6 | 65 | I18N-SPRINT65-01 | 13 | 40–45 | Partner Portal + Branded Login | partner, admin, dashboard, onboarding |
| 7 | 66 | I18N-SPRINT66-01 | 10 | 24–28 | Partner Analytics + ZK v2 | partner, zk-v2, admin |
| 8 | 67 | I18N-SPRINT67-01 | 12 | 30–35 | ZK v2 Participant Privacy | zk-v2, settings, common |
| 9 | 68 | I18N-SPRINT68-01 | 7 | 16–20 | ZK v2 Attestation + Coaching | zk-v2, coaching |
| 10 | 69 | I18N-SPRINT69-01 | 11 | 26–30 | AI Copilot Logging + Moderation | copilot, admin, present |
| 11 | 70 | I18N-SPRINT70-01 | 13 | 28–32 | Final Compliance + Legal | compliance, legal, admin |
| — | **TOTAL** | — | **110** | **321–385** | — | **12** |

---

## New Namespaces (S60–S70)

```
copilot.json         — AI coaching, hints, badges, conversation history (S60, ext S69)
compliance.json      — DPIA, SOC 2, breach, attestation (S62, ext S70)
partner.json         — Portal, dashboard, export formats (S64, ext S65–66)
zk-v2.json          — Modes, trust score, privacy dashboard (S66, ext S67–68)
coaching.json        — Coaching hints, skill badges (S68, ext S69)
legal.json          — Legal copy, policy references (S70)
```

---

## Story Card Template (Copy for New Sprint)

```markdown
## I18N-SPRINT##-01: i18n for {feature} in 5 locales

**Feature:** {product epic}  
**Sprint:** ## | **Pts:** X | **Pri:** P1  

### Acceptance Criteria
- [ ] All new strings in EN: `public/locales/en/{namespace}.json`
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations: AI draft marked `// AI draft`
- [ ] `npm run check:i18n` passes
- [ ] German layout: 100% and 200% zoom, no truncation
- [ ] Pseudo-loc audit passed
- [ ] No PII in any translation
- [ ] AI drafts reviewed by native speakers

### Dependencies
- Product spec frozen by Sprint [##-1] week 3
- Native speakers available for 5–7 day review

### Technical Notes
- Est. X–Y new keys
- Namespace: {new or extend}
- Intl API: {number/date/currency patterns}
- Email templates: {if applicable}

### Review Checklist
- [ ] i18n engineer: extraction, AI drafts, gates
- [ ] NL/ES/DE/FR native speakers: AI draft approved
- [ ] DE: layout validated 100%/200% zoom
- [ ] PO: copy accuracy
- [ ] Legal/Compliance: {if applicable}
```

---

## CI Gates (10-Point Checklist)

### Automated Gates (CI/CD)
1. **`npm run check:i18n`** — zero missing keys, no empty values
2. **German layout audit** — pseudo-locale at 100%/200% zoom (manual)
3. **AI draft marking** — JSON comments, native speaker approval
4. **`npm run check:pii-log`** — no emails, names, API keys
5. **Number/Date/Currency** — Intl API verified (code review)
6. **`npm run check:compliance-claims`** — legal review (S62+)

### Manual Gates (PR Review)
7. **Email template rendering** — Litmus preview (S64+)
8. **Namespace structure** — component-scoped (code review)
9. **Spelling & tone** — PO sign-off
10. **Deprecation cleanup** — Wave 3 calendar (S70 only)

**Merge criteria: ALL 10 gates pass.**

---

## Native Speaker Review Timeline

**Per-sprint (14 days):**
```
Days 1–3:   EN extraction + AI draft generation
Days 3–9:   Native speaker review (5–7 days, 4 languages = BOTTLENECK)
Days 8–11:  Layout audit + pseudo-loc test
Days 11–12: CI gates + compliance review
Days 12–14: PR merge
```

**Resource:** 1 i18n engineer (FTE) + 4 native speakers (20–30% each) + optional contractor (S65–S70).

---

## Key Metrics & Success Criteria

**Sprint 60 Entry Requirements:**
- ✅ AI Copilot spec finalized (strings frozen)
- ✅ Native speakers confirmed available (5–7 day review window)
- ✅ Glossary + tone guide prepared
- ✅ CI workflow scripts (.github/workflows/i18n-check.yml) deployed

**Sprint 70 Exit Requirements:**
- ✅ All 11 I18N-SPRINT##-01 stories completed
- ✅ 100% CI gate pass rate
- ✅ Zero PII leakage, zero compliance claim failures
- ✅ Zero German layout regressions
- ✅ 321–385 strings in 12 namespaces across 5 languages
- ✅ Wave 3 deprecation calendar finalized (S75+)

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Native speaker review delay | High | Pre-stage AI drafts Sprint +2; batch by language |
| German layout overage | Medium | Pseudo-locale test mandatory; min-width/min-height design gate |
| Compliance string churn | High | String freeze 1 week before close; legal SLA 3 days |
| Feature scope creep | Medium | String freeze 2 weeks before close; tag out-of-scope strings |

---

## Backlog Integration

**Add to BACKLOG_MASTER.md:**
- Copy 11 story cards from I18N_SPRINT_60_70_BACKLOG.md
- Map dependencies to product epics (AI-COPILOT, COMPLIANCE, PARTNER-PORTAL, etc.)
- Set i18n engineer capacity: 8–13 pts/sprint
- Feature spec freeze: 1 week before sprint start (critical path)

**Add to CI/CD:**
- `.github/workflows/i18n-check.yml` from I18N_CI_GATES_SPRINT_60_70.md
- Update PR template with i18n checklist (reference 10 gates)

---

## Files & Documentation

| File | Lines | Purpose |
|------|-------|---------|
| I18N_SPRINT_60_70_PLAN.md | 464 | Master planning (overview, workload, risks, template) |
| I18N_SPRINT_60_70_BACKLOG.md | 632 | 11 story cards with detailed AC & review checklist |
| I18N_CI_GATES_SPRINT_60_70.md | 458 | 10 CI gates, failure modes, recovery, config |
| I18N_SPRINT_60_70_SUMMARY.md | 253 | Executive summary + integration guide |
| **This file** | ~200 | Quick reference card |

---

## Quick Links

- **Master Plan:** I18N_SPRINT_60_70_PLAN.md
- **Story Cards:** I18N_SPRINT_60_70_BACKLOG.md
- **CI Gates:** I18N_CI_GATES_SPRINT_60_70.md
- **Executive Summary:** I18N_SPRINT_60_70_SUMMARY.md
- **i18n Skill:** `.claude/skills/i18n.md` (baseline constraints, workflows)

---

## Approval Sign-Off

- [ ] Product Owner: Confirms sprint allocation (110 pts across S60–S70)
- [ ] i18n Engineer: Ready to execute 11-sprint roadmap
- [ ] Native Speakers: Availability confirmed (5–7 day review cycle per sprint)
- [ ] Release Manager: CI gates and merge criteria understood
- [ ] Architecture: Namespace structure approved (12 total)

---

**Last Updated:** 2026-05-25 | **Status:** ✅ Ready for backlog integration
