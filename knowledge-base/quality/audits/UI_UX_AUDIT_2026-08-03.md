# Critical UI/UX Audit — 3 August 2026

> **Scope:** Shipped frontend in `src/` — design-token layer (`src/styles.css`, `src/styles/tokens.css`,
> `src/styles/canvas-themes.css`), the shared component library (`src/ui/components.tsx`,
> `src/ui/input-field-class.ts`), and the four highest-traffic surfaces: the marketing landing page
> (`src/pages/Home.tsx` + `src/layouts/MainLayout.tsx`), authentication (`src/pages/Login.tsx`), the
> participant flow (`src/pages/JoinPage.tsx`, `src/pages/join/*`), and the presenter/audience stage
> (`src/pages/Present.tsx`). Repo-wide greps for cross-cutting anti-patterns.
>
> **Method:** Token files and component library read in full; page components read line-by-line;
> every colour pair below computed with the WCAG 2.1 relative-luminance formula (not eyeballed);
> repo-wide greps to establish blast radius for each systemic finding. Audit-only — no application
> code changed in this pass.
>
> **Target audience assumed:** participants are non-technical, mobile-first, joining once with no
> account and no onboarding; hosts are facilitators/teachers on a laptop driving a projector;
> audience members read the projected stage from across a room. Accessibility is a stated
> product commitment (WCAG 2.1 AA, `[data-high-contrast]` mode, an AAA canvas theme), so
> contrast failures are treated as compliance defects, not preferences.

---

## Executive summary

The token layer is genuinely good work. `canvas-themes.css` is the strongest artefact in the
codebase — four presentation themes with per-token contrast ratios computed and documented in
comments, including a real AAA high-contrast theme. Motion tokens, density scaling, dark-mode
semantic aliases, and the iOS 16px input-zoom guard all show deliberate thought. The problems below
are not "nobody cared"; they are drift between a carefully-specified system and what the components
actually paint.

Three systemic defects dwarf everything else:

