---
id: MARKET_VALIDATION_S85_99
type: research
domain: product
category: market-intelligence
status: active
version: 1.0
created: 2026-06-11
updated: 2026-06-11
tags:
  - market-intelligence
  - competitive
  - validation
  - new-business
  - sprint-planning
  - s85-s99
  - s91-s99
  - post-v6
  - v7-horizon
  - tam
  - positioning
relates_to:
  - SPRINT81_90_PLAN
  - MARKET_VALIDATION_S81_90
  - COMPETITIVE_EPICS
  - ROADMAP_FULL
  - COMPETITOR_PROFILES
  - WIN_LOSS_ANALYSIS
  - MARKET_TRENDS
  - CUSTOMER_PAIN_POINTS
---

# Market Validation — Sprint 85–99 Arc (v5.1 GA → v7.0 horizon)

_Owner: `/market-research` agent. Created 2026-06-11 (UTC)._

_Companion to [`MARKET_VALIDATION_S81_90.md`](./MARKET_VALIDATION_S81_90.md), which validated the committed S81–S90 new-business set. This doc validates the **new 15-sprint S85→S99 arc on the 9-day cadence**, and — because S85–S90 reuse already-committed epics — focuses its net-new contribution on the **previously-unscoped horizon S91–S99 (post-v6.0 GA, heading to v7.0)**._

## Purpose & method

The replanned arc runs **S85→S99 on a 9-day sprint cadence** (capacity retained at 120–150 pts/sprint). Two halves:

- **S85–S90 — reuse of committed scope.** The S81–S90 plan already commits E84–E90 (TOWNHALL, STAGE, RETRO, IDEATE, DELIBERATE, EMBED, CANVAS, CAPTIONS + gov-cloud/AAA), closing **v6.0 GA at S90**. [`MARKET_VALIDATION_S81_90.md`](./MARKET_VALIDATION_S81_90.md) already validated this set; nothing here re-litigates it. The only new note for the cadence change is in §Cadence impact below.
- **S91–S99 — net-new horizon.** There is currently **no planned scope beyond S90**. This is the gap this doc fills: a **market-validated candidate epic set** that opens new buyers or defends moats *after* the S81–S90 set ships.

**Evidence basis & limits:** synthesis of Qesto's existing competitor profiles ([`COMPETITOR_PROFILES.md`](./COMPETITOR_PROFILES.md)), documented win/loss reasons ([`WIN_LOSS_ANALYSIS.md`](./WIN_LOSS_ANALYSIS.md)), customer pain points ([`CUSTOMER_PAIN_POINTS.md`](./CUSTOMER_PAIN_POINTS.md)), market trends ([`MARKET_TRENDS.md`](./MARKET_TRENDS.md)), and the residual ideation in [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md). As with the prior doc, **TAM signals are directional** (category maturity, documented lost-deal reasons, competitor moves, trend lines) — not a fresh sized survey. Confirm with a sized study before locking GTM spend. No private Qesto customer data was used.

**Hard guardrail honoured:** every candidate stays inside Qesto's constraints — **Workers AI only (no third-party LLM egress)**, **per-session pricing**, **edge-native**, **privacy-by-default**. None re-proposes committed S81–S90 scope. The S81–S90 "Out of scope (S91+)" list (full native AR/VR session mode, third-party native code execution outside the WfP sandbox, marketplace lending/credit, on-chain voting, quantum crypto) is treated as the explicit deferral pool — two candidates below (XR, CONNECT) draw directly from it.

---

## Rating key (unchanged from COMPETITIVE_EPICS.md)

- **Value (1–5):** revenue ceiling + new-buyer / TAM expansion (5 = largest).
- **Change (1–5):** build effort + architectural divergence from today's product (5 = heaviest / most net-new).
- **Moat** = which of Qesto's four moats the epic leans on: edge latency / zero-knowledge privacy / native Workers AI / reusable question engine.
- **Buyer** = the segment Qesto does **not** sell to today, unless flagged as *defend/expand* (existing base).

