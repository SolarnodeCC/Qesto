# Design System Compliance Audit — July 2026

> **Scope:** Every routed page in the app (59 routes / ~50 unique page components) audited against
> `/design-system/**`, `design-system/colors_and_type.css`, `src/styles.css`, ADR-0071, and
> `SPEC_DESIGN_SYSTEM_OVERVIEW.md`.
> **Method:** Design-system checklist extracted from source docs, cross-checked against the live
> Tailwind/CSS build; every page component read in full and compared line-by-line; repo-wide greps
> for cross-cutting anti-patterns (inline SVG, hardcoded hex, broken typography classes, missing
> legal links). Audit-only — no application code changed in this pass.
> **Author's note on the design system itself:** several checklist items below are marked
> *"undocumented — needs a design-system decision"* where the source docs don't resolve an observed
> inconsistency. These are gaps in the spec, not invented rules.

---

## Executive summary

The design system (ADR-0071, `/design-system/**`) is well-tokenized on paper — colors, spacing,
radius, motion, and page templates are all precisely specified. In practice, the shipped app has
drifted from it in a few systemic ways that dwarf any individual page-level nitpick:

1. **A large share of the app's headings/body text is applying a set of Tailwind-looking classes
   (`text-display-l`, `text-heading-l/m/s`, `text-body-l`, `text-caption`) that do not exist as CSS
   rules anywhere in the codebase.** They render with zero font-size/line-height/weight styling.
   This is not cosmetic — it's a silently broken implementation of the entire type scale on the
   pages that use it, most importantly the shared `src/ui/components.tsx` `Heading`/`Body`/`Caption`/
   `StatCard` components consumed by the Admin and Marketing dashboards.
2. **Icons are inline `<svg>` markup in 29+ files (58+ raw `<svg>` occurrences)**, directly violating
   Hard Rule #9 (Lucide-react only, one sanctioned exception in `Present.tsx`). Several are
   duplicating icons Lucide already ships (checkmarks, spinners, chevrons); a few are third-party
   brand marks (Slack, Google, Microsoft Teams) that may warrant a scoped ADR exception rather than
   a straight fix.
3. **~20 of 59 routes render with no shared header/nav/footer component at all** — every
   presenter/participant/display page across five independently-built feature families (Townhall,
   Retro, Ideate, Deliberate, Event Agenda) plus Present/Display/Join hand-rolls its own chrome. This
   is the single largest root cause of the drift found throughout this audit — see the "root-cause"
   section below.
