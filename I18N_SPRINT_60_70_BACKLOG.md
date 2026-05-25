---
id: I18N_SPRINT_60_70_BACKLOG
type: backlog
domain: i18n
category: stories
status: draft
version: 1.0
created: 2026-05-25
updated: 2026-05-25
tags:
  - i18n
  - backlog
  - stories
  - translation
relates_to:
  - I18N_SPRINT_60_70_PLAN
  - BACKLOG_MASTER
---

# i18n Backlog — Sprints 60–70 (Story Cards)

## I18N-SPRINT60-01: i18n for AI Copilot

**Epic:** v2.8 AI Copilot  
**Feature:** AI conversation coaching (copilot suggestions during session), participant skill assessment, coaching export.  
**Sprint:** 60 | **Pts:** 9 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/copilot.json` (new namespace)
  - [ ] Copilot prompt labels (e.g., `prompt.suggestQuestion`, `prompt.engagementTip`)
  - [ ] Assessment headers (e.g., `assessment.skillScore`, `assessment.improvementArea`)
  - [ ] Export field labels (e.g., `export.coachingLog`, `export.skillSummary`)
  - [ ] Toast messages (e.g., `toast.copilotReady`, `toast.assessmentComplete`)
  - [ ] Moderation cues (e.g., `moderate.flagInappropriate`, `moderate.resolveFlag`)
- [ ] Strings follow semantic camelCase dot-path convention (never full sentences)
- [ ] Non-EN translations (NL/ES/DE/FR) generated via Workers AI, marked `// AI draft` in JSON comments
- [ ] `npm run check:i18n` passes: zero missing keys in `copilot.json`, no empty values, no duplicates
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Copilot message bubbles wrap safely at +40% text length
  - [ ] Assessment card labels fit container without truncation
  - [ ] No overflow on mobile viewport (375px min-width)
- [ ] Pseudo-localization audit passed: representative session page with copilot suggestions in German preview
- [ ] No PII in any translation (no user names, email addresses, session IDs)
- [ ] All AI drafts reviewed and approved by native speaker (NL/ES/DE/FR) or explicitly deferred with rationale
- [ ] `npm run check:i18n` final pass before PR merge (CI gate)

### Dependencies
- Product spec (copilot feature) finalized by Sprint 59 week 3
- Copilot feature branch ready for i18n integration by Sprint 60 week 1
- Native speakers available for 5–7 day review cycle (S60 +3 to +9 days)

### Technical Notes
- New namespace: `copilot.json` (mirrors structure of existing `admin.json`, `present.json`)
- Estimated 25–30 new keys
- Assessment export uses Intl.DateTimeFormat (locale-aware date formatting)
- Coaching log timestamps use `Intl.DateTimeFormat(..., { dateStyle: 'short', timeStyle: 'short' })`
- Email export subject line should use `export.coachingLogEmail.subject` key

### Review Checklist
- [ ] i18n engineer: EN strings complete, AI drafts generated
- [ ] NL native speaker: AI draft reviewed, approved
- [ ] ES native speaker: AI draft reviewed, approved
- [ ] DE native speaker: AI draft reviewed, approved; layout tested 100%/200% zoom
- [ ] FR native speaker: AI draft reviewed, approved
- [ ] Product Owner: tone/content matches spec, no unexpected strings
- [ ] QA: Pseudo-locale test passed, no UI regression

---

## I18N-SPRINT61-01: i18n for Compliance Audit Findings

**Epic:** v2.8 AI Copilot (Sprint 61 phase)  
**Feature:** Compliance audit bug fixes, compliance statement refresh (audit findings), consent label updates.  
**Sprint:** 61 | **Pts:** 6 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All updates to `public/locales/en/common.json` and `public/locales/en/admin.json`
  - [ ] Compliance disclaimer updates (1–2 keys)
  - [ ] Consent flow label refresh (2–3 keys)
  - [ ] Copilot error messages from Sprint 60 feedback (2–3 keys)
  - [ ] Revised privacy notice snippets (1–2 keys)
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes (all keys complete, no empty values)
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Compliance modals fit mobile viewport
  - [ ] Consent flow at +40% text length wraps safely
- [ ] Pseudo-localization audit: consent modal at various viewport widths
- [ ] No PII in any translation
- [ ] All AI drafts reviewed by native speakers
- [ ] `npm run check:compliance-claims` passes (compliance audit validation)

### Dependencies
- Compliance audit results finalized by Sprint 60 week 3
- Consent flow UX approved by PO by Sprint 61 week 1
- Native speakers available for 3–5 day review cycle