---

## Cadence impact (S85–S99 on 9-day sprints)

The shift from 14-day to **9-day sprints at the same 120–150 pt capacity** raises per-day throughput ~1.55× and increases the number of RC/gate boundaries. Three market-relevant consequences:

1. **Faster competitive-response loop** — a 9-day cadence lets Qesto ship a parity/defence epic (e.g. REACTIONS GA) inside one sprint of a competitor move. This is a *positioning* asset: it shortens the window in which Mentimeter/Slido AI launches can erode the "native AI" claim (Risk Signal #1 in `MARKET_TRENDS.md`).
2. **Gate compression risk** — the same compliance/security gates (`check:compliance-claims`, pentest cadence, eval gates) now recur on a tighter clock. New-buyer epics with trust surfaces (governance, embed, agent autonomy, federation) must not let the faster cadence erode evidence quality. Flagged in §Risks.
3. **Epic windows are stated in 9-day sprint units below** — a "2-sprint" S91–S99 epic is ~18 calendar days, materially faster to revenue than the S81–S90 14-day equivalents.

No change to the S85–S90 market verdicts; they are inherited from the prior doc.

---

## S91–S99 candidate epic set (net-new horizon)

Eight candidates proposed; the PO can triage to 6–9. Each is grounded in a documented market signal (cited inline). None duplicates committed S81–S90 scope. Sprint windows are within **S91–S99** on the 9-day cadence.

| # | Epic | New buyer / market | Competitor gap attacked | Qesto moat leaned on | Value | Change | Window |
|---|------|--------------------|-------------------------|----------------------|:-----:|:------:|--------|
| 1 | **REACTIONS GA** — second-screen for streams/webinars | Creator-economy, webinar & livestream hosts (net-new) | Mentimeter/Slido have no high-throughput ephemeral reaction layer; StreamYard/Restream lack polling depth | Edge latency (ephemeral high-volume) | 3 | 3 | S91–S92 |
| 2 | **PULSE** — continuous HR engagement analytics product | HR/People-ops as a *standalone analytics buyer* (expand) | Culture Amp / Officevibe / Lattice own pulse analytics but are not GDPR-edge-native and price per-seat | Native Workers AI + zero-knowledge privacy + reusable engine | 5 | 4 | S91–S93 |
| 3 | **COPILOT GA** — live AI facilitator co-pilot, productised | Existing base upsell + Mentimeter "AI coaching" switchers (defend/expand) | Mentimeter AI-facilitator coaching; Qesto keeps inference on-edge, no transcript egress | Native Workers AI (no egress) | 4 | 3 | S92–S93 |
| 4 | **LEARN** — LMS-embedded assessment & learning engagement | Corporate L&D / training-ops; LMS platforms (net-new, via EMBED rails) | Kahoot/Poll Everywhere own LMS but are gamified/legacy; no GDPR-edge embed for serious L&D | Reusable engine + EMBED SDK (S87) + native AI | 4 | 3 | S93–S95 |
| 5 | **SOVEREIGN+** — data-residency & sovereign deployment expansion | EU/DACH public sector, regulated enterprise, gov-adjacent (expand the S89 sovereign tier) | No competitor offers per-region edge residency + verifiable audit; Mentimeter/Slido US-HQ GDPR friction | Zero-knowledge privacy + edge residency | 4 | 3 | S93–S95 |
| 6 | **CONNECT** — federated / cross-tenant engagement network | Multi-org events, associations, partner ecosystems, agencies (net-new) | No incumbent offers cross-tenant federated sessions with preserved anonymity; Slido is single-tenant | Edge latency + zero-knowledge privacy + reusable engine | 4 | 4 | S95–S97 |
| 7 | **STUDIO** — AI session authoring & content intelligence | Content/enablement teams, agencies, course creators (expand + net-new) | Mentimeter "AI build-a-poll" is shallow; no privacy-native AI authoring with brand/theme intelligence | Native Workers AI + CANVAS theme engine (S88) | 4 | 3 | S96–S98 |
| 8 | **XR** — spatial / immersive session mode (beta) | Hybrid-event & enterprise innovation buyers; XR-curious events (net-new, speculative) | Drawn from S81–S90 deferral pool; no facilitation incumbent has credible spatial mode | Edge latency + reusable engine | 3 | 5 | S98–S99 (beta only) |

**Residual COMPETITIVE_EPICS coverage:** REACTIONS (#8 in that doc — the one uncommitted competitive-set row) is promoted here as candidate #1. COPILOT and INSIGHTS+ from that doc were noted in `MARKET_VALIDATION_S81_90.md` as "upsell-to-base, partly absorbed by E83 agentic facilitation" — they are surfaced here as **COPILOT GA** (#3, the live-facilitator slice productised) and **PULSE** (#2, the INSIGHTS+ cross-session-intelligence slice sharpened into a *standalone HR analytics product*, the highest-value candidate). This intentionally finishes the COMPETITIVE_EPICS backlog while opening genuinely new analytics/data-product revenue.

---

## Per-epic market validation

Verdicts use the same convention as the prior doc: 🟢 validated / 🔵 high-moat strategic bet / 🟡 validated with caution / conditionally.

### 1. REACTIONS GA — second-screen for streams & webinars · V3 / C3 · S91–S92 🟡
**Signal:** the only uncommitted COMPETITIVE_EPICS row (#8); creator-economy/webinar adjacency is real and growing (`MARKET_TRENDS.md` event-engagement 22% CAGR). Edge latency is the headline feature for high-throughput ephemeral reactions — exactly the moat (`MARKET_TRENDS.md` §3, sub-100ms; `CUSTOMER_PAIN_POINTS.md` "no latency at scale", 30 mentions).
**Verdict:** 🟡 **Validated with caution — but ideal as the first S91 win.** Crowded space (StreamYard/Restream/Mentimeter overlays), so it is a *moat showcase + defence*, not a TAM unlock. Low change, fast to ship on the 9-day cadence, and the edge-latency demo it produces compounds every later epic. Lead the post-v6 arc with it precisely because it is cheap and proves the latency story for STUDIO/CONNECT later.

### 2. PULSE — continuous HR engagement analytics product · V5 / C4 · S91–S93 🟢
**Signal:** the strongest documented demand in the entire research base. "GDPR-compliant feedback" (40 mentions, `CUSTOMER_PAIN_POINTS.md`), "pulse surveys at scale" (20 mentions), HR/People-ops is **P0 segment** with "Excellent (GDPR)" fit, and `MARKET_TRENDS.md` rates HR pulse/survey the **fastest-growing segment at 32% CAGR**. `WIN_LOSS_ANALYSIS.md` Win 1+2 (privacy + per-session pricing) are both HR wins; the loss reason is "lack of audit logs / longitudinal trend product," not the core engine.
**New business:** lifts Qesto from "tool HR runs a poll in" to "the HR engagement *analytics product*" — a standalone, premium-tier, recurring-revenue line. Attacks Culture Amp / Officevibe / Lattice, none of which are GDPR-edge-native and all of which price per-seat (Qesto's per-session moat is decisive at HR scale).
**Moat:** native Workers AI (longitudinal theme clustering, no egress) + zero-knowledge privacy (honest employee feedback) + reusable engine. Builds directly on the INSIGHTS+ cross-session store that was deferred from the committed set.
**Verdict:** 🟢 **Validated — highest-value candidate, lead the new-buyer wave with it.** This is the clearest revenue/retention unlock post-v6.0: largest documented demand, fastest-growing segment, perfectly on-moat. The one caution is positioning discipline — sell it as a *privacy-native analytics product*, not "survey tool," to avoid a Culture Amp feature-parity comparison.

### 3. COPILOT GA — live AI facilitator co-pilot, productised · V4 / C3 · S92–S93 🟢
**Signal:** `MARKET_TRENDS.md` Risk Signal #1 — "if AI recap becomes trivial, our native AI advantage erodes" — and the explicit note that Mentimeter launched "AI facilitator coaching." `CUSTOMER_PAIN_POINTS.md` "passive participants" (45 mentions, the #1 unmet need) is the job COPILOT does live. Deferred from the committed set as "absorbed by E83 agentic facilitation," but the *presenter-side live co-pilot* is a distinct, demoable product surface that E83 (autonomous agents) does not fully cover.
**New business:** primarily defend/expand — upsell to base + a direct wedge against Mentimeter's AI coaching. The moat is native: inference stays on Workers AI, **no transcript egress** — the exact differentiator `MARKET_TRENDS.md` says to deepen ("AI is foundational, not an add-on").
**Verdict:** 🟢 **Validated as a moat-defence epic.** Not a new buyer, but it is the cheapest, highest-leverage way to keep the native-AI claim ahead of Mentimeter/Slido as they close the AI gap. The 9-day cadence makes it a strong competitive-response slot (§Cadence impact #1).

### 4. LEARN — LMS-embedded assessment & learning engagement · V4 / C3 · S93–S95 🟡
**Signal:** "integration gaps" (`CUSTOMER_PAIN_POINTS.md`, 20 mentions, all segments) names Canvas/Blackboard LMS explicitly; `WIN_LOSS_ANALYSIS.md` Loss 3 cites LMS integrations (Poll Everywhere/Kahoot) as a documented loss reason for L&D. `MARKET_TRENDS.md` Opportunity 3 (recurring team engagement, ~$500M–1B TAM) and corporate L&D ($1.5–2B segment) are large and under-served by *serious* (non-gamified) tooling.
**New business:** corporate L&D and the LMS platforms themselves, reached via the **EMBED SDK shipped at S87** — so this is a low-change "monetise the embed rails" move, not a fresh integration build. Differentiator: GDPR-edge + serious-facilitation positioning vs. Kahoot's "fun but not serious" perception (`COMPETITOR_PROFILES.md`).
**Verdict:** 🟡 **Validated with caution — gated on EMBED traction.** The signal is strong but the prior doc's ADJUST-2 logic applies: LEARN's revenue rides on EMBED (S87) and the marketplace economy being healthy. Confirm EMBED partner traction before committing the LMS-specific build. Explicitly **do not** chase K-12 (Kahoot owns it, `CUSTOMER_PAIN_POINTS.md` P3) — target corporate/professional L&D only.

### 5. SOVEREIGN+ — data-residency & sovereign deployment expansion · V4 / C3 · S93–S95 🟢
**Signal:** `MARKET_TRENDS.md` Trend #1 (privacy-first, growing rapidly) + Opportunity 1 (GDPR-first EU, ~$100–200M); `WIN_LOSS_ANALYSIS.md` Win 1 (privacy-first is the #1 win signal) and HR loss "lack of audit logs." The S89 sovereign tier + full FedRAMP ATO ships in the committed set — SOVEREIGN+ **expands that beachhead** into per-region residency, EU/DACH public sector, and regulated enterprise.
**New business:** EU/DACH public sector and gov-adjacent regulated buyers — extends the DELIBERATE works-council/governance fit (DE/NL locale already shipped) into a residency-led procurement story. No competitor pairs per-region edge residency with verifiable audit; all majors are US-HQ with documented GDPR friction (`CUSTOMER_PAIN_POINTS.md`, 40 mentions).
**Moat:** zero-knowledge privacy + edge residency — Qesto's structurally strongest, near-unbeatable axis (`COMPETITOR_PROFILES.md` rates Qesto sole "Leader" on Privacy/GDPR + sole "Yes" on edge).
**Verdict:** 🟢 **Validated — defends and extends the deepest moat.** Lower change because it builds on S89 sovereign-tier rails. The caution is sales-cycle length (public sector is slow); treat as high-ARPU/sticky, not fast-revenue — pair with 2–3 named public-sector design partners before the S93 commit.

### 6. CONNECT — federated / cross-tenant engagement network · V4 / C4 · S95–S97 🔵
**Signal:** `MARKET_TRENDS.md` Trend #5 (multi-tenant team collaboration is now standard) pushed one step further — *cross-tenant*. STAGE (hybrid events, S85) and the association/works-council buyers (DELIBERATE) both surface a latent need: sessions that span **multiple organisations** (multi-org conferences, association networks, agency↔client). `COMPETITOR_PROFILES.md` shows every incumbent is single-tenant; Slido's "no lock-in" weakness is the opening.
**New business:** multi-org events, associations, partner ecosystems, agencies — a genuinely net-new structural capability no incumbent offers. The hard part (and the moat) is **federated anonymity**: preserving zero-knowledge guarantees across tenant boundaries, which only Qesto's edge/privacy architecture can credibly claim.
**Moat:** edge latency (cross-tenant realtime) + zero-knowledge privacy (federated anonymity) + reusable engine.
**Verdict:** 🔵 **Validated — highest-moat strategic bet of the arc, the v7.0 centrepiece.** Smaller near-term TAM and change-4 build, but it is the one epic that is *structurally* hard for any competitor to copy, and it reframes Qesto from "engagement tool" to "engagement *network*." Correctly slotted mid-late (S95–S97) behind the cheaper proofs. Gate on a federation-trust security review (new cross-tenant attack surface).

### 7. STUDIO — AI session authoring & content intelligence · V4 / C3 · S96–S98 🟢
**Signal:** `MARKET_TRENDS.md` Trend #2 (AI in everything) + the directive to make AI "foundational, not an add-on"; `CUSTOMER_PAIN_POINTS.md` "time-consuming synthesis" (25 mentions) extended *upstream* to authoring. Mentimeter's "AI build-a-poll" is shallow; no competitor offers privacy-native AI authoring that also reasons over the CANVAS theme/brand system (S88).
**New business:** content/enablement teams, agencies, and course creators — expands the authoring surface and feeds the theme-marketplace upsell. Builds on CANVAS (S88) theme intelligence + the native-AI generate pipeline, so change is moderate.
**Verdict:** 🟢 **Validated as the AI-depth/retention epic.** Less a new-buyer unlock than a deepening of the native-AI moat across the *create* phase (COPILOT covers *run*, PULSE covers *analyse*). Together COPILOT + STUDIO + PULSE give Qesto an AI story across the full session lifecycle — the strongest answer to AI commoditisation risk.

### 8. XR — spatial / immersive session mode (beta) · V3 / C5 · S98–S99 (beta only) 🟡
**Signal:** drawn directly from the S81–S90 "Out of scope (S91+)" deferral list ("full native AR/VR session mode"). Speculative — no current research-base demand signal of meaningful frequency, so it is explicitly a **beta/innovation bet**, not a committed revenue line. The only market rationale is forward-defence: hybrid-event and enterprise-innovation buyers will eventually expect a spatial option, and edge-latency is the one credible Qesto advantage in a latency-sensitive XR context.
**Verdict:** 🟡 **Conditionally validated as a v7.0 innovation beta only.** Heaviest change (5), thinnest demand evidence — do **not** fund as a full epic. Recommend a time-boxed beta/spike in S98–S99 to plant a v7.0 flag and gather real demand signal, with a hard kill-criterion if no design-partner pull emerges. If capacity is tight, this is the first candidate to cut.

---

## Recommended triage (if cutting to 6)

If the PO trims to six, drop **XR** (speculative, change-5) and **REACTIONS GA** (defence-only, crowded) first, keeping the six revenue/moat epics: **PULSE, COPILOT GA, LEARN, SOVEREIGN+, CONNECT, STUDIO**. If keeping a cheap opener for the cadence-response value, retain REACTIONS GA at S91 and drop only XR.

**Priority order by signal strength:** PULSE (5/4, strongest demand) → COPILOT GA (4/3, moat defence) → SOVEREIGN+ (4/3, deepest moat) → STUDIO (4/3, AI depth) → LEARN (4/3, gated on EMBED) → CONNECT (4/4, strategic bet) → REACTIONS GA (3/3, opener) → XR (3/5, beta only).

---

## v6.x → v7.0 release narrative (S91–S99)

The committed arc closes **v6.0 GA at S90** (gov-cloud / FedRAMP Moderate ATO + WCAG AAA — a *certification* milestone). The S91–S99 horizon should be framed as the **"Engagement Intelligence Network"** story: v6.0 made Qesto *certified and trusted*; v7.0 makes it the *intelligent, networked* engagement platform across the full session lifecycle (create → run → analyse → connect).

| Release | Close | Sprints (9-day) | North star | Epics |
|---------|-------|-----------------|------------|-------|
| **v6.1** | ~S92 | S91–S92 | Lifecycle AI + creator reach: live co-pilot productised, second-screen reactions GA | REACTIONS GA, COPILOT GA (start) |
| **v6.2** | ~S95 | S93–S95 | **Data product + sovereignty:** Qesto becomes an HR engagement *analytics product*; sovereign/residency expansion; serious L&D via embed | PULSE, SOVEREIGN+, LEARN |
| **v6.3 / v7.0-rc** | ~S97 | S95–S97 | **The network turn:** federated cross-tenant engagement — "engagement tool → engagement network" | CONNECT, PULSE (GA) |
| **v7.0 GA** | ~S99 | S98–S99 | **Engagement Intelligence Network GA:** AI across the full lifecycle (author/run/analyse), federation GA, XR innovation beta as the forward flag | STUDIO, CONNECT (GA), XR (beta) |

**Narrative spine:** *Certified (v6.0) → Intelligent lifecycle (v6.1–v6.2) → Networked (v7.0).* Each release leads with the **same moat** the prior doc insists on — privacy-first / edge / native-AI — so five new buyer surfaces (creator, HR-analytics, L&D, public-sector, multi-org) do not fragment positioning. v7.0's tentpole is **CONNECT** (the structurally-uncopyable federation moat); **PULSE** is the revenue engine that funds the arc; **COPILOT + STUDIO + PULSE** together neutralise AI-commoditisation risk by owning the whole session lifecycle.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **TAM signals directional, not sized.** Verdicts rest on documented pain-point frequency + competitor moves, not a fresh sized study. | High (for GTM spend) | Commission sized TAM/SAM for PULSE (HR analytics), LEARN (corporate L&D), CONNECT (multi-org/federation) before locking budget. Treat as sequencing guidance. |
| **Six+ new buyer surfaces post-v6** (creator, HR-analytics, L&D, public-sector, multi-org, content) over-stretches a positioning story still centred on "privacy-first edge engagement." | High | Sequence GTM, never parallelise. Lead every launch with the *same* moat. Positioning audit (marketing lead) before S91 — escalation trigger per agent scope (E15). |
| **9-day cadence compresses trust gates.** Governance/embed/agent/federation surfaces now hit `check:compliance-claims`, pentest, and eval gates on a tighter clock. | High | Do not let cadence erode evidence. CONNECT (federation) and SOVEREIGN+ require full security/pentest review before GA, on the same hard-gate discipline as ADR-0049 — no compression. |
| **PULSE invites Culture Amp / Lattice feature-parity comparison** it cannot win head-on. | Medium-High | Position as *privacy-native edge analytics product*, not "survey/engagement-survey tool." Marketing copy review before S91. Lead with GDPR/residency + per-session economics, the two documented HR wins. |
| **LEARN revenue depends on EMBED (S87) + marketplace health** (inherits prior doc ADJUST-2). | Medium | Add an EMBED-traction checkpoint before the S93 LEARN commit; if soft, defer LEARN and reinvest in PULSE expansion. |
| **CONNECT cross-tenant anonymity is a new, high-stakes trust surface.** A federated-anonymity break would damage the core privacy moat brand-wide. | Medium-High | Gate CONNECT GA on an independent federation-trust + privacy review; ship single-tenant-compatible first, federate behind a feature flag with design partners. |
| **XR is demand-thin and change-5.** Risk of stranding capacity on a speculative bet. | Medium | Beta/spike only, hard kill-criterion (no design-partner pull → cut). First candidate to drop under capacity pressure. |
| **AI-commoditisation continues** (Risk Signal #1) even with COPILOT/STUDIO/PULSE. | Medium | Compete on *integration depth + no-egress privacy*, not "we have AI." The lifecycle-coverage story (author/run/analyse) is the differentiator, not any single feature. |

---

## Prioritised `/vs/` and hub pages for marketing (S91–S99)

Ordered by buyer-intent search value × launch alignment. Each leads with the moat in the verdict above and stays `check:compliance-claims`-safe.

| Priority | Page | Ship alongside | Lead angle |
|---|---|---|---|
| **P0** | `/vs/culture-amp` (+ `/vs/lattice`) | S91–S93 (PULSE) | Privacy-native edge HR analytics + per-session economics vs. per-seat. Attacks the analytics incumbents on GDPR/residency + price — the two documented HR wins. Highest-value new term. |
| **P0** | `/hr-analytics` (hub) | S91–S93 (PULSE) | HR/People-ops ICP hub; "the engagement analytics product your legal team approves." Pairs the `/vs/` pages above. |
| **P0** | `/vs/mentimeter` (AI-coaching angle refresh) | S92 (COPILOT GA) | Native AI co-pilot, no transcript egress, AI across the full lifecycle. Refreshes the #1 brand-threat page as Mentimeter ships AI coaching. |
| **P1** | `/sovereign` / `/public-sector` (hub) | S93–S95 (SOVEREIGN+) | Per-region edge residency + verifiable audit + FedRAMP path. EU/DACH public-sector + regulated-enterprise hub. |
| **P1** | `/learn` / `/lms` (hub) | S93–S95 (LEARN) | Serious (non-gamified) GDPR-edge engagement embedded in your LMS. Differentiate from Kahoot "fun but not serious." |
| **P1** | `/network` / `/federation` (hub) | S95–S97 (CONNECT) | "Engagement that spans organisations, anonymity preserved." The category-defining v7.0 page — no competitor can claim it. |
| **P2** | `/vs/streamyard` (reactions angle) | S91 (REACTIONS GA) | Second-screen reactions + polling depth at edge latency. Defensive/creator-economy capture. |
| **P2** | `/studio` (hub) | S96–S98 (STUDIO) | AI session authoring with brand/theme intelligence, privacy-native. Content/enablement ICP. |

---

## Escalation flags (per agent scope)

- **Positioning audit (marketing lead, E15):** six+ new buyer surfaces post-v6 risks fragmenting the "privacy-first edge engagement" story → recommend audit **before S91**, same trigger as the S81–S90 arc.
- **ADR-level strategic review:** **CONNECT** (cross-tenant federation) is a structural architecture shift and a new trust boundary — recommend an ADR + federation-trust security review before the S95 commit. This is the one S91–S99 candidate that warrants ADR-level scrutiny, not just backlog grooming.
- **Backlog grooming (PO, E1):** PULSE/COPILOT/SOVEREIGN+ design-partner validation + the EMBED-traction checkpoint gating LEARN → groom into the S91 and S93 RC gates. XR kill-criterion to be set at grooming.
- **Win/loss feed (sales, E17):** the LEARN (LMS) and PULSE (HR audit-log) candidates both originate in documented loss reasons — confirm with sales that these losses are still live before committing the S93 slot.

_No ADR-level conflict with documented positioning — every candidate maps to an existing moat. **CONNECT** is the one epic that is itself an ADR-worthy architectural bet (federation), flagged above. The macro-narrative (Certified → Intelligent → Networked) is consistent with `MARKET_TRENDS.md`'s three strongest trend lines (privacy, AI-in-everything, multi-tenant collaboration)._
