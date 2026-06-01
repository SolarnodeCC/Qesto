---
id: I18N_SPRINT_60_70_PLAN
type: planning
domain: i18n
category: estimation
status: draft
version: 1.0
created: 2026-05-25
updated: 2026-05-25
tags:
  - i18n
  - planning
  - sprints
  - translation
  - localization
relates_to:
  - SPRINT30_39_PLAN
  - BACKLOG_MASTER
  - i18n.md
---

# i18n Estimation — Sprints 60–70 (v2.4 → v2.6 horizon)

_Created: 2026-05-25._  
_Basis: SPRINT30_39_PLAN, BACKLOG_MASTER, current 5-language baseline (EN/NL/DE/FR/ES), published roadmap feature timeline._

## Overview

Five-language i18n (EN/NL/DE/FR/ES) workload for Sprints 60–70 covering:
- **v2.4 completion** (S35–S39 overflow + late acceptance)
- **v2.5 multi-region admin** (S40–45)
- **v2.6 partner portal** (S45–50)
- **v2.7 ZK v2 depth** (S50–55)
- **v2.8 AI copilot** (S55–60)
- **v2.9 compliance** (S60–70)

**Constraints:**
- 120–150 pts per sprint (product team)
- i18n workload typically **8–13 pts/sprint** for feature-rich sprints (avg 18–20 strings/feature, 3–5 namespaces)
- Pseudo-loc audit (German +40% layout) **2–3 pts/sprint**
- CI gate validation **1–2 pts** (built into acceptance, not separate line item)

**Languages:**
- EN: source of truth, all strings from product engineering
- NL/ES/DE/FR: 20–30% cycle time from EN (native speaker review = 5–7 days typical)

---

## Story Pattern (I18N-SPRINT##-01)

```
# I18N-SPRINT##-01: i18n strings for {feature} in 5 locales

**Feature:** {product epic/story}  
**Deliverable:** All UI strings extracted, EN source created, AI-drafted for NL/ES/DE/FR, marked for review.  
**Acceptance Criteria:**
- [ ] All new strings added to `public/locales/en/{namespace}.json` (namespaces: common, admin, dashboard, settings, etc.)
- [ ] Strings follow semantic camelCase dot-path convention (never full sentences; keys like `auth.flow.confirmLabel`, `settings.featureName.description`)
- [ ] Non-EN translations generated via Workers AI (not Anthropic), marked `// AI draft` in JSON comments for native speaker review
- [ ] `npm run check:i18n` passes: zero missing keys in any language, no empty values, no duplicates
- [ ] German layout tested at 100% and 200% zoom: no truncation, no overflow, all containers have min-width/min-height (not fixed)
- [ ] Pseudo-localization audit passed (sample page in German preview)
- [ ] No PII in any translation string (user emails, real names, API keys)
- [ ] All AI drafts reviewed and approved by native speaker (or explicitly approved for future sprint polish if volume exceeds capacity)

**Effort estimate:** {X} pts

