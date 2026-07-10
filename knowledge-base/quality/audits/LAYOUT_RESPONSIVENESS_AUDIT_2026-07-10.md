# Layout & Responsiveness Audit — 2026-07-10

**Scope:** UI/UX layout, alignment, spacing, typography hierarchy, responsive breakpoints, touch targets, viewport behaviour, overflow/clipping across `src/` (React 19 + Tailwind CSS v4).
**Method:** static code audit of pages, layouts, shared primitives (`src/ui/`), and design tokens (`src/styles.css`, `src/styles/grid.css`), **verified against the compiled CSS** (`npm run build` → `dist/assets/index-*.css`) so every spacing claim reflects what actually ships, not what the class names suggest.
**Exclusions (per audit brief):** color contrast, interaction states, performance, SEO.
**Related:** `DESIGN_SYSTEM_AUDIT_2026-07-01.md` (design-token conventions, ADR-0071).

## Remediation status (2026-07-10, same PR)

| Finding | Status | How |
|---|---|---|
| LAYOUT-001 | ✅ Fixed | Numeric `--spacing-N` remap deleted from `@theme`; 846 call sites across 128 files renumbered to the default-scale step with the identical px value (5→6, 6→8, 8→12, 10→16, 12→24). Verified by comparing compiled CSS before/after: every renamed class resolves to the same px, unmapped steps unchanged. Numeric utilities now mean standard Tailwind everywhere. |
| LAYOUT-002 | ✅ Fixed | `MainLayout` marketing nav is `hidden md:flex`; below `md` a 44×44px hamburger (lucide `Menu`/`X`) toggles a stacked disclosure panel with grouped sections and ≥44px link rows; closes on route change. `nav.openMenu`/`nav.closeMenu` added to all 5 locales. |
| LAYOUT-003 | ✅ Fixed | Pricing matrix wrapper `overflow-hidden` → `overflow-x-auto`; table `min-w-[640px]`; cell padding responsive (`px-3 md:px-8`). |
| LAYOUT-004 | ✅ Fixed | All five sub-16px shared input classes in `input-field-class.ts` now `text-base sm:text-sm` (or `sm:text-body-s`) — no iOS zoom-on-focus below `sm`. |
| LAYOUT-005 | ✅ Fixed | `min-h-11`/`min-w-11` floors on the upvote control, open-text Submit, JoinBar submit + code input (`sm:min-h-0` keeps the bar compact on desktop), and baked into the shared `Button` primitive (`sm` relaxes to `min-h-9` from the `sm` breakpoint). |
| LAYOUT-006…011 | ⏳ Open | Not in scope of this remediation pass. Note: LAYOUT-008's broken density equivalence is **resolved as a side effect** of LAYOUT-001 — with the default scale restored, `density-stack-6` (24px) again equals `space-y-6` (24px) at default density. |

## Headline result

The app's layout architecture is fundamentally healthy — `AppShellLayout` has a proper mobile drawer, `grid.css` is a clean mobile-first 4/8/12-column system, `Present.tsx`'s 1920×1080 letterboxed stage has a deliberate scale clamp, admin tables are wrapped in `overflow-x-auto`, and 72 call sites already enforce `min-h-[44px]` touch targets.

The two systemic problems are:

1. **A non-monotonic hybrid spacing scale.** `@theme` in `src/styles.css` remaps steps 5/6/8/10/12 to a designer px ramp (24/32/48/64/96px) while every unmapped step (7, 9, 11, 14, 16, 20, 24…) still resolves through Tailwind v4's default `--spacing: .25rem` multiplier. Compiled-CSS proof: `p-6` = 32px but `p-7` = 28px; `h-10` = 64px but `h-11` = 44px; `py-12` = 96px but `py-16` = 64px. The same numeric suffix means two different systems depending on whether the step happens to be remapped.
2. **The marketing header has no mobile collapse.** `MainLayout.tsx` renders three dropdowns + two links + theme toggle in one row with no hamburger and no responsive `hidden`/`md:` variants — it wraps/overflows on ≤640px viewports on every marketing page (Home, Pricing, features, solutions, use-cases).

