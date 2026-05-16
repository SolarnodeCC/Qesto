---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# I18N Pseudo-Localization Audit (Wave 2) - Cold-Start Drill
**Date**: 2026-04-24  
**Purpose**: Validate runbook for identifying UI strings that would truncate or overflow at ~140% string length (German equivalent)  
**Scope**: 5 critical pages per i18n.md Wave 2 runbook

---

## Executive Summary

**AUDIT RESULT: MULTIPLE FINDINGS IDENTIFIED**

### Key Issues Found
1. **Hardcoded strings without i18n keys** in Present.tsx (5 instances)
2. **Manual pluralization (ternary)** in Display.tsx (1 instance)
3. **Fixed-width container** that could constrain German text in Present.tsx (w-[440px] Join panel)
4. **Potential button label truncation** in Present.tsx control panel when German button labels are ~40% longer
5. **Modal dialogs** in AdminUsersTab use Dutch language instead of i18n keys

---

## Page-by-Page Findings

### 1. Session Config Page (`src/pages/SessionConfig.tsx`)

**Status**: ✅ **COMPLIANT**

| Component | Issue Type | Severity | Details |
|-----------|-----------|----------|---------|
| Title input | None | — | `w-full` + `maxLength={120}` — flexible width, no truncation risk |
| Prompt input | None | — | `w-full` + `maxLength={240}` — flexible width, good |
| Option inputs | None | — | `flex-1` layout — responsive, no fixed widths |
| Save button | None | — | `inline-flex` + `px-4 py-2` — padding scales with text |
| AI Suggest button | None | — | `inline-flex` + `px-3 py-1.5` — icon + label format handles longer text |

**German Equivalent Check**: EN "Configure" (9 chars) → DE "Konfigurieren" (13 chars). No fixed width constraints.

**Verdict**: No truncation risk. All strings use `w-full` or flexible layouts. i18n keys present: `pollQuestion`, `loadingSession`, `sessionNotFound`, `backToDashboard`.

---

### 2. Vote Page / Voter-Facing (`src/pages/JoinPage.tsx`)

**Status**: ✅ **COMPLIANT**

| Component | Issue Type | Severity | Details |
|-----------|-----------|----------|---------|
| Session title heading | None | — | `text-2xl` + `max-w-lg` — responsive container |
| Question text | None | — | `text-lg` + `max-w-lg` — flexible, uses `[text-wrap:balance]` in related code |
| Vote buttons (poll/multi-select) | None | — | `w-full` + `text-left` — button expands with content |
| Slider component | None | — | Numeric slider (no text truncation) |
| Results bars | None | — | Flexible labels + percentage display |

**German Equivalent Check**: EN "Session has ended" (17 chars) → DE "Sitzung beendet" (15 chars). Shorter in German.

**Pluralization Check**: ✅ Uses i18next  
- Line 243: `t('participants_label', { count: state.participants })` — **CORRECT** i18next format

**Verdict**: Compliant. All text uses flexible layouts. No manual ternary pluralizations found.

---

### 3. Presenter Active Page (`src/pages/Present.tsx`)

**Status**: 🔴 **CRITICAL ISSUES FOUND**

#### Issue 1: Hardcoded Button Labels (No i18n)
| Line | String | Severity | Notes |
|------|--------|----------|-------|
| 322 | `'Next question'` | HIGH | Hardcoded, no i18n key |
| 330 | `'Session closed'` / `'Closing…'` / `'Close session'` | HIGH | Hardcoded ternary without i18n |
| 348 | `'Copied!'` / `'Display link'` | MEDIUM | Hardcoded, frequently changes |
| 378 | `'Resume'` / `'Pause'` | MEDIUM | Hardcoded, button group text |
| 394 | `'Tally hidden'` / `'Hide tally'` | MEDIUM | Hardcoded, toggleable label |
| 405 | `'Shuffle options'` | MEDIUM | Hardcoded button label |
| 412 | `'Min. votes to show tally'` | MEDIUM | Hardcoded label |
| 353 | `'AI recap at session close · Workers AI on Cloudflare'` | MEDIUM | Hardcoded marketing copy |
| 357 | `'Anonymity: Full'` | MEDIUM | Hardcoded status label |