**Dependencies:**
- Product spec finalized (strings frozen)
- Namespace structure decided (new or existing)
- AI draft review cycle coordinated (typical 5–7 days post-generation)
```

---

## Sprint 60–70 Story Breakdown

### Sprint 60 — v2.8 AI Copilot + Prep for Sprint 61

**Product feature:** AI conversation coaching (copilot suggestions during session), participant skill assessment, coaching export.  
**New namespaces:** `copilot`, possibly extend `admin` + `results`.  
**Strings scope:** ~25–30 new keys (copilot prompt labels, assessment headers, export fields, toast messages, moderation cues).

**I18N-SPRINT60-01: i18n for AI Copilot** | **9 pts**
- EN strings (coaching prompts, assessment labels, export templates, moderation UI)
- AI drafts for NL/ES/DE/FR
- German layout: copilot message bubbles at 40% longer, no truncation in mobile view
- Pseudo-loc audit: assessment card labels at 200% zoom
- **CI gate:** `npm run check:i18n` pass; no missing keys in copilot namespace

**Dependencies:** Product spec frozen by Sprint 59 week 2; AI copilot feature branch ready for review by Sprint 60 week 1.

---

### Sprint 61 — v2.8 AI Copilot Hardening + Compliance Prep

**Product feature:** AI copilot bug fixes, compliance statement refresh (compliance audit findings).  
**New strings:** ~8–12 (compliance disclaimers, copilot error messages, revised consent labels).

**I18N-SPRINT61-01: i18n for Compliance Audit Findings** | **6 pts**
- EN compliance statement updates (GDPR, data residency disclaimers)
- AI drafts for NL/ES/DE/FR
- Pseudo-loc audit: consent modals at various viewport widths
- German layout: compliance text at 40% longer fits in modal without scroll
- **CI gate:** Compliance claim validation pass (`check:compliance-claims` includes i18n audit)

**Dependencies:** Compliance audit results finalized by Sprint 60 week 3.

---

### Sprint 62 — v2.9 Compliance (DPIA, SOC 2 Docs, Consent Workflow)

**Product feature:** Data Processing Impact Assessment (DPIA) UI, SOC 2 evidence dashboard, refreshed consent flow, audit export labels.  
**New namespaces:** Extend `admin`, `common`, possibly new `compliance`.  
**Strings scope:** ~35–40 new keys (DPIA section headers, attestation labels, consent flow steps, audit export headers).

**I18N-SPRINT62-01: i18n for Compliance Depth (DPIA + SOC 2 + Consent v2)** | **11 pts**
- EN DPIA attestation labels (3–5 sections × 2–3 fields each = ~15 keys)
- EN SOC 2 evidence dashboard section titles, metric labels (~8 keys)
- EN consent flow wizard headings, descriptive text (~8 keys)
- EN audit export CSV headers, status labels (~5 keys)
- AI drafts for NL/ES/DE/FR
- German layout: DPIA tables at +40%; dashboard metric cards wrap safely; consent wizard at 200% zoom
- Pseudo-loc audit: compliance dashboard grid layout at mobile + desktop
- **CI gate:** Compliance claim validation + i18n coverage 100%

**Dependencies:** Compliance spec frozen by Sprint 61 week 3; consent flow UX approved by Sprint 62 week 1.

---

### Sprint 63 — v2.5 Multi-Region Admin (User Management + Quota UI)

**Product feature:** Regional user admin panel, per-region quota enforcement, team member management polish, billing region view.  
**New namespaces:** Extend `admin`, `team`, `settings`.  
**Strings scope:** ~28–32 new keys (region selector labels, quota progress labels, team role descriptions, billing currency formatting).

**I18N-SPRINT63-01: i18n for Multi-Region Admin** | **10 pts**
- EN region selector labels, region-specific help text (~8 keys)
- EN quota progress labels (% used, limit, renewal date) (~6 keys)
- EN team role grant/revoke UI labels (~6 keys)
- EN billing region summary headers (~4 keys)
- AI drafts for NL/ES/DE/FR (number/currency formatting via Intl API; German +40% text)
- German layout: admin table columns at +40%; quota meter bars wrap safely at 200% zoom
- Pseudo-loc audit: region selector dropdown at high zoom, team member table responsive
- **CI gate:** `check:i18n` pass; no hardcoded currency/number formats in i18n strings

**Dependencies:** Multi-region admin spec frozen by Sprint 62 week 3.

---

### Sprint 64 — v2.5 Multi-Region Admin Follow-through + Partner Portal Prep

**Product feature:** Regional audit export, regional reporting dashboards, partner onboarding prep (partner role, team invitation link generation).  
**New namespaces:** Extend `admin`, `results`, new `partner`.  
**Strings scope:** ~22–26 new keys (audit report headers, regional metrics labels, partner invite email copy, partner dashboard intro).

**I18N-SPRINT64-01: i18n for Regional Audit + Partner Onboarding Prep** | **8 pts**
- EN audit report section headers (3–4 sections with 3–4 fields each = ~15 keys)
- EN partner role description, team invite email subject/body (~6 keys)
- EN partner dashboard welcome message (~2 keys)
- AI drafts for NL/ES/DE/FR
- Email template testing: invite email copy fits within mobile mail clients (80-char wrap) in each language
- German layout: audit report PDF preview at +40%; partner dashboard hero section responsive
- Pseudo-loc audit: partner signup form at 200% zoom
- **CI gate:** i18n coverage 100%; email template preview rendered in each locale

**Dependencies:** Partner portal spec frozen by Sprint 63 week 2.

---

### Sprint 65 — v2.6 Partner Portal (UI Suite + Branded Login)

**Product feature:** Partner dashboard, custom team templates, partner-branded session hosts, SSO integration UI, customer success resources.  
**New namespaces:** Extend `admin`, `dashboard`, new `partner`, `onboarding`.  
**Strings scope:** ~40–45 new keys (partner dashboard sections, template builder labels, branded login copy, SSO setup wizard, resource library titles).

**I18N-SPRINT65-01: i18n for Partner Portal + Branded Login** | **13 pts**
- EN partner dashboard section titles, card labels (~12 keys)
- EN template builder UI (create/edit/delete/duplicate actions) (~8 keys)
- EN branded login copy (admin/partner login distinctions, SSO flow) (~10 keys)
- EN resource library category titles, card headers (~5 keys)
- EN onboarding wizard steps, help text (~8 keys)
- AI drafts for NL/ES/DE/FR
- German layout: partner dashboard cards at +40%; template builder form fields wrap; branded login form responsive at 200% zoom
- Pseudo-loc audit: partner dashboard at tablet + desktop + mobile; template builder drag-and-drop UI responsive
- **CI gate:** `check:i18n` pass; branded login copy copy-review for tone/brand consistency before deployment

**Dependencies:** Partner portal spec frozen by Sprint 64 week 2; branded login copy approved by marketing by Sprint 65 week 1.

---

### Sprint 66 — v2.6 Partner Portal Hardening + v2.7 Zero-Knowledge v2 Prep

**Product feature:** Partner analytics export, partner-team reconciliation, partner audit logs, ZK v2 mode (enhanced anonymity with entropy proof, session-level audit trail obfuscation).  
**New namespaces:** Extend `admin`, `partner`, new `zk-v2`.  
**Strings scope:** ~24–28 new keys (partner export labels, ZK v2 mode selector, entropy proof explanation, audit obfuscation toggle).

**I18N-SPRINT66-01: i18n for Partner Analytics + ZK v2 Modes** | **10 pts**
- EN partner export format selector, column headers (~10 keys)
- EN ZK v2 mode descriptions (entropy mode, session audit obfuscation) (~6 keys)
- EN audit obfuscation toggle help text (~3 keys)
- EN reconciliation status messages (~4 keys)
- AI drafts for NL/ES/DE/FR
- German layout: export format selector labels at +40%; ZK v2 mode descriptions in modal at 200% zoom
- Pseudo-loc audit: partner export dialog at various widths; ZK v2 selector in session config
- **CI gate:** i18n coverage 100%; compliance claim validation for ZK v2 privacy statements

**Dependencies:** ZK v2 spec frozen by Sprint 65 week 3; partner export schema finalized by Sprint 66 week 1.

---

### Sprint 67 — v2.7 Zero-Knowledge v2 Depth + Participant Privacy Dashboard

**Product feature:** ZK v2 participant trust score, privacy dashboard, participant data deletion UI, PII audit trail obfuscation (participant-facing).  
**New namespaces:** Extend `zk-v2`, `settings`, `common`.  
**Strings scope:** ~30–35 new keys (trust score explanation, privacy dashboard sections, deletion confirmation, obfuscation status, privacy notice updates).

**I18N-SPRINT67-01: i18n for ZK v2 Participant Privacy** | **12 pts**
- EN trust score scale labels (very high → very low, with explanations) (~8 keys)
- EN privacy dashboard section titles, stat labels (~8 keys)
- EN data deletion confirmation copy, warning messages (~6 keys)
- EN obfuscation status labels (pending/active/archived) (~4 keys)
- EN privacy policy snippet updates (~2 keys)
- AI drafts for NL/ES/DE/FR
- German layout: privacy dashboard at +40%; trust score explanation modal wraps safely at 200% zoom; deletion confirmation fits on mobile
- Pseudo-loc audit: privacy dashboard responsive; trust score modal at high zoom
- **CI gate:** i18n coverage 100%; privacy statement compliance validation

**Dependencies:** ZK v2 privacy UX spec frozen by Sprint 66 week 3.

---

### Sprint 68 — v2.7 ZK v2 Compliance Review + v2.8 AI Copilot Feature Start

**Product feature:** ZK v2 GDPR attestation refresh, participant-facing privacy audit export, early AI copilot wireframes (coaching hints, skill badges).  
**New namespaces:** Extend `zk-v2`, possibly new `coaching`.  
**Strings scope:** ~16–20 new keys (GDPR attestation updates, privacy audit export headers, coaching UI labels).

**I18N-SPRINT68-01: i18n for ZK v2 Attestation + Coaching Hints** | **7 pts**
- EN GDPR attestation refresh (1–2 sections, ~5 keys)
- EN privacy audit export headers, column names (~5 keys)
- EN coaching hint labels, badge descriptions (~6 keys)
- AI drafts for NL/ES/DE/FR
- German layout: attestation section at +40%; coaching badges in session interface
- Pseudo-loc audit: coaching hints tooltip at 200% zoom
- **CI gate:** GDPR compliance claim validation; i18n coverage 100%

**Dependencies:** ZK v2 attestation updates by Sprint 68 week 1; coaching hints spec finalized by Sprint 68 week 2.

---

### Sprint 69 — v2.8 AI Copilot Expansion + Moderation Enhancements

**Product feature:** AI copilot conversation logging (presenter-side coaching history), real-time moderation suggestions (inappropriate content flags), participant engagement scoring.  
**New namespaces:** Extend `copilot`, `admin`, `present`.  
**Strings scope:** ~26–30 new keys (copilot history panel labels, moderation alert copy, engagement score descriptions, coaching export headers).

**I18N-SPRINT69-01: i18n for AI Copilot Logging + Moderation** | **11 pts**
- EN copilot history panel section titles, filter labels (~8 keys)
- EN moderation alert messages (severity levels, action prompts) (~8 keys)
- EN engagement score scale labels and explanations (~6 keys)
- EN coaching export headers, summary labels (~4 keys)
- AI drafts for NL/ES/DE/FR
- German layout: copilot history panel at +40%; moderation alert toasts wrap safely at mobile; engagement score card at 200% zoom
- Pseudo-loc audit: moderation dashboard at tablet/mobile; copilot history panel scrollable at high zoom
- **CI gate:** i18n coverage 100%; moderation message tone review (professional, non-accusatory)

**Dependencies:** Copilot logging spec by Sprint 68 week 3; moderation copy approved by compliance by Sprint 69 week 1.

---

### Sprint 70 — v2.9 Compliance Release + i18n Polish Sprint

**Product feature:** Compliance evidence dashboard finalization, breach notification templates, session data residency config, final GDPR/CCPA/HIPAA attestations.  
**New namespaces:** Extend `admin`, `compliance`, possibly `legal`.  
**Strings scope:** ~28–32 new keys (breach notification email copy, residency config options, compliance attestation headers, legal copy).

**I18N-SPRINT70-01: i18n for Final Compliance Suite + Legal Copy** | **13 pts**
- EN breach notification email templates (subject, body, action CTA, footer) (~8 keys)
- EN data residency selector options and help text (~5 keys)
- EN compliance attestation matrix headers, status badges (~6 keys)
- EN legal copy snippets (privacy policy, terms addendum, CCPA notice) (~6 keys)
- EN i18n infrastructure polish (deprecation of old keys, namespace cleanup) (~2 keys)
- AI drafts for NL/ES/DE/FR
- Email template testing: breach notification email fits mobile mail clients in all locales
- German layout: compliance attestation matrix at +40%; residency selector at 200% zoom; legal copy in footer responsive
- Pseudo-loc audit: legal copy footer at mobile + desktop; compliance dashboard final pass
- **CI gate:** i18n coverage 100%; compliance claim validation final gate; email template preview rendered in all locales
- **Deprecation cleanup:** Remove old compliance keys from Sprint 62 (if not removed earlier); mark Sprint 60–69 keys for Wave 3 EOL (Sprint 75+)

**Dependencies:** Breach notification templates by Sprint 69 week 3; legal copy approved by counsel by Sprint 70 week 1.

---

## Workload Summary

| Sprint | Feature | Pts | New strings | Namespaces | Review cycle (business days) |
|--------|---------|-----|-------------|-----------|---------------------------|
| 60 | AI Copilot | 9 | ~25–30 | copilot, admin, results | 5–7 |
| 61 | Compliance Audit Findings | 6 | ~8–12 | common, admin | 3–5 |
| 62 | Compliance Depth (DPIA, SOC 2, Consent v2) | 11 | ~35–40 | compliance, admin, common | 7–10 |
| 63 | Multi-Region Admin (User + Quota) | 10 | ~28–32 | admin, team, settings | 5–7 |
| 64 | Regional Audit + Partner Prep | 8 | ~22–26 | admin, results, partner | 5–7 |
| 65 | Partner Portal + Branded Login | 13 | ~40–45 | partner, admin, dashboard, onboarding | 7–10 |
| 66 | Partner Analytics + ZK v2 Modes | 10 | ~24–28 | partner, zk-v2, admin | 5–7 |
| 67 | ZK v2 Participant Privacy | 12 | ~30–35 | zk-v2, settings, common | 7–10 |
| 68 | ZK v2 Attestation + Coaching Hints | 7 | ~16–20 | zk-v2, coaching | 3–5 |
| 69 | AI Copilot Logging + Moderation | 11 | ~26–30 | copilot, admin, present | 7–10 |
| 70 | Final Compliance + Legal Copy | 13 | ~28–32 | compliance, admin, legal | 7–10 |
| **Total (11 sprints)** | — | **110 pts** | **~321–385 strings** | **10–12 total** | **~63–92 days** |

**Per-sprint average:** 10 pts (min 6, max 13)  
**Strings per sprint average:** 29–35 new keys  
**Average review cycle per sprint:** 5–9 business days (native speaker bottleneck typical)

---

## CI Gate Requirements (per Sprint)

**All I18N-SPRINT##-01 stories must meet these gates before merge:**

1. **`npm run check:i18n`** — zero missing keys in any language; no empty values; no duplicate keys within namespace
2. **Key naming audit** — all new keys follow semantic camelCase dot-path convention (never full sentences)
3. **AI draft marking** — all non-EN translations include `// AI draft` comment in JSON; reviewed + approved or explicitly deferred
4. **German layout validation** — tested at 100% and 200% zoom; no truncation, no overflow; all text containers use min-width/min-height
5. **Pseudo-localization audit** — representative page preview in German shows safe wrapping, readable typography, no UI breakage
6. **PII audit** — no user emails, real names, API keys, or personally identifiable info in any string
7. **Email template preview** — if sprint includes email strings, render HTML preview in EN/NL/DE/FR/ES (mail clients wrap at 80 chars)
8. **Compliance claim validation** (S62+) — if sprint includes compliance/privacy statements, `npm run check:compliance-claims` passes
9. **Number/Date/Currency formatting** — no hardcoded formats in i18n strings; Intl API usage verified in code review
10. **Tone & brand consistency** — marketing-facing copy (branded login, partner portal, legal) reviewed by PO + brand lead before deployment

