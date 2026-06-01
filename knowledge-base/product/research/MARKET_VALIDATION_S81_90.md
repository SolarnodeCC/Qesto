---
id: MARKET_VALIDATION_S81_90
type: research
domain: product
category: market-intelligence
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - market-intelligence
  - competitive
  - validation
  - new-business
  - sprint-planning
  - s81-s90
  - tam
  - positioning
relates_to:
  - SPRINT81_90_PLAN
  - COMPETITIVE_EPICS
  - ROADMAP_FULL
  - COMPETITOR_PROFILES
  - WIN_LOSS_ANALYSIS
---

# Market Validation — Sprint 81–90 Arc (post-v5.0 → v6.0 GA)

_Owner: `/market-research` agent. Created 2026-06-01 (UTC)._

_Validates the new-business epic set in [`SPRINT81_90_PLAN.md`](../planning/SPRINT81_90_PLAN.md) against the market, using [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md) (value/change ratings) as the candidate scope and [`COMPETITOR_PROFILES.md`](./COMPETITOR_PROFILES.md) + [`WIN_LOSS_ANALYSIS.md`](./WIN_LOSS_ANALYSIS.md) as the evidence base._

## Purpose & method

The S81–S90 plan promotes eight `COMPETITIVE_EPICS.md` rows (TOWNHALL, STAGE, RETRO, IDEATE, DELIBERATE, EMBED, CANVAS, CAPTIONS) from "proposed" to committed, alongside three platform moves (native mobile GA, marketplace economy, agentic facilitation). This doc asks one question per epic: **does the market signal justify the committed slot, and is it sequenced correctly?**

**Evidence basis & limits:** synthesis of Qesto's existing competitor profiles, documented win/loss reasons, and category-level public knowledge of the named competitors. This is a **sequencing/positioning validation**, not a fresh TAM survey — TAM signals below are **directional** (qualitative: category maturity, documented lost-deal reasons, competitor moves) and should be confirmed with a sized market study before any epic's GTM spend is locked. No private Qesto customer data was used.

---

## Per-epic market validation

Buyer = target segment Qesto does **not** sell to today (unless noted). Moat = which of Qesto's four moats (edge latency / zero-knowledge privacy / native Workers AI / reusable question engine) the epic leans on.