### Technical Notes
- Update existing namespaces (no new namespace)
- Estimated 8–12 new keys (mostly replacements/additions to `common.json`)
- Compliance claim CI gate: ensures public copy matches backend implementation

### Review Checklist
- [ ] i18n engineer: EN strings updated, audit findings incorporated
- [ ] Native speakers (4 languages): AI draft approved
- [ ] DE speaker: layout validated
- [ ] Product Owner: compliance statement accuracy confirmed
- [ ] Compliance Officer: updated copy approved

---

## I18N-SPRINT62-01: i18n for Compliance Depth (DPIA + SOC 2 + Consent v2)

**Epic:** v2.9 Compliance  
**Feature:** Data Processing Impact Assessment (DPIA) UI, SOC 2 evidence dashboard, refreshed consent flow, audit export labels.  
**Sprint:** 62 | **Pts:** 11 | **Pri:** P0  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to new namespace `public/locales/en/compliance.json` and extend `public/locales/en/admin.json`
  - [ ] DPIA section headers (3–5 sections × 2–3 fields = ~15 keys)
  - [ ] DPIA attestation labels (e.g., `dpia.riskAssessment`, `dpia.mitigationStrategy`)
  - [ ] SOC 2 evidence dashboard titles, metric labels (~8 keys)
  - [ ] Consent flow v2 wizard headings, descriptive text (~8 keys)
  - [ ] Audit export CSV headers, status labels (~5 keys)
- [ ] Strings follow semantic camelCase dot-path convention (never full sentences)
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys in `compliance.json`, no empty values, no duplicates
- [ ] German layout tested at 100% and 200% zoom
  - [ ] DPIA tables at +40% text length render without column compression
  - [ ] Dashboard metric cards wrap safely on mobile and desktop
  - [ ] Consent wizard at 200% zoom: all steps readable, CTAs accessible
- [ ] Pseudo-localization audit: compliance dashboard grid layout, consent modal at mobile + desktop
- [ ] No PII in any translation
- [ ] All AI drafts reviewed by native speakers
- [ ] `npm run check:compliance-claims` passes before merge (compliance validation)

### Dependencies
- Compliance spec finalized by Sprint 61 week 3
- Consent flow UX approved by Sprint 62 week 1
- DPIA template structure frozen by Sprint 62 week 1
- Native speakers available for 7–10 day review cycle
- Legal review SLA: 3 business days for compliance copy approval

### Technical Notes
- New namespace: `compliance.json` (mirrored structure in all 5 locales)
- Estimated 35–40 new keys
- DPIA export uses locale-aware number formatting: `Intl.NumberFormat(locale).format(percentage)`
- SOC 2 metric labels use `Intl.RelativeTimeFormat` for "X days ago" relative timestamps
- Consent flow includes pluralization for "Step 1 of N" — use i18next `_one`/`_other` pattern

### Review Checklist
- [ ] i18n engineer: EN strings complete, AI drafts generated, compliance keys isolated in new namespace
- [ ] NL/ES/DE/FR native speakers: AI draft approved
- [ ] DE speaker: layout validation 100%/200% zoom
- [ ] Legal team: compliance statements reviewed and approved
- [ ] Product Owner: DPIA and SOC 2 copy accuracy confirmed
- [ ] QA: Pseudo-locale test passed, export CSV headers render correctly in all locales

---

## I18N-SPRINT63-01: i18n for Multi-Region Admin