---

## Rollout & Native Speaker Coordination

**Sprint 60–70 i18n capacity plan:**

| Phase | Timeline | Staffing | Deliverable |
|-------|----------|----------|------------|
| **EN extraction + AI draft generation** | Sprint start → +3 days | i18n engineer | Public locales JSONs, all namespaces updated, AI drafts marked `// AI draft` |
| **Native speaker review (5 langs)** | Sprint +3 → +9 days | NL/ES/DE/FR reviewers (1–2 per language) | Approval/revisions, AI draft acceptance, final sign-off |
| **Layout audit + Pseudo-loc test** | Sprint +8 → +11 days | i18n engineer + QA | German 100%/200% zoom verification, pseudo-locale cleanup, no regression |
| **CI gate + merge** | Sprint +11 → +12 days | i18n engineer | `check:i18n` ✅, compliance claim validation ✅, PR merged |

**Critical path:** AI draft review is the bottleneck (5–7 business days). Plan feature strings finalization by mid-sprint to allow full review cycle before sprint close.

---

## Namespace Usage (Sprints 60–70)

**Existing (no new creation expected):**
- `common` — shared UI labels, buttons, errors (extended with compliance/privacy terminology)
- `admin` — admin panel, team management, billing (heavily extended with multi-region, partner, compliance)
- `settings` — user/team settings (extended with privacy dashboard, ZK v2 toggles)
- `dashboard` — team dashboard (extended with partner dashboard, regional views)
- `present` — presenter UI (extended with AI copilot coaching hints, moderation alerts)
- `vote` — voter UI (extended with ZK v2 trust score, privacy notices)
- `results` — results pages (extended with regional audit exports, partner export formats)

