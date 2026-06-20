# UI/UX Review — Full-App Scan (host, presenter, results, dashboard, config)

**Date:** 2026-06-20
**Reviewer role:** Senior UI/UX reviewer (WCAG 2.1 AA lens)
**Method:** Static source review (React/TSX + Tailwind tokens) + repo-wide grep to test whether issues are local or systemic. **No live render, no screen-reader pass, no automated axe, no device testing.**
**Companion doc:** `2026-06-20-participant-join-auth.md` (participant + auth path). This doc extends the scan to the authenticated host product and is where the **systemic** findings are recorded.

## Scope reviewed (this pass)

| Surface | File |
|---|---|
| Dashboard shell + actions | `src/pages/Dashboard.tsx`, `src/pages/dashboard/HeroSection.tsx` |
| Host draft/live config | `src/pages/SessionConfig.tsx` |
| Presenter live control bar | `src/pages/present/PresenterControls.tsx` |
| Projector / big-screen display | `src/pages/Display.tsx` |
| Post-session results | `src/pages/Results.tsx` |

Plus the join/auth surfaces from the companion doc.

## NOT reviewed (open risk — explicitly out of this pass)

Marketing/solution/feature pages, Pricing, AccountSettings, Admin, team-settings, Studio, Embed, Townhall/Ideate/Retro/Deliberate/EventStage variants, energizers, XR. These were only touched via grep for the contrast count below — treat them as **unaudited**, not as passing.

---

### [HIGH] Hardcoded English strings bypass i18n across core host surfaces
**Locatie:** `Results.tsx` (most of the page), `present/PresenterControls.tsx` (almost the entire control bar), `SessionConfig.tsx` (incl. the page `<h1>`), `Dashboard.tsx` (action toasts), `HeroSection.tsx`
**Probleem:** Whole user-facing surfaces are written in literal English while *the same files* localise other strings via `t()` — proving it's unintended drift, not an English-only decision. Concrete examples:
- `Results.tsx`: `"← Dashboard"`, `"Join code"`, `"live snapshot"`, `"Total votes: … source …"`, `"· winner"`, `"Export CSV"`, `"Refresh"`, and the status badge renders the raw enum `{session.status}` (l.182).
- `PresenterControls.tsx`: `"Back"`, `"Next question"`, `"Close session"`/`"Closing…"`/`"Session closed"`, `"Pause"`/`"Resume"`, `"Hide tally"`, `"Show sentiment"`, `"Shuffle options"`, `"Min. votes to show tally"`, `"Timer"`/`"min"`/`"Start"`/`"Stop"`, `"Display link"`/`"Copied!"`, `"Export CSV"`, `title="Copy display URL to embed in PowerPoint"` — yet the captions block right below uses `t('captions')` correctly.
- `SessionConfig.tsx`: `<h1>Configure</h1>` (l.182), `"Title"`, `"Prompt"`, `"Options (x/10)"`, `"Remove"`, `"+ Add option"`, `"Save"`/`"Saving…"`, `"Open presenter view →"`, `"Session closed"`, and validation copy `"A poll needs a prompt and at least two non-empty options."` (l.153) — alongside `t('pollQuestion')`, `t('loadingSession')`.
- `Dashboard.tsx`: toast strings `"Remove failed"` (l.250), `"Saved as template!"` (l.264).
**Gebruikersimpact:** Qesto advertises EN/NL/ES/DE/FR. A Dutch/Spanish/German/French host running a live session sees the entire presenter control bar and results page in English — the highest-stakes, most-visible host moments are untranslated. Mixed-language UI also reads as unfinished.
**Onderbouwing:** Project **Hard Rule** "No hardcoded translatable strings — use i18n" (CLAUDE.md / `COMMON_RULES`). The intra-file mix with `t()` is the proof of defect.
**Fix:** Extract every literal user-facing string in these files into the relevant i18n namespace (`results`, `present`/`captions`, `session-config`, `dashboard`). Add a lint rule / CI grep that fails on bare string literals inside JSX text and `title`/`aria-label`/`placeholder` for these directories. Never render a raw status enum — map `{session.status}` → `t('status.<value>')`.