**Epic:** v2.5 Multi-Region Admin  
**Feature:** Regional user admin panel, per-region quota enforcement, team member management polish, billing region view.  
**Sprint:** 63 | **Pts:** 10 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/admin.json` (extend), `public/locales/en/team.json` (extend), `public/locales/en/settings.json` (extend)
  - [ ] Region selector labels, region-specific help text (~8 keys)
  - [ ] Quota progress labels (e.g., `quota.percentUsed`, `quota.limitReached`, `quota.renewalDate`) (~6 keys)
  - [ ] Team role grant/revoke UI labels (~6 keys)
  - [ ] Billing region summary headers (~4 keys)
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys, no empty values, no duplicates
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Admin table columns at +40% text length render without overflow
  - [ ] Quota meter bars and percentage labels wrap safely
  - [ ] Region selector dropdown accessible at 200% zoom
- [ ] Pseudo-localization audit: region selector, team member table, quota dashboard at mobile + desktop
- [ ] No hardcoded currency or number formats in i18n strings
  - [ ] All percentage formatting uses `Intl.NumberFormat(locale, { style: 'percent' })`
  - [ ] All currency amounts use `Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })`
- [ ] No PII in any translation
- [ ] All AI drafts reviewed by native speakers

### Dependencies
- Multi-region admin spec finalized by Sprint 62 week 3
- Region list and quota schema locked by Sprint 63 week 1
- Billing currency/region mapping finalized by Sprint 63 week 1
- Native speakers available for 5–7 day review cycle

### Technical Notes
- Extend existing namespaces (no new namespace)
- Estimated 24–28 new keys
- Currency formatting: if Sprint 63 includes only EUR, use hardcoded currency in Intl API; if multi-currency support planned, use `session.billingCurrency` context
- Number formatting for quota: use `Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })`
- Region names (e.g., "EU-West-1", "US-East-1") are not translated — use pass-through keys like `region.identifier.euWest1 = "EU-West-1"`

### Review Checklist
- [ ] i18n engineer: EN strings complete, number/currency formatting audited
- [ ] Native speakers (4 languages): AI draft approved
- [ ] DE speaker: layout validated at multiple zoom levels
- [ ] Product Owner: region/quota copy accuracy confirmed
- [ ] DevOps: region/currency context variables documented for i18n runtime

---

## I18N-SPRINT64-01: i18n for Regional Audit + Partner Onboarding Prep

**Epic:** v2.5 Multi-Region Admin (phase 2) + v2.6 Partner Portal prep  
**Feature:** Regional audit export, regional reporting dashboards, partner onboarding (role, team invitation link generation).  
**Sprint:** 64 | **Pts:** 8 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/admin.json`, `public/locales/en/results.json`, and new `public/locales/en/partner.json`
  - [ ] Audit report section headers (3–4 sections with 3–4 fields = ~15 keys)
  - [ ] Partner role description, team invite email subject/body (~6 keys)
  - [ ] Partner dashboard welcome message (~2 keys)
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes (all languages complete)
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Audit report PDF preview at +40% text length renders without column compression
  - [ ] Partner dashboard hero section responsive at mobile + desktop
- [ ] Pseudo-localization audit: partner signup form at 200% zoom, audit report in mail client preview
- [ ] Email template testing: partner invite email subject and body fit mobile mail client constraints (80-char wrap test)
  - [ ] Subject line ≤ 50 chars (readable in preview)
  - [ ] Body text ≤ 80 chars per line (no forced wrap breaking words)
  - [ ] CTA link text descriptive and visible at high zoom (200%)
- [ ] No hardcoded email formatting; use `Intl.DateTimeFormat` for invite expiry date in email
- [ ] No PII in any translation (no partner names, emails, API tokens)
- [ ] All AI drafts reviewed by native speakers
- [ ] Email template rendered in EN/NL/DE/FR/ES preview (visual regression test)

### Dependencies
- Partner portal spec finalized by Sprint 63 week 2
- Partner role model and permissions frozen by Sprint 64 week 1
- Email template design finalized by Sprint 64 week 1
- Native speakers available for 5–7 day review cycle

### Technical Notes
- New namespace: `partner.json` (prepare for S65 expansion)
- Estimated 22–26 new keys
- Partner invite email: include locale-aware expiry date (e.g., "This link expires on June 15, 2026")
- Team invitation link format: `{APP_URL}/join?token={token}&lang={requestedLang}` — lang param ensures invited user sees UI in their language

### Review Checklist
- [ ] i18n engineer: EN strings complete, new `partner.json` namespace created, email template rendering tested
- [ ] Native speakers (4 languages): AI draft approved
- [ ] DE speaker: layout validated, PDF audit report preview checked
- [ ] Email deliverability team: email template tested in Litmus/Email on Acid for rendering across clients
- [ ] Product Owner: partner role copy and invite messaging tone approved

---

## I18N-SPRINT65-01: i18n for Partner Portal + Branded Login