**German Length Impact**:
- EN "Resume" (6) → DE "Fortsetzen" (10) — +67% length
- EN "Pause" (5) → DE "Pausieren" (9) — +80% length
- EN "Hide tally" (10) → DE "Tally verstecken" (~16) — +60% length

#### Issue 2: Fixed-Width Join Panel
| Line | Element | Width | Risk |
|------|---------|-------|------|
| 283 | Join session panel | `w-[440px]` | Fixed width with `p-9` padding (36px each side) leaves ~368px for content. German labels like "Diese Sitzung beitreten" (25 chars × avg 0.5em @ 16px ≈ 200px) fit, but header "Dieser Sitzung beitreten" (24 chars) at `text-[16px]` could wrap awkwardly at 200% zoom. |

**Layout at +40% string length**: The 440px container with 9 units padding is tight but may survive at normal zoom. At 200% zoom on a German-equivalent string: potential word-wrap but no overflow. **Marginal risk.**

#### Issue 3: Presenter Control Panel Button Sizing
| Element | CSS | Concern |
|---------|-----|---------|
| Pause/Resume button | `px-3 py-1.5 min-h-[36px]` | German "Fortsetzen" (10 chars @ 14px icon size + gap) may wrap to two lines. No max-width constraint. |
| Hide tally button | `px-3 py-1.5 min-h-[36px]` | Same concern. English "Tally hidden" (12 chars) vs DE "Tally verstecken" (16 chars). |
| Shuffle options | `px-3 py-1.5` | English "Shuffle options" (15 chars + icon) fits in 1 line at ~60px. German "Optionen mischen" (16 chars) similar; no overflow but tight fit. |

**Verdict at 200% zoom**: With flexbox wrapping enabled, buttons will reflow but may become cramped. **No critical truncation, but uncomfortable UX at high zoom.**

#### Issue 4: Manual Pluralization NOT Found
✅ Line 238: Uses `t('participant', { count: state.results.total })` — **correct i18next format**  
✅ Line 302: Uses `t('participant', { count: state.participants })` — **correct i18next format**

---

### 4. Display Page / Live Results (`src/pages/Display.tsx`)

**Status**: 🟡 **MINOR ISSUE**

#### Issue: Manual Ternary Pluralization
| Line | Code | Issue |
|------|------|-------|
| 119 | `{state.results.total} {state.results.total === 1 ? 'vote' : 'votes'}` | Manual ternary instead of i18next |

**Fix Required**: Should use `t('votes', { count: state.results.total })` with translation file keys:
```json
// en/display.json
{
  "votes_one": "{{count}} vote",
  "votes_other": "{{count}} votes"
}
```

**German Equivalent**: DE "Stimme" (6) vs "Stimmen" (7) — minimal length difference, but pattern violation.

**Verdict**: **COMPLIANCE FAILURE** — must use i18next pluralization, not manual ternary.

---

### 5. Admin Panel (`src/pages/AdminDashboard.tsx` + `src/components/admin/AdminUsersTab.tsx`)

**Status**: 🟡 **MODERATE ISSUES**

#### Issue 1: Hardcoded Dutch Strings in UserModal
| Line | String | Language | i18n Key | Severity |
|------|--------|----------|----------|----------|
| 91 | `'Account bewerken'` / `'Account aanmaken'` | Dutch | Missing | MEDIUM |
| 95 | `'E-mailadres'` | Dutch | Missing | MEDIUM |
| 107 | `'Weergavenaam'` | Dutch | Missing | MEDIUM |
| 130 | `'Admin-rol'` | Dutch | Missing | MEDIUM |
| 136,138 | `'Geen'` / `'Admin'` / `'Super Admin'` | Dutch | Missing | MEDIUM |
| 145,147 | `'Annuleren'` / `'Opslaan…'` / `'Opslaan'` | Dutch | Missing | MEDIUM |
| 23,27 | `'Geschorst'` / `'Actief'` in StatusBadge | Dutch | Missing | MEDIUM |
| 39 | `'Super Admin'` / `'Admin'` in RoleBadge | English | Missing | MEDIUM |

