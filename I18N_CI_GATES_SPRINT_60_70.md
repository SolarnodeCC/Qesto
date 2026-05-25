---
id: I18N_CI_GATES_SPRINT_60_70
type: operational
domain: i18n
category: ci
status: draft
version: 1.0
created: 2026-05-25
updated: 2026-05-25
tags:
  - i18n
  - ci
  - validation
  - gates
relates_to:
  - I18N_SPRINT_60_70_PLAN
  - I18N_SPRINT_60_70_BACKLOG
---

# i18n CI Gates — Sprints 60–70 (Validation & Merge Gates)

_All I18N-SPRINT##-01 PRs must pass these gates before merge._

## Gate 1: Key Completeness & Format

**Command:** `npm run check:i18n`

**Checks:**
- ✅ Zero missing keys in any non-EN language (all 5 locales complete)
- ✅ No empty string values (`""`) in any namespace
- ✅ No duplicate keys within a namespace
- ✅ All new keys follow semantic camelCase dot-path convention
- ✅ Key naming audit: no full sentences in keys (max ~5 words for composite keys)

**Failure action:** Block PR; must fix before re-run.

**Expected output:**
```
✅ Namespace completeness: 100% (all 5 langs, all namespaces)
✅ No empty values detected
✅ No duplicate keys detected
✅ Key format validation: PASS
```

---

## Gate 2: German Layout Compliance (100% + 200% Zoom)

**Command:** Manual pseudo-locale test (automated detection)  
**Trigger:** If PR adds/modifies strings in `copilot`, `compliance`, `partner`, `zk-v2`, `legal` namespaces.

**Checks:**
- ✅ No truncated text (all text containers use `min-width`/`min-height`, not fixed `width`/`height`)
- ✅ No overlapping text or layout shifts
- ✅ All buttons ≥ 44px height (accessible click target)
- ✅ Form inputs ≥ 200px width (readable in German +40% length)
- ✅ Mobile viewport (375px) renders without forced horizontal scroll
- ✅ 200% zoom: all text readable, CTAs accessible, no UI breakage

**Test procedure:**
```bash
# 1. Generate pseudo-locale (DE-simulated)
npm run i18n:pseudo-gen > public/locales/qxx/common.json

# 2. Switch to ?lang=qxx in dev browser

# 3. Visual checklist at 100% zoom:
#    - Session config: title field not truncated
#    - Voting interface: question text readable
#    - Dashboard: all cards visible, table columns not compressed
#    - Modals: buttons not cramped, overlay text fits

# 4. Zoom to 200%:
#    - Page still readable (no vertical scroll if avoidable)
#    - No horizontal scroll (unless intentional, e.g., wide table)
#    - All interactive elements clickable at high zoom
```

**Failure action:** Block PR; require layout fixes (min-width/min-height adjustments, container resizing, responsive breakpoints).

**Evidence:** Screenshot of pseudo-locale page at 100% and 200% zoom, showing no truncation or overflow.

---

## Gate 3: AI Draft Marking & Native Speaker Review

**Command:** Manual review + comment parsing

**Checks:**
- ✅ All non-EN translations include `// AI draft` comment in JSON (machine-generated only)
- ✅ All AI drafts reviewed by corresponding native speaker
- ✅ Native speaker approval recorded (PR comment or checklist ✅)
- ✅ Or explicitly deferred with rationale (e.g., "defer to S61 for native review due to late spec change")

**Format:**
```json
{
  "en": {
    "session.title.label": "Session title"
  },
  "de": {
    "session.title.label": "Sitzungstitel",  // AI draft — reviewed and approved by DE speaker
    // OR
    "session.title.label": "Sitzungstitel",  // AI draft — DEFER to S61 (late spec change)
  }
}
```

**Failure action:** Block PR if AI drafts present without native speaker comment. Approved AI drafts may be merged; deferred AI drafts must be tracked in backlog for next sprint.

**Evidence:** PR comment or checklist showing native speaker sign-off (e.g., "✅ DE review complete by @native-speaker-de").

---

## Gate 4: PII Audit

**Command:** `npm run check:pii-log` (scans public/locales/ for patterns)

**Checks:**
- ✅ No user email addresses (pattern: `*@*.com`, `*@*.org`, etc.)
- ✅ No real user names (checked against hardcoded deny list: "John", "Mary", "Alice", "Bob", etc.)
- ✅ No API keys, tokens, or secrets (pattern: `sk_*`, `pk_*`, `Bearer `)
- ✅ No session IDs or personally identifiable identifiers (pattern: `uuid-`, `sess-`, `user-`, etc.)
- ✅ No specific participant data quoted in translation strings