**Epic:** v2.6 Partner Portal  
**Feature:** Partner dashboard, custom team templates, partner-branded session hosts, SSO integration UI, customer success resources.  
**Sprint:** 65 | **Pts:** 13 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/partner.json` (extend), `public/locales/en/admin.json` (extend), new `public/locales/en/dashboard.json` section, new `public/locales/en/onboarding.json`
  - [ ] Partner dashboard section titles, card labels (~12 keys)
  - [ ] Template builder UI (create/edit/delete/duplicate actions) (~8 keys)
  - [ ] Branded login copy (admin/partner login distinctions, SSO flow) (~10 keys)
  - [ ] Resource library category titles, card headers (~5 keys)
  - [ ] Onboarding wizard steps, help text (~8 keys)
- [ ] Strings follow semantic camelCase dot-path convention (never full sentences)
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys in all updated namespaces
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Partner dashboard cards at +40% text length render without container overflow
  - [ ] Template builder form fields, labels wrap safely on tablet (768px) and mobile (375px)
  - [ ] Branded login form responsive at 200% zoom: inputs accessible, CTA button clickable
- [ ] Pseudo-localization audit: partner dashboard at tablet + desktop + mobile, template builder drag-and-drop responsive, branded login form at multiple breakpoints
- [ ] No hardcoded text in template builder labels (e.g., "Drag to reorder" is i18n-keyed, not hardcoded)
- [ ] No PII in any translation (no partner company names, user emails, internal team identifiers)
- [ ] Branded login copy tone reviewed and approved by PO + marketing (professionalism, brand consistency)
- [ ] All AI drafts reviewed by native speakers
- [ ] `npm run check:i18n` final pass before PR merge

### Dependencies
- Partner portal spec finalized by Sprint 64 week 2
- Branded login copy approved by marketing and PO by Sprint 65 week 1
- Template builder UX finalized by Sprint 65 week 1
- Partner dashboard design finalized by Sprint 65 week 1
- Native speakers available for 7–10 day review cycle

### Technical Notes
- New namespaces: `partner.json` (expand from S64), `onboarding.json` (new)
- Estimated 40–45 new keys (largest single i18n story in arc)
- Template builder actions use verb-noun pattern: `builder.action.create`, `builder.action.edit`, `builder.action.delete`, `builder.action.duplicate`
- Branded login: distinguish between admin login (blue theme) and partner login (partner brand color) using CSS class + data attribute, not i18n copy
- Onboarding wizard: use i18next pluralization for "Step X of N" (`onboarding.step_one`, `onboarding.step_other`)
- Resource library: use category enum (e.g., `resource.category.gettingStarted`, `resource.category.bestPractices`, `resource.category.templates`) — don't hardcode category names

### Review Checklist
- [ ] i18n engineer: EN strings complete, AI drafts generated, new namespaces created, layout tested
- [ ] NL/ES/DE/FR native speakers: AI draft approved
- [ ] DE speaker: layout validated 100%/200% zoom, mobile (375px) responsive
- [ ] Marketing + PO: branded login copy tone approved, brand consistency verified
- [ ] QA: Pseudo-locale test passed, template builder drag-drop responsive in German, onboarding flow text renders correctly
- [ ] Accessibility: template builder labels and resource library links tested with screen reader

---

## I18N-SPRINT66-01: i18n for Partner Analytics + ZK v2 Modes

**Epic:** v2.6 Partner Portal (phase 2) + v2.7 Zero-Knowledge v2 prep  
**Feature:** Partner analytics export, partner-team reconciliation, partner audit logs, ZK v2 mode (enhanced anonymity with entropy proof, session-level audit trail obfuscation).  
**Sprint:** 66 | **Pts:** 10 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/partner.json` (extend), new `public/locales/en/zk-v2.json`
  - [ ] Partner export format selector, column headers (~10 keys)
  - [ ] ZK v2 mode descriptions (entropy mode, session audit obfuscation) (~6 keys)
  - [ ] Audit obfuscation toggle help text (~3 keys)
  - [ ] Reconciliation status messages (~4 keys)
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys in `zk-v2.json`
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Export format selector labels at +40% text length render without overflow
  - [ ] ZK v2 mode descriptions in modal fit viewport at 200% zoom
  - [ ] Reconciliation status messages on dashboard responsive
- [ ] Pseudo-localization audit: partner export dialog at various widths (375px, 768px, 1024px), ZK v2 selector in session config modal
- [ ] No hardcoded export column names; all CSV headers use i18n keys
- [ ] No PII in any translation (no partner org names, user identifiers, session IDs)
- [ ] All AI drafts reviewed by native speakers
- [ ] `npm run check:compliance-claims` passes (ZK v2 privacy statements must not make false claims)

### Dependencies
- ZK v2 spec finalized by Sprint 65 week 3
- Partner export schema locked by Sprint 66 week 1
- Compliance review of ZK v2 privacy claims by Sprint 66 week 2
- Native speakers available for 5–7 day review cycle