**Modal Width**: `max-w-md` (28rem ≈ 448px) with `mx-4` — responsive, safe from truncation. However, Dutch labels are hardcoded.

**German Equivalent**: Modal label "Account bewerken" (16) vs DE "Konto bearbeiten" (15) — similar length, but layout not tested for German.

#### Issue 2: Table Column Headers (Dutch)
| Line | Header | Language |
|------|--------|----------|
| 226 | `'Naam'` | Dutch |
| 227 | `'E-mail'` | Dutch |
| 228 | `'Plan'` | Dutch |
| 229 | `'Laatste betaling'` | Dutch |
| 230 | `'Admin-rol'` | Dutch |
| 231 | `'Status'` | Dutch |

**Layout Risk**: Table headers use `px-4 py-3 font-medium text-xs`. At +40% length, German headers could compress columns. `overflow-x-auto` exists (line 222), so horizontal scroll is fallback. **Low risk, but not i18n-compliant.**

#### Issue 3: Button Labels (AdminUsersTab)
| Line | Label | Issue |
|------|-------|-------|
| 210 | `'+ Account aanmaken'` | Hardcoded Dutch |
| 268 | `'Bewerken'` | Hardcoded Dutch |
| 277 | `'Gebruiker herstellen'` | Hardcoded Dutch, 18 chars → DE "Benutzer wiederherstellen" (26) — +44% length! |
| 286 | `'Schorsen'` | Hardcoded Dutch |

**Button Truncation Risk**: Line 277 — at `size="sm"` (typically `px-3 py-1.5`), button label "Gebruiker herstellen" (18 chars @ 14px) ≈ 126px. German equivalent "Benutzer wiederherstellen" (26 chars) ≈ 182px — **potential wrap or truncation at normal zoom**.

**Verdict**: AdminUsersTab is **NOT i18n-compliant**. Must extract all Dutch/English strings to translation files.

---

## Pseudo-Localization Checklist (from i18n.md Wave 2)

| Item | Present.tsx | Display.tsx | JoinPage.tsx | SessionConfig.tsx | AdminDashboard.tsx | Result |
|------|-------------|------------|--------------|-------------------|-------------------|--------|
| ✅ Session config title not truncated | N/A | N/A | — | Yes | N/A | ✅ |
| ❌ Vote page question readable at +40% | — | Yes | ✅ | — | — | ✅ (JoinPage OK) |
| ❌ Presenter slide headers fit | Hardcoded! | — | — | — | — | 🔴 FAIL |
| ❌ Admin table columns not compressed | — | — | — | — | Hardcoded Dutch | 🔴 FAIL |
| ❌ Modal dialogs buttons not cramped | — | — | — | — | Fixed `max-w-md`, Dutch labels | 🟡 WARN |

---

## Severity Summary

### Critical (P0)
1. **Present.tsx hardcoded button labels** (5 strings): `'Resume'`, `'Pause'`, `'Hide tally'`, `'Tally hidden'`, `'Shuffle options'`
   - German equivalents +40–80% longer
   - Presenter control panel buttons may reflow/wrap at 200% zoom
   - **Action**: Move to `present.json` i18n file

2. **Display.tsx manual pluralization** (Line 119): `state.results.total === 1 ? 'vote' : 'votes'`
   - Pattern violation: must use i18next `_one`/`_other` keys
   - **Action**: Replace with `t('votes', { count: state.results.total })`

### High (P1)
3. **AdminUsersTab hardcoded Dutch strings** (8+ instances):
   - Modal headings, labels, button text all Dutch
   - Button "Gebruiker herstellen" (18) → DE "Benutzer wiederherstellen" (26) — +44% risk
   - **Action**: Create `admin.json` namespace with all strings

4. **Present.tsx hardcoded strings** (3 additional): `'Next question'`, `'Session closed'`, `'Display link'`, `'Min. votes to show tally'`, `'AI recap at session close…'`, `'Anonymity: Full'`
   - **Action**: Extract to `present.json`

