# GitHub issue draft — design system ADR backlog

Use this file to open the tracking issue. From the repo root:

```bash
gh issue create \
  --title "ADR backlog: design system audit items deferred from Phase 2+ remediation" \
  --label "documentation" --label "tech-debt" --label "audit" \
  --body-file .github/ISSUE_DRAFT_design-system-adr-backlog.md
```

Then remove the front matter below (lines starting with `<!--`) before submitting, or paste the **Issue body** section into the GitHub UI.

---

<!-- ISSUE BODY START — paste from here -->

## Context

Phase 1–2 remediation for [`DESIGN_SYSTEM_AUDIT_2026-07-01`](knowledge-base/quality/audits/DESIGN_SYSTEM_AUDIT_2026-07-01.md) landed on branch `cursor/design-audit-phase1-8f13` (PR #666). Critical/high findings on typography, legal links, gradients, dark-mode tokens, icons, status badges, and join-code display were addressed on high-traffic paths.

The items below were **intentionally deferred** because they require design-system or architecture decisions (ADRs), not another sweep of class renames. Implementing them without an ADR risks breaking canvas theming, marketing layouts, or cross-family UX.

**Related:** [ADR-0071](knowledge-base/adr/ADR-0071-design-system-v1.md) (design system v1), ADR-0050 (embed widget), [`SPEC_DESIGN_SYSTEM_OVERVIEW.md`](knowledge-base/specifications/domain/SPEC_DESIGN_SYSTEM_OVERVIEW.md)

---

## Deferred items (ADR required)

### 1. Three parallel theming mechanisms (audit #13)

**Current state:**
- App-wide dark mode: `[data-theme]` on `<html>` via `useColorScheme`
- Present/Display canvas: `[data-canvas-theme]` (4-value system) via `useCanvasTheme`
- Embed widget: independent light/dark hex palette in `EmbedWidget.tsx` (chromeless iframe per ADR-0050)

**Why deferred:** Merging these into one system would break Present/Display canvas tokens and the embed sandbox contract.

**ADR should decide:**
- Are the three systems intentionally separate surfaces?
- What is the canonical token source per surface (app shell vs. canvas vs. embed)?
- Migration path if consolidation is desired

**Files:** `src/styles.css`, `src/styles/canvas-themes.css`, `src/hooks/useColorScheme.ts`, `src/hooks/useCanvasTheme.ts`, `src/pages/EmbedWidget.tsx`, `src/pages/Present.tsx`, `src/pages/Display.tsx`

---

### 2. Present / Display full T5 shell migration (audit #3 partial)

**Current state:** Present and Display are full-viewport, canvas-themed surfaces with letterboxing/scaling logic. Townhall/Retro `*Display` pages use `BigScreenShell`; core `Present.tsx` / `Display.tsx` do not.

**Why deferred:** `BigScreenShell` uses `--surface-stage` and app tokens; Present/Display use `--canvas-*` tokens tied to projector/audience contrast. Forcing the shared shell would regress canvas theme picker behaviour.

**ADR should decide:**
- Is T5 (100vw×100dvh, 3-row, 5% padding) the target for core Present/Display, or is canvas theming an explicit T5 exception?
- Should `HostConsoleShell` / `BigScreenShell` gain a `variant="canvas"` prop, or should Present/Display remain a documented exception?

**Files:** `src/pages/Present.tsx`, `src/pages/Display.tsx`, `src/layouts/BigScreenShell.tsx`, `src/layouts/HostConsoleShell.tsx`

---

### 3. Cross-family feature consolidation (audit #18)

**Current state:** Townhall, Retro, Ideate, Deliberate, and Event Agenda were built independently. Shells are shared, but button hierarchy, tab styling, cluster colour palettes, and item-level badges still diverge per family.

**Why deferred:** Needs shared components (`<FeatureTabBar>`, canonical cluster palette, moderation chip mapping) designed once and migrated across 13+ files.

**ADR should decide:**
- Canonical cluster colour palette for Ideate (6 colours in facilitator board vs. 4 in present/join)
- Shared primary/secondary/ghost button hierarchy for host consoles
- Whether feature-specific status chips map onto `Badge` tones or get family-scoped variants

**Files:** `src/pages/Townhall*.tsx`, `src/pages/Retro*.tsx`, `src/pages/Ideate*.tsx`, `src/pages/DeliberateJoin.tsx`, `src/pages/EventAgenda*.tsx`, `src/ui/cluster-colors.ts`

---

### 4. Off–4px-baseline spacing (audit #10)

**Current state:** Marketing/solution pages use values like `p-7` (28px), `py-3.5` (14px), `py-4.5` (18px), `gap-14` (56px) that fall off the documented 4px baseline scale.

**Why deferred:** Mass rounding changes layout density on public marketing pages with high visual-regression risk and low functional impact.

**ADR should decide:**
- Is strict 4px enforcement required on marketing pages, or only on app shell / dashboard surfaces?
- Approved rounding rule (nearest step vs. always round down)

**Files:** `src/pages/solutions/*`, `src/pages/features/*`, `src/components/SolutionPageTemplate.tsx`, `src/components/FeaturePageTemplate.tsx`

---

### 5. `label-field` utility rollout (audit #17 partial)

**Current state:** `@utility label-field` added to `src/styles.css` (13px, pulse-700). Not yet applied across form-heavy pages.

**Why deferred:** Mechanical but touches many forms; needs a decision on whether labels use the utility globally or only in new work.

**ADR / spec should decide:**
- Mandatory adoption for all `<label>` elements in authenticated UI?
- Relationship to existing `text-sm` labels in TeamSettings / AccountSettings

**Files:** `src/styles.css`, `src/pages/AccountSettings.tsx`, `src/pages/team-settings/*`, `src/ui/input-field-class.ts`

---

### 6. i18n gaps on no-layout English surfaces (audit #19)

**Current state:** `PresenterRemotePage.tsx`, `ZoomSessionEmbedPage.tsx` (partial), and some marketing `playbook` props still hardcode English. Structural chrome (legal footer, branding) was added in remediation; strings were not routed through `useT()`.

**Why deferred:** Owned by `/i18n` — needs namespace keys across EN/NL/ES/DE/FR and extraction pipeline update.

**Follow-up (no ADR, but track here):**
- Add `presenter-remote` and `zoom-embed` namespaces
- Extract Zoom error/loading copy
- Route `TeamMeetingsPage` / `WorkshopsPage` / `TrainingPage` `playbook` props through i18n

**Files:** `src/pages/PresenterRemotePage.tsx`, `src/pages/ZoomSessionEmbedPage.tsx`, `src/pages/use-cases/*`

---

## Suggested ADR deliverables

| ADR | Topic | Unblocks |
|-----|-------|----------|
| ADR-0072 (proposed) | Theming surfaces: app vs. canvas vs. embed | #13, Present/Display shell question |
| ADR-0073 (proposed) | Feature-family shared components (tabs, clusters, chips) | #18 |
| Spec amendment | Marketing spacing enforcement scope | #10 |
| Spec amendment | Form label standard (`label-field`) | #17 |

---

## Acceptance criteria (close this issue)

- [ ] ADR-0072 (or equivalent) ratified: documents the three theming systems and Present/Display T5 scope
- [ ] ADR-0073 (or equivalent) ratified: canonical cluster palette + feature-family button/chip rules
- [ ] `SPEC_DESIGN_SYSTEM_OVERVIEW.md` updated with spacing scope (app vs. marketing) and label utility contract
- [ ] Follow-up implementation issues created per ADR outcome (not bundled into this ADR issue)

---

## Out of scope

- Re-opening Phase 1–2 items already fixed (typography kit, LegalFooter, `bg-gradient-brand`, `JoinCodeDisplay`, Lucide sweep, dashboard `container-app`)
- Backend/security items from `AUDIT_FIXES_SUMMARY.md` (#529 SAML, #538 vote corruption, etc.)

<!-- ISSUE BODY END -->