### Technical Notes
- New namespace: `zk-v2.json` (ZK v2 UI strings, modes, trust score)
- Estimated 24–28 new keys
- Export CSV headers use namespace pattern: `partner.export.column.sessionTitle`, `partner.export.column.participantCount`, etc.
- ZK v2 modes: `zk.mode.none` (standard anonymity), `zk.mode.entropy` (enhanced with entropy proof), `zk.mode.obfuscated` (audit trail masked)
- Reconciliation status: `reconciliation.status.pending`, `reconciliation.status.complete`, `reconciliation.status.error`
- Compliance validation: ensure no claims like "100% anonymous" or "zero data retention" without evidence

### Review Checklist
- [ ] i18n engineer: EN strings complete, ZK v2 namespace created, export format keys isolated
- [ ] Native speakers (4 languages): AI draft approved
- [ ] DE speaker: layout validated, modal at 200% zoom accessible
- [ ] Compliance officer: ZK v2 privacy statements reviewed; no false claims
- [ ] Product Owner: ZK v2 mode descriptions match spec, export format headers match schema
- [ ] QA: Pseudo-locale test passed, export CSV generated correctly in all locales

---

## I18N-SPRINT67-01: i18n for ZK v2 Participant Privacy

**Epic:** v2.7 Zero-Knowledge v2  
**Feature:** ZK v2 participant trust score, privacy dashboard, participant data deletion UI, PII audit trail obfuscation (participant-facing).  
**Sprint:** 67 | **Pts:** 12 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/zk-v2.json` (extend), `public/locales/en/settings.json` (extend), `public/locales/en/common.json` (extend)
  - [ ] Trust score scale labels (very high → very low, explanations) (~8 keys)
  - [ ] Privacy dashboard section titles, stat labels (~8 keys)
  - [ ] Data deletion confirmation copy, warning messages (~6 keys)
  - [ ] Obfuscation status labels (pending/active/archived) (~4 keys)
  - [ ] Privacy policy snippet updates (~2 keys)
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys in all updated namespaces
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Privacy dashboard at +40% text length renders without column compression
  - [ ] Trust score explanation modal wraps safely at 200% zoom, readable on mobile
  - [ ] Data deletion confirmation fits on mobile (375px viewport), CTA buttons accessible
- [ ] Pseudo-localization audit: privacy dashboard responsive at mobile/tablet/desktop, trust score modal at high zoom, deletion confirmation UX tested
- [ ] Trust score scale values (Very High, High, Medium, Low, Very Low) are translatable keys, not hardcoded
- [ ] No PII in any translation (no session IDs, participant identifiers, audit entry details)
- [ ] Deletion flow uses proper i18next pluralization for "X records will be deleted" (handle singular/plural)
- [ ] All AI drafts reviewed by native speakers
- [ ] `npm run check:compliance-claims` passes (privacy statements must be accurate)

### Dependencies
- ZK v2 privacy UX spec finalized by Sprint 66 week 3
- Privacy dashboard design frozen by Sprint 67 week 1
- Data deletion flow approved by legal/compliance by Sprint 67 week 1
- Native speakers available for 7–10 day review cycle

### Technical Notes
- Extend `zk-v2.json` with participant-facing strings
- Estimated 30–35 new keys
- Trust score scale: use ordinal enum keys (`trustScore.veryHigh`, `trustScore.high`, `trustScore.medium`, `trustScore.low`, `trustScore.veryLow`)
- Privacy dashboard stats: `privacy.stat.sessionsAttended`, `privacy.stat.dataCollected`, `privacy.stat.deletionRequests`
- Deletion confirmation: use i18next pluralization — `deletion.confirmMessage_one: "This will delete {{count}} record."`, `deletion.confirmMessage_other: "This will delete {{count}} records."`
- Obfuscation status transition: pending → active → archived (show status in UI with locale-aware timestamp)

### Review Checklist
- [ ] i18n engineer: EN strings complete, trust scale enum keys isolated, deletion pluralization verified
- [ ] NL/ES/DE/FR native speakers: AI draft approved
- [ ] DE speaker: layout validated at 100%/200% zoom, mobile responsiveness checked
- [ ] Legal/Compliance: privacy policy snippet and deletion copy approved
- [ ] Product Owner: privacy dashboard copy accuracy confirmed, trust score scale descriptions reviewed
- [ ] QA: Pseudo-locale test passed, deletion flow tested in German at mobile viewport, data deletion actually deletes correct records

---

## I18N-SPRINT68-01: i18n for ZK v2 Attestation + Coaching Hints

**Epic:** v2.7 ZK v2 (phase 2) + v2.8 AI Copilot prep  
**Feature:** ZK v2 GDPR attestation refresh, participant-facing privacy audit export, early AI copilot wireframes (coaching hints, skill badges).  
**Sprint:** 68 | **Pts:** 7 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/zk-v2.json` (extend), new `public/locales/en/coaching.json`
  - [ ] GDPR attestation refresh (1–2 sections, ~5 keys)
  - [ ] Privacy audit export headers, column names (~5 keys)
  - [ ] Coaching hint labels, badge descriptions (~6 keys)
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys in both namespaces
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Attestation section at +40% text length renders safely
  - [ ] Coaching badges in session interface display correctly (text not truncated, badge icon visible)