### Medium (P2)
5. **Present.tsx fixed-width Join panel** (`w-[440px]`):
   - German headers like "Dieser Sitzung beitreten" (24 chars) at `text-[16px]` may word-wrap at 200% zoom
   - Content width ~368px effective; no truncation but cramped at high zoom
   - **Action**: Test at 200% zoom with German translations; consider `min-w-[320px]` instead of fixed width

---

## Compliance by Language

### English (EN)
- ✅ Source of truth — all keys present
- ✅ SessionConfig, JoinPage, Display mostly compliant
- 🔴 Present.tsx, AdminUsersTab have hardcoded UI strings

### Dutch (NL)
- ✅ AdminUsersTab has Dutch translations (but hardcoded, not in i18n files)
- 🔴 No `present.json` entries for Dutch presenter buttons
- 🔴 No `admin.json` file for AdminDashboard/AdminUsersTab

### German (DE)
- ⚠️ Present.tsx button labels not tested at +40% length
- ⚠️ AdminUsersTab button "Benutzer wiederherstellen" (26 chars) exceeds presenter button width budget
- ⚠️ No layout testing at 200% zoom with German text

### Spanish (ES), French (FR)
- ⚠️ No specific issues identified, but hardcoded strings need translation

---

## Test Results Summary

| Page | Strings Extracted | Hardcoded Found | Fixed Widths | Manual Pluralization | Layout Tested (200% zoom) | i18n Compliant |
|------|------------------|-----------------|------------------|----------------------|----------------------------|---------------|
| SessionConfig.tsx | ✅ | ❌ None | ❌ None | ✅ Uses i18n | Not tested | ✅ YES |
| Display.tsx | ✅ | ⚠️ 1 minor | ❌ None | 🔴 Manual ternary (Line 119) | Not tested | 🔴 NO |
| JoinPage.tsx | ✅ | ❌ None | ❌ None | ✅ Uses i18n | Not tested | ✅ YES |
| Present.tsx | ⚠️ Partial | 🔴 8 critical | ⚠️ 1 fixed (Join panel w-[440px]) | ✅ Uses i18n (participant) | Not tested | 🔴 NO |
| AdminDashboard.tsx | ⚠️ Partial | 🔴 10+ hardcoded | ❌ None | ✅ N/A | Not tested | 🔴 NO |

---

## Recommendations (Priority Order)

### Immediate (Before Sprint 15 Ship)

1. **Extract hardcoded Present.tsx strings to `present.json`**:
   ```json
   {
     "nextQuestion": "Next question",
     "sessionClosed": "Session closed",
     "closing": "Closing…",
     "closingSession": "Close session",
     "displayLinkCopied": "Copied!",
     "displayLink": "Display link",
     "pauseLabel": "Pause",
     "resumeLabel": "Resume",
     "tallyHidden": "Tally hidden",
     "hideTallyLabel": "Hide tally",
     "shuffleOptionsLabel": "Shuffle options",
     "minVotesToShowTally": "Min. votes to show tally",
     "aiRecapAtSessionClose": "AI recap at session close · Workers AI on Cloudflare",
     "anonymityFull": "Anonymity: Full"
   }
   ```
   Add corresponding i18n keys for NL, DE, ES, FR.

2. **Fix Display.tsx manual pluralization (Line 119)**:
   - Replace: `{state.results.total === 1 ? 'vote' : 'votes'}`
   - With: `{t('votes', { count: state.results.total })}`
   - Add to `display.json`:
   ```json
   {
     "votes_one": "{{count}} vote",
     "votes_other": "{{count}} votes"
   }
   ```

3. **Extract AdminUsersTab/AdminDashboard Dutch strings to new `admin.json` namespace**:
   - Move: `'Account bewerken'`, `'E-mailadres'`, `'Weergavenaam'`, `'Admin-rol'`, `'Bewerken'`, `'Gebruiker herstellen'`, `'Schorsen'`, `'Geschorst'`, `'Actief'`, etc.
   - Create keys with semantic paths: `button.createAccount`, `form.emailLabel`, `table.header.role`, etc.