| Epic (sprint) | Target buyer / segment | Named competitors attacked | TAM signal (directional) | Qesto moat leaned on | Verdict |
|---|---|---|---|---|---|
| **TOWNHALL** (S84) | Internal-comms / People / IC teams running all-hands & AMAs | **Slido, Vevox**, Poll Everywhere (participant cap) | **Strong.** Slido's documented *core* category; Vevox's wedge. Recurring all-hands cadence = retention. Internal-comms is a net-new buyer Qesto doesn't sell today. | Edge latency (scale) + zero-knowledge anonymity | 🟢 **Validated — strongest new-business signal.** Lowest change (2), highest-leverage. Anonymity-at-scale is the exact axis Slido is weakest on (enterprise privacy opacity in our profile). |
| **STAGE** (S85) | Conference / summit / hybrid-event organizers | Slido (events), Mentimeter (event mode), Cvent-adjacent event-tech | **Strong but proven-loss.** Event organizers are the **#2 documented lost-deal reason** (WIN_LOSS_ANALYSIS). Turns a known loss into a vertical. High-ticket category. | Edge latency + reusable engine (Find-Your-Match energizer ships already) | 🟢 **Validated.** Reclaims documented losses. Note: loss reason is partly *integration gaps* (Zoom), not feature gaps — STAGE must not over-build orchestration before closing the integration loss. |
| **RETRO** (S85) | Engineering / scrum / agile teams (recurring) | **Parabol, Retrium, EasyRetro, TeamRetro, Metro Retro** | **Strong, sticky.** Weekly cadence = highest retention/expansion of the set. Mature crowded category (validates demand), but incumbents lack the anonymity + native-AI clustering combo. | Zero-knowledge anonymity + native Workers AI (theme clustering) + reusable engine | 🟢 **Validated — best *recurring-revenue* signal.** Honest retros need anonymity; that is Qesto's moat, not a feature these incumbents lead on. Strongest LTV case after TOWNHALL. |
| **IDEATE** (S85–S86) | Workshop facilitators, innovation / design-thinking teams | **Miro / Mural** (voting), **Stormboard** | **Moderate-Strong.** Large adjacent TAM but the *decision-focused* slice is narrow vs. freeform-canvas incumbents. Risk of being a "lite" feature against entrenched whiteboards. | Native AI (auto-cluster) + reusable engine (`ranking`/`upvote`) | 🟡 **Validated with caution.** Don't position head-on vs. Miro's canvas — position as *converge-to-decision*, not whiteboard parity. Correctly slotted P1 / behind RETRO. |
| **DELIBERATE** (S86–S87) | Boards, associations, co-ops, **works councils** (DACH/NL) | Association/governance-voting tools (ElectionBuddy, OpaVote, Assembly Voting, association ballot vendors) | **Niche but high-ARPU.** Small TAM, very sticky, low price sensitivity. DE/NL locale + EU-residency fit is a real unlock (works councils). | **Zero-knowledge privacy + audit** (near-unbeatable here) | 🔵 **Validated — highest-moat bet.** Smallest TAM of the set but the only epic where Qesto's moat is structurally near-unbeatable. Correctly gated behind crypto-receipt feasibility (ADR-0049). |
| **EMBED** (S87–S88) | Product teams, LMSs, streaming/dev tools (PLG / developer / partner) | **Typeform** (embed widgets), embeddable form/poll widgets, partner-tier APIs | **Highest ceiling.** Expands TAM beyond the Qesto app itself; opens PLG + partner revenue. But heaviest build (change 5) and longest payback. | Reusable engine + edge latency + entitlements/metering | 🟡 **Validated as the *ceiling* bet, not the *near-term* bet.** Highest TAM, slowest to revenue. Correctly sequenced late (S87) — but see sequencing risk #2: its revenue depends on the marketplace economy (E82) being healthy first. |
| **CANVAS** (S88) | Existing base + Mentimeter switchers (presentation polish) | **Mentimeter** ("looks great on stage" — its core win axis) | **Moderate (conversion lever, not new buyer).** Not a new-buyer epic — it lifts trial→paid and feeds the theme-marketplace upsell + white-label on-ramp. | Reusable render layer (generalizes existing theming) | 🟢 **Validated — but it is a *conversion* epic, not new-business.** Attacks Mentimeter's strongest axis. Arguably under-prioritized: see sequencing risk #3. |
| **CAPTIONS** (S88) | Global enterprises, accessibility/inclusion buyers, multilingual events | Mentimeter/Slido (no native live MT), Wordly/Interprefy (event MT) | **Moderate, differentiator.** Inclusion/accessibility is a real enterprise procurement driver; leans on existing 5-locale i18n. **Tech-risk gated** (Workers AI ASR/WER quality). | Native Workers AI (no third-party egress) + i18n | 🟡 **Validated *conditionally*.** Strong differentiator IF the WER bar (S88 gate) holds. ASR quality risk is the real variable — keep the feasibility gate hard. |

**Not promoted (correctly held back):** COPILOT, INSIGHTS+, REACTIONS from `COMPETITIVE_EPICS.md` are absent from the committed E84–E88 new-business slots. COPILOT/INSIGHTS+ are upsell-to-base (no new buyer) and are partly absorbed by E83 agentic facilitation; REACTIONS is a speculative crowded-space bet (creator economy) and rightly deferred. **No disagreement.**

---

## Sequencing assessment

**Overall verdict: AGREE with the macro-sequence, with three adjustments to flag (not block).**