- [ ] Pseudo-localization audit: attestation section, coaching hints tooltip at 200% zoom
- [ ] GDPR attestation copy verified by legal/compliance (no false claims)
- [ ] No PII in export headers or coaching strings (no session IDs, user names)
- [ ] All AI drafts reviewed by native speakers

### Dependencies
- ZK v2 attestation updates finalized by Sprint 68 week 1
- Coaching hints spec by Sprint 68 week 2
- Legal review of attestation updates by Sprint 68 week 2
- Native speakers available for 3–5 day review cycle

### Technical Notes
- New namespace: `coaching.json` (coach-related UI strings, hints, badges)
- Estimated 16–20 new keys
- Privacy audit export: CSV headers use namespace `zk-v2.export.column.*`
- Coaching badges: predefined types (e.g., `coaching.badge.engagement`, `coaching.badge.creativity`, `coaching.badge.leadership`) — don't allow freeform badge names
- Coaching hints: appear as tooltips on hover; text should be concise (≤ 60 chars in EN, ≤ 80 chars in DE)
- GDPR attestation: reference specific compliance framework (e.g., "GDPR Article 5 - Data minimization") in keys but not in display text

### Review Checklist
- [ ] i18n engineer: EN strings complete, coaching namespace created, attestation keys isolated
- [ ] Native speakers (4 languages): AI draft approved
- [ ] DE speaker: layout validated, coaching badge text at high zoom
- [ ] Legal/Compliance: GDPR attestation reviewed; no discrepancies with backend implementation
- [ ] Product Owner: coaching hint copy tone approved
- [ ] QA: Pseudo-locale test passed, coaching badge tooltips render correctly at 200% zoom

---

## I18N-SPRINT69-01: i18n for AI Copilot Logging + Moderation