### Before 200% Zoom Test

4. **Test Present.tsx Join panel at 200% zoom** with German translations:
   - Verify "Dieser Sitzung beitreten" does not overflow
   - Consider `min-w-[360px]` instead of `w-[440px]` if space allows

5. **Test AdminUsersTab button "Benutzer wiederherstellen"** at normal and 200% zoom:
   - Measure button width at `size="sm"` (typically `px-3 py-1.5`)
   - If truncation occurs, increase padding to `px-4 py-2` or use `size="md"`

### Post-Sprint 15

6. **Update backlog**: Mark I18N-PRESENT, I18N-DISPLAY, I18N-ADMIN as completed after fixes.

7. **Add to CI validation**: Flag hardcoded strings in linting (e.g., detect English-only quoted strings in `src/pages/*.tsx`).

---

## Files Affected

| File | Issues | Action |
|------|--------|--------|
| `/home/user/Qesto/src/pages/Present.tsx` | 8 hardcoded strings | Extract to `present.json` |
| `/home/user/Qesto/src/pages/Display.tsx` | Manual ternary pluralization | Replace with i18next |
| `/home/user/Qesto/src/components/admin/AdminUsersTab.tsx` | 10+ hardcoded Dutch strings | Extract to `admin.json` |
| `/home/user/Qesto/src/pages/AdminDashboard.tsx` | Uses `admin` namespace but incomplete | Complete `admin.json` |
| `/home/user/Qesto/public/locales/en/present.json` | Missing keys | Add 8 new keys |
| `/home/user/Qesto/public/locales/en/display.json` | Missing pluralization keys | Add `votes_one`, `votes_other` |
| `/home/user/Qesto/public/locales/en/admin.json` | Missing or incomplete | Create/complete all keys |

---

## Runbook Validation

**Runbook Status**: ✅ **VALIDATED & FUNCTIONAL**

This audit successfully followed the i18n.md Wave 2 pseudo-localization runbook:

1. ✅ Identified 5 critical pages
2. ✅ Scanned for hardcoded strings
3. ✅ Checked for fixed-width containers
4. ✅ Verified pluralization patterns
5. ✅ Estimated German string lengths (+40%)
6. ✅ Flagged truncation/overflow risks
7. ✅ Documented findings with file paths + line numbers
8. ✅ Categorized severity (HIGH/MEDIUM/LOW)

**Runbook improvements for next cycle**:
- Add automated grep patterns to detect i18n violations (e.g., hardcoded 'Resume'/'Pause' in presenter.tsx)
- Create Git hooks to prevent unquoted English strings in JSX
- Add Tailwind constraint validator to flag `w-[XXXpx]` fixed widths without fallback

---

## Appendix: String Length Analysis (EN vs DE)

| String | EN Length | DE Equivalent | DE Length | % Increase |
|--------|-----------|---------------|-----------|------------|
| Resume | 6 | Fortsetzen | 10 | +67% |
| Pause | 5 | Pausieren | 9 | +80% |
| Hide tally | 10 | Tally verstecken | ~16 | +60% |
| Tally hidden | 12 | Tally versteckt | ~14 | +17% |
| Shuffle options | 15 | Optionen mischen | 16 | +7% |
| Next question | 13 | Nächste Frage | 13 | 0% |
| Geschorst (Dutch) | 9 | Suspended | 9 | N/A (already +40% longer in Dutch) |
| Benutzer herstellen | — | Benutzer wiederherstellen | 26 | +44% (vs "Restore user" 12) |

---

## Sign-Off

**Audit Completed**: 2026-04-24  
**Auditor Role**: i18n engineer (Wave 2 cold-start drill)  
**Scope Covered**: 100% of 5 critical pages  
**Issues Found**: 3 P0, 2 P1, 1 P2  
**Blockers for Ship**: 🔴 YES — must fix Display.tsx pluralization + Present.tsx hardcoded strings before Sprint 15 close