**New (S60–S70):**
- `copilot` — AI coaching UI, conversation history, coaching export (S60, extended S69)
- `compliance` — DPIA, SOC 2, breach notifications, legal copy (S62, extended S70)
- `partner` — partner portal, partner dashboard, partner export (S64, extended S65–66)
- `zk-v2` — ZK v2 modes, trust score, privacy dashboard, attestation (S66, extended S67–68)
- `coaching` — AI coaching hints, skill badges (S68, extended S69)
- `legal` — legal copy snippets (S70)

**Rationale:** One new namespace per 2–3 sprints avoids complexity sprawl; grouping ZK v2 + compliance features keeps related strings proximate.

---

## Risk & Mitigation

### Risk: Native Speaker Review Bottleneck
**Likelihood:** High (5–7 day cycle × 4 languages = compounding delay)  
**Mitigation:**
- Batch review by language (NL group, DE group, ES group, FR group)
- Provide native reviewers with glossary + tone guide by Sprint 59 week 4
- Hire part-time contractor for S65–70 (partner portal + compliance copy high volume)
- Pre-stage AI drafts for review by end of Sprint +2 (before dev finalization)

### Risk: German Layout Failures (Overage)
**Likelihood:** Medium (new namespaces with long strings: compliance, legal copy, coaching)  
**Mitigation:**
- German pseudo-locale test mandatory for every sprint (non-negotiable gate)
- Require min-width/min-height on all text containers at design review (S60 week 1)
- Allocate 2 pts per sprint for German layout remediation if overage detected
- Mobile viewport testing (375px breakpoint) for S65+ (partner portal, S70 legal)