**1. The brand gradient fails WCAG AA everywhere it carries text.** `--gradient-brand` runs
`#14B8A6 → #8B5CF6`. White text on the teal end is **2.49:1** — failing not just the 4.5:1 normal-text
threshold but the 3.0:1 large-text threshold too. This is the fill on every primary CTA in the
product (38 `from-teal-500` call sites plus the `bg-gradient-brand` utility). The same gradient used
as `bg-clip-text` renders the **join code on the projected audience screen** — the single most
important string in the entire product — at 2.49:1 against white, and it bypasses the canvas theme
system entirely, so the AAA high-contrast theme silently does not apply to it. The solid fallback
`bg-teal-600` + white (42 files, including the participant's Join button) is **3.74:1** — also a fail
at 14px. The whole primary-action colour story needs one decision: darken to `teal-700` (5.47:1) or
stop putting white text on the gradient.

**2. Focus indication fails its own WCAG requirement.** `--shadow-focus-ring: 0 0 0 3px
rgba(20,184,166,0.4)` composites to `#A1E2DB`, which is **1.46:1 against white** — WCAG 2.1 SC 1.4.11
and 2.2 SC 2.4.11 both require 3:1. Separately, 122 call sites use `focus-visible:ring-offset-2` with
no `dark:ring-offset-*` anywhere in the repo, so Tailwind's default `#fff` offset paints a white halo
around every focused control in dark mode. Keyboard users currently have no compliant focus
indicator in either theme.

**3. The presenter stage is unusable on a phone and the participant vote controls are
unreachable after voting.** `Present.tsx` renders a fixed 1920×1080 canvas scaled with a
`STAGE_SCALE_FLOOR` of 0.45 inside an `overflow-x-hidden` container: on a 375px viewport the stage is
864px wide and roughly 55% of it — including the join panel, QR code, and join code — is clipped with
no way to scroll to it. Meanwhile the participant vote buttons use the native `disabled` attribute
for the "you already voted" state (174 `disabled=` vs. 1 `aria-disabled` repo-wide), which removes
them from the tab order, so keyboard and screen-reader users lose the ability to review their own
answer the moment they submit it.

Everything else is downstream of those three, or is consistency drift: 1,576 arbitrary hex values
across 114 files against a token contract that says otherwise, 63 inline `<svg>` elements against a
rule that says use `lucide-react`, a non-monotonic radius scale, and a landing page that is ~95%
hardcoded English in a product shipping five locales.

### Top three priorities

1. **UI-COL-001** — White-on-gradient / white-on-`teal-600` primary CTAs at 2.49:1 and 3.74:1. One
   token decision fixes ~80 call sites and is the highest-leverage change available.
2. **UI-A11Y-002** — The global focus ring at 1.46:1 plus 122 dark-mode white ring-offsets. No
   compliant keyboard focus indicator exists today, in either theme.
3. **UI-MOB-004 / UI-COL-003** — The audience stage clips its own join panel on mobile, and the join
   code it displays is the lowest-contrast text on the screen. Both attack the product's core loop:
   getting people into the room.

### Findings by severity

| Severity | Count |
|---|---|
| Critical | 5 |
| High | 10 |
| Medium | 10 |
| Low | 5 |
| **Total** | **30** |

---

## Structured findings

```json
{
  "audit": {
    "timestamp": "2026-08-03T00:00:00Z",
    "reviewer": "UI/UX design audit — visual design, layout, interaction, mobile, WCAG 2.1 AA, usability",
    "targetAudience": "Non-technical mobile-first participants (no account, single use); facilitator/teacher hosts on laptop driving a projector; room audience reading a projected stage at distance. Accessibility-first is a stated product commitment (WCAG 2.1 AA + AAA canvas theme + high-contrast mode)."
  },
  "findings": [
    {
      "id": "UI-COL-001",
      "severity": "critical",
      "category": "color",
      "title": "Every primary CTA in the product has white label text at 2.49:1 — fails even the large-text threshold",
      "issue": "`--gradient-brand` is `linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)` and is always paired with `text-white`. White on the teal-500 start stop is 2.49:1; white on the violet-500 end stop is 4.23:1. The entire gradient fails WCAG 2.1 AA 1.4.3 (4.5:1), and the teal half fails the 3.0:1 large-text allowance as well. The solid fallback `bg-teal-600 text-white` is 3.74:1 — also a fail at the 14px sizes it is used at.",
      "location": {
        "screen": "Global — every page with a primary action",
        "component": "src/ui/components.tsx Button variant='primary'; src/pages/Home.tsx:143,160; src/pages/Login.tsx:104 primaryBtn; src/pages/join/JoinLanding.tsx submit; src/pages/JoinPage.tsx:142 retry; src/styles.css:119 @utility bg-gradient-brand; src/styles/tokens.css:70",
        "element": "Primary button fill + label"
      },
      "currentState": "Primary buttons render white text on a teal→violet gradient. 38 files use `from-teal-500` gradients directly, 42 files use `bg-teal-600 text-white`, plus the shared `Button` component and the `bg-gradient-brand` utility. Three independent hand-rolled copies of the same gradient exist (Home uses `bg-[linear-gradient(to_bottom_right,#14b8a6,#8b5cf6)]`, Login uses `bg-gradient-to-br from-teal-500 to-violet-600`, the design system uses `bg-gradient-brand`).",
      "problemStatement": "The most-clicked control in the product is the least readable. Low-vision users, anyone on a laptop screen in a bright training room, and anyone with a glossy projector cannot reliably read CTA labels. Because the failure lives in the shared `Button` primitive and a registered Tailwind utility, it is inherited by every feature built on the design system rather than being a page-level slip. It also makes any WCAG 2.1 AA conformance claim in sales or procurement material indefensible.",
      "severity_justification": "Critical: a measured WCAG 2.1 AA 1.4.3 failure on the product's primary interactive element, replicated across ~80 call sites, at a ratio (2.49:1) that fails even the relaxed large-text threshold. Not a judgement call — arithmetic.",
      "affectedUsers": "All users; acutely low-vision users, users with colour vision deficiency, and anyone viewing in high ambient light. Blocks WCAG 2.1 AA conformance claims for the whole product.",
      "recommendation": {
        "principle": "WCAG 2.1 AA SC 1.4.3 Contrast (Minimum) — 4.5:1 normal text, 3:1 large text (≥24px, or ≥18.66px bold).",
        "suggested_approach": "Decide once, at the token: either (a) shift the gradient's text-bearing range darker — `#0F766E → #6D28D9` gives 5.47:1 at the start and 7.5:1 at the end, keeping the brand read while passing AA across the whole sweep; or (b) keep `--gradient-brand` for decorative surfaces only (hero glows, accent bars, the top brand strip) and introduce `--color-action` = `#0F766E` (teal-700, 5.47:1) as the only fill allowed under white label text. Then collapse the three hand-rolled gradient copies into the single `bg-gradient-brand` utility so this stays fixed. Add a CI contrast assertion over the token file so a future palette tweak cannot silently regress it.",
        "example": "`--gradient-brand-action: linear-gradient(135deg, #0F766E 0%, #6D28D9 100%)` for CTAs; keep `--gradient-brand` (#14B8A6 → #8B5CF6) for decorative fills that never carry text. Reference: Stripe and Linear both restrict their brand gradients to decorative surfaces and use a single darkened solid for action buttons, for exactly this reason."
      },
      "estimatedImpact": "Major accessibility and legibility win; the single highest-leverage change in this audit. One token edit plus a mechanical sweep of ~80 call sites."
    },
    {
      "id": "UI-A11Y-002",
      "severity": "critical",
      "category": "accessibility",
      "title": "No compliant keyboard focus indicator exists — 1.46:1 ring in light mode, white halo in dark mode",
      "issue": "Two independent defects in the same system. (1) `--shadow-focus-ring: 0 0 0 3px rgba(20,184,166,0.4)` composites over white to `#A1E2DB` = **1.46:1** against the page and 2.57:1 against a teal-600 button — WCAG 2.1 SC 1.4.11 Non-text Contrast requires 3:1 for focus indicators. (2) 122 call sites use `focus-visible:ring-offset-2` and the repo contains **zero** `dark:ring-offset-*` declarations and no `--tw-ring-offset-color` override, so Tailwind's default `#fff` paints a hard white ring around every focused control in dark mode.",
      "location": {
        "screen": "Global",
        "component": "src/styles/tokens.css:120,239-243 (`:where(button,a,input,…):focus-visible`); src/styles.css:80,152,219; 122 `ring-offset-2` call sites across src/",
        "element": "Focus ring on all interactive elements"
      },
      "currentState": "Tabbing through any page produces a pale mint glow that is essentially invisible on white. In dark mode, controls that use the Tailwind ring utilities gain a bright white 2px halo that reads as a rendering artefact rather than a focus state. The token-based ring and the Tailwind ring utilities are also two competing systems producing visually different focus states on adjacent controls.",
      "problemStatement": "Keyboard-only users, switch-device users, and screen-magnifier users cannot locate focus. This is the most commonly-cited WCAG failure in accessibility audits and it is a hard blocker for public-sector and enterprise procurement — a market this product explicitly courts with its SOC 2 and GDPR trust centres. The dark-mode white halo additionally makes the app look broken in a theme the product ships a manual toggle for.",
      "severity_justification": "Critical: WCAG 2.1 SC 1.4.11 and WCAG 2.2 SC 2.4.11 failure affecting 100% of keyboard navigation across 100% of the app. Blocks compliance entirely.",
      "affectedUsers": "All keyboard-only users, motor-impaired users, screen-magnifier users, power users who navigate by keyboard. ~100% of dark-mode users see the halo artefact.",
      "recommendation": {
        "principle": "WCAG 2.1 AA SC 1.4.11 Non-text Contrast (3:1 for focus indicators); WCAG 2.2 SC 2.4.11 Focus Not Obscured; SC 2.4.13 Focus Appearance.",
        "suggested_approach": "Raise the ring to full opacity and add a contrasting inner ring so it works on both light and dark surfaces, then set the offset colour per theme. Also remove `border-radius: var(--radius-md)` from the `:focus-visible` rule — it currently forces a 10px radius onto pills and circular controls on focus, so the shape visibly changes when focused.",
        "example": "`--shadow-focus-ring: 0 0 0 2px var(--color-bg), 0 0 0 4px #0F766E;` (5.47:1 outer ring, separated from any background by a 2px halo in the surface colour). Dark: `0 0 0 2px var(--color-bg), 0 0 0 4px #2DD4BF`. Then add `--tw-ring-offset-color: var(--color-bg)` in `:root` and `[data-theme=dark]` so the 122 `ring-offset-2` sites inherit the right offset automatically instead of needing 122 edits."
      },
      "estimatedImpact": "Major accessibility win; removes a hard compliance blocker. Two token edits plus one global `--tw-ring-offset-color` declaration fixes all 122 sites."
    },
    {
      "id": "UI-COL-003",
      "severity": "critical",
      "category": "color",
      "title": "The join code on the projected audience screen is the lowest-contrast text on it (2.49:1) and ignores the canvas theme system",
      "issue": "The 6-character join code — the string every participant in the room must read and type to enter — is rendered at `text-[52px]` with `bg-clip-text text-transparent` filled by `var(--gradient-brand)`. Against the default canvas surface (`#FAFAFA`) the teal end is 2.49:1. Worse, it hardcodes `--gradient-brand` instead of `var(--canvas-accent)`, so it is the one element on the stage that does not respond to the canvas theme — including the `high-contrast` theme, which the codebase documents as satisfying WCAG AAA 7:1 and 'qualifies for FE-AAA-GA-01'.",
      "location": {
        "screen": "/present/:id — audience-facing 1920×1080 stage",
        "component": "src/pages/Present.tsx:533-539 (join panel)",
        "element": "Join code display"
      },
      "currentState": "A gradient-filled monospace code at 52px inside the join panel. Every sibling element on the stage correctly consumes `var(--canvas-text)`, `var(--canvas-accent)`, `var(--canvas-border)`; the join code alone reaches past the theme layer to the app-level brand gradient.",
      "problemStatement": "This element is read at distance — from the back of a classroom or conference room, through a projector that typically loses 30-50% of designed contrast. A 2.49:1 ratio that is already marginal on a laptop becomes unreadable when projected. Participants who cannot read the code cannot enter the session, which is a total task failure at the product's entry point, not a degraded experience. The theme bypass is a separate defect: a facilitator who deliberately selects the high-contrast theme for an accessibility-sensitive audience gets AAA treatment on everything except the one string that matters most.",
      "severity_justification": "Critical: blocks the product's primary entry task for part of the room, fails WCAG 1.4.3 at large-text threshold, and silently voids the documented AAA guarantee of the high-contrast canvas theme.",
      "affectedUsers": "Every participant in every room, weighted heavily toward those seated far from the screen, low-vision attendees, and rooms where the facilitator chose high-contrast specifically for accessibility reasons.",
      "recommendation": {
        "principle": "WCAG 2.1 AA SC 1.4.3; Nielsen heuristic #1 Visibility of System Status; the codebase's own canvas-theme token contract in src/styles/canvas-themes.css.",
        "suggested_approach": "Drop the gradient fill on the join code and use `color: var(--canvas-text)` — 21:1 on the default theme, 16.3:1 on dark, 21:1 on high-contrast, and it inherits every future theme for free. If a brand accent is wanted, `var(--canvas-accent)` is already contrast-audited per theme (5.47:1 / 8.1:1 / 8.9:1 / 7.8:1). Consider also grouping the code characters (`ABC · 123`) — chunking measurably reduces transcription errors at distance.",
        "example": "`<div className=\"font-mono text-[52px] font-bold tracking-[0.12em]\" style={{ color: 'var(--canvas-text)' }}>` — same visual weight, 21:1 instead of 2.49:1."
      },
      "estimatedImpact": "Major usability win at the product's front door; a two-line change."
    },
    {
      "id": "UI-MOB-004",
      "severity": "critical",
      "category": "mobile",
      "title": "The presenter stage clips ~55% of itself on a phone with no way to scroll to it — including the join panel and QR code",
      "issue": "`Present.tsx` renders a fixed `w-[1920px] h-[1080px]` stage scaled by CSS transform, with `STAGE_SCALE_FLOOR = 0.45`. On a 375px-wide viewport the natural fit scale is 0.195, which is clamped up to 0.45 — producing an 864px-wide stage inside a 375px container whose class list is `overflow-y-auto overflow-x-hidden`. The right ~489px is unreachable: no horizontal scroll, no pan, no responsive fallback. Everything positioned at `right-[64px]` — the join panel, the join code, the QR code, the participant count, the energizer leaderboard — is invisible.",
      "location": {
        "screen": "/present/:id",
        "component": "src/pages/Present.tsx:23 (STAGE_SCALE_FLOOR), 360-368 (container), 521-564 (join panel), 566-593 (leaderboard)",
        "element": "Letterboxed stage container"
      },
      "currentState": "A host opening the presenter view on a phone sees the left portion of a desktop canvas: the question headline and results bars, with the entire right column silently cut off. The CSS contains a `.present-mobile-bar` rule with `env(safe-area-inset-bottom)` handling — but grep confirms that class is referenced nowhere in `src/`, so the mobile presenter treatment it was written for does not exist.",
      "problemStatement": "Facilitators routinely run sessions from a phone — walking a room, presenting from a tablet, or checking a session between meetings. The clipped region is not decorative: it is the join panel. A host on mobile literally cannot show or read the code that lets people join. `overflow-x-hidden` converts what would be an ugly-but-usable horizontal scroll into a hard content loss, and the 0.45 floor guarantees the overflow rather than merely permitting it.",
      "severity_justification": "Critical: blocks the core host task (get participants into the session) on an entire device class, with no workaround or discoverable affordance that content is missing.",
      "affectedUsers": "Every host on a phone or small tablet; anyone on a narrow/split-screen desktop window below ~1000px effective width.",
      "recommendation": {
        "principle": "Nielsen heuristic #1 Visibility of System Status (content is hidden with no indication); mobile-first responsive design; WCAG 2.1 SC 1.4.10 Reflow (content must not require two-dimensional scrolling at 320px equivalent).",
        "suggested_approach": "The fixed-canvas approach is correct for the projected display, wrong for the host's own device. Split them: below `lg`, render a purpose-built presenter view — join code and QR first, then question, then results, then the `PresenterControls` — stacked in a normal flow document. Keep the 1920×1080 canvas for `/display/:code` and for `lg`+ presenters. As an immediate mitigation, change `overflow-x-hidden` to `overflow-x-auto` so the content is at least reachable, and delete or wire up the orphaned `.present-mobile-bar` rule.",
        "example": "`{isNarrow ? <PresenterMobileView … /> : <Stage … />}` gated on a `useMediaQuery('(min-width: 1024px)')`, reusing the existing `JoinCodePanel` component from `src/components/launchpad/` for the mobile join block."
      },
      "estimatedImpact": "Major usability win; converts a broken device class into a supported one."
    },
    {
      "id": "UI-A11Y-005",
      "severity": "critical",
      "category": "accessibility",
      "title": "The open-text and word-cloud vote field has no accessible name — placeholder is its only label",
      "issue": "The response input for `open` and `word_cloud` question kinds is rendered with a placeholder via `inputHint()` and nothing else: no `<label>`, no `aria-label`, no `aria-labelledby`. Screen readers announce it as an unlabelled edit field, and the placeholder disappears the moment the user starts typing, so sighted users lose the prompt too.",
      "location": {
        "screen": "/j/:code — participant voting",
        "component": "src/pages/join/QuestionVoteInput.tsx (word_cloud / open branch)",
        "element": "Free-text response input"
      },
      "currentState": "`<input type=\"text\" name=\"resp\" maxLength={120} {...inputHint(t('word_phrase_hint'))} className={ENTRY_RESPONSE_FIELD_CLASS} autoComplete=\"off\" />` — the placeholder carries 100% of the labelling.",
      "problemStatement": "For open-text questions this is the participant's only means of responding. A screen-reader user reaches an anonymous 'edit, blank' with no indication of what is being asked beyond the separately-rendered question heading, which is not programmatically associated with the field. This is the textbook WCAG 3.3.2 / 4.1.2 failure, and it sits on the participant path — the one flow the product markets as requiring no account and working for everyone. Note that the neighbouring `JoinLanding` code field does this correctly with `aria-label` + `aria-describedby`; this is an inconsistency, not an unknown pattern.",
      "severity_justification": "Critical: WCAG 2.1 A SC 4.1.2 Name, Role, Value and SC 3.3.2 Labels or Instructions failure on a primary input in the core participant task. Level A, not AA.",
      "affectedUsers": "Screen-reader users, voice-control users (who need an accessible name to target the field by voice), and all users once typing clears the placeholder.",
      "recommendation": {
        "principle": "WCAG 2.1 A SC 4.1.2 Name, Role, Value; SC 3.3.2 Labels or Instructions; NN/g — never use placeholder as label.",
        "suggested_approach": "Add a visible `<label>` bound with `htmlFor`, or at minimum `aria-labelledby=\"question-heading\"` to inherit the already-rendered question prompt as the field's name. Keep the placeholder as an example, not as the label.",
        "example": "`<label htmlFor=\"resp\" className=\"sr-only\">{t('response_label')}</label><input id=\"resp\" aria-labelledby=\"question-heading\" … />` — matching the pattern already used correctly in JoinLanding."
      },
      "estimatedImpact": "Major accessibility win; a two-line fix that removes a Level A failure from the primary user path."
    },
    {
      "id": "UI-COL-006",
      "severity": "high",
      "category": "color",
      "title": "Solid `bg-teal-600` + white 14px label (3.74:1) fails AA — including the participant's Join button",
      "issue": "`bg-teal-600` (`#0D9488`) with `text-white` measures 3.74:1. It clears the 3:1 large-text bar but is used almost exclusively at `text-sm` (14px) / `text-xs` (12px), where 4.5:1 is required. It appears in 42 files, including the participant's primary Join submit and the 'Try again' recovery button on the session-not-found screen.",
      "location": {
        "screen": "Global; notably /j (JoinLanding submit), /j/:code error state",
        "component": "src/pages/join/JoinLanding.tsx (submit button); src/pages/JoinPage.tsx:142 (retry); 42 files repo-wide",
        "element": "Solid primary buttons"
      },
      "currentState": "White 14px semibold labels on `#0D9488` fills across the app.",
      "problemStatement": "This is the non-gradient half of the same colour problem as UI-COL-001, and it lands on the two buttons that matter most on the participant path: the one that gets you into a session, and the one that recovers you when the code fails. Being 'close' to passing is worse than failing loudly, because it survives casual review.",
      "severity_justification": "High: WCAG 2.1 AA SC 1.4.3 failure across 42 files on primary actions, but at a ratio (3.74:1) that degrades legibility rather than destroying it, and with a trivially available compliant alternative.",
      "affectedUsers": "Low-vision users, users in high ambient light, ~8% of male users with colour vision deficiency (teal desaturates toward mid-grey under deuteranopia simulation).",
      "recommendation": {
        "principle": "WCAG 2.1 AA SC 1.4.3 Contrast (Minimum).",
        "suggested_approach": "Move solid primary fills from `teal-600` to `teal-700` (`#0F766E`, 5.47:1 with white). The palette already contains it and the Login tab-switcher already uses `bg-teal-700 text-white` correctly — so this is aligning the rest of the app with a pattern the codebase already got right once.",
        "example": "`bg-teal-600` → `bg-teal-700`, `hover:bg-teal-700` → `hover:bg-teal-800`. Visually near-identical; 3.74:1 → 5.47:1."
      },
      "estimatedImpact": "Significant accessibility win; a mechanical find-and-replace across 42 files."
    },
    {
      "id": "UI-A11Y-007",
      "severity": "high",
      "category": "accessibility",
      "title": "Vote buttons use the native `disabled` attribute for 'already voted', removing the participant's own answer from the tab order",
      "issue": "After voting, every option button gets `disabled={hasVoted || !canVote}`. `disabled` removes elements from the accessibility tree's interactive surface and from the tab order entirely — so the `aria-pressed={voted}` state that marks the user's own choice becomes unreachable. Repo-wide the ratio is 174 `disabled=` to 1 `aria-disabled`, so this is a codebase-wide default rather than a local slip.",
      "location": {
        "screen": "/j/:code — participant voting",
        "component": "src/pages/join/QuestionVoteInput.tsx — poll/ranking/consent default branch, likert branch, multi_select branch, upvote branch",
        "element": "Option buttons after submission"
      },
      "currentState": "A sighted user sees their choice highlighted in teal with a checkmark. A keyboard or screen-reader user tabs straight past all options into the results region and has no way to confirm what they selected.",
      "problemStatement": "The confirmation of your own vote is arguably the most important feedback in the entire product — this is a voting tool, and 'did my vote register?' is the question every participant asks. Removing that confirmation from assistive technology is a direct violation of the anonymity/trust promise the product markets, since the user cannot verify their input was recorded. `disabled` is the wrong primitive for 'submitted': the correct one is `aria-disabled` + a click guard, which keeps the control focusable and its state announceable.",
      "severity_justification": "High: significantly impairs the core task for AT users and removes essential state feedback, though a sighted-mouse user is unaffected. Related to WCAG 2.1 SC 4.1.2 (state must be programmatically determinable and perceivable).",
      "affectedUsers": "Screen-reader users, keyboard-only users, switch users, voice-control users.",
      "recommendation": {
        "principle": "WCAG 2.1 A SC 4.1.2 Name, Role, Value; WAI-ARIA APG guidance — prefer `aria-disabled` over `disabled` when the control's state carries information the user needs to perceive.",
        "suggested_approach": "Replace `disabled={hasVoted}` with `aria-disabled={hasVoted}` plus an early return in `onClick`, keeping the visual treatment identical. Keep the native `disabled` only for `!canVote` (offline), where the control genuinely has nothing to communicate. Add `role=\"status\"` confirmation text ('Your answer: <label>') after submission so the confirmation is announced, not merely inspectable.",
        "example": "`aria-disabled={hasVoted || !canVote}` + `onClick={() => { if (hasVoted || !canVote) return; onVote(o.id) }}` — one-line change per branch, four branches."
      },
      "estimatedImpact": "Significant accessibility win on the core participant task."
    },
    {
      "id": "UI-INT-008",
      "severity": "high",
      "category": "interaction",
      "title": "Multi-select and upvote choices cannot be undone — a mis-tap is permanent",
      "issue": "In the `multi_select` branch, `disabled={selected || !canVote}` means once an option is selected it can never be deselected. Same in the `upvote` branch: `disabled={upvoted || !canVote}`. There is no deselect path, no clear-all, and no confirmation step before the selection commits.",
      "location": {
        "screen": "/j/:code — participant voting",
        "component": "src/pages/join/QuestionVoteInput.tsx — multi_select and upvote branches",
        "element": "Option buttons / upvote controls"
      },
      "currentState": "Tapping an option in a multi-select question immediately and irreversibly commits it. On a phone, adjacent full-width options with `py-3.5` padding sit ~8px apart — a fat-finger mis-tap is likely and unrecoverable.",
      "problemStatement": "Multi-select is universally understood as a toggle: users expect a second tap to deselect, because that is how every checkbox on the web behaves. Violating that expectation without warning means a mis-tap silently corrupts the data the facilitator will later present as the room's opinion — so this is a data-integrity problem, not only a UX one. Nielsen's third heuristic (User Control and Freedom) exists precisely for this case: users need a clearly marked emergency exit from actions taken by mistake.",
      "severity_justification": "High: significantly impairs the task and corrupts session data, but does not block completion. Mis-taps on mobile are common enough that this will occur in most sessions with multi-select questions.",
      "affectedUsers": "All participants answering multi-select or upvote questions; disproportionately mobile users and users with motor impairments.",
      "recommendation": {
        "principle": "Nielsen heuristic #3 User Control and Freedom; the platform convention that a checkbox/toggle is reversible.",
        "suggested_approach": "Make multi-select genuinely toggleable — send a deselect message on second tap — and give upvotes the same un-upvote affordance every social product has. If the realtime protocol cannot express a retraction, the interaction must change instead: batch the selections locally and add an explicit 'Submit answers' button, so the commit point is deliberate and everything before it is freely editable.",
        "example": "`onClick={() => canVote && (selected ? onUnvote(o.id) : onVote(o.id))}` with `aria-pressed={selected}` and no `disabled`. If retraction is impossible server-side, use the local-batch + explicit-submit pattern, which is also better for perceived control."
      },
      "estimatedImpact": "Significant usability win plus a measurable improvement in response-data accuracy."
    },
    {
      "id": "UI-A11Y-009",
      "severity": "high",
      "category": "accessibility",
      "title": "The global reduced-motion override silently disables every loading spinner",
      "issue": "The `prefers-reduced-motion` block applies `animation-duration: 1ms !important` **and** `animation-iteration-count: 1 !important` to `*`. That is correct for decorative motion but catastrophic for spinners: all 13 `animate-spin` indicators complete a single 1ms rotation and then freeze. Users who requested reduced motion get a static, meaningless partial arc where a progress indicator should be. The `.skeleton-shimmer` and `animate-pulse` indicators are flattened the same way.",
      "location": {
        "screen": "Global — 11 components including the participant lookup screen",
        "component": "src/styles.css:293-308 (@media prefers-reduced-motion); src/pages/JoinPage.tsx:106-114; plus SessionWizardFooter, PreFlightStrip, QuestionList, JoinCodePanel, CopilotPanel, SessionConfig, EmbedPlayground, Display, TeamInvite, EmbedWidget",
        "element": "Loading spinners and skeleton shimmer"
      },
      "currentState": "With reduced motion enabled, `/j/:code` shows a frozen partial circle and the text 'Looking up session…' while the network request runs. Whether the app is working or hung is indistinguishable.",
      "problemStatement": "`prefers-reduced-motion` means 'reduce vestibular-triggering motion', not 'remove system status feedback'. WCAG 2.1 SC 2.2.2 explicitly exempts motion that is essential to conveying information, and a loading indicator is the canonical example. The blanket `*` selector with `!important` makes this unfixable at the component level — no spinner can opt out. This disproportionately affects users with vestibular disorders, who are also more likely to be affected by a UI that appears frozen.",
      "severity_justification": "High: removes system-status feedback for an entire user preference cohort across every async operation in the app, and the `!important` blanket rule makes it locally unfixable.",
      "affectedUsers": "All users with `prefers-reduced-motion: reduce` set — users with vestibular disorders, migraine sufferers, and (notably) everyone on iOS with Reduce Motion enabled, which is a common battery/comfort setting well beyond the disability cohort.",
      "recommendation": {
        "principle": "WCAG 2.1 AA SC 2.2.2 Pause, Stop, Hide — with its explicit exemption for motion essential to the activity; WCAG 2.1 SC 1.4.13 and the intent of `prefers-reduced-motion`.",
        "suggested_approach": "Scope the blanket override so status indicators are exempt, and give reduced-motion users a non-rotating equivalent: an opacity pulse or an indeterminate progress bar conveys 'working' without spatial motion. Add an opt-out class the spinner components carry.",
        "example": "`*:not(.motion-essential), *:not(.motion-essential)::before { … }` plus `.animate-spin.motion-essential { animation-duration: 1s !important; animation-iteration-count: infinite !important; }` — or replace spinners entirely with a reduced-motion-safe opacity fade, which the codebase's existing `--motion-*` tokens already support."
      },
      "estimatedImpact": "Significant win for a large, mostly-invisible user cohort; restores status feedback across every async flow."
    },
    {
      "id": "UI-A11Y-010",
      "severity": "high",
      "category": "accessibility",
      "title": "Connection loss on the participant screen is neither announced nor readable (3.19:1, no live region)",
      "issue": "Two defects on the same element. The header connection indicator renders `<span className=\"text-xs text-amber-600\">{connectionLabel}</span>` — `#D97706` on white is **3.19:1** at 12px, failing SC 1.4.3 (4.5:1 required). And it is a plain `<span>` with no `role=\"status\"` or `aria-live`, so a screen-reader user is never told the session dropped. Ten lines further down, the inline reconnect notice does this correctly with `role=\"status\" aria-live=\"polite\"` — so the pattern is known and inconsistently applied.",
      "location": {
        "screen": "/j/:code — participant top bar",
        "component": "src/pages/JoinPage.tsx:290",
        "element": "Connection status label"
      },
      "currentState": "When the WebSocket drops, a faint amber 12px label appears in the header. Sighted users may miss it; screen-reader users are told nothing and continue attempting to vote into a closed socket.",
      "problemStatement": "In a realtime voting product, connection state is the highest-stakes status in the UI: a disconnected participant who believes they voted is worse than one who knows they did not. Nielsen's first heuristic is precisely this — the system must keep users informed about what is going on, through appropriate feedback, within reasonable time. Rendering that information at sub-AA contrast and outside any live region fails both the perceptual and the programmatic channel simultaneously.",
      "severity_justification": "High: WCAG SC 1.4.3 failure combined with missing status announcement on safety-critical state, on the core participant path. Not critical only because a second (correct) notice appears inline when a question is active.",
      "affectedUsers": "Screen-reader users (no announcement at all); all low-vision users (3.19:1); all participants on flaky conference-venue wifi — the exact conditions this product runs in.",
      "recommendation": {
        "principle": "Nielsen heuristic #1 Visibility of System Status; WCAG 2.1 AA SC 1.4.3 Contrast; SC 4.1.3 Status Messages.",
        "suggested_approach": "Add `role=\"status\" aria-live=\"polite\"` to the connection span (matching the inline notice pattern already in the file) and darken the text to `amber-700` (`#B45309`, 4.72:1) with a `dark:text-amber-300` counterpart. Pair the colour with the icon that already exists elsewhere in the file, so state is not communicated by colour alone.",
        "example": "`<span role=\"status\" aria-live=\"polite\" className=\"flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300\"><WifiOff size={12} aria-hidden />{connectionLabel}</span>`"
      },
      "estimatedImpact": "Significant win on trust and error recovery in exactly the network conditions the product is used in."
    },
    {
      "id": "UI-MOB-011",
      "severity": "high",
      "category": "mobile",
      "title": "15 footer links at 12px with ~18px touch targets — the coarse-pointer rule does not cover plain anchors",
      "issue": "The site footer renders 15 links in a single flat `<ul>` with `text-xs` (12px) and `gap-y-1` (4px). Their effective touch height is roughly 17-18px. The global touch-target rule in `styles.css` targets `button, a[role='button'], .touch-target` — plain `<a>` elements are excluded, so none of these links receive the 44px floor.",
      "location": {
        "screen": "Global — every page rendered through MainLayout",
        "component": "src/layouts/MainLayout.tsx (footer); src/styles.css:474-484 (coarse-pointer rule)",
        "element": "Footer navigation links"
      },
      "currentState": "A wrapped block of 15 identically-weighted 12px links with no grouping, no headings, and no visual hierarchy — Pricing, Events, HR, Nonprofit, Consulting, AI insights, Live polling, Privacy feature, GDPR trust center, SOC 2 trust center, Partner marketplace, Privacy Policy, Terms, Legal, Report illegal content.",
      "problemStatement": "Two problems compound. (1) Accessibility: ~18px targets fail WCAG 2.2 AA SC 2.5.8 Target Size (Minimum), which requires 24×24 CSS px, and fall far below the 44px platform guidance — on mobile these are effectively un-tappable without zooming, and adjacent-link mis-taps are near-certain. (2) Information architecture: fifteen undifferentiated links with no grouping give the user no mental model of the site. Product pages, legal notices, and trust-centre pages are all rendered with identical weight, so the footer functions as a link dump rather than as navigation. The `MainLayout` header already solves the grouping problem correctly with `mobileNavSections`; the footer ignores that solution.",
      "severity_justification": "High: WCAG 2.2 AA SC 2.5.8 failure on every page of the site, on the device class where footers get the most use, plus a genuine IA failure that affects wayfinding for all users.",
      "affectedUsers": "All mobile users (~60%+ of marketing traffic for this category of product); users with motor impairments or tremor; all users trying to navigate the site structure.",
      "recommendation": {
        "principle": "WCAG 2.2 AA SC 2.5.8 Target Size (Minimum, 24×24px); Apple HIG / Material 44-48px guidance; Gestalt proximity — group related items and label the groups.",
        "suggested_approach": "Extend the coarse-pointer rule to cover navigation anchors (`nav a`) or add `min-h-11 flex items-center` to the footer link class. Then restructure the footer into 3-4 labelled columns — Product / Solutions / Trust / Legal — mirroring the `mobileNavSections` structure already defined in the same file. Raise footer text from `text-xs` to `text-sm`.",
        "example": "`<nav aria-label=\"Footer\"><div className=\"grid grid-cols-2 md:grid-cols-4 gap-8\">{FOOTER_SECTIONS.map(s => <div><h2 className=\"caption-step\">{s.heading}</h2><ul>…<a className=\"flex min-h-11 items-center text-sm\">…</ul></div>)}</div></nav>`"
      },
      "estimatedImpact": "Significant mobile usability and IA win across every page of the site."
    },
    {
      "id": "UI-MOB-012",
      "severity": "high",
      "category": "mobile",
      "title": "Login card uses non-responsive `p-12`, leaving ~160px of usable width at 320px",
      "issue": "The auth card is `max-w-md … p-12` inside a `<main>` with `p-8`. At a 320px viewport that resolves to 320 − 64 (main padding) = 256px card width, minus 96px of card padding = **160px of content**. The three-tab switcher ('Magic link' / 'Log in' / 'Sign up') must fit 14px labels into ~52px each; email and password fields render 160px wide. There are no responsive padding breakpoints anywhere on the card.",
      "location": {
        "screen": "/login",
        "component": "src/pages/Login.tsx:108-112 (`<main className=\"…p-8\">`, `<section className=\"…max-w-md…p-12\">`)",
        "element": "Auth card container"
      },
      "currentState": "On a small phone the login card is mostly padding. Tab labels wrap or overflow; form fields are narrower than the email addresses typed into them.",
      "problemStatement": "This is the conversion gate for the entire product — every host account starts here. 48px of padding is a desktop-first choice applied unconditionally, which is the definition of the 'responsive theatre' anti-pattern: the card resizes but the layout never adapts to the content. Small-screen iPhone SE and Android compact devices remain a meaningful share of traffic, and a cramped, wrapping login form measurably increases abandonment at the single highest-value step in the funnel.",
      "severity_justification": "High: significantly impairs a high-value conversion flow on a real device class, though the flow remains technically completable.",
      "affectedUsers": "All users on ≤375px devices (iPhone SE/mini, Android compact, split-screen tablet users) signing up or signing in.",
      "recommendation": {
        "principle": "Mobile-first responsive design; WCAG 2.1 AA SC 1.4.10 Reflow (usable at 320px without horizontal scroll or loss of function).",
        "suggested_approach": "Make the padding responsive and reduce the outer gutter on small screens. Also consider stacking the three tabs vertically below `sm`, or replacing the tab switcher with a single primary method plus a 'more ways to sign in' disclosure — three peer tabs is itself a lot of choice at the front door.",
        "example": "`<main className=\"…px-4 py-8 sm:p-8\">` and `<section className=\"…p-6 sm:p-10 lg:p-12\">` — recovers ~64px of content width at 320px with no desktop change."
      },
      "estimatedImpact": "Significant conversion win at the product's highest-value funnel step."
    },
    {
      "id": "UI-LAY-013",
      "severity": "high",
      "category": "layout",
      "title": "`bg-pulse-950` is undefined — the presenter letterbox renders with no background",
      "issue": "`Present.tsx:356` applies `bg-pulse-950` to the full-screen stage container. The `@theme` block in `src/styles.css` defines `--color-pulse-50` through `--color-pulse-900` only; there is no `pulse-950`. In Tailwind v4 an undefined theme colour produces no utility at all, so the class is inert and the container has no background. The same dead class appears twice more: `EventStagePresent.tsx:129` (`dark:bg-pulse-950`) and `Login.tsx:85` (`hover:text-pulse-950`).",
      "location": {
        "screen": "/present/:id; /events/:id/stage; /login",
        "component": "src/pages/Present.tsx:356; src/pages/EventStagePresent.tsx:129; src/pages/Login.tsx:85",
        "element": "Stage letterbox container / page background / tab hover state"
      },
      "currentState": "The letterbox bars around the scaled 16:9 stage inherit the body background — white in light mode — so a dark-themed canvas sits inside bright white bars. `EventStagePresent` loses its dark-mode page background. The Login tab hover state simply does nothing.",
      "problemStatement": "On a projector the white letterbox bars are the brightest object in a darkened room and will visually overwhelm the stage they frame. Beyond the visual defect, this is a silent-failure class: Tailwind v4 emits no warning for an undefined theme colour, so `bg-pulse-950` looks correct in review and in the diff. Three instances have already shipped, which means there is no lint gate catching it and more will follow.",
      "severity_justification": "High: a visible rendering defect on the audience-facing surface in exactly the environment (darkened room, projector) the surface exists for, plus an unguarded silent-failure pattern already replicated three times.",
      "affectedUsers": "Every audience member in every projected session; all dark-mode users of the event stage page.",
      "recommendation": {
        "principle": "Design-token integrity — a token reference that does not resolve must fail loudly, not silently.",
        "suggested_approach": "Use the token that already exists for exactly this purpose: `--surface-stage: #0A0F1E`, which `styles.css:141` documents as 'Big-screen stage surface … always the canonical near-black ink regardless of app theme' and which was introduced to consolidate precisely this kind of ad-hoc value. Add a CI grep asserting every `(bg|text|border)-pulse-\\d+` class matches a defined step.",
        "example": "`<div className=\"fixed inset-0 flex flex-col animate-page-enter\" style={{ background: 'var(--surface-stage)' }}>` — uses the documented token instead of an undefined utility."
      },
      "estimatedImpact": "Significant visual-quality win on the audience-facing surface; a one-line fix per site plus a lint guard."
    },
    {
      "id": "UI-USE-014",
      "severity": "high",
      "category": "usability",
      "title": "The dashboard sidebar looks like navigation but is scroll-spy — no URL change, no deep links, no back button",
      "issue": "`Dashboard.tsx` renders Home / Insights / Teams / Templates as sidebar items with `aria-current=\"page\"`, but they are anchors into one long scrolling document. Clicking calls `scrollIntoView`, an `IntersectionObserver` at `threshold: 0.3` writes back the 'active' item, and the URL never changes.",
      "location": {
        "screen": "/dashboard",
        "component": "src/pages/Dashboard.tsx:110-131 (IntersectionObserver); src/layouts/AppShellLayout.tsx:94 (scrollIntoView), 144/165/188 (aria-current='page')",
        "element": "Primary application sidebar"
      },
      "currentState": "Four sidebar entries styled and labelled as destinations, with `aria-current=\"page\"` asserting they are pages. Selecting 'Teams' scrolls the single dashboard document. The browser back button does not return to the previous section; the URL cannot be bookmarked, shared, or reloaded into a section; and the scroll-spy can flip the active item to something the user did not choose while they scroll past it.",
      "problemStatement": "This breaks the strongest convention on the web: a left sidebar in an app shell means destinations, and the back button undoes navigation. Users cannot share 'the teams view' with a colleague, cannot reload into where they were, and cannot trust the highlighted item to reflect intent rather than scroll position. `aria-current=\"page\"` makes it worse for screen-reader users by explicitly asserting a page relationship that does not exist. The IA cost also grows with content: all four sections load and render on every dashboard visit, so the page gets slower and the scroll longer as a workspace fills up — it works for one team and degrades badly at fifty.",
      "severity_justification": "High: significantly impairs wayfinding and breaks browser-level expectations (back, bookmark, share, reload) throughout the product's primary authenticated surface. Not critical because every task remains completable.",
      "affectedUsers": "All authenticated hosts; disproportionately power users who bookmark and share, and screen-reader users who receive a false `aria-current=\"page\"` signal.",
      "recommendation": {
        "principle": "Nielsen heuristic #4 Consistency and Standards; heuristic #7 Flexibility and Efficiency of Use; WCAG SC 4.1.2 (state must accurately describe the element).",
        "suggested_approach": "Promote the four sections to real routes (`/dashboard`, `/dashboard/insights`, `/dashboard/teams`, `/dashboard/templates`) so the URL is the source of truth, the back button works, sections are shareable, and each route loads only its own data. If the single-scroll layout is a deliberate product choice, then drop `aria-current=\"page\"` for `aria-current=\"true\"`, sync the section into the URL hash so it survives reload, and restyle the sidebar as an in-page table of contents rather than as navigation.",
        "example": "React Router nested routes under a `/dashboard` layout element, reusing the existing `HeroSection`/`InsightsSection`/`TeamsSection`/`TemplatesSection` components unchanged as route elements."
      },
      "estimatedImpact": "Major wayfinding win on the primary authenticated surface, plus a real performance benefit as workspaces grow."
    },
    {
      "id": "UI-COL-015",
      "severity": "high",
      "category": "color",
      "title": "Dark mode has no counterpart for several light-only colour choices, producing sub-2.6:1 text",
      "issue": "Several components set a light-mode colour with no `dark:` variant, so the dark theme inherits an unreadable pairing. Measured: `MetricCard` alert state applies `bg-red-50` with no dark override while its value text is `dark:text-red-400` — **2.53:1**. The reaction-button count uses `text-pulse-500` with no dark variant on a `#1C2540` card — **3.19:1**. The presenter leaderboard hardcodes `text-orange-700` on the dark canvas surface — **3.28:1**. `JoinPage`'s `state.error` uses `text-red-600` with no dark variant on `#0A0F1E` — **3.95:1**.",
      "location": {
        "screen": "Admin/analytics dashboards; /j/:code reaction questions; /present/:id leaderboard",
        "component": "src/ui/components.tsx:259-268 (MetricCard alert); src/pages/join/QuestionVoteInput.tsx (reaction count); src/pages/Present.tsx:613,621 (leaderboard); src/pages/JoinPage.tsx:441",
        "element": "Alert metric cards, reaction counts, leaderboard, error text"
      },
      "currentState": "In dark mode, alert metric cards render light-red text on a near-white red background; reaction vote counts and leaderboard scores sit at ~3.2:1. Notably, the leaderboard is the only element on the presenter stage that hardcodes a colour instead of consuming `var(--canvas-*)`, so it is also the only element that ignores the canvas theme.",
      "problemStatement": "Alert states are the highest-stakes colour in any dashboard — they exist to be noticed. Rendering them at 2.53:1 inverts their purpose: the most urgent information becomes the least readable. The pattern is the same in each case: a `dark:` variant added to the foreground but not the background (or vice versa), which is a class of bug that only surfaces when someone actually toggles the theme. Given the product ships a manual dark-mode toggle in the header, this is a first-class surface, not an edge case.",
      "severity_justification": "High: multiple measured WCAG SC 1.4.3 failures concentrated on alert and status information, where legibility matters most, across a fully-supported theme.",
      "affectedUsers": "All dark-mode users; acutely those relying on alert states in admin/analytics views and on the presenter leaderboard during energizers.",
      "recommendation": {
        "principle": "WCAG 2.1 AA SC 1.4.3 Contrast (Minimum); ADR-0071 token conventions — prefer semantic tokens that carry both themes.",
        "suggested_approach": "Audit every `bg-*-50` / `text-*-600` pairing for a matching `dark:` counterpart, and make the presenter leaderboard consume `var(--canvas-text)` / `var(--canvas-accent)` like every other stage element. Better: introduce semantic alert tokens (`--surface-danger`, `--text-on-danger`) defined once per theme, so component authors cannot forget the dark half.",
        "example": "`alert ? 'border-signal-error bg-red-50 dark:bg-red-950/40' : ''` and leaderboard `style={{ color: 'var(--canvas-accent)' }}` instead of `text-orange-700`."
      },
      "estimatedImpact": "Significant legibility win in dark mode; removes several AA failures from status-critical UI."
    },
    {
      "id": "UI-CON-016",
      "severity": "medium",
      "category": "visualHierarchy",
      "title": "1,576 arbitrary hex values across 114 files bypass the token layer the project mandates",
      "issue": "Repo-wide grep finds 1,576 `(bg|text|border)-[#…]` arbitrary values across 114 of ~181 component files — the dominant dark-mode idiom is `dark:bg-[#151C2E]`, `dark:text-[#F0F2F8]`, `dark:border-[#1E2A45]` rather than the semantic tokens defined for exactly these values in `styles.css:203-221`. CLAUDE.md rule 10 and ADR-0071 both require token custom properties where one exists.",
      "location": {
        "screen": "Global",
        "component": "114 files including src/ui/components.tsx (Card, Caption, MetricCard, EmptyState, StatCard, SkeletonCard), src/pages/Home.tsx, src/pages/JoinPage.tsx, src/layouts/MainLayout.tsx",
        "element": "Dark-mode colour declarations"
      },
      "currentState": "`--color-surface`, `--color-border`, `--text-primary`, `--text-secondary` are all correctly defined per theme, and are then bypassed by literal hex in the components that should consume them. Even `src/ui/components.tsx` — the file whose header comment reads 'All components pre-apply design tokens for consistency' — hardcodes `dark:bg-[#151C2E]` and `dark:text-[#F0F2F8]`.",
      "problemStatement": "This is why UI-COL-015 exists and will keep recurring. With 1,576 literal values, a theme change is a 114-file migration rather than a token edit, so drift is structurally guaranteed: some sites get updated and some do not, producing exactly the mismatched foreground/background pairs measured above. It also blocks per-tenant branding (`applyBrandingCssVars` in `src/lib/branding.ts` sets CSS variables — which literal hex cannot respond to) and makes the `[data-high-contrast]` override ineffective on any component that hardcodes its colours.",
      "severity_justification": "Medium: no individual instance breaks a user task, but the aggregate makes the theming system structurally unmaintainable and is the root cause of several high-severity findings above.",
      "affectedUsers": "Indirect — all users, via the recurring dark-mode and high-contrast defects this pattern produces. Directly blocks white-label branding customers.",
      "recommendation": {
        "principle": "ADR-0071 design-system tokens; CLAUDE.md rule 10; single source of truth.",
        "suggested_approach": "Fix the shared primitives first — `src/ui/components.tsx` is 8 components covering most of the app's surface area and converting it changes the most while risking the least. Then add a lint rule (eslint-plugin-tailwindcss or a CI grep) rejecting new `dark:*-[#…]` arbitrary values, so the count can only go down. The remaining ~110 files can migrate opportunistically.",
        "example": "`bg-pulse-50 dark:bg-[#151C2E]` → `bg-[var(--color-surface)]`; `dark:text-[#F0F2F8]` → `text-[var(--text-primary)]`; `dark:border-[#1E2A45]` → `border-[var(--color-border)]`."
      },
      "estimatedImpact": "Foundational; prevents recurrence of an entire defect class rather than fixing symptoms."
    },
    {
      "id": "UI-CON-017",
      "severity": "medium",
      "category": "layout",
      "title": "The border-radius scale is non-monotonic — `rounded-2xl` (16px) is smaller than `rounded-xl` (24px)",
      "issue": "`@theme` overrides `--radius-sm/md/lg/xl` to 6/10/16/24px but leaves Tailwind's `--radius-2xl` (16px) and `--radius-3xl` (24px) at their defaults. The resulting scale is 6 → 10 → 16 → **24 → 16 → 24**: `rounded-2xl` is smaller than `rounded-xl`, and `rounded-3xl` is identical to it. 35 `rounded-2xl` call sites are affected. This is the same defect class the spacing comment at `styles.css:60-66` documents and warns against ('a partial remap makes the scale non-monotonic') — the lesson was recorded for spacing and not applied to radius.",
      "location": {
        "screen": "Global",
        "component": "src/styles.css:67-72 (@theme radius block); 35 `rounded-2xl` call sites incl. src/pages/Login.tsx:110",
        "element": "Border radius utilities"
      },
      "currentState": "Developers reaching for a larger radius than `rounded-xl` get a smaller one. Separately, CLAUDE.md rule 10 states cards use `rounded-xl` and buttons `rounded-lg`, while the shared `Card` primitive uses `rounded-lg` and the shared `Button` uses `rounded-md` — so the documented convention and the shipped primitives disagree. Actual usage is 359 `rounded-lg`, 139 `rounded-xl`, 113 `rounded-md`, 35 `rounded-2xl`, 3 `rounded-3xl`.",
      "problemStatement": "Radius is one of the strongest signals of a coherent visual system; when it is applied inconsistently, surfaces stop reading as members of the same family. The non-monotonic scale makes the inconsistency actively hard to avoid, because the utility names no longer describe their own ordering — a developer cannot reason about `2xl > xl` and must check the token file. The primitive-vs-documentation conflict then means there is no authoritative answer to 'what radius does a card use'.",
      "severity_justification": "Medium: a noticeable consistency gap and a latent trap for future work, but no single instance impairs a user task.",
      "affectedUsers": "All users, subliminally (visual coherence); developers directly, as a correctness trap.",
      "recommendation": {
        "principle": "Design-token scale integrity; ADR-0071; the codebase's own documented lesson at src/styles.css:60-66.",
        "suggested_approach": "Either complete the remap (`--radius-2xl: 32px`, `--radius-3xl: 40px`) so the scale stays monotonic, or stop remapping and rename the tokens to project-specific names (`--radius-card`, `--radius-control`) that cannot collide with Tailwind's built-in scale — the second option is safer because it makes the intent explicit at every call site. Then reconcile rule 10 with the `Card`/`Button` primitives and make the primitives the single source of truth.",
        "example": "`--radius-card: 24px; --radius-control: 10px;` used as `rounded-(--radius-card)`, removing the collision with Tailwind's `rounded-lg`/`xl`/`2xl` entirely."
      },
      "estimatedImpact": "Minor polish with meaningful long-term maintainability value; removes a correctness trap."
    },
    {
      "id": "UI-VIS-018",
      "severity": "medium",
      "category": "visualHierarchy",
      "title": "The landing hero has three stacked paragraphs with inverted size hierarchy before the CTA",
      "issue": "Between the H1 and the CTA sit three paragraphs at `text-lg` (18px), `text-xl` (20px), and `text-base` (16px) — in that order. The 'supporting line' is rendered *smaller* than the 'sub-headline' beneath it, so visual weight does not map to intended importance. Together they run ~90 words. The CTA row is then followed by `mb-24` (96px), a Privacy Policy / Terms of Service link pair, another `mb-24`, and only then the feature strip.",
      "location": {
        "screen": "/ (landing page)",
        "component": "src/pages/Home.tsx:110-200",
        "element": "Hero copy block and CTA region"
      },
      "currentState": "H1 (60px gradient) → 18px paragraph → 20px paragraph → 16px paragraph → CTA buttons + a 13px qualifier → 96px gap → legal links → 96px gap → feature strip.",
      "problemStatement": "Three consecutive supporting paragraphs with non-monotonic sizing gives the reader no cue about what to read first, which violates the core purpose of a type scale: importance should map to prominence. Ninety words of prose between headline and CTA measurably depresses click-through — the standard pattern is headline, one sub-headline, CTA. Promoting Privacy Policy and Terms of Service to hero prominence (directly beneath the primary CTA, above the feature strip) is a further hierarchy inversion: these are footer-class links competing visually with the conversion action, and they already appear in the site footer. The 96px gaps are not strategic whitespace — they are uniform padding that pushes the product preview below the fold on most laptop viewports.",
      "severity_justification": "Medium: a noticeable design gap with real conversion cost on the product's primary acquisition page, but it does not block any task.",
      "affectedUsers": "All first-time visitors; disproportionately mobile visitors, for whom the stacked column makes the pre-CTA scroll considerably longer.",
      "recommendation": {
        "principle": "Visual hierarchy — importance maps to prominence; Nielsen heuristic #8 Aesthetic and Minimalist Design; F-pattern scanning research (users read ~20% of page copy).",
        "suggested_approach": "Cut to one sub-headline of ≤25 words directly under the H1, then the CTA. Move the third paragraph ('Qesto helps teams and facilitators…') into the features section where it belongs contextually. Demote the Privacy/Terms links to the footer, which already carries them. Reduce the 96px gaps to 48px and let the section boundaries do the separating.",
        "example": "H1 → single 20px sub-headline → CTA row → 48px → feature strip. Reference: Linear, Notion, and Figma landing heroes all use exactly one supporting line before the primary action."
      },
      "estimatedImpact": "Meaningful conversion win on the primary acquisition surface; pure subtraction, low implementation risk."
    },
    {
      "id": "UI-TYP-019",
      "severity": "medium",
      "category": "typography",
      "title": "The landing page bypasses the type scale with arbitrary pixel sizes",
      "issue": "`styles.css` registers a complete Tailwind type scale (`text-display-xl/l`, `text-heading-l/m/s`, `text-body-l/m/s`, `text-caption`) with matched line-heights. `Home.tsx` then uses `text-[60px]`, `text-[48px]`, `text-[20px]`, `text-[17px]`, `text-[15px]`, `text-[13px]` — introducing 17px, 15px, and 13px steps that exist nowhere in the scale.",
      "location": {
        "screen": "/ (landing page) and other marketing pages",
        "component": "src/pages/Home.tsx:113,143,149,160,166,172,220,226,243,258,261",
        "element": "Headings, CTA labels, body copy, eyebrows"
      },
      "currentState": "Six distinct font sizes on one page, three of which are off-scale. Line-heights are also hand-specified (`leading-[1.05]`, `leading-[1.55]`, `leading-[1.5]`, `leading-snug`) rather than inherited from the scale's paired values.",
      "problemStatement": "A type scale's value is that a finite set of sizes produces predictable rhythm and unambiguous hierarchy. Introducing 13/15/17px means the page has near-identical sizes (15 vs 16, 17 vs 18) that read as inconsistency rather than as distinct levels — the reader gets no information from the difference, only noise. It also means the marketing surface cannot participate in any future scale change, and the registered `text-display-l` / `text-heading-*` utilities sit unused on the page they were designed for.",
      "severity_justification": "Medium: weakens hierarchy and consistency on a high-traffic page and undermines the scale's purpose, but each individual size is legible.",
      "affectedUsers": "All visitors, subliminally; developers, who now have two competing conventions for setting type.",
      "recommendation": {
        "principle": "Modular type scale discipline; ADR-0071; CLAUDE.md rule 10 (prefer tokens where one exists).",
        "suggested_approach": "Map every arbitrary size onto the nearest registered step: 60→`text-display-xl`, 48→`text-display-l`, 20→`text-heading-s`, 17→`text-body-l`, 15→`text-body-s`, 13→`text-caption`. Drop the hand-specified `leading-*` values, since the registered steps already carry matched line-heights. Add a lint rule rejecting new `text-[Npx]` in `src/pages/` and `src/components/`.",
        "example": "`className=\"text-display-xl font-bold tracking-[-0.02em]\"` instead of `text-5xl md:text-[60px] leading-[1.05]`."
      },
      "estimatedImpact": "Minor polish, meaningful consistency gain; mechanical to apply."
    },
    {
      "id": "UI-A11Y-020",
      "severity": "medium",
      "category": "accessibility",
      "title": "Nav dropdowns declare the ARIA menu pattern without implementing it; the mobile menu has no focus management",
      "issue": "`NavDropdown` sets `role=\"menu\"`, `role=\"menuitem\"`, and `aria-haspopup=\"true\"` on what is a list of `<Link>` elements. The ARIA menu pattern contracts for arrow-key navigation, Home/End, typeahead, and menuitems removed from the tab sequence — none of which is implemented; only Escape is handled. Separately, the mobile hamburger menu has no Escape handler, no focus move into the panel, no focus restoration to the trigger on close, and no outside-click dismissal.",
      "location": {
        "screen": "All marketing pages",
        "component": "src/layouts/MainLayout.tsx:13-104 (NavDropdown), 289-317 (mobile nav panel)",
        "element": "Site navigation dropdowns and mobile menu"
      },
      "currentState": "A screen reader announces 'menu' and its user reaches for arrow keys, which do nothing — the links respond only to Tab. On mobile, opening the menu leaves focus on the hamburger button; the user must tab forward through it, cannot dismiss with Escape, and on close is dropped wherever they were rather than returned to the trigger.",
      "problemStatement": "Announcing a widget role you have not implemented is worse than using no role at all: it creates a false expectation and leaves the user believing the page is broken when the keys they were told to use do nothing. The WAI-ARIA Authoring Practices are explicit that site navigation dropdowns should use the disclosure pattern (`aria-expanded` on a button + a plain list) rather than `menu`, which is reserved for application-style command menus. The mobile focus-management gaps are a separate, well-understood checklist that the panel simply does not implement.",
      "severity_justification": "Medium: noticeable friction and a false affordance for AT users, but navigation remains completable by Tab in every case.",
      "affectedUsers": "Screen-reader users, keyboard-only users; all mobile users for the focus-management half.",
      "recommendation": {
        "principle": "WAI-ARIA Authoring Practices — Disclosure (Show/Hide) pattern for navigation; WCAG 2.1 SC 2.4.3 Focus Order; SC 2.1.2 No Keyboard Trap (inverse — focus must be managed on open/close).",
        "suggested_approach": "Drop `role=\"menu\"` / `role=\"menuitem\"` / `aria-haspopup` and keep only `aria-expanded` + `aria-controls` on the trigger with a plain `<ul>` of links — this is the correct pattern and requires deleting code rather than adding it. For the mobile panel, add an Escape handler, move focus to the first link on open, restore focus to the trigger on close, and dismiss on outside click. `Dashboard.tsx:95-108` already implements the outside-click + Escape pattern correctly and can be lifted into a shared hook.",
        "example": "Extract `useDismissable({ onDismiss, triggerRef })` from the existing Dashboard `newMenu` effect and use it for both the mobile nav and the nav dropdowns."
      },
      "estimatedImpact": "Meaningful accessibility win; net code reduction for the dropdown half."
    },
    {
      "id": "UI-CON-021",
      "severity": "medium",
      "category": "visualHierarchy",
      "title": "63 inline `<svg>` elements against a rule requiring lucide-react icons",
      "issue": "CLAUDE.md rule 9 forbids inline `<svg>` for icons, permitting exactly one exception (the circular timer arc in `Present.tsx`). Grep finds 63 inline `<svg>` elements across 30 files, including four in `MainLayout.tsx` alone (chevron, sparkle wordmark, sun, moon) and four in `JoinPage.tsx` (spinner, error circle, shield, pause) — every one of which has a direct lucide equivalent (`ChevronDown`, `Sparkles`, `Sun`, `Moon`, `Loader2`, `AlertCircle`, `ShieldCheck`, `Pause`).",
      "location": {
        "screen": "Global",
        "component": "30 files including src/layouts/MainLayout.tsx, src/pages/JoinPage.tsx, src/pages/Login.tsx, src/pages/Display.tsx, src/components/HelpChatWidget.tsx",
        "element": "Icons"
      },
      "currentState": "Hand-authored SVG paths with varying `strokeWidth` (1.5, 2, 3), varying viewBox conventions, and varying sizing approaches (`width`/`height` attributes vs. `className=\"w-4 h-4\"`) sit alongside lucide icons sized with the `size` prop.",
      "problemStatement": "Mixing two icon systems produces visible weight mismatches — hand-rolled paths at `strokeWidth=2` next to lucide's default 2 at a different optical size do not align on the same baseline or read at the same weight. The `Present.tsx` and `JoinPage.tsx` files already import lucide icons *and* hand-roll others, so the inconsistency is within single files. It also costs review attention on every PR touching an icon, since there is no single answer to 'how do we render an icon here'.",
      "severity_justification": "Medium: a real and visible consistency gap with an explicit project rule against it, but no functional or accessibility impact (all instances correctly carry `aria-hidden`).",
      "affectedUsers": "All users, subliminally; developers directly.",
      "recommendation": {
        "principle": "CLAUDE.md rule 9; single icon system for optical consistency.",
        "suggested_approach": "Mechanical replacement — every instance found maps to an existing lucide export. Start with `MainLayout.tsx` (4 icons on every page) and `JoinPage.tsx` (4 on the participant path) for maximum visible effect. Add a CI grep rejecting new `<svg` in `src/**/*.tsx` outside the documented `Present.tsx` timer exception.",
        "example": "`<svg …><path d=\"M6 9l6 6 6-6\"/></svg>` → `<ChevronDown size={12} aria-hidden=\"true\" />`."
      },
      "estimatedImpact": "Minor polish; meaningful consistency and review-cost improvement."
    },
    {
      "id": "UI-I18N-022",
      "severity": "medium",
      "category": "usability",
      "title": "The landing page and presenter stage are hardcoded English in a five-locale product",
      "issue": "`Home.tsx` imports `useT('home')` and then uses it for exactly two strings (`heroTagline`, `loading`); the H1, all three body paragraphs, all six feature-card titles and descriptions, the four feature-strip labels, and the 'Sign in'/'Sign out'/'Go to dashboard'/'Browse templates' CTAs are all hardcoded English. The presenter stage hardcodes 'Question', 'Waiting for question', 'Live', and the marketing line 'AI recap at session close · Workers AI on Cloudflare'. `MainLayout`'s footer mixes `t('footer.pricing')` with hardcoded 'GDPR trust center', 'SOC 2 trust center', 'Partner marketplace', 'Legal', 'Report illegal content'.",
      "location": {
        "screen": "/ (landing), /present/:id (audience stage), global footer",
        "component": "src/pages/Home.tsx:11-57,71,78,115-172; src/pages/Present.tsx:465,489,624; src/layouts/MainLayout.tsx (footer)",
        "element": "Marketing copy, stage labels, footer links"
      },
      "currentState": "A Dutch or German visitor lands on an English page with a Dutch nav bar. A facilitator running a Spanish-language session projects a stage labelled 'Question' and 'Live'.",
      "problemStatement": "Partial localisation reads as more broken than none — a nav bar in the user's language above English body copy signals an unfinished product rather than an English-first one, which is corrosive to trust on the page whose entire job is establishing it. The stage case is worse because it is audience-facing: everyone in a room of non-English speakers sees the English labels. `Present.tsx:465` additionally renders `{state.connection}` directly when not open, exposing raw internal state strings ('reconnecting', 'failed') to the audience — untranslated and unwritten-for-humans.",
      "severity_justification": "Medium: does not block tasks for the English-speaking majority, but materially degrades the experience for four of five supported locales and exposes internal state strings to an audience.",
      "affectedUsers": "All NL/ES/DE/FR users — every visitor to the landing page and every audience member in a non-English session.",
      "recommendation": {
        "principle": "Internationalisation completeness; Nielsen heuristic #2 Match Between System and the Real World (show information in the users' language, not internal terminology).",
        "suggested_approach": "Extract the hardcoded strings in these three files into the existing i18n namespaces — the `qesto-i18n` agent and key-extraction pipeline already exist for this. Replace the raw `{state.connection}` render with a mapped, translated label, matching how `JoinPage.tsx:262-271` already handles the same state correctly. Add a CI check flagging string literals in JSX text position in `src/pages/` and `src/layouts/`.",
        "example": "`{state.connection === 'open' ? t('status.live') : t(`status.${state.connection}`)}` — mirroring the `connectionLabel` mapping already written in JoinPage."
      },
      "estimatedImpact": "Meaningful win for 4 of 5 supported locales; mostly mechanical extraction."
    },
    {
      "id": "UI-MOB-023",
      "severity": "medium",
      "category": "mobile",
      "title": "The Likert scale renders five columns at ~50px each on a 320px viewport",
      "issue": "Likert questions use a fixed `grid grid-cols-5 gap-1.5` with `text-xs` (12px) labels and `px-1` horizontal padding, at every breakpoint. Inside the participant container (`max-w-lg px-6`) a 320px viewport yields 272px of content, so each of the five columns is ~49.6px wide with ~2px usable padding.",
      "location": {
        "screen": "/j/:code — Likert questions",
        "component": "src/pages/join/QuestionVoteInput.tsx — likert branch",
        "element": "Five-point scale buttons"
      },
      "currentState": "Labels such as 'Strongly disagree' wrap to three or four lines at 12px inside a ~48px column, producing ragged, uneven-height buttons and severely degraded legibility. There is no `sm:` variant — the five-column grid is unconditional.",
      "problemStatement": "Likert is one of the product's core question types and the single most common format in workshop and training feedback — its mobile rendering is not an edge case. Fifty pixels cannot hold a readable scale label; the standard mobile treatment is to stack the five points vertically, or to render a numeric 1-5 row with the anchor labels shown once above and below. The buttons only clear 44px height because the global coarse-pointer rule rescues them, which means the layout is relying on an accessibility backstop rather than being designed for the viewport.",
      "severity_justification": "Medium: noticeable friction and degraded legibility on a core question type, but the task remains completable and the touch targets are (incidentally) adequate.",
      "affectedUsers": "All participants answering Likert questions on phones — the dominant device for participants, who join by QR code from a phone by design.",
      "recommendation": {
        "principle": "Mobile-first responsive design; WCAG 2.1 AA SC 1.4.10 Reflow; readable measure.",
        "suggested_approach": "Stack vertically below `sm` — five full-width rows read cleanly, match the multi-select pattern already used elsewhere in the same file, and give generous touch targets. Alternatively render the numeric scale horizontally with anchor labels above and below, which is the pattern most survey tools converge on for narrow viewports.",
        "example": "`grid grid-cols-1 sm:grid-cols-5 gap-1.5` with `text-sm sm:text-xs` — a one-line change reusing the vertical list treatment already present for multi_select."
      },
      "estimatedImpact": "Meaningful mobile usability win on a core question type."
    },
    {
      "id": "UI-INT-024",
      "severity": "medium",
      "category": "interaction",
      "title": "Destructive actions use native `window.confirm()` — unstyled, untranslated in one case, and no undo",
      "issue": "Three destructive flows gate on `window.confirm()`: revoking an embed widget (`'Revoke this widget? All tokens minted for it will immediately stop working.'` — hardcoded English), deleting a Studio library item, and regenerating AI questions over existing content. The native dialog cannot be styled, does not respect the app theme, cannot be localised via the i18n layer in the hardcoded case, and offers only OK/Cancel with no undo path afterward.",
      "location": {
        "screen": "/embed-playground, /studio, session wizard step 2",
        "component": "src/pages/EmbedPlayground.tsx:96; src/pages/StudioPage.tsx:186; src/components/session-wizard/SessionWizardStep2.tsx:197",
        "element": "Destructive-action confirmation"
      },
      "currentState": "A browser-chrome dialog appears with the site origin in its title bar, in the browser's language for its buttons and the app's hardcoded English for its message. Once confirmed, the action is irreversible with no undo affordance.",
      "problemStatement": "Native `confirm()` breaks the visual continuity of an otherwise carefully-designed product at exactly the moment users most need to feel oriented and in control. It also blocks the main thread, cannot show the *name* of the thing being deleted (so users confirm without verifying they picked the right item), and cannot offer the modern alternative: perform the action immediately and offer a timed undo, which research consistently shows users prefer to a confirmation gate. The codebase already has a well-built modal pattern (`DuplicateSessionModal`, `TemplatePreviewModal`, `role=\"dialog\"` in 7 components), so the primitive exists and is simply not being used here.",
      "severity_justification": "Medium: noticeable jarring inconsistency and a missed undo opportunity on destructive paths, but the confirmation does successfully prevent accidental loss.",
      "affectedUsers": "Hosts and workspace admins performing destructive operations; non-English users, who see mixed-language dialogs.",
      "recommendation": {
        "principle": "Nielsen heuristic #3 User Control and Freedom (prefer undo over confirmation); heuristic #4 Consistency and Standards; heuristic #5 Error Prevention.",
        "suggested_approach": "Replace with the existing in-app modal pattern, naming the specific item being destroyed ('Revoke widget \"Q3 Retro embed\"?') so users can verify before confirming. Where the backend supports it — Studio library deletes especially — prefer immediate action plus a 10-second undo toast over a blocking confirm.",
        "example": "A shared `<ConfirmDialog title description confirmLabel tone=\"danger\" />` built on the `role=\"dialog\"` pattern already in `DuplicateSessionModal`, with all copy routed through `useT`."
      },
      "estimatedImpact": "Meaningful polish and error-recovery win on destructive paths."
    },
    {
      "id": "UI-VIS-025",
      "severity": "medium",
      "category": "visualHierarchy",
      "title": "Two different wordmarks and mismatched control sizing in the same header",
      "issue": "The brand is rendered two different ways: `MainLayout` uses `text-base font-extrabold uppercase tracking-widest text-teal-700` with an inline sparkle glyph, while `JoinPage` and `JoinLanding` use `font-display (Syne) font-bold text-[18px] tracking-[-0.02em] text-pulse-900` with no glyph. Adjacent header controls also disagree: the theme toggle is `w-12 h-12` with `rounded` (4px) holding a 16px icon, while the mobile menu button beside it is `h-11 w-11` with `rounded-lg` (16px per the remap) holding a 20px icon.",
      "location": {
        "screen": "Global header; /j and /j/:code participant header",
        "component": "src/layouts/MainLayout.tsx (logo, theme toggle, menu button); src/pages/JoinPage.tsx:283; src/pages/join/JoinLanding.tsx",
        "element": "Wordmark and header icon buttons"
      },
      "currentState": "Marketing and app pages show a teal uppercase letterspaced 'QESTO' with a violet sparkle; participant pages show a near-black Syne 'Qesto' with tight tracking. In the header, two icon buttons sit side by side at 48px/4px-radius and 44px/16px-radius with 16px and 20px icons respectively.",
      "problemStatement": "The wordmark is the single most repeated element in a product and the primary carrier of brand recognition. Two treatments means a participant who later visits the marketing site does not visually connect the two — which matters commercially, since participant-to-host conversion is a core growth loop for this category. The mismatched header controls are a smaller but more visible instance of the same problem: two adjacent buttons with different sizes, radii, and icon scales read as unfinished regardless of how well-considered each is individually.",
      "severity_justification": "Medium: a genuine brand-consistency and visual-polish gap visible on every page, with no functional impact.",
      "affectedUsers": "All users; commercially relevant for participants who might become hosts.",
      "recommendation": {
        "principle": "Brand consistency; Gestalt similarity — elements with the same function should share visual treatment.",
        "suggested_approach": "Pick one wordmark treatment (the Syne rendering is the stronger choice — it uses the display face the design system defines for exactly this purpose, and avoids the ALL-CAPS letterspacing that reduces scannability) and extract it into a single `<Wordmark />` component used everywhere. Normalise the header icon buttons to one size, one radius, and one icon size.",
        "example": "`<Wordmark />` rendering `font-display font-bold text-[18px] tracking-[-0.02em]` plus the sparkle glyph, used in MainLayout, JoinPage, JoinLanding, and Present. Header buttons standardised to `h-11 w-11 rounded-lg` with `size={20}` icons."
      },
      "estimatedImpact": "Minor polish with real brand-coherence value; low effort."
    },
    {
      "id": "UI-INT-026",
      "severity": "low",
      "category": "interaction",
      "title": "No character counter on the 120-character response field — input is silently truncated",
      "issue": "The open-text and word-cloud response input sets `maxLength={120}` with no counter, no warning as the limit approaches, and no indication after the limit is hit. The browser simply stops accepting keystrokes.",
      "location": {
        "screen": "/j/:code — open text and word cloud questions",
        "component": "src/pages/join/QuestionVoteInput.tsx — word_cloud / open branch",
        "element": "Response text input"
      },
      "currentState": "A participant composing a longer answer reaches 120 characters and their keyboard stops working with no explanation.",
      "problemStatement": "Silent input rejection is one of the more frustrating micro-failures in form design, because users typically blame their device rather than the form. Open text is the question kind where participants invest the most effort, so a truncation with no warning risks losing a considered answer mid-thought — and in an anonymous session there is no way for them to follow up.",
      "severity_justification": "Low: a polish gap affecting only participants who write longer responses, easily worked around once understood.",
      "affectedUsers": "Participants answering open-text and word-cloud questions at length.",
      "recommendation": {
        "principle": "Nielsen heuristic #1 Visibility of System Status; heuristic #5 Error Prevention.",
        "suggested_approach": "Show a live counter that appears once past ~70% of the limit, and announce the limit politely for screen-reader users.",
        "example": "`{value.length > 84 && <p aria-live=\"polite\" className=\"text-caption text-pulse-600\">{120 - value.length} characters left</p>}`"
      },
      "estimatedImpact": "Minor polish; removes a small but memorable frustration on the highest-effort question type."
    },
    {
      "id": "UI-USE-027",
      "severity": "low",
      "category": "usability",
      "title": "No show/hide password toggle on login or signup",
      "issue": "Both password fields are plain `type=\"password\"` with no reveal control. Signup additionally enforces an 8-character minimum only on submit, with no requirement shown before the user types.",
      "location": {
        "screen": "/login",
        "component": "src/pages/Login.tsx — login and signup password fields",
        "element": "Password inputs"
      },
      "currentState": "Fully masked entry, with the length requirement surfaced only after a failed submit.",
      "problemStatement": "Masking without a reveal option is the single largest driver of password-entry error, particularly on mobile keyboards where autocorrect and shifted characters are common. Surfacing the 8-character minimum only after submission is form-submit shock — the requirement is knowable up front and costs nothing to state. Notably the rest of this form is well built (correct `autoComplete` tokens, `role=\"alert\"` errors, a proper roving-tabindex tab pattern), which makes these two gaps stand out.",
      "severity_justification": "Low: a polish gap that adds friction and retry cycles but blocks nothing.",
      "affectedUsers": "All users setting or entering a password, disproportionately mobile users.",
      "recommendation": {
        "principle": "NN/g — Stop Password Masking; Nielsen heuristic #5 Error Prevention (state constraints before the error).",
        "suggested_approach": "Add a show/hide toggle button inside the field with `aria-pressed` and an `aria-label` that reflects state. Render the 8-character requirement as persistent helper text bound with `aria-describedby`, not as a post-submit error.",
        "example": "`<button type=\"button\" aria-pressed={shown} aria-label={shown ? t('hidePassword') : t('showPassword')}>{shown ? <EyeOff size={16}/> : <Eye size={16}/>}</button>` plus `<p id=\"pw-help\">{t('passwordMinHint')}</p>`."
      },
      "estimatedImpact": "Minor polish; reduces retry cycles at the signup gate."
    },
    {
      "id": "UI-INT-028",
      "severity": "low",
      "category": "interaction",
      "title": "The join form's disabled submit gives no explanation, and the handler fails silently",
      "issue": "`JoinLanding` disables its submit button until exactly 6 characters are entered (`disabled={code.trim().length !== 6}`), and `handleSubmit` additionally returns silently if the length is wrong. Disabled buttons are not focusable, so a keyboard user tabbing to submit finds nothing there and receives no explanation of what is missing.",
      "location": {
        "screen": "/j (join landing)",
        "component": "src/pages/join/JoinLanding.tsx",
        "element": "Join submit button"
      },
      "currentState": "The button sits at 50% opacity until the sixth character is typed. The `code_length_hint` text below the field is the only clue, and it is present regardless of state rather than responding to what the user has entered.",
      "problemStatement": "Disabled-until-valid is a common pattern with a known cost: the user is told 'no' without being told why, and assistive technology cannot reach the control to investigate. The current implementation also belts-and-braces the guard in the handler, so even a programmatic submit fails silently. Since this is the participant's first interaction with the product — often typing a code read off a projector at distance — clarity matters more here than almost anywhere else.",
      "severity_justification": "Low: minor friction with an adequate (if static) hint already present; the task is completable and the failure mode is self-correcting as the user types.",
      "affectedUsers": "Participants entering a join code, especially keyboard and screen-reader users.",
      "recommendation": {
        "principle": "Nielsen heuristic #9 Help Users Recognize, Diagnose, and Recover from Errors; WAI guidance against disabled submit controls.",
        "suggested_approach": "Keep the button enabled and validate on submit, announcing a specific message ('Codes are 6 characters — you have entered 4') in a live region. This keeps the control reachable and turns a dead end into guidance.",
        "example": "Drop `disabled`, and in `handleSubmit` set an error state rendered as `<p role=\"alert\">` when `clean.length !== 6`."
      },
      "estimatedImpact": "Minor polish at the participant's first touchpoint."
    },
    {
      "id": "UI-LAY-029",
      "severity": "low",
      "category": "layout",
      "title": "The stage prints a hardcoded `qesto.cc/join` URL while its QR code points at `window.location.origin`",
      "issue": "The presenter join panel displays the literal string `qesto.cc/join`, while the QR code beside it encodes `${window.location.origin}/j/${code}`. On any deployment that is not `qesto.cc` — preview branches, self-hosted, white-labelled, or a custom customer domain — the two disagree, and the printed URL sends participants somewhere the session does not exist.",
      "location": {
        "screen": "/present/:id — join panel",
        "component": "src/pages/Present.tsx:528-530 (literal) vs 546 (QRCode value)",
        "element": "Join URL text"
      },
      "currentState": "A hardcoded domain string rendered directly above a dynamically-generated QR code for a different origin.",
      "problemStatement": "The two join affordances on the same panel can point at different places, and the one people type manually is the one that can be wrong. The failure is also invisible in production for the primary domain, so it will only surface for preview deployments and white-label customers — precisely the audiences least able to diagnose it. The panel is additionally missing the `/j/` path segment used by the actual route, so even on `qesto.cc` the printed URL relies on a separate redirect existing.",
      "severity_justification": "Low: correct on the primary production domain today, so most sessions are unaffected; becomes a real failure only on non-primary origins.",
      "affectedUsers": "Participants in sessions run from preview deployments, self-hosted instances, or white-labelled custom domains.",
      "recommendation": {
        "principle": "Single source of truth; Nielsen heuristic #4 Consistency and Standards.",
        "suggested_approach": "Derive the displayed URL from the same origin the QR encodes, stripping the protocol for display.",
        "example": "`{window.location.host}/j/{state.session.code}` — one string, both affordances, always in agreement."
      },
      "estimatedImpact": "Minor correctness fix; prevents a confusing failure for white-label and preview deployments."
    },
    {
      "id": "UI-VIS-030",
      "severity": "low",
      "category": "visualHierarchy",
      "title": "Error and empty states are visually under-designed relative to the rest of the product",
      "issue": "Several recovery and zero-state surfaces do not get the care the happy path does. The session-not-found screen places a 20×20px icon inside a 96×96px red circle — a 4.6× container-to-content ratio that reads as a rendering error rather than a designed element. The shared `EmptyState` uses `py-24` (96px vertical padding) with a muted heading and no illustration or default action. The presenter stage renders WebSocket errors as `text-sm` (14px) absolutely positioned at `top-[1020px]`, which on a 1080px canvas overlaps the bottom chrome bar and is illegible when projected.",
      "location": {
        "screen": "/j/:code error state; global empty states; /present/:id error region",
        "component": "src/pages/JoinPage.tsx:127-133; src/ui/components.tsx:276-294 (EmptyState); src/pages/Present.tsx:597-601",
        "element": "Error and empty states"
      },
      "currentState": "A tiny icon floating in a large pink circle; 96px-padded empty states with a grey heading and optional action; 14px error text positioned into the stage's bottom chrome.",
      "problemStatement": "Error and empty states are where users are least confident and most likely to abandon, so they warrant *more* design attention than the happy path, not less — yet these read as placeholders. The stage error is the most consequential: a 14px string on a 1920×1080 canvas scaled to a projector is roughly 3px of apparent height from the back of a room, so a host will never learn their session has a connection problem from the surface they are actually looking at, and it collides with the chrome bar besides.",
      "severity_justification": "Low individually — these are polish gaps on surfaces users reach infrequently — though the stage error's illegibility edges toward a status-visibility problem.",
      "affectedUsers": "Users hitting an invalid code, users on first run with no content yet, hosts whose session encounters a WebSocket error.",
      "recommendation": {
        "principle": "Nielsen heuristic #1 Visibility of System Status; heuristic #9 Help Users Recover from Errors; empty states as onboarding opportunities.",
        "suggested_approach": "Size the error icon to its container (a 20px icon wants a 40-48px circle). Give `EmptyState` a default illustration slot, reduce `py-24` to `py-16`, and make the action prop prominent rather than optional-looking. Scale stage errors to the canvas — `text-[24px]` minimum — and position them in the top region where they cannot collide with the bottom chrome.",
        "example": "`<div className=\"w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center\"><AlertCircle size={24} className=\"text-red-600\" /></div>` for the error state; stage errors as a top-anchored banner at `text-[28px]`."
      },
      "estimatedImpact": "Minor polish; disproportionately valuable at the moments users are most likely to give up."
    }
  ],
  "summary": {
    "totalFindings": 30,
    "byCriticality": {
      "critical": 5,
      "high": 10,
      "medium": 10,
      "low": 5
    },
    "byCategory": {
      "visualHierarchy": 5,
      "typography": 1,
      "color": 5,
      "layout": 3,
      "interaction": 4,
      "mobile": 4,
      "accessibility": 5,
      "usability": 3,
      "performance": 0
    },
    "overallAssessment": "Qesto's token layer is better than its component layer, and the gap between them is where nearly every finding lives. canvas-themes.css is exemplary — four presentation themes with per-token contrast ratios computed and recorded in comments, including a genuine AAA high-contrast theme. Motion tokens, density scaling, the iOS 16px input-zoom guard, and the roving-tabindex tab pattern in Login all show real craft. But the components below that layer bypass it: 1,576 arbitrary hex values across 114 files, 63 inline SVGs against an explicit rule, a type scale that the landing page ignores in favour of 13/15/17px one-offs, and a radius scale that is non-monotonic because the remap was left half-finished. Three defects are severe enough to act on before anything else. First, colour: white text on the brand gradient is 2.49:1 and on solid teal-600 is 3.74:1, so essentially every primary action in the product fails WCAG AA — and the same gradient renders the join code on the projected audience screen, the one string a whole room must read, at 2.49:1 while bypassing the carefully-built canvas theme system entirely. Second, focus: the global focus ring composites to 1.46:1 against white where 3:1 is required, and 122 ring-offset-2 call sites have no dark-mode offset colour, so keyboard users have no compliant focus indicator in either theme. Third, reach: the presenter stage clips roughly 55% of itself on a phone with overflow-x-hidden — hiding the join panel and QR code, the host's primary tool — while participant vote buttons use the native disabled attribute for 'already voted', removing users' own answers from the tab order on a product whose entire premise is recording what people chose. None of these are architectural. The colour fix is one token decision propagated mechanically; the focus fix is two token edits plus a single global --tw-ring-offset-color; the stage fix is a mobile branch reusing components that already exist in src/components/launchpad/. The highest-value structural investment is converting src/ui/components.tsx to consume semantic tokens instead of literal hex — that one file underlies most of the app's surface and is the root cause of the recurring dark-mode contrast failures catalogued in UI-COL-015.",
    "topThreePriorities": [
      "1. UI-COL-001 — White label text on the brand gradient (2.49:1) and on solid teal-600 (3.74:1) fails WCAG AA across ~80 primary-CTA call sites. One token decision, propagated mechanically, is the highest-leverage fix available.",
      "2. UI-A11Y-002 — No compliant keyboard focus indicator exists: the global ring is 1.46:1 against white (3:1 required) and 122 ring-offset-2 sites paint a white halo in dark mode. Two token edits plus one global --tw-ring-offset-color declaration.",
      "3. UI-MOB-004 + UI-COL-003 — The audience stage clips its own join panel and QR code on mobile with overflow-x-hidden, and the join code it displays is the lowest-contrast text on the screen while bypassing the AAA canvas theme. Both attack the product's core loop: getting people into the room."
    ]
  }
}
```

---

## Measured contrast reference

All ratios computed with the WCAG 2.1 relative-luminance formula. **Bold** = fails the applicable threshold.

| Foreground / background | Ratio | AA normal (4.5:1) | AA large (3:1) | Where |
|---|---|---|---|---|
| `#FFFFFF` on `#14B8A6` (gradient start) | **2.49** | ✗ | ✗ | Every primary CTA (UI-COL-001) |
| `#FFFFFF` on `#8B5CF6` (gradient end) | **4.23** | ✗ | ✓ | Every primary CTA (UI-COL-001) |
| `#FFFFFF` on `#0D9488` (teal-600) | **3.74** | ✗ | ✓ | 42 files incl. Join button (UI-COL-006) |
| `#FFFFFF` on `#0F766E` (teal-700) | 5.47 | ✓ | ✓ | Recommended replacement |
| `#14B8A6` text on `#FAFAFA` | **2.49** | ✗ | ✗ | Presenter join code (UI-COL-003) |
| `#A1E2DB` (focus ring composited) on white | **1.46** | ✗ | ✗ | Global focus ring (UI-A11Y-002) |
| `#A1E2DB` focus ring vs `#0D9488` button | **2.57** | ✗ | ✗ | Global focus ring (UI-A11Y-002) |
| `#D97706` (amber-600) on white | **3.19** | ✗ | ✓ | Connection status, 12px (UI-A11Y-010) |
| `#B45309` (amber-700) on white | 4.72 | ✓ | ✓ | Recommended replacement |
| `#DC2626` (red-600) on `#0A0F1E` | **3.95** | ✗ | ✓ | JoinPage error, dark (UI-COL-015) |
| `#737373` (pulse-500) on `#1C2540` | **3.19** | ✗ | ✓ | Reaction counts, dark (UI-COL-015) |
| `#C2410C` (orange-700) on `#151C2E` | **3.28** | ✗ | ✓ | Stage leaderboard (UI-COL-015) |
| `#F87171` (red-400) on `#FEF2F2` (red-50) | **2.53** | ✗ | ✗ | MetricCard alert, dark (UI-COL-015) |
| `#22C55E` (signal-success) on white | **2.28** | ✗ | ✗ | Token — unsafe as text on light |
| `#F59E0B` (signal-warning) on white | **2.15** | ✗ | ✗ | Token — 1 text call site |
| `#0EA5E9` (signal-info) on white | **2.77** | ✗ | ✗ | Token — unsafe as text on light |
| `#6B7A99` (--text-muted) on `#0A0F1E` | 4.43 | ✗ (marginal) | ✓ | Dark muted text — borderline |