The plan's spine — **Reach (mobile) → Economy (marketplace) → New buyers (E84–E88) → Gov/cert (E89–E90)** — is the right order. Rationale: new-buyer epics that monetize through ecosystem (EMBED, agent marketplace, CANVAS theme marketplace) **depend on** the marketplace economy (E82) and mobile reach (E81) being live first. Shipping a new buyer before the rails that monetize it would strand revenue. The plan gets this right.

| # | Sequencing question | Assessment |
|---|---|---|
| 1 | Is **mobile GA (E81)** correctly ahead of new-buyer epics? | **AGREE.** Mobile-first engagement is a documented competitor strength (Kahoot/Mentimeter app). TOWNHALL/STAGE/RETRO all have heavy mobile-participant usage — shipping them before native GA would launch new buyers onto a weaker surface. Mobile-first is correct. |
| 2 | Is **marketplace economy (E82)** correctly ahead of EMBED (E87)? | **AGREE — and it is load-bearing.** EMBED's partner/PLG revenue and CANVAS's theme-marketplace upsell both monetize *through* Stripe Connect payout + revenue share. E82 before E87 is not just fine, it's a prerequisite. |
| 3 | Is **TOWNHALL (S84) / RETRO (S85)** correctly the first new-buyer wins? | **AGREE.** These are the lowest-change (2–3), highest-signal, fastest-to-revenue new buyers. Leading the new-business wave with them de-risks the heavier later epics (DELIBERATE crypto, EMBED SDK). Matches `COMPETITIVE_EPICS.md` "prove value on existing rails first" logic. |

**Three adjustments to consider:**

- **ADJUST-1 (pull CANVAS earlier, ~S84/S85):** CANVAS is rated a 🟢 conversion lever that "compounds the value of every other epic," yet it lands at S88 — *after* the four new-buyer launches it would make demo better. Every TOWNHALL/STAGE/RETRO launch ships before the presentation polish that drives trial→paid. Recommend pulling at least the **theme picker / per-question viz** slice forward to S84–S85 so the new-buyer launches demo on it. Low change (3), high compounding return. This is my one substantive sequencing recommendation.
- **ADJUST-2 (guard the EMBED payback assumption):** EMBED (change 5, highest ceiling, slowest revenue) consumes a 34-pt slot at S87. Confirm the marketplace economy (E82) is showing real partner traction *before* the EMBED build commits — if E82 monetization is soft by S86, EMBED's payback assumption weakens and the slot is better spent hardening RETRO/TOWNHALL expansion. Add an E82-health checkpoint to the S86 RC gate.
- **ADJUST-3 (DELIBERATE TAM vs. slot cost):** DELIBERATE is the smallest TAM but a full P0 crypto build (ADR-0049, 21 pts + security). The moat justifies it, but recommend the PO confirm at least 2–3 named works-council/association design partners before S86 to validate the niche is real revenue, not just a moat showcase.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **TAM signals are directional, not sized.** Verdicts rest on category maturity + documented losses, not a fresh sized market study. | High (for GTM spend) | Commission a sized TAM/SAM study for TOWNHALL (internal-comms), RETRO (agile), EMBED (developer) before locking marketing budget. Treat verdicts as sequencing guidance, not revenue forecasts. |
| **Five net-new buyer segments in one arc** (internal-comms, events, agile, governance, developer) stretches a positioning story that today centers on "privacy-first edge engagement." | High | Sequence GTM, don't parallelize. Lead each launch with the *same* moat (privacy/edge/native-AI), not five new value props. Run a positioning audit (marketing lead) before S84 — escalation trigger per agent scope. |
| **CAPTIONS ASR/WER quality** (Workers AI only, no third-party egress). If WER bar misses, the inclusion claim is unsupportable and `check:compliance-claims` blocks copy. | Medium-High | Keep S88 WER gate hard. Have a "captions = beta, no accuracy claim" fallback so E88 still ships CANVAS/AAA if CAPTIONS slips. |
| **IDEATE positioned head-on vs. Miro/Mural** invites an unwinnable canvas-parity comparison. | Medium | Position as converge-to-decision, never "whiteboard." Marketing copy review before S86. |
| **STAGE rebuilds orchestration when the real loss reason is integration gaps** (Zoom, event-mgmt tools per WIN_LOSS_ANALYSIS). | Medium | Confirm the Zoom/event-integration loss is closed (or in scope) before over-investing in agenda orchestration. Tie STAGE GTM to the integration story. |
| **DELIBERATE = smallest TAM, full P0 crypto cost.** Moat-led, not demand-led. | Medium | Require 2–3 design partners (ADJUST-3) before S86 commit. Crypto-receipt feasibility already gated (ADR-0049) — good. |
| **EMBED revenue depends on E82 marketplace health** (ADJUST-2). | Medium | Add E82-traction checkpoint to S86 RC gate before EMBED build commits. |