**Failure action:** Block PR; must remove or redact PII.

**Expected output:**
```
✅ No email addresses detected in translations
✅ No user names detected in translations
✅ No API keys/tokens detected in translations
✅ No session IDs detected in translations
PII audit: PASS
```

---

## Gate 5: Number, Date, Currency Formatting

**Command:** Code review + pattern matching  
**Trigger:** If PR adds strings with numbers, dates, or currency amounts.

**Checks:**
- ✅ No hardcoded number formatting in i18n strings (e.g., no "1,234.56" in JSON)
- ✅ No hardcoded date formatting in i18n strings (e.g., no "01/01/2026" in JSON)
- ✅ All Intl API usage verified in code review (correct locale, options)
- ✅ Pluralization uses i18next `_one`/`_other` pattern (never ternary in code)

**Format (correct):**
```json
{
  "quota.percentUsed": "{{percent}}% used",
  "engagement.count_one": "{{count}} engagement",
  "engagement.count_other": "{{count}} engagements"
}
```

**Code (correct):**
```typescript
const formatted = new Intl.NumberFormat(locale, { 
  style: 'percent', 
  minimumFractionDigits: 0 
}).format(0.45)  // Output: "45%" (locale-aware)

const plural = t('engagement.count', { count: voterCount })  // Handles _one/_other
```

**Failure action:** Block PR; code review must verify Intl API usage.

**Evidence:** Code review comment confirming Intl API audit passed.

---

## Gate 6: Compliance Claims Validation (S62+)

**Command:** `npm run check:compliance-claims`

**Trigger:** If PR adds/modifies strings in `compliance`, `legal`, or privacy-related namespace keys.

**Checks:**
- ✅ No false claims (e.g., "100% anonymous", "zero data retention without evidence")
- ✅ Attestation language matches backend implementation (no promise of features not shipped)
- ✅ GDPR/CCPA/HIPAA claims verified against legal counsel approval
- ✅ Disclaimer language present where required (e.g., "We use AI for…" requires "AI-generated" label)

**Failure action:** Block PR; legal review must approve copy before re-run.

**Expected output:**
```
✅ No false compliance claims detected
✅ Attestation language matches backend implementation
✅ GDPR/CCPA/HIPAA claims verified
Compliance audit: PASS
```

**Evidence:** Legal counsel sign-off in PR comments; copy changes approved by @legal-team.

---

## Gate 7: Email Template Rendering (S64+)

**Command:** Manual or automated email preview  
**Trigger:** If PR adds email template strings (subject, body, CTA, footer).

**Checks:**
- ✅ Email subject ≤ 50 characters (readable in mail preview)
- ✅ Email body text ≤ 80 characters per line (mobile mail wrapping)
- ✅ CTA link text descriptive and visible at high zoom (200%)
- ✅ HTML email renders correctly in Outlook, Gmail, Apple Mail, Thunderbird (all locales)
- ✅ No encoding issues (special chars in DE/FR/ES render correctly)

**Test procedure:**
```bash
# Email template test in Litmus or Email on Acid:
# 1. Render HTML email in EN/NL/DE/FR/ES
# 2. Check mobile (iPhone 6, Samsung Galaxy) rendering
# 3. Verify CTA link clickable at high zoom (200%)
# 4. Verify date/time formatting locale-aware (e.g., "15 juin 2026" for FR)
```

**Failure action:** Block PR; email template must render correctly in all mail clients and locales.

**Evidence:** Screenshots from Litmus preview (EN, DE, FR at mobile viewport) showing correct rendering.

---

## Gate 8: Namespace Structure Audit

**Command:** Manual structural review

**Checks:**
- ✅ New strings added to correct namespace (component-scoped, not overly general)
- ✅ If string used in 3+ namespaces, moved to `common.json`
- ✅ No circular dependencies between namespaces
- ✅ Namespace structure matches product domain (e.g., partner-portal strings in `partner.json`, not `admin.json`)

**Failure action:** Block PR if namespace structure violates conventions; must reorganize before merge.

**Evidence:** Code review comment confirming namespace placement approved.

---

## Gate 9: Spelling & Tone Review (Spot Check)

**Command:** Manual review + automated spellcheck (future)