> The three `--signal-*` colours are safe as **fills** (bars, dots, badge backgrounds) but not as **text on light surfaces**. `text-signal-error` has 18 call sites and `text-signal-warning` has 1 — each needs checking against its actual background. Darker text-safe counterparts (`#B91C1C`, `#B45309`, `#0369A1`) should be added to the token set so authors have a correct option to reach for.

---

## Cross-cutting metrics

| Metric | Count | Reference |
|---|---|---|
| Arbitrary hex colour values (`bg-/text-/border-[#…]`) | 1,576 across 114 files | UI-CON-016 |
| Inline `<svg>` elements | 63 across 30 files | UI-CON-021 |
| `focus-visible:ring-offset-2` without a dark offset colour | 122 | UI-A11Y-002 |
| `disabled=` vs `aria-disabled=` | 174 vs 1 | UI-A11Y-007 |
| `animate-spin` spinners neutralised by reduced motion | 13 across 11 files | UI-A11Y-009 |
| Undefined `pulse-950` class references | 3 | UI-LAY-013 |
| `rounded-2xl` sites affected by the non-monotonic radius scale | 35 | UI-CON-017 |
| Gradient CTA implementations (three hand-rolled variants) | 38 `from-teal-500` + 2 `bg-gradient-brand` | UI-COL-001 |