4. **The design-token pipeline is forked and partly dead.** `tailwind.config.ts` +
   `src/ui/tailwind-theme.ts` (generated from `docs/spec/design-tokens.json`) has **no effect on the
   production build** — Tailwind v4 loads only `src/styles.css`'s `@theme` block, and no `@config`
   directive wires the legacy file in. The dead pipeline's values have already drifted from the live
   ones (e.g. `--color-border` #E5E7EB in the dead config vs. `#E5E5E5` live).
5. **Hardcoded hex color literals bypass the token system 1,501 times across 115 files** — almost
   entirely dark-mode `dark:text-[#...]`/`dark:bg-[#...]`/`dark:border-[#...]` values that mostly
   match the documented dark tokens but have already fragmented into at least 5 near-duplicate
   "muted text" and "dark surface" hex values across different files.
6. **None of the 20 no-layout pages link to `/privacy` or `/terms`**, including every
   participant-facing consent-collection surface (`JoinPage`, `TownhallJoin`, `RetroJoin`,
   `IdeateJoin`, `DeliberateJoin`, `EventAgendaJoin`) — a genuine compliance gap given Qesto's
   privacy-by-default positioning and GDPR consent logging.
7. **The primary-CTA gradient token (`--gradient-brand` / the registered `bg-gradient-brand`
   utility) is essentially unused where it should be the default** — every one of the 13 files in
   the Townhall/Retro/Ideate/Deliberate/Event family uses flat `bg-teal-600`/`bg-violet-600`/
   `bg-pulse-800` for primary actions instead, and several marketing/template pages re-implement the
   gradient by hand-duplicating its hex stops instead of using the class that already exists for it.

None of this requires new design decisions — it requires fixing ~6 shared files/components to
un-break dozens of pages at once. See **Quick wins** below.

---

## Design-system ground truth used for this audit

- **Tokens are live in `src/styles.css`'s `@theme` block + `design-system/colors_and_type.css`**,
  imported at `src/styles.css:3`. `tailwind.config.ts` / `src/ui/tailwind-theme.ts` (auto-generated
  from `docs/spec/design-tokens.json`) is **dead code** — confirmed via `vite.config.ts:112-116`
  (imported only to force build ordering, explicitly not wired into the Tailwind theme) and the
  absence of any `@config` directive in the CSS.
- **Real typography classes:** `.h-display-xl`, `.h-display-l`, plain `h1`/`h2`/`h3` (32/24/20px),
  `.body-m`(16px)/`.body-l`(18px)/`.body-s`(14px), `.caption`(12px) — all defined in
  `design-system/colors_and_type.css:130-210`.
- **Broken classes actually used in the codebase:** `text-display-l`, `text-heading-l`,
  `text-heading-m`, `text-heading-s`, `text-body-l`, `text-caption` — none of these six strings
  match any CSS rule or Tailwind utility (Tailwind's `fontSize` scale is empty; no CSS file defines
  them).
- **Colors:** teal/violet/pulse 50–900 scales, semantic `--text-primary/secondary/muted`,
  `--surface-bg/border`, signal colors, `--gradient-brand` (registered as the real `bg-gradient-brand`
  Tailwind `@utility`, `src/styles.css:102-104`) and `--gradient-ai` (reserved for AI-only surfaces).
- **Radius (ADR-0071 hard rule):** cards/panels/modals → `rounded-xl` (16px token); buttons/inputs →
  `rounded-lg` (10px token).
- **Icons:** Lucide-react only (Hard Rule #9); the *only* sanctioned inline `<svg>` in the entire
  codebase is the circular timer arc in `src/pages/Present.tsx`.
- **Spacing:** 4px baseline scale (4/8/12/16/24/32/48/64/96px).
- **Page templates:** T1 Landing, T2 Dashboard (240px sidebar + 64px topbar + `container.app`
  1280px), T3 Content (680px prose / 70ch), T4 Wizard (640px modal), T5 Present (100vw×100dvh,
  3-row, 5% h-padding), T6 Launchpad (320px action rail + fluid content rail).
- **Copy rules:** sentence case except proper nouns; no exclamation points in headlines/CTAs;
  banned CTA phrases; every AI mention anchored to "Workers AI on Cloudflare's edge" / "inside the
  same network as your session" / "no third-party model providers"; numeric marketing claims must
  be measurable and labeled "illustrative target"/"internal benchmark" or dropped.

---

## Consolidated findings by pattern (sorted by severity)

| # | Pattern | Severity | Scope | Root cause / fix location |
|---|---|---|---|---|
| 1 | Broken typography classes (`text-display-l`/`text-heading-*`/`text-body-l`/`text-caption`) render zero styling | **Critical** | 19+ files incl. `src/ui/components.tsx` (shared `Heading`/`Body`/`Caption`/`StatCard`), `SolutionPageTemplate.tsx`, `FeaturePageTemplate.tsx`, `AIBadge.tsx`, `SessionTitleField.tsx`, `AdminDashboard.tsx`, `MarketingDashboard.tsx`, `InsightsSection.tsx`, session-wizard step components, `AdminOpsTab.tsx`/`AdminAnalyticsTab.tsx` | `src/ui/components.tsx` (single highest-leverage fix — repairs Admin + Marketing dashboards and any future consumer) |
| 2 | Inline `<svg>` markup instead of Lucide (Hard Rule #9) | **Critical** | 29+ files, 58+ occurrences — dropdown chevrons, spinners, checkmarks, brand logos (Slack/Google/Teams), an admin latency sparkline chart | Per-file swap to Lucide equivalents (`Loader2`, `CircleAlert`, `ShieldCheck`, `Check`, `ChevronDown`, `Pause`); brand logos and the data-viz sparkline may warrant a scoped ADR-0071 amendment rather than removal |
| 3 | No shared header/nav/footer component | **Critical** | ~20 routes: `Present`, `Display`, `JoinPage`, `ZoomSessionEmbedPage`, `EmbedWidget`, `Login`, `ResetPassword`, `NotFound`, and all 13 Townhall/Retro/Ideate/Deliberate/Event files | Root cause of most drift in this audit — see dedicated section below |
| 4 | No participant-facing page links to `/privacy` or `/terms` | **Critical/High** | All 20 no-layout routes, especially consent-collecting join flows (`JoinPage`, `TownhallJoin`, `RetroJoin`, `IdeateJoin`, `DeliberateJoin`, `EventAgendaJoin`) | Shared `ParticipantShell`/footer strip (see root-cause section) |
| 5 | Dead/forked design-token pipeline (`tailwind.config.ts` + `tailwind-theme.ts`) has zero effect on the build and has already drifted from live tokens | **High** | Build config / `docs/spec/design-tokens.json` pipeline | Either delete the dead pipeline or wire it in via `@config` and reconcile drifted values |
| 6 | `bg-gradient-brand` (the registered primary-CTA utility) essentially unused; hand-duplicated hex gradients or flat colors used instead | **High** | `TemplateGallery.tsx`, `TemplateDetail.tsx`, `EventsPage`/`HRPage`/`NonprofitPage`/`ConsultingPage`/`AIInsightsPage` (local `gradientBrand` consts), `TeamInvite.tsx`, `StudioPage.tsx`, `SessionConfig.tsx`, `Results.tsx`, and **all 13** Townhall/Retro/Ideate/Deliberate/Event files (0/13 use it) | Delete local `gradientBrand` consts; standardize on `className="bg-gradient-brand"` |
| 7 | ADR-0071 radius rule violated (cards using `rounded-2xl`/`rounded-md`/`rounded-lg`/bare `rounded`; buttons using `rounded-2xl`/`rounded-md`/bare `rounded`) | **High** | `Home.tsx`, `Pricing.tsx`, `Login.tsx`, `ResetPassword.tsx`, `TemplateGallery.tsx`, `TemplateDetail.tsx`, `TeamIntegrations.tsx`, `CustomRolesSection.tsx`, `RetroPresent.tsx`, `RetroJoin.tsx`, `IdeateJoin.tsx`, `PresenterRemotePage.tsx`, `AdminDashboard.tsx`, `JoinCodePanel.tsx`, `EmbedWidget.tsx` | Per-file class swap to `rounded-xl` (cards) / `rounded-lg` (buttons/inputs) |
| 8 | Exclamation point in a headline (banned by copy rules) | **High** | `TeamInvite.tsx:86` — "You've joined {state.teamName}!" | One-line copy fix |
| 9 | Hardcoded hex color literals bypassing tokens, incl. fragmenting into 5+ near-duplicate "muted"/"dark surface" shades | **Medium** (High in aggregate) | 1,501 occurrences / 115 files — nearly every audited file | Promote the ~6 most-repeated hex values to named dark-mode token classes in one pass |
| 10 | Off-4px-baseline spacing (`p-7`=28px, `py-3.5`=14px, `py-4.5`=18px, `p-5.5`=22px, `gap-14`=56px, `w-4.5`=18px) | **Medium** | All 7 non-templated solution/feature/use-case pages; scattered elsewhere | Round to nearest 4px-scale step per file |
| 11 | Status/moderation badge colors have no shared mapping — every feature family invented its own | **Medium** | Session `Results.tsx` (no green+dot for LIVE, violet not amber for closed), `QuestionList.tsx` question-type chips (shade drift + missing `word_cloud` entry), Townhall `STATUS_BADGE`, Retro/Ideate (no badges), `EventAgendaJoin`/`EventAgendaOrganizer`/`EventStagePresent` (three more independent schemes) | Needs a design-system decision + one shared `<StatusBadge>` component |
| 12 | Join/session code display inconsistent (missing `uppercase`/`tabular-nums`, tracking off from 0.1em spec, weight 500 not 600) | **Medium** | `Present.tsx`, `JoinCodePanel.tsx` (Launchpad), `Display.tsx` (unstyled plain text), none of the 5 Join-family pages ever re-display the code at all | Standardize one code-display component/class |
| 13 | Three parallel theming mechanisms coexist (`[data-theme]` app-wide dark mode, `[data-canvas-theme]` 4-value Present/Display canvas theme, manual ternary string-building in `EmbedWidget.tsx`) | **Medium** | Architecture-level, spans `useColorScheme`, `useCanvasTheme`, `EmbedWidget.tsx` | Needs an ADR reconciling the three systems or documenting them as intentionally separate |
| 14 | Unlabeled precision numeric marketing claims (Numbers Rule) | **Medium** | `HRPage.tsx` (94%, 3.1× unlabeled), `LivePollingPage.tsx` (per-hop ms figures inconsistent with its own "validation pending" total) | Label as "illustrative target"/"internal benchmark" or drop, matching `TeamMeetingsPage`/`Soc2TrustPage`'s already-compliant pattern |
| 15 | AI copy not anchored to Workers AI/edge/no-third-party language | **Medium** | `AIInsightsPage.tsx` hero (anchor buried in a later section), `WorkshopsPage`/`TrainingPage` i18n content ("with AI" claims), **all 3 Ideate views** (AI-clustering UI has zero AI mention/badge anywhere) | Add anchor copy near each AI claim; `PrivacyFeaturePage.tsx` and `Privacy.tsx` are the best in-repo reference examples |
| 16 | Dashboard-family (`Dashboard`/`AccountSettings`/`AdminDashboard`/`MarketingDashboard`) each use a different content container width (1200px/720px/1152px/1152px), none matching the `container.app` 1280px spec, with inconsistent gutters | **Medium** | T2 Dashboard template | Introduce one shared `container.app`/`<PageContainer>` |
| 17 | Form labels inconsistent (`text-sm`=14px vs. spec's 13px; missing explicit `pulse-700` color) | **Low/Medium** | `TeamSettings.tsx` sub-sections, `AccountSettings.tsx` | Standardize a `.label` utility |
| 18 | Cross-family inconsistency across Townhall/Retro/Ideate/Deliberate/Event (button hierarchy, tab styling, cluster-color palettes, tap-target sizing, i18n coverage) | **Medium/High in aggregate** | 13 files | Needs consolidation into shared components; see cross-family notes below |
| 19 | Hardcoded English copy bypassing i18n (`PresenterRemotePage.tsx`, `ZoomSessionEmbedPage.tsx`, `TeamMeetingsPage`/`WorkshopsPage`/`TrainingPage`'s `playbook` prop, `EmbedWidget.tsx`'s "Live" label, Admin's "Observability" tab) | **Low** (flag to `/i18n`) | Multiple files | Route through `useT()` |
| 20 | Missing `<img>` alt text | **None found** | Verified via repo-wide scan — `Present.tsx`/`Display.tsx` correctly use empty `alt=""` for decorative logos; template `alt` props are dynamically supplied | No action needed |
| 21 | Tap targets under 44×44px on mobile-first participant pages | **Medium** | `TownhallJoin`/`RetroJoin`/`IdeateJoin` submit buttons (no explicit `min-h`), `EmbedPlayground.tsx` icon-action buttons (32–40px) | `DeliberateJoin.tsx` already does this correctly — use it as the reference pattern |

---

## Root cause: pages with no shared layout component

Per the audit brief, this is flagged as its own Critical/High finding since it is the source of
most of the drift found above. **20 of 59 routes render with zero shared header/nav/footer
component:**

| Page file | Route(s) | What it hand-rolls instead |
|---|---|---|
| `Login.tsx` | `/login` | Centered card, branded gradient title, no Privacy/Terms link |
| `ResetPassword.tsx` | `/reset-password` | Centered card, **no branding, no exit link in default form state** |
| `NotFound.tsx` | `*` | Single text link, no branding, no nav |
| `Present.tsx` | `/sessions/:id/present` | Own top bar / question header / bottom chrome, 1920×1080 letterboxed stage (doesn't match the fluid 100vw/100dvh T5 spec) |
| `Display.tsx` | `/display/:code` | Own header/footer, near-duplicate of Present's pattern but independently implemented |
| `JoinPage.tsx` | `/join`, `/j/:code` | Own brand strip, no footer, no exit affordance |
| `ZoomSessionEmbedPage.tsx` | `/sessions/:id/zoom-embed` | Own `<header>` with one back-link (best of the no-layout group) |
| `EmbedWidget.tsx` | `/embed/widget` | Intentionally chromeless (iframe-sandboxed) — **legitimate exception, but currently undocumented as such** |
| `TownhallPresent/Join/Display.tsx` | `/sessions/:id/townhall`, `/th/:code`, `/th/:code/display` | Independent ad-hoc header per file |
| `RetroPresent/Join/Display.tsx` | `/sessions/:id/retro`, `/r/:code`, `/r/:code/display` | Independent ad-hoc header per file |
| `IdeatePresent.tsx`, `IdeateBoardPage.tsx`, `IdeateJoin.tsx` | `/sessions/:id/ideate(/board)`, `/i/:code` | Independent ad-hoc header per file |
| `DeliberateJoin.tsx` | `/d/:code` | Ad-hoc header (best a11y focus-management pattern of the five Join pages) |
| `EventAgendaJoin/Organizer.tsx`, `EventStagePresent.tsx` | `/e/:code`, `/teams/:teamId/workspaces/:wsId/event`, `.../present` | `EventStagePresent.tsx` has the most complete ad-hoc header (back-link + title + live badge + URL) — best template to generalize from |

**Recommendation:** extract three shared components and migrate all 20 pages onto them:
- **`HostConsoleShell`** — for all "*Present"/board/organizer pages (branding, connection status,
  exit link). Use `EventStagePresent.tsx`'s header as the starting template — it's already the most
  complete.
- **`ParticipantShell`** — for all 5 "*Join.tsx" pages (branding, connection status, and — critically
  — a Privacy/Terms link, since these are consent-collection surfaces). Use `DeliberateJoin.tsx`'s
  focus-management pattern (`tabIndex={-1}` on the `<h1>`) as the a11y reference.
- **`BigScreenShell`** — for `Display.tsx`/`TownhallDisplay.tsx`/`RetroDisplay.tsx` (header/footer,
  join-code display, safe-area handling).
- Document `EmbedWidget.tsx`'s chromeless iframe pattern as an intentional, ADR-0050-scoped
  exception so future audits don't re-flag it.

---

## Quick wins (fix once, resolve dozens of findings)

1. **Rewrite `src/ui/components.tsx`'s `Heading`/`Body`/`Caption`/`StatCard`** to emit the real
   classes (`h-display-l`/`h1`-`h3`/`.body-*`/`.caption`) instead of the six broken `text-*` names.
   This alone repairs `AdminDashboard.tsx`, `MarketingDashboard.tsx`, and any future consumer of the
   shared UI kit — the single highest-leverage fix in this entire audit.
2. **Fix `AIBadge.tsx`** (broken `text-caption` + inline SVG sparkle + non-existent `rounded-pill`/
   `gap-space-1` utilities) — consumed by `SessionConfig.tsx` and likely elsewhere; one file fixes
   every AI-suggestion surface.
3. **Fix `SessionTitleField.tsx`** (`text-caption` → `.caption`) — consumed by both `Launchpad.tsx`
   and `Results.tsx`.
4. **Delete the dead `tailwind.config.ts`/`src/ui/tailwind-theme.ts` pipeline** (or wire it in via
   `@config` and reconcile the drifted values) so there is exactly one source of truth for tokens.
5. **Register `bg-gradient-brand` usage as the default primary-button treatment** and delete the
   ~8 independently-hand-duplicated `gradientBrand`/`from-teal-500 to-violet-600` constants scattered
   across `TemplateGallery.tsx`, `TemplateDetail.tsx`, the four solution pages, `AIInsightsPage.tsx`,
   `TeamInvite.tsx`, `StudioPage.tsx`, `SessionConfig.tsx`, and `Results.tsx`.
6. **Extract the three shared layout shells** described above — resolves the header/nav/footer
   Critical finding on 20 routes simultaneously, and by construction fixes the missing-Privacy/Terms-
   link finding on every participant-facing join page in one place.
7. **Fix the `RetroJoin.tsx`/`IdeateJoin.tsx` `rounded-lg`-on-a-panel bug** — identical bug in both
   files, almost certainly copy-pasted; one shared component fixes both.

---

## Phased remediation proposal

**Phase 1 — Critical/High (align header, nav, footer, typography, icons across all pages)**
- Rewrite `src/ui/components.tsx`'s broken typography primitives (Quick win #1).
- Fix `AIBadge.tsx` and `SessionTitleField.tsx` (Quick wins #2–3).
- Extract `HostConsoleShell` / `ParticipantShell` / `BigScreenShell` and migrate all 20 no-layout
  pages (root-cause section) — this pass should also add the missing Privacy/Terms link to every
  `ParticipantShell` consumer.
- Sweep all 29+ files with inline `<svg>` to Lucide equivalents; separately decide (ADR-0071
  amendment) whether third-party brand marks (Slack/Google/Teams) and the admin latency sparkline
  get a documented exception or a lucide/library replacement.
- Fix the `TeamInvite.tsx` exclamation-point headline.
- Resolve the dead token-pipeline question (delete or rewire `tailwind.config.ts`).

**Phase 2 — Medium (typography/spacing/color token cleanup, consistency)**
- Standardize on `bg-gradient-brand` for primary CTAs app-wide (Quick win #5).
- Fix all ADR-0071 radius violations (cards → `rounded-xl`, buttons/inputs → `rounded-lg`).
- Consolidate the ~6 most-repeated hardcoded dark-mode hex values into named token classes.
- Round off-4px-scale spacing values to the nearest scale step.
- Decide and implement one shared `<StatusBadge>` color mapping; migrate `Results.tsx`,
  `QuestionList.tsx`, Townhall/Event badges onto it.
- Standardize the join/session-code display component (mono, uppercase, tracked 0.1em,
  tabular-nums, weight 600) and use it everywhere a code is shown.
- Add AI-anchor copy to `AIInsightsPage.tsx`'s hero and all three Ideate views; fix the two
  under-labeled numeric claims (`HRPage.tsx`, `LivePollingPage.tsx`).
- Unify the Dashboard/Settings/Admin/Marketing container width on `container.app`.

**Phase 3 — Low (polish)**
- Form-label sizing/color standardization (13px, `pulse-700`).
- i18n gaps (hardcoded English strings) — hand off to `/i18n`.
- Tap-target audit on the three non-compliant Join pages, using `DeliberateJoin.tsx` as the
  reference.
- Reconcile the three parallel theming mechanisms (`[data-theme]`, `[data-canvas-theme]`,
  `EmbedWidget.tsx`'s manual ternary) via an ADR, or explicitly document them as intentionally
  separate systems.

---

## Cross-family notes: Townhall / Retro / Ideate / Deliberate / Event Agenda

These five feature families were built independently and, per this audit, should be compared
against each other rather than only against the design-system docs:

- All 13 files share the no-shared-layout problem (see root-cause section).
- `*Present.tsx`/board host-console pages converge on the same non-compliant container recipe
  (`mx-auto max-w-{2xl|6xl} space-y-N px-5 py-6`) — consistent with each other, but none is T5
  full-viewport compliant; `EventStagePresent.tsx` instead uses a `min-h-screen` 3-column dashboard
  grid that may warrant being explicitly scoped out of T5 rather than silently deviating.
- **`bg-gradient-brand` is used zero times across all 13 files** — every family independently chose
  flat `bg-teal-600`/`bg-violet-600`/`bg-pulse-800` for what should be gradient-brand primary CTAs.
- Status/moderation badge colors are reinvented per family with no shared mapping (Townhall's
  amber/teal/pulse/red `STATUS_BADGE`, Event's teal-for-live badges duplicated with slightly
  different classNames in two places, Retro/Ideate with no item-level badges at all).
- The `RetroJoin.tsx`/`IdeateJoin.tsx` panel-radius bug (`rounded-lg` where `rounded-xl` is
  required) is identical in both files.
- Ideate's cluster color palettes disagree across its own three views: `IdeateFacilitatorBoard.tsx`
  defines 6 colors, `IdeatePresent.tsx`/`IdeateJoin.tsx` each independently define only 4, in a
  different order/format — cluster N does not necessarily render the same color across views.
- None of the 5 `*Join.tsx` pages actually render a styled "enter your code" field (codes arrive via
  URL/QR only) — the JetBrains Mono/uppercase/tracked/tabular-nums join-code spec is effectively
  unexercised by this family; worth a design-system decision on whether that spec still applies here
  or should be scoped to Present/Display/Launchpad only.
- Copy-rule compliance is good across this family — no exclamation points or banned phrases found
  in any of the 5 submission-confirmation strings.
- Tap-target compliance is inconsistent: `DeliberateJoin.tsx` explicitly sets `min-h-[44px]`
  everywhere (best-in-class reference); `TownhallJoin`/`RetroJoin`/`IdeateJoin` set none.
- AI-clustering in Ideate has no AI badge/anchor copy anywhere in its 3 views — the one AI-specific
  rule in this audit's brief is unaddressed uniformly across the whole feature.

---

## Design-system documentation gaps (flagged, not invented)

The following inconsistencies have no documented resolution in the design system source and need a
design-system decision rather than a code fix:

- No documented footer column/link-grouping spec beyond what `MainLayout.tsx` happens to implement;
  no DSA-required-link placement rule.
- No documented spec for auth-page (no-`MainLayout`) header/footer treatment — leading to three
  different ad hoc solutions across `Login`/`ResetPassword`/`NotFound`.
- No documented dropdown/toast/table/error-message/loading-spinner/segmented-control component spec.
- Button radius is internally ambiguous: the design token is 10px, but Tailwind's `rounded-lg`
  default is 8px — the two are conflated throughout the codebase under one class name.
- No rule for when to use `.h-display-l` vs. plain `h1` for a page title.
- No canonical status-badge color mapping beyond the four documented session states (LIVE/DRAFT/
  SCHEDULED/ENDED) — every feature family invents its own for its own item-level states (energizer
  draft/active/completed, question pending/approved/answered, track idle/live/done, etc.).
- No canonical cluster-color palette for Ideate.
- No resolution for the "*Join.tsx pages never actually display an enterable/re-displayed code"
  observation — is the JetBrains Mono code-display spec meant to apply here at all?
- No documented exception process for icons with no Lucide equivalent (third-party brand marks,
  data-visualization charts) — currently these are just quietly non-compliant with Hard Rule #9.
- No reconciliation between the app-wide `[data-theme]` dark-mode system and Present/Display's
  separate `[data-canvas-theme]` 4-value system, nor documentation of `EmbedWidget.tsx`'s third,
  independent theming mechanism.

---

## Appendix: full per-file findings

The complete, unabridged per-file findings from each audit batch are preserved below for reference.

### Batch A — Marketing top-level pages (Home, Pricing, Privacy, Terms, Login, ResetPassword, NotFound)

- **Home.tsx** (`/`): hero/CTA gradient hand-duplicated as raw hex instead of `--gradient-brand`
  (Medium); ~14 hardcoded dark-mode hex literals (Low); CTA buttons use `rounded-md` instead of
  `rounded-lg` (**High**, ADR-0071); feature cards use `rounded-lg` instead of `rounded-xl`
  (Medium); hero/H2 headings use ad hoc `text-[Npx]` + inline `displayFont` style instead of
  `.h-display-*` (Low). No broken typography classes, no inline SVG.
- **Pricing.tsx** (`/pricing`): three pricing-tier cards use `rounded-[20px]`, feature-matrix
  wrapper `rounded-2xl`, CTA band `rounded-[2rem]` — all should be `rounded-xl` (**High**); buttons
  correctly use `rounded-lg` (compliant); inline JS gradient object duplicates `--gradient-brand`
  hex (Low); ~30+ hardcoded dark-mode hex (Low, highest count of the 7 files); "AI-powered insights"/
  "AI insights" mentions unanchored (Medium); copy otherwise sentence-case/compliant; `SourceBadge`
  uses `rounded` instead of `rounded-pill` (Low). No broken typography classes, no inline SVG.
- **Privacy.tsx** (`/privacy`, T3 template): no broken typography classes; ad hoc pixel sizing
  instead of `.h-display-l`/`.body-*`/`.caption` (Low); prose column has no `max-w-[680px]`
  constraint, can exceed ~70ch on wide viewports (Medium); TOC grid via inline style, functionally
  fine (Low); ~25+ hardcoded dark-mode hex (Low); section 8's AI/Workers-AI disclosure is exemplary
  and well-anchored (positive reference example).
- **Terms.tsx** (`/terms`, T3 template): same pixel-sizing pattern as Privacy.tsx (Low); `<main>`
  is missing the `prose-content` class that Privacy.tsx's `<main>` has — inconsistent between the
  two sibling legal pages, and also lacks the `max-w-[680px]` constraint (Medium); ~20+ hardcoded
  dark-mode hex (Low).
- **Login.tsx** (`/login`, no shared layout): **High** — no header/nav/footer, no Privacy/Terms
  link despite being a signup surface (reads as intentional minimal-chrome auth modal, still
  missing legal links); `GoogleIcon()` is a hand-coded inline `<svg>` Google "G" mark (**Medium**,
  Hard Rule #9 — candidate for a scoped brand-mark exception); login card uses `rounded-2xl`
  instead of `rounded-xl` (Medium); tab-switcher buttons use `rounded-md` inside a `rounded-lg`
  container (Low, undocumented nested-radius case); mixed hardcoded-hex/token-class color usage
  within the same file (Low). No broken typography classes.
- **ResetPassword.tsx** (`/reset-password`, no shared layout): **High** — no header/nav/footer,
  and in its default (non-error, non-success) form state has **zero navigation anywhere on the
  page** — no logo, no back link, nothing (weakest of the three no-layout pages); card uses
  `rounded-2xl` instead of `rounded-xl` (Medium); otherwise uses token-based dark-mode classes
  (compliant, better than Login.tsx's hex here). No broken typography classes, no inline SVG.
- **NotFound.tsx** (`*` catch-all, no shared layout): **High** — zero header/nav/footer/branding,
  only a single text link home; visual hierarchy is unusual (giant styled "404" numeral, unstyled
  semantic `<h1>` message) (Low); single `dark:text-[#A8B3CC]` hex literal (Low). No broken
  typography classes, no inline SVG.

### Batch B — Solution/Feature/Use-case leaf pages

All 12 files render via `SolutionPageTemplate`/`FeaturePageTemplate` (already audited at the
template level). None uses the six broken typography classes or any inline SVG directly.
- **Common pattern across all 7 non-templated content pages** (Events/HR/Nonprofit/Consulting/
  AIInsights/LivePolling/PrivacyFeature): headings built from raw `text-5xl`/`text-4xl`/`text-[Npx]`
  + inline `style={displayFont}` instead of `.h-display-xl`/`.h-display-l` (**High**, repeated 7×);
  off-4px-scale spacing (`p-7`=28px, `py-3.5`=14px, `py-4.5`=18px, `gap-14`=56px) repeated across
  all 7 (Medium); each page hand-duplicates the brand gradient as a local hex constant (Low, 7×
  repetition of the same anti-pattern found elsewhere).
- **AIInsightsPage.tsx**: defines its own local `gradientAI` hex constant instead of using
  `--gradient-ai` (**Critical** — reserved token bypassed with hand-authored duplicate hex); hero's
  AI claim isn't anchored to Workers AI/edge language (anchor only appears later in a Privacy
  section) (Medium).
- **HRPage.tsx**: unlabeled precision stats "94%"/"3.1×" violate the Numbers Rule (Medium).
- **LivePollingPage.tsx**: per-hop latency figures (~22ms/~8ms/~12ms/~16ms) presented as fact while
  the aggregate total explicitly says "validation pending" — internally inconsistent (Medium).
- **PrivacyFeaturePage.tsx**: best-anchored AI copy in the whole audit ("No OpenAI, no Anthropic,
  no Azure. Inference runs through Cloudflare Workers AI") — reference example; hardcoded red
  `#DC2626` for a "don't" icon with no danger/error token defined anywhere in the palette (Low).
- **TeamMeetings/Workshops/TrainingPage.tsx** (use-cases): each has a hardcoded-English `playbook`
  prop bypassing i18n while the rest of the page is translated (Low); Workshops/Training's `features.ai.desc`
  i18n strings make generic "with AI" claims with no anchor (Medium); metrics correctly labeled
  "Illustrative target" — compliant reference pattern.
- **GdprTrustPage.tsx / Soc2TrustPage.tsx**: fully compliant on the Numbers Rule (Soc2's Type I/Type
  II shipped-vs-target framing is the best example in the codebase); both hardcode
  `dark:bg-[#0A0F1E] dark:text-[#A8B3CC]` directly in the page file rather than inheriting from a
  token (Low).

### Batch C — Marketplace/Dev/Templates/Teams/Federation/Studio pages

- **MarketplacePage.tsx**: hardcoded dark-mode hex (Medium); otherwise clean, no broken typography.
- **PartnerSlaPage.tsx**: hardcoded dark-mode hex (Medium); stat cards use `rounded-lg`, arguably
  should be `rounded-xl` as panels (Low).
- **DeveloperPortalPage.tsx**: hardcoded dark-mode hex (Medium); API-path list is undocumented
  table-styling territory (Low, flagged as a gap not a violation).
- **TemplateGallery.tsx**: hand-duplicates `--gradient-brand` as a local hex const instead of using
  `bg-gradient-brand` (**High**); card and skeleton use `rounded-2xl` instead of `rounded-xl`
  (Medium).
- **TemplateDetail.tsx**: same `gradientBrand` hex duplication, used 6× in this file alone
  (**High**); modal/CTA card use `rounded-2xl`/`rounded-t-2xl` instead of `rounded-xl` (Medium);
  custom modal has no focus trap/Escape handling (Low).
- **TeamSettings.tsx** (+ sub-components): three Teams-integration inputs use bare `rounded` (4px,
  no token at all) instead of `rounded-lg` (**High**); role-action buttons use `rounded-md` instead
  of `rounded-lg` (Medium); a full multi-path inline `<svg>` Slack logo (**Critical**, Hard Rule
  #9 — brand-mark exception candidate); hardcoded `#464EB8` for a Teams placeholder icon (Medium);
  role badges (`owner`=violet) risk visual confusion with violet's AI/brand-gradient association
  elsewhere (Low); form labels at 14px without explicit `pulse-700` (Low).
- **TeamInvite.tsx**: two inline `<svg>` icons (checkmark, X) duplicating Lucide `Check`/`X`
  (**Critical**); headline **"You've joined {state.teamName}!"** uses a banned exclamation point
  (**High**); primary CTA uses raw `bg-gradient-to-br from-teal-500 to-violet-600` instead of
  `bg-gradient-brand` (Low); secondary button border uses `pulse-300` instead of spec'd `pulse-200`
  (Low).
- **ConnectJoinPage.tsx**: inline `<svg>` checkmark (**Critical**); otherwise the cleanest file in
  this batch — no hardcoded hex found, correct aggregate-only tenant-privacy rendering per ADR-0062.
- **StudioPage.tsx**: raw Tailwind gradient utility instead of `bg-gradient-brand` (Low); otherwise
  clean, no broken typography, no inline SVG.
- **EmbedPlayground.tsx**: inline `<svg>` lock/upgrade icon (**Critical**); a Unicode glyph (⧉)
  used as a copy-icon instead of a Lucide icon (Medium); its `auth.status==='loading'` branch
  renders completely outside `MainLayout`, unlike every sibling page in this batch (Medium); several
  icon buttons at 32–40px fall short of the 44×44px tap-target minimum (Low); otherwise the most
  radius-compliant file in the batch.

### Batch D — Authenticated app shell pages (Dashboard, AccountSettings, AdminDashboard, MarketingDashboard)

- **Dashboard.tsx**: imports a separate `MetricCard` (not the broken shared one) — clean on
  typography; primary "New session" CTA uses monochrome `bg-pulse-900` instead of
  `bg-gradient-brand` (Medium); ad hoc `max-w-[1200px]` container instead of `container.app`
  (Medium). Its composed `InsightsSection.tsx` directly uses broken `text-heading-s`/`text-body-s`
  (**Critical**).
- **AccountSettings.tsx**: clean on both the broken-typography and bare-`rounded` hotspots the
  brief called out — good reference example; form/section labels mix `text-sm`/`text-xs` and
  `pulse-500/700/800` ad hoc (Medium); its own `max-w-[720px]` container is a third distinct width
  (Medium); ~15+ hardcoded dark-mode hex (Low).
- **AdminDashboard.tsx**: imports `Heading`/`Body`/`Caption`/`StatCard` from the broken
  `src/ui/components.tsx` (**Critical** — root cause, affects every instance on this page) plus
  three direct `text-body-s` occurrences (**Critical**); a hand-built inline-`<svg>` latency
  sparkline chart (Medium — genuine data-viz, candidate for a documented exception rather than a
  straight fix); no `bg-gradient-brand` used anywhere on the page (Medium); date-range inputs use
  `rounded-md` instead of `rounded-lg` (Low); correctly implements the 5-tab segmented control, teal
  left-border section accents, €-currency, and `isAdmin` gating per the admin UI-kit spec
  (compliant); yet another distinct `max-w-6xl` container width (Medium).
- **MarketingDashboard.tsx**: same broken-`Heading`/`Body` import as AdminDashboard (**Critical**,
  same root cause); Title Case tab labels/page title instead of sentence case (Low); `max-w-6xl`
  container, matching AdminDashboard but not Dashboard/Settings (Medium); otherwise clean —
  no inline SVG, good aria-tab implementation.
- **Cross-cutting**: four different container widths across these four pages (1200/720/1152/1152px),
  none matching the 1280px `container.app` spec, all using `px-6 lg:px-10` gutters instead of the
  spec'd flat 32px (Medium).

### Batch E — Session lifecycle pages (SessionConfig, Launchpad, PresenterRemotePage, Results)

- **SessionConfig.tsx**: primary submit button hand-duplicates `from-teal-500 to-violet-600`
  instead of `bg-gradient-brand` (**High**); ~15+ hardcoded dark-mode hex (Medium); imports the
  broken `AIBadge` component, which itself has an inline SVG sparkle (**Critical**) and uses the
  broken `text-caption` class (**High**) plus non-existent `rounded-pill`/`gap-space-1` utility
  names (Medium); AI-suggest copy is correctly Workers-AI-anchored (compliant).
- **Launchpad.tsx**: action-rail is 330px vs. the T6 spec's 320px, and collapses at `lg` rather than
  a tablet breakpoint (**High**); imports `SessionTitleField.tsx`, which uses the broken
  `text-caption` class (**High**); imported `QuestionList.tsx`'s question-type chip colors are off
  by one-to-two shades from the documented mapping and have no `word_cloud` entry at all (Medium);
  drag handle correctly uses Lucide `GripVertical` but has no keyboard-alternative reorder mechanism
  (Low); imported `JoinCodePanel.tsx`'s code display is close to spec but missing `uppercase`/
  `tabular-nums` and uses 0.08em tracking, not 0.1em (Low); its CTA buttons use an arbitrary
  `rounded-[var(--radius-md,10px)]` instead of the `rounded-lg` class (Medium).
- **PresenterRemotePage.tsx**: minimal/placeholder page — no playback icons, no code display, none
  of the anticipated risk patterns apply yet; Q&A queue section uses `rounded-lg` where a card/panel
  should use `rounded-xl` (Medium); ~7 hardcoded dark-mode hex (Medium); uniquely among the four
  files in this batch, hardcodes English copy with no i18n wrapper (Low, flag to `/i18n`).
- **Results.tsx**: tally bars hand-duplicate `from-teal-500 to-violet-500` instead of
  `bg-gradient-brand` (Medium); status badge doesn't match the LIVE=green+dot/ENDED=amber spec at
  all (teal for live, violet for closed, no dot) (**High**); imports `SessionTitleField.tsx`'s
  broken `text-caption` (indirect, already counted above); word-cloud font-size via computed inline
  style is a justified, compliant exception (not a violation).

### Batch F — Full-screen pages part 1 (Present, Display, JoinPage, ZoomSessionEmbedPage, EmbedWidget)

- **Present.tsx**: no shared layout (**Critical**, root cause); 1920×1080 letterboxed/scaled stage
  doesn't match the fluid T5 100vw/100dvh/3-row spec (Medium); confirmed the **only** sanctioned
  inline SVG in the whole codebase (the timer arc) — otherwise fully Lucide-compliant; outer
  letterbox background is static `bg-pulse-950` and doesn't respond to the 4-value canvas theme
  (Low); hardcoded `#EF4444` timer-danger color and static `orange-700/600` leaderboard accents
  bypass the canvas token set (Low); canvas theming uses a separate `[data-canvas-theme]`
  4-value system, not the documented `[data-theme="dark"]` binary (Medium, architecture); join-code
  display uses `font-medium` (500) not the spec'd 600, tracking 0.12em not 0.1em, no explicit
  `uppercase` (Low); exactly one 🎉 emoji in the one sanctioned spot (compliant).
- **Display.tsx**: no shared layout (**Critical**); T5 3-row/5%-padding/safe-area spec not
  implemented (Medium); a new, undocumented `#0f1117` hex for loading/error backgrounds, matching no
  documented token (Low); inline `<svg>` loading spinner duplicating Lucide's `Loader2`
  (**High**); footer join-code text has zero mono/uppercase/tracking treatment at all — the weakest
  code display of the two audience-facing surfaces (Medium); one 🎉 emoji, correctly the only one
  (compliant).
- **JoinPage.tsx**: no shared layout (**Critical**, flagged as especially significant since this is
  the most mobile-critical, highest-traffic participant page in the app); four inline `<svg>`
  icons — spinner, error icon, trust-badge checkmark, paused-banner icon, all duplicating available
  Lucide icons (**High**); a second, distinct "muted dark text" hex (`#8A96B0`) coexists with the
  documented `#A8B3CC` in the same file (Medium, new drift); several informational banners
  (paused/offline/trust-badge) use `rounded-lg` instead of `rounded-xl` as panels (Low); "Try again"
  button and "back to home" link have no explicit 44px tap-target guarantee (Medium); focus
  management (`tabIndex={-1}` + return-focus-on-close) is a good, compliant reference pattern; the
  actual manual code-entry field lives in an unaudited sibling (`JoinLanding.tsx`), flagged for
  follow-up.
- **ZoomSessionEmbedPage.tsx**: no shared layout, but the best of the four page-level no-layout
  files — has a real back-link (**High**, not Critical, given the partial mitigation); a *third*
  distinct muted-dark hex (`#9AA8C7`) found here, on top of the two already found in JoinPage.tsx
  (Medium); fully radius-compliant (reference example); hardcodes all copy with no i18n wrapper,
  unlike its siblings (Low, flag to `/i18n`); correctly uses `var(--color-bg)` token (compliant,
  though possible `--color-bg`/`--surface-bg` naming drift worth a quick architect check).
- **EmbedWidget.tsx**: intentionally chromeless — legitimate iframe-sandboxed exception, but not
  documented as such anywhere (Medium, doc gap); re-implements its own independent light/dark hex
  palette via manual ternary rather than the app's token system — a third theming mechanism
  alongside `[data-theme]` and `[data-canvas-theme]` (Medium, architecture); one hardcoded
  `#0F1628` background matching none of the ~4 other dark-surface hex values found elsewhere in
  this audit (Low); one inline `<svg>` checkmark duplicating Lucide `CircleCheckBig` (**High**);
  root container uses `rounded-lg` where it functions as the widget's outer card (Low); no semantic
  heading element anywhere in the file (Low, a11y).

### Batch G — Full-screen pages part 2 (Townhall/Retro/Ideate/Deliberate/Event families)

See the dedicated **"Cross-family notes"** section above for the consolidated view. Per-file
highlights not already covered there:
- **IdeateBoardPage.tsx** (via `IdeateFacilitatorBoard.tsx`): inline `<svg>` chevron for
  cluster collapse/expand, duplicating Lucide `ChevronDown` (**Critical**); good `tabIndex={-1}`
  focus-management pattern, unique among the Present-family files; button-based cluster-merge
  interaction already satisfies the keyboard-alternative requirement (no drag-and-drop present).
- **EventAgendaOrganizer.tsx** / **EventStagePresent.tsx**: the worst button-hierarchy sprawl in the
  audit — 4–5 independently-styled button treatments on a single page with no primary/secondary
  system and zero `bg-gradient-brand` usage (Medium); `EventStagePresent.tsx`'s slide-deck iframe
  combines `allow-scripts` and `allow-same-origin` sandbox flags (flagged to `/security`, out of
  design-system scope); its header is nonetheless the best ad-hoc header in the whole no-layout set
  and the recommended starting point for `HostConsoleShell`.
- **RetroPresent.tsx**: column submit button/textarea use `rounded-md` instead of `rounded-lg`
  (Medium).
- **TownhallDisplay.tsx / RetroDisplay.tsx**: near-identical big-screen shells, but Townhall's
  "Q&A" badge label is hardcoded (non-i18n) while Retro's equivalent is translated (Low); both
  share an identical, undocumented `#0f1117` background hex (Low — same value as Display.tsx and
  ZoomSessionEmbedPage's loading screens, i.e. a fourth confirmed sighting of this exact
  undocumented shade across the whole audit).