**Checks:**
- ✅ No spelling errors in EN copy (baseline for all languages)
- ✅ Tone consistent with brand voice (professional, friendly, not jargony)
- ✅ Terminology matches product glossary (no "session" vs "meeting" ambiguity)
- ✅ Help text is concise and actionable (≤ 100 chars)

**Failure action:** Block PR if spelling errors or tone mismatches found; PO must approve copy before merge.

**Evidence:** Product Owner comment confirming copy tone and terminology approved.

---

## Gate 10: Deprecation Cleanup (S70 only)

**Command:** Manual audit + pattern matching

**Checks (S70 final sprint):**
- ✅ Old Sprint 60 keys marked `// DEPRECATED` in source (if still present)
- ✅ All references to deprecated keys removed from code
- ✅ `docs/I18N_DEPRECATIONS.md` updated with removal date and rationale
- ✅ Wave 3 deprecation calendar (S75+) finalized

**Failure action:** Block S70 PR if deprecation cleanup incomplete; must finalize Wave 3 roadmap.

**Evidence:** PR comment confirming deprecation cleanup complete; `I18N_DEPRECATIONS.md` updated.

---

## Merge Criteria (All Gates)

**PR must pass ALL 10 gates (8 automated, 2 manual) to be mergeable:**

1. ✅ `npm run check:i18n` PASS
2. ✅ German layout audit PASS (screenshots attached)
3. ✅ AI draft review PASS (native speaker comments)
4. ✅ `npm run check:pii-log` PASS
5. ✅ Number/Date/Currency audit PASS (code review)
6. ✅ `npm run check:compliance-claims` PASS (legal review if applicable)
7. ✅ Email template rendering PASS (Litmus if applicable)
8. ✅ Namespace structure PASS (code review)
9. ✅ Spelling & tone PASS (PO review)
10. ✅ Deprecation cleanup PASS (S70 only)

**Approvals required:**
- i18n engineer: gates 1, 2, 3, 4, 5, 7, 8
- Product Owner: gate 9 (tone, terminology)
- Legal/Compliance: gate 6 (if applicable)
- Release Manager: gate 10 (S70 only)

**Timeline:**
- Commit gates 1–8 checks to CI/CD pipeline (run on every push to i18n branch)
- Gates 9–10: manual reviews in PR comment, blocking until approved
- Target merge window: Sprint close -1 day (to allow final validation)

---

## Rollout CI Configuration

**File:** `.github/workflows/i18n-check.yml` (create/update)

```yaml
name: i18n validation

on:
  push:
    paths:
      - 'public/locales/**'
      - '.github/workflows/i18n-check.yml'
  pull_request:
    paths:
      - 'public/locales/**'

jobs:
  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check i18n completeness
        run: npm run check:i18n
        
      - name: Check PII in translations
        run: npm run check:pii-log
        
      - name: Check compliance claims (if applicable)
        run: npm run check:compliance-claims
        if: contains(github.head_ref, 'compliance') || contains(github.head_ref, 'legal')
        continue-on-error: true
        
      - name: Pseudo-locale generation
        run: npm run i18n:pseudo-gen > public/locales/qxx/common.json
        
      - name: Report results
        if: always()
        run: |
          echo "## i18n Validation Results" >> $GITHUB_STEP_SUMMARY
          echo "- Check completeness: ✅" >> $GITHUB_STEP_SUMMARY
          echo "- PII audit: ✅" >> $GITHUB_STEP_SUMMARY
          echo "- Pseudo-locale generated (manual layout review required)" >> $GITHUB_STEP_SUMMARY
```

---

## Sprints 60–70 Gate Checklist

