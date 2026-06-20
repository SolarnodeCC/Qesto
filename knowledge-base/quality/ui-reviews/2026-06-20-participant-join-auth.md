# UI/UX Review — Participant Join Flow + Auth Entry

**Date:** 2026-06-20
**Reviewer role:** Senior UI/UX reviewer (WCAG 2.1 AA lens)
**Method:** Static source review — React/TSX + Tailwind tokens. **No live browser render, no screen-reader pass, no automated axe run, no real device testing.**
**Colour ratios** computed from `src/styles.css` token hex values against the actual background each token sits on.

## Scope reviewed

| Surface | File |
|---|---|
| Voter entry / lookup / live voting shell | `src/pages/JoinPage.tsx` |
| Persistent join bar (marketing nav) | `src/components/JoinBar.tsx` |
| Standalone join landing (`/j`) | `src/pages/join/JoinLanding.tsx` |
| Vote input (all question kinds) | `src/pages/join/QuestionVoteInput.tsx` |
| Pre-session waiting screen | `src/pages/join/WaitingScreen.tsx` |
| Auth (magic link / password / signup / reset) | `src/pages/Login.tsx` |
| Shared input/field tokens | `src/ui/input-field-class.ts` |
| Skip-link primitive | `src/components/SkipLink.tsx` |

## NOT reviewed (open risk)

- Host launchpad, Present/Display projector views, Results, Dashboard, Admin, team settings — **not** audited; findings here do not generalise to them.
- Actual rendered output, focus-ring visibility, animation timing, RTL, real touch-target sizes on device.
- Screen-reader announcement order (only static ARIA attributes inspected).
- Target audience/device assumption: participant flow is assumed **mobile-first, one-time anonymous users on variable networks**. If that assumption is wrong, re-weight the connection/touch findings.

---