---

## Prioritized `/vs/` competitor pages for marketing

Ordered by **buyer-intent search value × launch alignment**. Each page should lead with the Qesto moat in the verdict column above, and stay `check:compliance-claims`-safe (no unsubstantiated scale/accuracy claims).

| Priority | Page | Ship alongside | Lead angle |
|---|---|---|---|
| **P0** | `/vs/slido` | S84 (TOWNHALL) | Anonymity-at-scale + edge latency + no Cisco lock-in. Attacks Slido's core (town halls) on its weakest axis (privacy opacity). Highest-intent term in the set. |
| **P0** | `/vs/mentimeter` | S88 (CANVAS) — but the page should exist far earlier | Privacy-first + per-session pricing + native AI + "looks great on stage" (CANVAS). Mentimeter is the #1 documented brand threat; this page earns search regardless of epic timing — build it first even if CANVAS slips. |
| **P0** | `/vs/parabol` (or `/vs/retrium`) | S85 (RETRO) | Anonymous retros + AI theme clustering + action carryover. Parabol is the strongest-brand retro incumbent; Retrium as the enterprise-agile alternate term. |
| **P1** | `/vs/easyretro` | S85 (RETRO) | Capture the high-volume/low-friction retro searcher Parabol doesn't fully own. Same moat, different intent tier. |
| **P1** | `/vs/vevox` | S84 (TOWNHALL) | Town-hall/IC alternative-to-Slido searchers; edge-scale + anonymity. |
| **P1** | `/vs/typeform` (embed angle) | S87 (EMBED) | Embeddable engagement widgets + metered API. Frame as "engagement SDK," not "forms" — different job-to-be-done. |
| **P2** | `/vs/miro` (voting-only angle) | S86 (IDEATE) | Narrow scope: "dot-voting & converge-to-decision without the whiteboard." Defensive page — do **not** invite full canvas comparison. |
| **P2** | `/vs/poll-everywhere` | Evergreen | Already a declining-incumbent target; low new effort, captures switch-intent. Per existing profile guidance, low priority. |

**Hub pages (not `/vs/`) to pair:** `/internal-comms` (TOWNHALL ICP, S84), `/retro` (agile ICP, S85), `/embed` (developer ICP, S87) — already in the marketing plan (MKTG-84/85/87). The `/vs/` pages above feed these hubs.

---

## Escalation flags (per agent scope)

- **Positioning audit (marketing lead):** five new buyer segments in one arc risks fragmenting the "privacy-first edge engagement" story → recommend audit before S84 (Risk #2).
- **Backlog grooming (PO):** DELIBERATE design-partner validation + EMBED/E82-health checkpoint → groom into S86 RC gate (ADJUST-2, ADJUST-3).
- **CANVAS re-sequencing (PO):** ADJUST-1 (pull theme/viz slice to S84–S85) is a backlog-order change worth a grooming decision, not an ADR.

_No ADR-level strategic conflict found: the epic→moat mapping in SPRINT81_90_PLAN is consistent with documented positioning. The macro-sequence is sound._