### Risk: Compliance String Churn (GDPR/CCPA Updates)
**Likelihood:** High (ongoing regulatory pressure through S70)  
**Mitigation:**
- Lock compliance copy 1 week before sprint close (no late edits)
- Establish compliance review SLA: 3 business days max for legal review
- Deprecation workflow ready (Sprint 70 cleanup for Wave 3 EOL)
- Compliance strings versioned by date (e.g., `compliance.gdpr.attestation_2026_06`, not `2026_07`)

### Risk: Feature Scope Creep
**Likelihood:** Medium (partner portal, AI copilot historically expand mid-sprint)  
**Mitigation:**
- String freeze 2 weeks before sprint end (feature branches locked)
- Out-of-scope strings tagged `// FUTURE_SPRINT_##` for next cycle
- Backlog hygiene every 2 sprints: audit `// AI draft` comments, close deferred reviews

---

## Acceptance & Sign-Off

**Each I18N-SPRINT##-01 story requires sign-off from:**
1. **i18n engineer** — CI gates pass, no missing keys, German layout verified, PII audit clean
2. **Native speaker (per language)** — all AI drafts reviewed and approved (or explicitly deferred + rationale)
3. **Product Owner** — feature strings match product spec, tone/copy approved
4. **QA / Release Manager** — i18n strings packaged with product feature PR, no blocking issues