### [HIGH] Disabled vote controls look fully enabled — taps are silently swallowed during reconnect
**Locatie:** `src/pages/join/QuestionVoteInput.tsx` — `poll`/`ranking`/`consent` default branch (l.220-233), `multi_select` (l.145-155), `likert` (l.101-114), `upvote` (l.186-196)
**Probleem:** When the WebSocket is not `open`, `canVote` is `false` and every option button gets `disabled`. But these four branches have **no `disabled:` visual style** — a not-yet-voted button falls through to the full-colour "available" styling while being functionally disabled. (Compare the `reaction` branch l.43 and the open-text submit l.86, which *do* carry `disabled:opacity-50`.) There is also no inline message near the controls explaining why nothing happens — the only signal is a small amber `connectionLabel` in the page header (`JoinPage.tsx` l.300-302).
**Gebruikersimpact:** During a reconnect (the *expected* state on conference Wi-Fi / mobile), the participant taps a fully tappable-looking option, gets zero feedback, taps again, and concludes the app is broken or their vote was counted. This is the single moment that "may not fail" on this screen.
**Onderbouwing:** WCAG 1.4.1 (don't rely on a header-only colour cue), 3.3.1/4.1.3 (status must be perceivable at the point of action), Nielsen #1 "visibility of system status". The inconsistency with the two branches that already dim correctly proves it's an oversight, not a design intent.
**Fix:** (1) Add `disabled:opacity-50 disabled:cursor-not-allowed` to all four option-button class blocks. (2) When `!canVote`, render an inline `role="status"` line above the options (e.g. `t('reconnecting_vote_disabled')`) instead of relying on the header chip. (3) Confirm `sendVote` buffers or rejects while closed so an optimistic `myVotes` entry can't show "vote recorded" for a vote that never left the device.

### [HIGH] `text-pulse-400` secondary text fails AA contrast (2.5:1) across the join flow
**Locatie:** `--color-pulse-400: #A3A3A3` used as readable copy in `JoinLanding.tsx` l.55, `WaitingScreen.tsx` l.35 & l.49, `JoinPage.tsx` l.350 (countdown caption), `QuestionVoteInput.tsx` l.231 (post-vote option label)
**Probleem:** #A3A3A3 on white (#FFFFFF) measures **2.52:1**. AA requires 4.5:1 for normal text and 3:1 for large text — this fails both. The dark-mode counterpart `#6B7A99` on `#0A0F1E` measures **~4.34:1**, also just under the 4.5:1 normal-text bar. By contrast `text-pulse-500` (#737373) is 4.73:1 and passes.
**Gebruikersimpact:** Low-vision users, anyone outdoors on a phone (the join flow's actual context), or on a dim projector-room screen cannot reliably read helper text: "auto-updates", the countdown sub-caption, the post-vote dimmed options.
**Onderbouwing:** WCAG 1.4.3 Contrast (Minimum), Level AA. Measured ratio 2.52:1 vs required 4.5:1.
**Fix:** Stop using `pulse-400` for text. Promote secondary copy to `pulse-500` (#737373, 4.73:1) or darker; reserve `pulse-400`/`pulse-300` for borders/decoration only. In dark mode use a token ≥ `#8A96B0` to clear 4.5:1. Add a lint/token rule so `pulse-400` can't be used with a `text-` utility.

### [MEDIUM] Auth active-tab uses off-brand `bg-blue-600` (teal/violet everywhere else)
**Locatie:** `src/pages/Login.tsx` — `tabClass` l.84
**Probleem:** The selected Magic/Login/Signup tab is `bg-blue-600`, while the primary button is a teal→violet gradient (l.91), the title is a teal→violet clip-text (l.103), and every focus ring is teal/violet. Blue appears nowhere else in this component's palette.
**Gebruikersimpact:** No task failure, but it reads as an unfinished/borrowed component and weakens the brand's primary-colour signal — the active tab competes with, rather than matches, the primary CTA.
**Onderbouwing:** Visual-consistency / semantic-colour principle: one "primary/selected" hue per surface. This is a measurable token mismatch (`blue-600` vs the teal/violet system), not taste.
**Fix:** Use the brand primary for the active tab (e.g. `bg-teal-600 text-white`, or a teal/violet treatment consistent with `primaryBtn`).

### [MEDIUM] Auth tabs are an incomplete ARIA tab pattern
**Locatie:** `src/pages/Login.tsx` — `role="tablist"` l.151, tabs l.152-160, panels l.165/212/328
**Probleem:** Tabs have `role="tab"` + `aria-selected`, but: (a) no `aria-controls` linking each tab to its panel; (b) panels (`role="tabpanel"`) have no `id` and no `aria-labelledby`; (c) no arrow-key roving tabindex — a screen-reader/keyboard user can't move between tabs with ←/→ as the role implies; (d) the tab buttons lack `type="button"`.
**Gebruikersimpact:** Screen-reader users hear "tab" but get none of the relationships or navigation the role promises; the panel isn't associated with its tab.
**Onderbouwing:** WAI-ARIA Authoring Practices — Tabs pattern (roving tabindex, `aria-controls`, `aria-labelledby`). Either implement the full pattern or drop the tab roles.
**Fix:** Add `id`/`aria-controls`/`aria-labelledby` pairing, roving `tabIndex` (0 for selected, -1 otherwise) with an arrow-key handler, and `type="button"`. Alternatively, if a full tab widget is overkill, switch to plain buttons + a labelled region.

### [MEDIUM] Likert option targets are ~40px tall — below the 44px touch minimum
**Locatie:** `src/pages/join/QuestionVoteInput.tsx` — `likert` branch, `grid-cols-5 gap-1.5` with `py-3 px-1 text-xs` (l.97-114)
**Probleem:** Five targets across a phone width with `py-3` (12px) + ~16px text ≈ **~40px** tall. On a 360px viewport (minus `px-5` page padding) each is ~59px wide but the height is the limiting axis.
**Gebruikersimpact:** Mis-taps on a 5-point scale on small screens — the participant registers the wrong score and can't change it (button locks after vote).
**Onderbouwing:** Apple HIG 44×44pt / Material 48dp minimum; WCAG 2.5.5 (AAA) 44px. (It does clear the AA 2.5.8 24px floor, hence Medium not High.)
**Fix:** Raise to `min-h-[44px]` (e.g. `py-3.5`), and on the narrowest breakpoint consider a 1×5 vertical or 2-row layout so width isn't sacrificed for height.

### [MEDIUM] Placeholder text is the only hint in some fields and sits at 1.5–2.5:1
**Locatie:** `src/ui/input-field-class.ts` — `ENTRY_CODE_FIELD_CLASS` placeholder `pulse-300` (#D4D4D4 = **1.48:1**), `ENTRY_RESPONSE_FIELD_CLASS`/`INPUT_HINT_TEXT_CLASS` placeholder `pulse-400` (#A3A3A3 = **2.5:1**)
**Probleem:** The join-code field and the open-response field rely on a placeholder as the example/affordance, but those placeholders are near-invisible. Placeholders also vanish on input, so anything carried only in the placeholder is lost mid-typing.
**Gebruikersimpact:** Users who don't immediately parse the example (format of a join code, what to type in an open question) get no persistent hint, especially in bright light.
**Onderbouwing:** WCAG 1.4.3 (placeholder text is still text); WCAG 3.3.2 Labels or Instructions — don't depend on placeholder as the sole label/hint.
**Fix:** Either raise placeholder contrast to ≥ 4.5:1 **and** keep a persistent visible label/helper (the join field already has an `sr-only` label — add a visible format hint like "6 characters" below it), or move the example into permanent helper text.

### [MEDIUM] Lookup-error screen prints the raw server message to participants
**Locatie:** `src/pages/JoinPage.tsx` — error branch l.135 renders `{lookup.message}` from `res.error.message`
**Probleem:** Whatever the API returns as `error.message` is shown verbatim under a friendly "not found" title. Server error strings are not product copy — they can be terse, technical, untranslated, or leak internals.
**Gebruikersimpact:** A confused participant who mistyped a code may see a developer-flavoured string instead of a clear "Check the code and try again" with retry affordance.
**Onderbouwing:** Error-recovery / Nielsen #9 (plain-language, constructive errors); also i18n consistency — server messages bypass the `t()` layer.
**Fix:** Map known error codes to localised copy and a clear next action (re-enter code / retry). Reserve raw `message` for logs, not the participant UI. Add a visible "try again" affordance, not only "back to home".

### [LOW] Waiting-screen easter egg: hardcoded English label, AT noise, missing Space key
**Locatie:** `src/pages/join/WaitingScreen.tsx` l.37-48
**Probleem:** A focusable `role="button"` div with `aria-label="Easter egg: Click for fun"` — a **hardcoded English string** (violates the project "no hardcoded translatable strings" rule), inserted into the keyboard tab order and announced to screen readers as meaningless filler on a waiting screen. `onKeyDown` handles `Enter` only; `role="button"` is expected to also activate on `Space`.
**Gebruikersimpact:** SR/keyboard users tab onto a 6xl emoji and hear untranslated noise; the only label on the screen that isn't localised. Non-English users get an English string.
**Onderbouwing:** Project i18n rule; WAI-ARIA button keyboard contract (Enter **and** Space); reduced cognitive load on a passive wait screen.
**Fix:** If the easter egg stays, make it non-focusable decoration (`aria-hidden`, remove from tab order) or give it a localised label and Space handling. Simplest: drop the interaction or hide it from AT.

### [LOW] Join code submit accepts <6 chars and forces a failed round-trip
**Locatie:** `src/components/JoinBar.tsx` l.12-17 and `src/pages/join/JoinLanding.tsx` l.12-17 — both only check `clean.length < 1`
**Probleem:** Codes are 6 chars (`maxLength={6}`), but submit fires on length ≥ 1, navigating to `/j/<partial>` which then resolves to the error screen.
**Gebruikersimpact:** A user who hits enter early is bounced to an error instead of getting inline "enter all 6 characters" — an avoidable failure loop.
**Onderbouwing:** WCAG 3.3.1/3.3.4 error prevention; validate before the network round-trip.
**Fix:** Gate submit on `clean.length === 6` (or the real code length) and show inline guidance; keep the button disabled until valid.

### [LOW] Magic-link invalid-email message isn't announced
**Locatie:** `src/pages/Login.tsx` l.195-197
**Probleem:** The magic-link invalid-email error is a plain `<p>` (no `role="alert"`), while the password/signup/reset errors all use `role="alert"`. Inconsistent — this one won't be announced when it appears.
**Gebruikersimpact:** Screen-reader users submitting the magic-link form get no spoken feedback that the email was rejected.
**Onderbouwing:** WCAG 4.1.3 Status Messages; internal consistency with the other three forms.
**Fix:** Add `role="alert"` to the message (it already pairs with `aria-invalid` on the input).

### [LOW] `id="main"` / skip-target coverage is inconsistent on the join route
**Locatie:** `src/pages/JoinPage.tsx` loading branch l.104 (`<main>` has **no** `id="main"`), and the join route renders its own `<main>` outside `MainLayout`/`AppShellLayout`, so `SkipLink` is never mounted on `/j/:code`.
**Probleem:** Most `<main>`s carry `id="main"` (the skip-link target), but the loading state omits it, and the participant flow has no skip link at all. The in-page `<main>`s also lack `tabIndex={-1}`, so even an anchor jump wouldn't move focus.
**Gebruikersimpact:** Minor on this low-chrome screen, but it's an inconsistency that breaks the "every page has a working skip target" contract the SkipLink doc claims.
**Onderbouwing:** WCAG 2.4.1 Bypass Blocks (Level A); internal contract in `SkipLink.tsx` ("Targets the `#main` landmark on every page").
**Fix:** Add `id="main"` (+ `tabIndex={-1}`) to every `<main>` in `JoinPage`, and decide whether the join route should mount a `SkipLink`. At minimum make the contract true or update the doc.

---

## Samenvatting

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 5 |
| Low | 4 |
| **Total** | **11** |

No Critical found **in the reviewed scope** — but note this was static-only: a live screen-reader/device pass on the voting flow could surface Critical issues (e.g. focus management on question change) that source review can't confirm.

## Top 3 prioriteiten

1. **Visual + inline feedback for disabled voting during reconnect** (HIGH #1) — directly attacks the one task that must not fail on the product's busiest screen, in its most likely failure state.
2. **Kill `text-pulse-400` as text colour** (HIGH #2) — a single token fix clears multiple AA 1.4.3 failures across the whole join flow; add a guard so it can't regress.
3. **Auth tab pattern + brand colour** (MEDIUM #3 + #4) — cheap, high-polish: correct ARIA tabs and on-brand selected state on the first authenticated-product impression.

## Wat wél goed werkt (behouden)

- **Connection state is modelled, not ignored:** explicit `connecting`/`reconnecting`/`failed` copy, a connecting skeleton (`JoinPage.tsx` l.336-343), and an inter-question countdown with `aria-live` — most poll tools drop the participant into a frozen screen on reconnect.
- **Consistent, correct focus-visible rings** (`focus-visible:ring-2 ring-teal-500`) on essentially every interactive element, plus a real `SkipLink` and `aria-pressed` on toggle-style vote buttons.
- **Auth error states are genuinely complete:** distinct status enums per form, `role="alert"`/`role="status"` on most banners, `autoComplete`/`type` set correctly (`email`/`current-password`/`new-password`), and `noValidate` with custom messaging.
- **Token discipline:** inputs and fields are centralised in `input-field-class.ts` rather than ad-hoc — which is also exactly why the two contrast fixes above can be made in one place.