### [HIGH] `text-pulse-400` / `text-pulse-300` used as readable text in 89 places across 40 files
**Locatie:** Platform-wide. Heaviest: `EmbedPlayground` (8), `DeliberateReceipt` (8), `EventStagePresent` (8), `PresenterControls` (5), `IdeateFacilitatorBoard` (5), `AccountSettings` (4), `AdminDashboard` (4), `TemplateDetail` (4) — and the join flow from the companion doc.
**Probleem:** `--color-pulse-400 = #A3A3A3` = **2.52:1** on white; `--color-pulse-300 = #D4D4D4` = **1.48:1**. Both fail WCAG 1.4.3 (need 4.5:1 normal / 3:1 large). The earlier doc flagged this on the join flow; the grep shows it's a **platform-wide token-usage pattern**, not a local slip.
**Gebruikersimpact:** Low-vision users and anyone on a bright screen lose secondary copy (captions, hints, metadata, counts) across most screens.
**Onderbouwing:** WCAG 1.4.3 Contrast (Minimum), AA. Measured from `src/styles.css` tokens.
**Fix:** One systemic remediation: forbid `text-pulse-400`/`text-pulse-300` (and their dark equivalents below 4.5:1) via an ESLint/regex CI gate; sweep existing usages to `pulse-500` (#737373, 4.73:1) or darker. This single token policy clears the majority of the contrast debt in one change.

### [MEDIUM] Presenter control bar is an unstructured wall of ~15 controls for screen readers
**Locatie:** `src/pages/present/PresenterControls.tsx` — root `<div>` (l.84) containing the whole bar
**Probleem:** ~15 interactive controls sit in a flat `flex-wrap` row. The visual group separators (`<span … w-px>` dividers, l.120 etc.) are `aria-hidden`, and the container has no `role="toolbar"`, no `aria-label`, and no grouping. A screen-reader/keyboard user gets fifteen unlabelled-by-context buttons in sequence with no sense of sections (navigation vs. visibility vs. timer vs. export vs. captions).
**Gebruikersimpact:** The host's primary live-control surface is hard to orient in via AT; during a live session that's a high-pressure failure mode.
**Onderbouwing:** WAI-ARIA `toolbar` pattern; WCAG 1.3.1 (info & relationships conveyed visually must be programmatic too).
**Fix:** Wrap the bar in `role="toolbar"` with an `aria-label`, and group related controls in labelled `role="group"` containers (Navigation / Display / Timer / Export / Captions). Consider arrow-key roving within the toolbar.

### [MEDIUM] Composite ARIA widgets miss the keyboard interaction their role promises
**Locatie:** `dashboard/HeroSection.tsx` "New session" `role="menu"` (l.64), and `Login.tsx` tab pattern (companion doc)
**Probleem:** The New-session dropdown declares `role="menu"` + `role="menuitem"` and wires `aria-haspopup`/`aria-expanded` correctly, but: focus is not moved into the menu on open, not restored to the trigger on close, and ↑/↓ arrow navigation between items isn't implemented. (Escape + outside-click *are* handled in `Dashboard.tsx` — good.) Same shape as the Login tabs gap. This is a **recurring pattern**, not a one-off.
**Gebruikersimpact:** Keyboard users can open the menu but can't traverse it as a menu; the announced semantics over-promise relative to behaviour.
**Onderbouwing:** WAI-ARIA Authoring Practices — Menu/Menu Button and Tabs patterns (focus management + arrow keys are part of the contract).
**Fix:** Add a small shared menu/tablist hook that handles roving `tabIndex`, arrow keys, and focus move/restore, and reuse it for both the dropdown and the auth tabs.

### [MEDIUM] Touch targets below 44px on the presenter bar (and Likert)
**Locatie:** `PresenterControls.tsx` — every control is `min-h-[36px]` (l.91, 100, …); number inputs are `w-14`/`w-12` with `py-1` (l.192, 211). Plus the Likert ~40px target from the companion doc.
**Probleem:** 36px controls and ~28–30px-wide numeric steppers are below the 44×44 touch minimum. The presenter bar is plausibly operated on a touch laptop/tablet at the front of a room.
**Gebruikersimpact:** Mis-taps on Next/Pause/Close during a live session — exactly when a mistake is most visible.
**Onderbouwing:** Apple HIG 44pt / Material 48dp; WCAG 2.5.5 (AAA) 44px. (Clears the AA 2.5.8 24px floor → Medium.)
**Fix:** Raise interactive controls to `min-h-[44px]` and widen the numeric inputs; if vertical space is tight, drop to a single control row height and let the bar wrap.

### [MEDIUM] Raw enum/status tokens rendered as UI labels
**Locatie:** `Results.tsx` l.182 `{session.status}`; `SessionConfig.tsx` l.186 `{data.session.status}`; `Display.tsx` l.143 `{state.connection}` (and l.164 footer)
**Probleem:** Lowercase machine enums (`draft`, `live`, `closed`, `archived`, `reconnecting`) are shown directly in status pills/labels — untranslated and unstyled as copy.
**Gebruikersimpact:** Users see developer-facing tokens instead of localized, human labels; inconsistent capitalization/voice.
**Onderbouwing:** WCAG 3.1 / general content quality; ties into the i18n Hard Rule.
**Fix:** Map every status/connection enum through a localized label table before rendering.

### [LOW] Word-cloud result colours are random (non-semantic) and several fail contrast
**Locatie:** `Results.tsx` — `RESULT_COLORS` + `hashColor()` (l.14-29), applied at l.214
**Probleem:** Word colour is a hash of the word — it carries no meaning — while several palette entries (`text-orange-500`, `text-pink-500`, `text-amber-600`, `text-rose-500`) on white fall near/below 4.5:1, and the smallest words render at 18px (l.213 via `getResultFontSize`).
**Gebruikersimpact:** The least-frequent words (smallest + possibly lowest-contrast) are the hardest to read, and the colour variety implies a grouping that doesn't exist.
**Onderbouwing:** WCAG 1.4.1 (colour not used to convey non-existent meaning) + 1.4.3 (contrast).
**Fix:** Either map font *weight/size* to frequency only and keep a single accessible text colour, or restrict the palette to AA-passing hues and raise the floor font size.

### [LOW] Permanently-disabled "Import session" dead control with hardcoded tooltip
**Locatie:** `dashboard/HeroSection.tsx` l.123-130
**Probleem:** A disabled button with `title="Coming soon"` (hardcoded English) and `text-pulse-400`/`opacity-60` sits among the primary hero CTAs.
**Gebruikersimpact:** Visual clutter beside the real actions; a control that looks actionable but never is. Minor cognitive cost.
**Onderbouwing:** Foutpreventie / progressive disclosure — don't show dead-end affordances as primary actions.
**Fix:** Hide until the feature ships, or move behind a "more" affordance; if kept, localise the tooltip.

---

## Samenvatting (this pass)

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 (both systemic) |
| Medium | 4 |
| Low | 2 |
| **Total** | **8** |

Combined with the companion doc: **4 High, 9 Medium, 6 Low** across the reviewed surfaces. Still **static-only** — a live SR/device pass is the next gate and could surface Critical issues (focus management on question advance, live-region timing on the projector).

## Top 3 prioriteiten (whole app)

1. **i18n sweep of host surfaces** (HIGH) — Results, PresenterControls, SessionConfig are partially-English on the highest-stakes screens; it breaks the advertised 5-language support and violates a Hard Rule. Add the CI grep so it can't regress.
2. **Kill `pulse-400`/`pulse-300` as text, platform-wide** (HIGH) — one token policy + sweep clears 89 contrast failures across 40 files.
3. **Shared accessible toolbar/menu/tabs behaviour** (MEDIUM ×2 + presenter toolbar) — one small hook fixes the recurring "ARIA role without the keyboard contract" gap on the dropdown, the auth tabs, and the presenter bar at once.

## Wat wél goed werkt (behouden)

- **Real loading/skeleton discipline:** `Dashboard`/`Results` use geometric skeletons to prevent layout shift; `SessionConfig`/`Results` gate on `auth.status` cleanly with `<Navigate>` redirects.
- **Toggle controls are not colour-only:** every presenter toggle pairs a colour change with an icon swap *and* a text-label change (`Pause`→`Resume`, `Hide tally`→`Tally hidden`), with correct `aria-pressed`.
- **Dashboard dropdown gets the hard parts right:** `aria-haspopup`/`aria-expanded`, Escape + outside-click dismissal, and a `ref`-scoped handler — only the in-menu arrow keys/focus-move are missing.
- **Forms are structured:** `SessionConfig` uses `fieldset`/`legend`, `htmlFor` labels, per-option `aria-label`, and `role="alert"`/`role="status"` on save feedback — the bones are correct; it's the literal strings and contrast tokens that need work.