---

## What is working well

Worth recording, because a critical audit reads as if nothing is right:

- **`src/styles/canvas-themes.css`** is the best file in the frontend. Four themes, every token's contrast ratio computed and documented inline, a real AAA high-contrast variant with extra leading for SC 1.4.8, and a comment explaining *why* the high-contrast muted bar is darker rather than lighter. This is the standard the rest of the token layer should be held to.
- **The iOS zoom guard** (`text-base sm:text-sm` on inputs, documented as LAYOUT-004) is a subtle, correct fix that most teams never make.
- **The spacing-scale comment** at `styles.css:60-66` records a real past bug and the reasoning behind not repeating it — institutional memory encoded where the next person will read it. UI-CON-017 exists only because the same lesson was not applied to radius.
- **`Login.tsx`'s tab switcher** implements the WAI-ARIA roving-tabindex pattern correctly, with `aria-selected`, `aria-controls`, and arrow-key handling — a pattern most codebases get wrong.
- **`JoinPage.tsx`'s inline reconnect notice** correctly uses `role="status" aria-live="polite"` and explains *why* the disabled vote controls are unresponsive, with a code comment stating the reasoning. UI-A11Y-010 is a request to apply this same care ten lines up.
- **The upvote control** carries an explicit `min-h-11 min-w-11` with a comment citing WCAG 2.5.5 and explaining that it is the only tap target for that question kind — evidence of per-component accessibility reasoning, not blanket rule-following.
- **`applyBrandingCssVars`** establishes CSS-variable-driven per-tenant branding, which is the right architecture. UI-CON-016 is largely about letting the components actually benefit from it.