| Sprint | Story | Automated gates | Manual gates | Legal approval | Evidence |
|--------|-------|-----------------|--------------|----------------|----------|
| 60 | I18N-SPRINT60-01 | check:i18n, pii-log | German layout, AI draft review | — | Screenshots (100%/200% zoom), DE speaker ✅ |
| 61 | I18N-SPRINT61-01 | check:i18n, pii-log, compliance-claims | German layout, AI draft review | Compliance officer | Compliance sign-off, screenshots |
| 62 | I18N-SPRINT62-01 | check:i18n, pii-log, compliance-claims | German layout, AI draft review, email preview | Legal counsel | Legal approval, compliance audit, email preview |
| 63 | I18N-SPRINT63-01 | check:i18n, pii-log | German layout, AI draft review | — | Screenshots, DE speaker ✅ |
| 64 | I18N-SPRINT64-01 | check:i18n, pii-log | German layout, AI draft review, email preview | — | Email template Litmus preview (all locales) |
| 65 | I18N-SPRINT65-01 | check:i18n, pii-log | German layout, AI draft review | PO + Marketing | Brand voice approval, DE layout, AI drafts |
| 66 | I18N-SPRINT66-01 | check:i18n, pii-log, compliance-claims | German layout, AI draft review | Compliance officer | Compliance claims validated, DE layout |
| 67 | I18N-SPRINT67-01 | check:i18n, pii-log, compliance-claims | German layout, AI draft review | Legal/Compliance | Privacy statement approved, DE layout |
| 68 | I18N-SPRINT68-01 | check:i18n, pii-log, compliance-claims | German layout, AI draft review | Legal counsel | GDPR attestation approved, DE layout |
| 69 | I18N-SPRINT69-01 | check:i18n, pii-log | German layout, AI draft review | Compliance officer | Moderation copy tone approved, DE layout |
| 70 | I18N-SPRINT70-01 | check:i18n, pii-log, compliance-claims | German layout, AI draft review, deprecation cleanup | Legal counsel | Breach notification + legal copy approved, email preview, deprecation cleanup |

---

## Failure Modes & Recovery

### Failure: Missing Keys After AI Draft Generation

**Symptom:** `npm run check:i18n` fails with "missing key in NL: copilot.prompt.suggestQuestion"

**Root cause:** AI draft generation incomplete (network timeout, API limit, incomplete JSON)

**Recovery:**
1. Re-run AI draft generation: `npm run i18n:extract && npm run i18n:translate`
2. Verify all non-EN namespaces have matching key structure
3. Check for JSON syntax errors: `npm run check:json` (if available)
4. Re-test: `npm run check:i18n`

**Prevention:** Batch AI generation before native speaker review; allow 2 hours for generation + validation.

---

### Failure: German Layout Truncation

**Symptom:** DE text overflows container in modal at 200% zoom

**Root cause:** Fixed `width`/`height` on text container; German +40% longer

**Recovery:**
1. Change fixed `width` to `min-width`; fixed `height` to `min-height`
2. Add `flex-wrap: wrap` or `word-break: break-word` if needed
3. Test at 200% zoom again
4. Verify mobile (375px) doesn't regress

**Prevention:** Design review gates mandate `min-width`/`min-height` on all text containers; pseudo-locale test mandatory.

---

### Failure: PII Detected in String

**Symptom:** `npm run check:pii-log` flags "user.email.placeholder: 'user@example.com'"

**Root cause:** Example data in help text or placeholder

**Recovery:**
1. Replace with generic placeholder: `"user@example.com"` → `"name@company.com"` (don't use real domain)
2. Or use i18n function pattern: `"user.[REDACTED]"` → no exposure
3. Re-run PII check

**Prevention:** Code review must spot-check placeholder strings; use [REDACTED] for examples.

---

### Failure: Compliance Claims Mismatch

**Symptom:** `npm run check:compliance-claims` fails: "claim 'zero data retention' not backed by backend implementation"

**Root cause:** Copy written to spec; backend changed late; copy not updated

**Recovery:**
1. Verify actual backend behavior (does it retain session data post-closure?)
2. Update copy to match implementation, or update backend to match promise
3. Legal review updated copy
4. Re-run check

**Prevention:** Compliance review SLA of 3 business days; legal approval required before PR submission.

---

### Failure: Email Template Fails Litmus Preview

**Symptom:** Subject line renders as garbled UTF-8 in Outlook 2016

**Root cause:** HTML encoding issue (UTF-8 not declared); German umlauts broken

**Recovery:**
1. Check HTML email `<head>`: must include `<meta charset="UTF-8">`
2. Check JSON string encoding: verify `ä`, `ö`, `ü` are UTF-8 encoded (not `\u00e4` escape)
3. Test in Litmus again
4. Preview in actual client (Outlook Web, Gmail)

**Prevention:** Email template review includes encoding check; test in all major clients before PR submission.

---

## Success Metrics (End of S70)

- ✅ 100% of I18N-SPRINT##-01 stories passed all 10 gates
- ✅ Zero PII leakage in production translations
- ✅ Zero failed compliance claims at GA
- ✅ Zero German layout regressions (200% zoom test passed)
- ✅ 100% of AI drafts reviewed by native speakers (or explicitly deferred + tracked)
- ✅ All email templates rendered correctly in Litmus (EN/NL/DE/FR/ES)
- ✅ Deprecation calendar finalized for Wave 3 (S75+)