**Epic:** v2.8 AI Copilot (phase 2)  
**Feature:** AI copilot conversation logging (presenter-side coaching history), real-time moderation suggestions (inappropriate content flags), participant engagement scoring.  
**Sprint:** 69 | **Pts:** 11 | **Pri:** P1  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/copilot.json` (extend), `public/locales/en/admin.json` (extend), `public/locales/en/present.json` (extend)
  - [ ] Copilot history panel section titles, filter labels (~8 keys)
  - [ ] Moderation alert messages (severity levels, action prompts) (~8 keys)
  - [ ] Engagement score scale labels and explanations (~6 keys)
  - [ ] Coaching export headers, summary labels (~4 keys)
- [ ] Strings follow semantic camelCase dot-path convention
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys in all updated namespaces
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Copilot history panel at +40% text length scrolls safely, no truncation
  - [ ] Moderation alert toasts wrap safely on mobile (375px viewport)
  - [ ] Engagement score card displays correctly at 200% zoom
- [ ] Pseudo-localization audit: moderation dashboard at tablet/mobile, copilot history panel scrollable at high zoom, engagement score display responsive
- [ ] Moderation alert copy is professional and non-accusatory (not "inappropriate user", but "this message may need review")
- [ ] Engagement score scale uses ordinal enum keys (Very Low, Low, Medium, High, Very High)
- [ ] No PII in any translation (no participant names, email addresses, specific content quoted)
- [ ] Moderation message tone reviewed and approved by compliance/legal
- [ ] All AI drafts reviewed by native speakers

### Dependencies
- Copilot logging spec by Sprint 68 week 3
- Moderation copy approved by compliance and tone by Sprint 69 week 1
- Engagement score schema locked by Sprint 69 week 1
- Native speakers available for 7–10 day review cycle

### Technical Notes
- Extend `copilot.json` with logging history and moderation strings
- Estimated 26–30 new keys
- Moderation alert severity: `moderation.alert.severity.low`, `moderation.alert.severity.medium`, `moderation.alert.severity.high`
- Moderation action prompts: `moderation.action.review`, `moderation.action.remove`, `moderation.action.ban` — include help text explaining each action
- Engagement score scale: `engagement.score.veryLow`, `engagement.score.low`, `engagement.score.medium`, `engagement.score.high`, `engagement.score.veryHigh`
- Copilot history filter: allow filtering by date range, coaching type (suggestion, assessment, export) — use i18n keys for filter labels
- Coaching export summary includes statistics (e.g., "Total suggestions: 42", "Avg response time: 2.3s") — use locale-aware number formatting

### Review Checklist
- [ ] i18n engineer: EN strings complete, moderation copy isolated, engagement score enum keys created
- [ ] NL/ES/DE/FR native speakers: AI draft approved
- [ ] DE speaker: layout validated, moderation toast at mobile, engagement card at high zoom
- [ ] Compliance/Legal: moderation alert copy reviewed; tone is professional and defensible
- [ ] Product Owner: engagement score scale descriptions match product intent, coaching export format approved
- [ ] QA: Pseudo-locale test passed, moderation dashboard usable in German, copilot history filter works in all locales

---

## I18N-SPRINT70-01: i18n for Final Compliance Suite + Legal Copy

**Epic:** v2.9 Compliance (final phase)  
**Feature:** Compliance evidence dashboard finalization, breach notification templates, session data residency config, final GDPR/CCPA/HIPAA attestations.  
**Sprint:** 70 | **Pts:** 13 | **Pri:** P0  
**Status:** Ready for backlog  

### Acceptance Criteria

- [ ] All new strings added to `public/locales/en/compliance.json` (extend), new `public/locales/en/legal.json`
  - [ ] Breach notification email templates (subject, body, action CTA, footer) (~8 keys)
  - [ ] Data residency selector options and help text (~5 keys)
  - [ ] Compliance attestation matrix headers, status badges (~6 keys)
  - [ ] Legal copy snippets (privacy policy, terms addendum, CCPA notice) (~6 keys)
  - [ ] i18n infrastructure polish (deprecation of old keys, namespace cleanup) (~2 keys)
- [ ] Strings follow semantic camelCase dot-path convention (never full sentences; legal copy uses ref keys to external docs)
- [ ] Non-EN translations generated via Workers AI, marked `// AI draft`
- [ ] `npm run check:i18n` passes: zero missing keys in both namespaces, no empty values, no duplicates
- [ ] German layout tested at 100% and 200% zoom
  - [ ] Compliance attestation matrix at +40% text length renders without column compression
  - [ ] Data residency selector at 200% zoom; options readable and selectable
  - [ ] Legal copy footer responsive at mobile (375px) and desktop (1200px+)
- [ ] Pseudo-localization audit: compliance dashboard final pass, legal copy footer at mobile + desktop, breach notification email template rendered in mail clients (Outlook, Gmail, Apple Mail)
- [ ] Email template testing: breach notification email fits mobile mail client constraints
  - [ ] Subject line ≤ 50 chars (readable in preview)
  - [ ] Body text ≤ 80 chars per line (mobile-friendly wrap)
  - [ ] CTA link visible and clickable at high zoom (200%)
  - [ ] Template rendered correctly in EN/NL/DE/FR/ES (no encoding issues)
- [ ] Breach notification copy is clear, compassionate, and compliant with breach notification regulations
- [ ] Legal copy references are externally maintained (no copy-pasting; use ref keys pointing to legal.com or docs.qesto.cc)
- [ ] No PII in any translation (no breach victim details, no sensitive data listed)
- [ ] Deprecation cleanup: old compliance keys from Sprint 62 removed or marked for Wave 3 EOL (Sprint 75+)
- [ ] All AI drafts reviewed by native speakers
- [ ] `npm run check:compliance-claims` final pass before PR merge
- [ ] `npm run check:i18n` final pass before PR merge (CI gate)

### Dependencies
- Breach notification templates by Sprint 69 week 3
- Legal copy approved by counsel by Sprint 70 week 1
- Data residency config finalized by Sprint 70 week 1
- Compliance attestation matrix frozen by Sprint 70 week 1
- Native speakers available for 7–10 day review cycle
- Legal review SLA: 3 business days max for breach notification and legal copy approval