Participant-facing mobile surfaces (`/j/:code`) are mostly well built, but the open-text answer input is 14px (triggers iOS Safari zoom-on-focus), the upvote control is ~32px tall, and the Likert scale stays 5-across at 320px.

## Full findings (JSON)

```json
{
  "findings": [
    {
      "id": "LAYOUT-001",
      "severity": "critical",
      "category": "spacing",
      "title": "Spacing scale is non-monotonic: remapped @theme steps collide with Tailwind v4's default multiplier",
      "description": "src/styles.css @theme remaps --spacing-5/6/8/10/12 to a 24/32/48/64/96px design ramp, but Tailwind v4 keeps --spacing: .25rem for every step without an explicit token. Any utility using an unmapped step (7, 9, 11, 14, 16, 20, 24) silently falls back to the 4px-multiplier scale. The compiled CSS therefore ships a scale where a numerically larger class can be physically smaller: p-7 (28px) < p-6 (32px); h-11 (44px) < h-10 (64px); h-16 (64px) < h-12 (96px); py-16 (64px) < py-12 (96px). Usage is heavy on both sides of the fault line (139× px-6, 62× py-16, 58× p-8, 29× px-7, 18× p-7, 12× h-16, 11× h-11, 6× gap-14), so vertical rhythm and control sizing differ page-to-page depending on which steps a component happened to use. It also means every standard-Tailwind habit (h-10 = 40px button, w-12 h-12 = 48px icon tile) silently renders 1.5–2× larger here (h-10 = 64px, w-12 = 96px).",
      "location": {
        "file": "src/styles.css",
        "component": "@theme spacing tokens",
        "lineRange": [58, 69]
      },
      "currentBehavior": "Compiled CSS (dist/assets/index-*.css): .p-6{padding:var(--spacing-6)} → 32px, .p-7{padding:calc(var(--spacing)*7)} → 28px, .h-10{height:var(--spacing-10)} → 64px, .h-11 → 44px, .py-12 → 96px, .py-16 → 64px. Scale is non-monotonic and dual-sourced.",
      "expectedBehavior": "One monotonic scale: each numeric step resolves from a single system, and step N+1 is never smaller than step N.",
      "affectedDevices": ["desktop", "tablet", "mobile"],
      "remediationSteps": [
        "1. Decide the canonical scale. Recommended: delete the numeric --spacing-N overrides from @theme and let Tailwind's default 4px multiplier own all numeric steps.",
        "2. Re-express the design ramp as named tokens instead (e.g. --spacing-gutter: 24px, --spacing-card: 32px, --spacing-section: 64px) so intent-level spacing survives without hijacking numeric utilities.",
        "3. Migrate call sites mechanically: p-5→p-6, p-6→p-8, p-8→p-12, p-10→p-16, p-12→p-24 (and the h-/w-/gap-/space- equivalents) to preserve today's rendered geometry, or accept the (smaller) default values where the inflation was never intentional.",
        "4. Add a stylelint/grep CI check that fails on new --spacing-<number> overrides in @theme.",
        "5. Verify with a before/after visual diff on Dashboard, JoinPage, Pricing, and one solutions page."
      ],
      "codeExample": {
        "before": "@theme {\n  --spacing-5: 24px;\n  --spacing-6: 32px;\n  --spacing-8: 48px;\n  --spacing-10: 64px;\n  --spacing-12: 96px;\n}",
        "after": "@theme {\n  /* numeric steps stay on Tailwind's 4px multiplier (p-6 = 24px, h-10 = 40px) */\n  --spacing-gutter: 24px;   /* px-gutter */\n  --spacing-card: 32px;     /* p-card    */\n  --spacing-section: 64px;  /* py-section */\n}"
      }
    },
    {
      "id": "LAYOUT-002",
      "severity": "critical",
      "category": "mobile",
      "title": "Marketing header never collapses: 6 inline nav items with no hamburger on ≤640px",
      "description": "MainLayout renders the site banner as a single flex row: logo + (on marketing pages) three NavDropdown triggers + Pricing link + Privacy link + theme toggle. There is not a single responsive class on the nav — no hidden md:flex, no mobile menu, no overflow strategy. At 375px the row wraps to multiple lines or forces horizontal scroll, and dropdown menus (absolute, min-w-[160px], left-0) can extend past the right viewport edge for the right-most trigger. This is the shared chrome for every marketing page: /, /pricing, /features/*, /use-cases/*, and all four solutions pages — i.e. the pages where first-time mobile visitors land.",
      "location": {
        "file": "src/layouts/MainLayout.tsx",
        "component": "MainLayout header / NavDropdown",
        "lineRange": [172, 243]
      },
      "currentBehavior": "All nav items render inline at every viewport width; header wraps/overflows at ≤640px; nav triggers are px-2 py-1 (~28px tall).",
      "expectedBehavior": "≥md: current inline nav. <md: a hamburger button (≥44px) toggling a full-width disclosure panel that stacks the solution/feature/use-case links.",
      "affectedDevices": ["mobile", "tablet portrait"],
      "remediationSteps": [
        "1. Wrap the marketing nav block in a container with hidden md:flex.",
        "2. Add a md:hidden hamburger button (lucide-react Menu icon, min 44×44px) toggling a stacked panel below the header; reuse the AppShellLayout drawer pattern (fixed overlay + focus management) already in the codebase.",
        "3. Give mobile menu links py-3 rows so each target is ≥44px.",
        "4. For the desktop dropdowns, add right-0 md:left-0 or a viewport-edge check so menus never overflow the right edge.",
        "5. Verify at 320px, 375px, and 768px with Chrome DevTools emulation."
      ],
      "codeExample": {
        "before": "<nav aria-label=\"Site navigation\" className=\"flex items-center gap-1\">\n  {isMarketingPage && (<>\n    <NavDropdown label={t('nav.solutions')} links={solutionLinks} />\n    ...\n  </>)}\n</nav>",
        "after": "<nav aria-label=\"Site navigation\" className=\"hidden md:flex items-center gap-1\">…</nav>\n<button type=\"button\" className=\"md:hidden flex h-11 w-11 items-center justify-center rounded-lg\" aria-expanded={mobileOpen} aria-controls=\"mobile-nav\" onClick={() => setMobileOpen(v => !v)}>\n  <Menu size={20} aria-hidden=\"true\" />\n</button>\n{mobileOpen && <div id=\"mobile-nav\" className=\"md:hidden border-t border-pulse-200 px-4 py-2\">…stacked links, py-3 each…</div>}"
      }
    },
    {
      "id": "LAYOUT-003",
      "severity": "high",
      "category": "mobile",
      "title": "Pricing feature matrix is clipped on mobile: 4-column table inside overflow-hidden with no horizontal scroll",
      "description": "The plan-comparison table (Capability + Pulse/Signal/Chorus) uses w-full with px-6 cells — and px-6 compiles to 32px per side under the remapped scale, so a single row carries 256px of padding alone. Its wrapper is rounded-2xl overflow-hidden, not overflow-x-auto. Below ~700px the table's min-content width exceeds the viewport: columns crush into vertical letter-soup and, once min-content no longer fits, the right-hand plan columns are clipped with no way to scroll to them. This is the page where plan limits are disclosed — mobile users literally cannot read what the Chorus column contains.",
      "location": {
        "file": "src/pages/Pricing.tsx",
        "component": "Feature matrix section",
        "lineRange": [270, 329]
      },
      "currentBehavior": "overflow-hidden wrapper clips the table; no scroll affordance; heavy cell padding forces overflow at ≤768px.",
      "expectedBehavior": "Table scrolls horizontally inside its own container on small viewports (or reflows to a per-plan stacked layout), with reduced cell padding on mobile.",
      "affectedDevices": ["mobile", "tablet portrait"],
      "remediationSteps": [
        "1. Change the wrapper to overflow-x-auto (keep rounded-2xl) and give the table a min-w-[640px] so columns keep integrity while scrolling.",
        "2. Reduce cell padding responsively: px-3 py-3 md:px-6 md:py-5 on th/td.",
        "3. Optional (better UX): under md, render a stacked per-plan card list instead of the matrix.",
        "4. Verify at 375px that all three plan columns are reachable."
      ],
      "codeExample": {
        "before": "<div className=\"bg-white dark:bg-[#151C2E] rounded-2xl overflow-hidden\" style={shadowCard}>\n  <table className=\"w-full border-collapse\">\n    …<th className=\"text-left px-6 py-5 …\">",
        "after": "<div className=\"bg-white dark:bg-[#151C2E] rounded-2xl overflow-x-auto\" style={shadowCard}>\n  <table className=\"w-full min-w-[640px] border-collapse\">\n    …<th className=\"text-left px-3 py-3 md:px-6 md:py-5 …\">"
      }
    },
    {
      "id": "LAYOUT-004",
      "severity": "high",
      "category": "mobile",
      "title": "14px inputs trigger iOS Safari zoom-on-focus on the participant answer flow and site-wide primitives",
      "description": "iOS Safari zooms the whole viewport when a focused input's font-size is below 16px. Four shared input classes ship 14px text: ENTRY_RESPONSE_FIELD_CLASS (text-sm — the open-text/word-cloud answer box on /j/:code, the single most phone-dominated surface in the product), ENTRY_BAR_CODE_CLASS (text-sm — the join-code bar rendered on nearly every page), SEARCH_FIELD_CLASS (text-sm), and DEFAULT_TEXT_INPUT_CLASS (text-body-s = 14px — the ui/TextInput primitive). Every focus on these fields on an iPhone jolts the layout with an unwanted zoom the user must pinch back out of, mid-live-session.",
      "location": {
        "file": "src/ui/input-field-class.ts",
        "component": "ENTRY_RESPONSE_FIELD_CLASS / ENTRY_BAR_CODE_CLASS / SEARCH_FIELD_CLASS / DEFAULT_TEXT_INPUT_CLASS",
        "lineRange": [18, 34]
      },
      "currentBehavior": "Focusing these inputs on iOS Safari zooms the page; participant answering flow visibly jumps.",
      "expectedBehavior": "Inputs are ≥16px on touch viewports (text-base sm:text-sm keeps the compact desktop look).",
      "affectedDevices": ["mobile (iOS Safari primarily)"],
      "remediationSteps": [
        "1. In input-field-class.ts change text-sm → text-base sm:text-sm (and text-body-s → text-base sm:text-body-s) on the four classes.",
        "2. Grep remaining one-off <input>/<textarea>/<select> for text-sm/text-xs and apply the same pattern (JoinBar, wizard steps, settings forms).",
        "3. Verify on iOS Safari (or BrowserStack): focusing the /j/:code answer box must not zoom."
      ],
      "codeExample": {
        "before": "export const ENTRY_RESPONSE_FIELD_CLASS =\n  `w-full rounded-lg … px-4 py-3 text-sm focus:outline-none …`",
        "after": "export const ENTRY_RESPONSE_FIELD_CLASS =\n  `w-full rounded-lg … px-4 py-3 text-base sm:text-sm focus:outline-none …`"
      }
    },
    {
      "id": "LAYOUT-005",
      "severity": "high",
      "category": "touchTarget",
      "title": "Sub-44px touch targets on participant voting controls and shared Button primitive",
      "description": "WCAG 2.5.5 target size (44×44px) is enforced in 72 places via min-h-[44px], but the highest-frequency mobile tap targets miss it: the upvote button in QuestionVoteInput (px-2.5 py-1.5 text-sm ≈ 32px tall — the only interactive element for 'upvote' questions on phones); the open-text Submit button (py-2.5 ≈ 41px); the JoinBar submit (px-3 py-1.5 ≈ 33px, rendered on almost every page); NavDropdown triggers and header text links (px-2 py-1 ≈ 28px); and the shared ui Button primitive, whose sm (py-2 + 14px text ≈ 37px) and md (py-2 + 16px text ≈ 40px) sizes have no min-height, so every consumer that doesn't add its own min-h-[44px] ships undersized.",
      "location": {
        "file": "src/pages/join/QuestionVoteInput.tsx",
        "component": "upvote button (also src/ui/components.tsx Button, src/components/JoinBar.tsx, src/layouts/MainLayout.tsx nav)",
        "lineRange": [189, 210]
      },
      "currentBehavior": "Primary mobile tap targets measure ~28–41px tall.",
      "expectedBehavior": "All interactive elements ≥44×44px on touch viewports (visual size may stay compact on desktop via sm: overrides).",
      "affectedDevices": ["mobile", "tablet"],
      "remediationSteps": [
        "1. Add min-h-11 min-w-11 to the upvote button and min-h-11 to the open-text Submit in QuestionVoteInput (note: min-h-11 resolves to 44px via the default multiplier — safe even before LAYOUT-001 lands).",
        "2. Bake the floor into the primitive: Button sizeStyles → sm: 'px-3 py-2 text-body-s min-h-11 sm:min-h-[32px]', md: 'px-4 py-2 text-body-m min-h-11'.",
        "3. JoinBar submit: py-1.5 → min-h-11 py-1.5 (bar grows ~10px on mobile only if needed).",
        "4. MainLayout nav links become ≥44px automatically once LAYOUT-002's mobile menu (py-3 rows) lands.",
        "5. Re-run the axe/e2e touch-target audit (qesto-e2e-tester pack) as regression proof."
      ],
      "codeExample": {
        "before": "className={concatClasses(\n  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium border …'",
        "after": "className={concatClasses(\n  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 min-h-11 min-w-11 justify-center text-sm font-medium border …'"
      }
    },
    {
      "id": "LAYOUT-006",
      "severity": "medium",
      "category": "mobile",
      "title": "Likert scale locks 5 columns at every viewport; labels crush at ≤375px",
      "description": "QuestionVoteInput renders Likert options as grid grid-cols-5 gap-1.5 with px-1 text-xs buttons and no responsive variant. At 375px each column is ~60px wide; full labels like 'Strongly disagree' wrap into 3–4 line fragments ('Stron-gly disa-gree'), and at 320px the buttons approach 44px width with unreadable text. The reaction grid two branches up already does this correctly (grid-cols-3 sm:grid-cols-5).",
      "location": {
        "file": "src/pages/join/QuestionVoteInput.tsx",
        "component": "Likert branch",
        "lineRange": [96, 124]
      },
      "currentBehavior": "Five ~60px columns with multi-line text-xs labels on phones.",
      "expectedBehavior": "Readable Likert control on phones: stacked full-width rows (or numeric buttons with a legend) below sm, 5-across from sm up.",
      "affectedDevices": ["mobile"],
      "remediationSteps": [
        "1. Change the container to grid grid-cols-1 sm:grid-cols-5 gap-1.5 and add w-full text-left sm:text-center to buttons (stacked rows read naturally and each row is a full-width ≥44px target).",
        "2. Alternative if 5-across must stay: show the scale number in the button and the two pole labels above the grid, with aria-label carrying the full text.",
        "3. Verify at 320px and 375px with the longest EN/DE label strings."
      ],
      "codeExample": {
        "before": "<div className=\"grid grid-cols-5 gap-1.5\">",
        "after": "<div className=\"grid grid-cols-1 sm:grid-cols-5 gap-1.5\">"
      }
    },
    {
      "id": "LAYOUT-007",
      "severity": "medium",
      "category": "viewport",
      "title": "Mixed min-h-screen / min-h-dvh causes iOS toolbar overshoot on full-height centered states",
      "description": "index.html sets viewport-fit=cover and ParticipantShell correctly uses min-h-dvh, but 35 other surfaces still use min-h-screen (100vh) — including the JoinPage loading/error states and the Voter main, the Login page, and Present's loading state — and SessionWizard's modal caps at max-h-[90vh]. On iOS Safari 100vh includes the collapsed-toolbar region, so vertically-centered content sits low (or the page scrolls ~60px for no reason) while the URL bar is expanded, and 90vh modals can extend under the home-indicator area with the keyboard open.",
      "location": {
        "file": "src/pages/JoinPage.tsx",
        "component": "loading/error/Voter mains (pattern repeats in 35 files; SessionWizard.tsx:368 for 90vh)",
        "lineRange": [104, 294]
      },
      "currentBehavior": "min-h-screen/90vh measure the largest viewport on iOS; centered states mis-center and modals can exceed the visible viewport.",
      "expectedBehavior": "Full-height surfaces track the dynamic viewport (dvh) consistently, as ParticipantShell already does.",
      "affectedDevices": ["mobile (iOS Safari, Android Chrome with dynamic toolbars)"],
      "remediationSteps": [
        "1. Codemod min-h-screen → min-h-dvh across src/ (Tailwind v4 ships min-h-dvh natively; behaviour is identical everywhere except dynamic-toolbar browsers, where it becomes correct).",
        "2. Change modal caps max-h-[90vh] → max-h-[90dvh] (SessionWizard and any other fixed-overlay panels).",
        "3. Spot-check Login and /j/:code on an iPhone with the URL bar expanded."
      ],
      "codeExample": {
        "before": "<main id=\"main\" className=\"min-h-screen flex flex-col items-center justify-center gap-3 p-8 …\">",
        "after": "<main id=\"main\" className=\"min-h-dvh flex flex-col items-center justify-center gap-3 p-8 …\">"
      }
    },
    {
      "id": "LAYOUT-008",
      "severity": "medium",
      "category": "spacing",
      "title": "density-stack-*/density-pad-* utilities are documented as no-op swaps for space-y-*/p-* but are 25–50% smaller",
      "description": "styles.css documents the density utilities as mirroring 'the matching Tailwind step at scale 1 … swapping space-y-6 → density-stack-6 / p-8 → density-pad-8 is a no-op at the default density.' That was written against Tailwind's default scale, but the remapped @theme tokens (LAYOUT-001) broke the equivalence: density-stack-6 = 1.5rem (24px) vs space-y-6 = 32px; density-pad-8 = 2rem (32px) vs p-8 = 48px; density-stack-12 = 3rem (48px) vs space-y-12 = 96px. Dashboard already uses density-stack-12 where sibling pages use space-y-* — so 'comfortable' density on the dashboard is literally half the section gap the token scale prescribes, and any future swap done per the comment's instructions silently compresses the page it touches.",
      "location": {
        "file": "src/styles.css",
        "component": "density-stack / density-pad @utility block",
        "lineRange": [172, 196]
      },
      "currentBehavior": "The documented no-op swap changes rendered spacing by 25–50%; density-adjusted pages have different rhythm than non-density pages at default density.",
      "expectedBehavior": "density-*-N at --density-scale: 1 renders exactly the same as the corresponding Tailwind step, whatever scale LAYOUT-001 settles on.",
      "affectedDevices": ["desktop", "tablet", "mobile"],
      "remediationSteps": [
        "1. Define the density utilities in terms of the same tokens: density-stack-6 → margin-top: calc(var(--spacing-6) * var(--density-scale)) (repeat for 4/5/8/10/12 and the pad variants).",
        "2. Re-check Dashboard/AccountSettings rhythm after the change (they will visibly widen at default density — confirm with design that this is the intended geometry).",
        "3. Fold this into the LAYOUT-001 migration so both scales are corrected in one visual-diff pass."
      ],
      "codeExample": {
        "before": "@utility density-stack-6  { & > * + * { margin-top: calc(1.5rem  * var(--density-scale)); } }",
        "after": "@utility density-stack-6  { & > * + * { margin-top: calc(var(--spacing-6, 1.5rem) * var(--density-scale)); } }"
      }
    },
    {
      "id": "LAYOUT-009",
      "severity": "medium",
      "category": "typography",
      "title": "Fixed-px display headings don't step down on mobile",
      "description": "Home's section heading uses text-[48px] with no responsive prefix and the hero uses text-5xl (48px) md:text-[60px]; several marketing templates use similar fixed sizes (Pricing h2 text-4xl). At 375px a 48px display heading fits ~10–12 characters per line, so multi-word headings ('Everything you need to run a session') wrap into 4–5 line towers that push the fold content down a full screen. The @theme type scale already defines smaller display steps that go unused here.",
      "location": {
        "file": "src/pages/Home.tsx",
        "component": "hero h1 / section h2",
        "lineRange": [113, 231]
      },
      "currentBehavior": "48px headings render at 48px from 320px up.",
      "expectedBehavior": "Display type ramps with the viewport: ~32-36px at mobile, 48-60px from md.",
      "affectedDevices": ["mobile"],
      "remediationSteps": [
        "1. Home.tsx:113 → text-4xl md:text-[60px]; Home.tsx:226 → text-3xl md:text-[48px].",
        "2. Grep marketing pages for text-\\[4[0-9]px\\]|text-5xl without an md:/lg: partner and apply the same ramp.",
        "3. Longer-term: expose the @theme display scale as responsive utilities (e.g. a .text-display class with a clamp()) so pages stop hand-rolling px sizes."
      ],
      "codeExample": {
        "before": "className=\"… font-bold text-[48px] leading-[1.1] tracking-[-0.02em] …\"",
        "after": "className=\"… font-bold text-3xl md:text-[48px] leading-[1.15] md:leading-[1.1] tracking-[-0.02em] …\""
      }
    },
    {
      "id": "LAYOUT-010",
      "severity": "low",
      "category": "mobile",
      "title": "Long unbroken session titles can overflow participant and card layouts",
      "description": "JoinPage's h1 ({title}) and dashboard session-card titles render host-provided strings without break-words/truncate in several spots. A title pasted as one long token (URL, hashtag string) exceeds the max-w-lg column and forces horizontal scroll on phones. Some card rows already truncate correctly (RecentSessionsSection uses truncate); the participant h1 and SessionEndedCard do not.",
      "location": {
        "file": "src/pages/JoinPage.tsx",
        "component": "Voter h1",
        "lineRange": [326, 328]
      },
      "currentBehavior": "An unbroken 60-char title overflows the 375px viewport.",
      "expectedBehavior": "Titles wrap (break-words) in reading surfaces and truncate with ellipsis in card rows.",
      "affectedDevices": ["mobile"],
      "remediationSteps": [
        "1. Add break-words to the Voter h1 and ParticipantShell title.",
        "2. Audit *Join pages and SessionEndedCard for the same pattern.",
        "3. Add a Vitest/Playwright fixture session titled with a 60-char unbroken string."
      ],
      "codeExample": {
        "before": "<h1 tabIndex={-1} className=\"text-2xl font-semibold text-pulse-900 dark:text-[#F0F2F8] focus:outline-none\">",
        "after": "<h1 tabIndex={-1} className=\"text-2xl font-semibold break-words text-pulse-900 dark:text-[#F0F2F8] focus:outline-none\">"
      }
    },
    {
      "id": "LAYOUT-011",
      "severity": "low",
      "category": "alignment",
      "title": "Shared Card/Button primitives disagree with ADR-0071 radius conventions",
      "description": "ADR-0071 (design system v1) fixes cards/panels at rounded-xl and buttons at rounded-lg. The shared primitives in src/ui/components.tsx ship Card with rounded-lg and Button with rounded-md, while most hand-rolled cards/buttons across pages follow the ADR. The two populations sit side by side (e.g. ui Card next to rounded-xl panels in admin tabs), producing visible radius mismatches on dense screens.",
      "location": {
        "file": "src/ui/components.tsx",
        "component": "Card / Button",
        "lineRange": [69, 117]
      },
      "currentBehavior": "Primitive-built surfaces have smaller radii than ADR-compliant hand-rolled ones on the same screen.",
      "expectedBehavior": "Card → rounded-xl, Button → rounded-lg everywhere (single source of truth in the primitives).",
      "affectedDevices": ["desktop", "tablet", "mobile"],
      "remediationSteps": [
        "1. Change Card to rounded-xl and Button baseStyles to rounded-lg in src/ui/components.tsx.",
        "2. Visual-diff admin/analytics screens (heaviest Card consumers).",
        "3. Note the fix in the ADR-0071 changelog."
      ],
      "codeExample": {
        "before": "const baseStyles = 'rounded-md font-medium transition-all duration-150 …'  // Button\n…\nclassName={`rounded-lg border border-pulse-200 … p-4`}  // Card",
        "after": "const baseStyles = 'rounded-lg font-medium transition-all duration-150 …'  // Button (ADR-0071)\n…\nclassName={`rounded-xl border border-pulse-200 … p-4`}  // Card (ADR-0071)"
      }
    }
  ],
  "summary": {
    "totalFindings": 11,
    "byCriticality": {
      "critical": 2,
      "high": 3,
      "medium": 4,
      "low": 2
    },
    "byDevice": {
      "desktop": 3,
      "mobile": 9,
      "responsive": 6
    },
    "overallScore": "64"
  }
}
```