---

## Suggested sequencing

| Wave | Findings | Rationale |
|---|---|---|
| **1 — Token fixes** | UI-COL-001, UI-A11Y-002, UI-COL-006, UI-LAY-013 | Highest leverage per line changed. Four token edits plus a mechanical sweep resolve ~200 call sites and remove both hard compliance blockers. |
| **2 — Participant path** | UI-A11Y-005, UI-A11Y-007, UI-INT-008, UI-A11Y-010, UI-MOB-023 | The flow with the most users and the least tolerance for friction; all five are localised to `src/pages/join/`. |
| **3 — Presenter stage** | UI-MOB-004, UI-COL-003, UI-COL-015 (leaderboard), UI-VIS-030 (stage error) | The audience-facing surface. UI-COL-003 ships with wave 1 if the token sweep touches it. |
| **4 — Structural** | UI-CON-016, UI-CON-017, UI-CON-021, UI-USE-014 | Prevents recurrence. Start with `src/ui/components.tsx` and add the CI guards (undefined token grep, arbitrary-hex lint, inline-SVG grep) so the counts can only fall. |
| **5 — Polish** | Remaining medium and low findings | Landing-page hierarchy, i18n extraction, confirmations, empty states. |

The CI guards in wave 4 matter more than the migrations they accompany: without them, waves 1-3 will drift back within a few release trains, which is how the current state was reached.