### Technical Notes
- New namespace: `legal.json` (legal-specific strings, policy snippets, terms references)
- Estimated 28–32 new keys
- Breach notification subject: use simple pattern like `breach.notification.subject = "Important: Your account security"` — avoid naming specific breach type
- Breach notification body: use locale-aware date formatting for incident date: `Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(incidentDate)`
- Data residency options: `residency.option.eu`, `residency.option.us`, `residency.option.global` — don't hardcode region names
- Compliance attestation status: `compliance.attestation.status.pending`, `compliance.attestation.status.approved`, `compliance.attestation.status.expired`
- Legal copy links: store URLs in `legal.link.*` keys (e.g., `legal.link.privacyPolicy = "https://qesto.cc/legal/privacy"`), not in display text
- Deprecation: create `I18N_DEPRECATIONS.md` in `docs/` listing Sprint 60 keys to be removed in Sprint 75

### Review Checklist
- [ ] i18n engineer: EN strings complete, legal namespace created, deprecation cleanup documented, AI drafts generated
- [ ] NL/ES/DE/FR native speakers: AI draft approved
- [ ] DE speaker: layout validated 100%/200% zoom, legal footer checked at mobile
- [ ] Email deliverability team: breach notification template tested in Litmus/Email on Acid for all locales
- [ ] Legal/Compliance counsel: breach notification copy reviewed; GDPR/CCPA/HIPAA compliance verified; legal copy accuracy confirmed
- [ ] Product Owner: attestation matrix copy matches backend implementation, data residency options finalized
- [ ] QA: Pseudo-locale test passed, email template rendered in all locales, compliance dashboard usable in German
- [ ] Release Manager: deprecation list reviewed, no orphaned keys remaining in code

---

## Summary by Sprint

| Sprint | Story ID | Pts | Feature | New keys | Namespaces | Review cycle |
|--------|----------|-----|---------|----------|-----------|-------------|
| 60 | I18N-SPRINT60-01 | 9 | AI Copilot | 25–30 | copilot, admin, results | 5–7 d |
| 61 | I18N-SPRINT61-01 | 6 | Compliance Audit | 8–12 | common, admin | 3–5 d |
| 62 | I18N-SPRINT62-01 | 11 | DPIA + SOC 2 + Consent v2 | 35–40 | compliance, admin, common | 7–10 d |
| 63 | I18N-SPRINT63-01 | 10 | Multi-Region Admin | 24–28 | admin, team, settings | 5–7 d |
| 64 | I18N-SPRINT64-01 | 8 | Regional Audit + Partner Prep | 22–26 | admin, results, partner | 5–7 d |
| 65 | I18N-SPRINT65-01 | 13 | Partner Portal + Branded Login | 40–45 | partner, admin, dashboard, onboarding | 7–10 d |
| 66 | I18N-SPRINT66-01 | 10 | Partner Analytics + ZK v2 | 24–28 | partner, zk-v2, admin | 5–7 d |
| 67 | I18N-SPRINT67-01 | 12 | ZK v2 Participant Privacy | 30–35 | zk-v2, settings, common | 7–10 d |
| 68 | I18N-SPRINT68-01 | 7 | ZK v2 Attestation + Coaching | 16–20 | zk-v2, coaching | 3–5 d |
| 69 | I18N-SPRINT69-01 | 11 | AI Copilot Logging + Moderation | 26–30 | copilot, admin, present | 7–10 d |
| 70 | I18N-SPRINT70-01 | 13 | Final Compliance + Legal | 28–32 | compliance, legal, admin | 7–10 d |
| **Total** | — | **110 pts** | — | **321–385** | 12 total | **63–92 d** |

---

## Backlog Hygiene Checklist

Before each sprint, verify:
- [ ] Feature spec finalized (strings locked by sprint -1 week)
- [ ] Namespace structure agreed (new or extend existing)
- [ ] AI draft glossary updated (terminology, tone guide, brand voice)
- [ ] Native speaker capacity confirmed (5–7 day review window available)
- [ ] Legal/compliance review SLA set (3 business days max)
- [ ] German pseudo-locale test setup ready (`npm run i18n:pseudo-gen`)
- [ ] Email template preview tool available (if sprint includes email)
- [ ] CI gate scripts updated (new namespaces, compliance checks, PII audit)
- [ ] Deprecation calendar tracked (`docs/I18N_DEPRECATIONS.md`)

---

## Out of Scope (S60–S70)

- Mobile-first i18n (PWA viewport optimization) — Wave 3 (S71+)
- BIDI language support (Arabic, Hebrew) — Wave 3 (S75+)
- Audio/speech i18n (speech synthesis, accessibility) — Wave 3 (S75+)
- Regional CDN caching for i18n bundles — Wave 4 (S76+)
- Auto-generated glossary from key naming — Wave 4 (S76+)