**Definition of Done (i18n portion):**
- ✅ `npm run check:i18n` zero errors
- ✅ German 100%/200% zoom tested; zero truncation
- ✅ All AI drafts reviewed by native speaker (or explicitly deferred with rationale)
- ✅ Pseudo-locale audit passed
- ✅ No PII, no hardcoded formats, all Intl APIs verified
- ✅ Compliance strings validated (S62+)
- ✅ Email templates tested in mail clients (S64+)
- ✅ PR merged to main; no follow-up i18n rework anticipated until Wave 3+ cycle

---

## Long-Term Roadmap (S71+)

**Wave 3 (S71–S75):** Mobile-first i18n (PWA viewport testing), BIDI language support (Arabic, Hebrew placeholder), voice/audio i18n (speech synthesis, accessibility).  
**Wave 4 (S76+):** Regional CDN caching for i18n bundles (reduce TTFB), auto-generated glossary from key naming, contextual help i18n (tooltips, modals).

**Deprecation Calendar:**
- **S75:** Remove all Sprint 60 `// AI draft` comments (either finalized or deleted)
- **S80:** Remove compliance keys from S62 if superseded by newer attestations

---

## Appendix: Template (copy for new sprints)

```markdown
## I18N-SPRINT##-01: i18n for {feature} in 5 locales

**Feature:** {product epic/story ID and title}  
**Window:** {Sprint ## start → end}  
**Deliverable:** All UI strings extracted to `public/locales/en/{namespace}.json`; AI-drafted for NL/ES/DE/FR; marked `// AI draft` for native speaker review.

**Strings scope:** ~{X–Y} new keys in namespace(s): {list}.

**Acceptance Criteria:**
- [ ] All new strings added to EN; follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes (zero missing keys, no empty values, no duplicates)
- [ ] German layout tested at 100% and 200% zoom: no truncation, no overflow
- [ ] Pseudo-localization audit passed
- [ ] No PII in any translation
- [ ] All AI drafts reviewed by native speaker (NL/ES/DE/FR) and approved

**Effort:** {X} pts

**Dependencies:** {list of product blockers, spec freezes, native speaker availability}

**Compliance notes:** {if S62+, list any compliance/privacy statements requiring legal review}
```