## Impact quantification

- **Participant surfaces are phone-first by nature** (audience members join `/j/:code` from their own devices in a room). LAYOUT-004/005/006/007 sit directly on that path: effectively **every iOS participant** who answers an open-text question hits the zoom-on-focus jump, and every `upvote`-question participant taps a ~32px control.
- **LAYOUT-002/003 gate the mobile acquisition funnel**: all marketing pages share the non-collapsing header, and the pricing matrix — the plan-disclosure surface — is unreadable/clipped below ~700px.
- **LAYOUT-001/008 are maintainability time-bombs** rather than user-visible today (the rendered app *was* QA'd with the remapped values): every future component authored with standard Tailwind muscle memory, every AI-generated diff, and every documented density swap lands on the wrong scale silently.

## What was checked and found healthy

- Viewport meta (`width=device-width, initial-scale=1, viewport-fit=cover`) ✓
- `AppShellLayout` mobile drawer (backdrop, `lg:static` sidebar, hamburger) ✓
- `grid.css` mobile-first 4/8/12 column system with sane gutters ✓
- `Present.tsx` 1920×1080 letterboxed stage with scale clamp + scroll fallback ✓
- Admin/audit tables wrapped in `overflow-x-auto` (AuditLogViewer, SloDashboardPanel, ObservabilityPanel, AdminOpsTab, AdminUsersTab, AnalyticsAdvancedPanel) ✓
- Marketing grids consistently `grid-cols-1 → sm/md/lg` responsive ✓
- 72 × `min-h-[44px]` touch-target enforcement on newer surfaces (workspaces, XR button) ✓
- Modal pattern (backdrop `p-4`, panel `max-h` + inner `overflow-y-auto`) ✓ (modulo `vh`→`dvh`, LAYOUT-007)
- Micro-typography (10–12px) confined to badges/labels, body text ≥14px with 1.5+ line-height via the `@theme` type scale ✓

## Suggested remediation order (effort-first)

1. **LAYOUT-004** input font sizes — one file + grep, minutes. Highest UX win per line changed.
2. **LAYOUT-005** touch-target floors — a handful of class edits (`min-h-11` is scale-safe today).
3. **LAYOUT-003** pricing matrix scroll — two class changes.
4. **LAYOUT-006** Likert stacking, **LAYOUT-010** break-words, **LAYOUT-011** radii — small, independent.
5. **LAYOUT-007** `min-h-screen → min-h-dvh` codemod — mechanical but wide; needs a smoke pass.
6. **LAYOUT-002** mobile marketing nav — a real component, ~half day with focus management.
7. **LAYOUT-009** heading ramps — small, but wants design eyes on the mobile sizes.
8. **LAYOUT-001 + LAYOUT-008** spacing-scale consolidation — the big one; plan as its own story with a visual-diff gate (recommend an ADR since it amends ADR-0071's token layer).
