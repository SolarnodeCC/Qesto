---
id: XR_DESIGN_PARTNER_VALIDATION
type: research
domain: product
category: market-intelligence
status: active
version: 1.0
created: 2026-06-18
updated: 2026-06-18
tags:
  - market-intelligence
  - competitive
  - validation
  - design-partner
  - xr
  - spatial
  - v7-horizon
  - spike
  - kill-criterion
  - s98
relates_to:
  - SPRINT91_99_STORIES
  - MARKET_VALIDATION_S85_99
  - COMPETITOR_PROFILES
  - MARKET_TRENDS
  - CUSTOMER_PAIN_POINTS
  - BACKLOG_MASTER
---

# XR Demand Validation — Design-Partner Spike (XR-00, S98)

_Owner: `/market-research` agent. Created 2026-06-18 (UTC). Market-research half of the `XR-00` demand-validation spike (Epic 8 — XR, `SPRINT91_99_STORIES.md`)._

> **Purpose of this document:** XR is rated 🟡 conditionally-validated, **thin demand, change-5** — the heaviest-build, weakest-evidence candidate in the entire S91–S99 arc (`MARKET_VALIDATION_S85_99.md` §8). The spike exists to **validate or kill**, not to justify a feature already decided on. This doc is written to make killing easy if the evidence isn't there. The honest prior is: **XR should be killed/deferred unless real, named, dated commitments appear.**

> **Kill-criterion (authoritative, per S98 spike charter):**
> **≥3 design-partner commitments to proceed by S98 week 2, else XR is killed / deferred to v7.1.**
> A "commitment" is defined precisely in §4 — it is *not* "sounds cool."

> **⚠️ Doc-consistency note for PO:** `SPRINT91_99_STORIES.md` Epic 8 contains two different thresholds — the `XR-00` acceptance signal and this charter say **≥3 commitments by S98 week 2**; the Epic KPI table says "**<1 design-partner pull by S99 week 2 → defer to v7.1**." These are not the same gate. This spike uses the **stricter, earlier gate (≥3 by S98 wk2)** as the decision point; the looser S99 KPI should be reconciled down to match, or it silently weakens the kill discipline. Flagged to PO (E1).

---

## 1. Demand thesis & risk (honest assessment, no hype)

### Why XR is rated thin-demand / speculative

XR did not earn its place via a demand signal. It was **drawn from the S81–S90 "Out of scope (S91+)" deferral pool** ("full native AR/VR session mode") — i.e. it is on the roadmap because it was *explicitly parked*, not because customers asked for it (`MARKET_VALIDATION_S85_99.md` §Purpose, §8).

The evidence base is genuinely empty on this one:

- **Zero demand frequency in the research base.** Grep of `CUSTOMER_PAIN_POINTS.md`, `WIN_LOSS_ANALYSIS.md`, `MARKET_TRENDS.md`, `WEEKLY_MARKET_PULSE.md` returns **no mentions** of XR, spatial, immersive, headset, WebXR, or metaverse demand. By contrast, the validated epics in the same arc rest on documented frequencies — PULSE on "GDPR feedback" (40 mentions) and "pulse at scale" (20), COPILOT on "passive participants" (45, the #1 unmet need). XR has **none of this**.
- **The documented top pains are anti-XR.** The #1 unmet need is *passive participants* (45 mentions) and the recurring asks are GDPR/anonymity, latency-at-scale, integration gaps, and synthesis time (`CUSTOMER_PAIN_POINTS.md`). A headset *raises* the participation barrier (hardware ownership, setup friction, motion comfort) — it works against the platform's strongest job-to-be-done.
- **Only rationale is forward-defence, not pull.** The single market argument is speculative: hybrid-event and enterprise-innovation buyers *may eventually* expect a spatial option, and edge-latency is the one credible Qesto advantage in a latency-sensitive XR context (`MARKET_VALIDATION_S85_99.md` §8). That is a hypothesis about the future, not present demand.

### The central risk — and the trap

The honest framing: **absence of demand evidence is ambiguous.** It could mean (a) the category genuinely doesn't want spatial sessions, or (b) buyers can't articulate a want for something they've never seen. The spike cannot resolve that ambiguity from desk research — only a real commitment to run a real session in a headset can.

The **trap to avoid**: treating "no one is asking, so we must be early/visionary" as a reason to build. Most "we're early" bets in a category that isn't asking are simply **wrong, not early**. The novelty-interest signal ("ooh, VR, cool") is abundant and worthless; it converts to zero booked sessions. The whole instrument in §4 is engineered to **discount novelty interest to zero** and count only genuine, resourced intent.

**Capacity risk is the real cost.** XR-00 is 13 pts and the follow-on XR stories are ~34 pts more — all landing in S98–S99, the **v7.0 GA-close window** that also carries STUDIO and CONNECT GA. Speculative XR work directly competes with GA-critical capacity. `MARKET_VALIDATION_S85_99.md` names XR "the first candidate to cut" under capacity pressure twice. Stranding GA-sprint capacity on an unvalidated bet is the failure mode this spike is meant to prevent.

**Net thesis:** XR is a *plant-the-flag* innovation bet with no current pull. It is worth a minimal, time-boxed, flagged beta **only if** real design partners commit — and worth killing fast if they don't. Default expectation: it does not clear the bar.

---

## 2. Design-partner ICP (realistic, not aspirational)

Who could *credibly* pull spatial sessions — meaning they have the hardware, the use case, and a real session they would run in the next quarter. Ranked by credibility, with an honest read on each.

| # | Segment | Why they could pull | Reality check (why most won't) | Credibility |
|---|---------|---------------------|-------------------------------|:-----------:|
| 1 | **Hybrid-event & immersive-event organisers** (conference producers, XR-experience agencies) | Already run mixed in-person/remote events; some already produce VR experiences; have a budget line for "wow" moments and headset inventory on-site | Polling/Q&A is rarely their bottleneck; they buy spectacle, not facilitation depth; one-off events ≠ recurring revenue | **Medium** — best near-term source of a *named, dated* session |
| 2 | **Enterprise innovation labs / R&D & "future of work" teams** | Have Quest/Vision Pro inventory, an explicit mandate to pilot emerging tech, and internal events to test on; budget exists to experiment | Pilots are perpetual pilots — innovation-lab interest rarely converts to production usage or renewal; classic "great logo, no revenue" trap | **Medium** — good for a *logo + signal*, weak for revenue proof |
| 3 | **XR-curious corporate training / L&D teams** | Immersive training is a real and growing niche (safety, soft-skills sims); spatial assessment/polling could ride that | Their immersive work is usually bespoke scenario content, not question-driven facilitation; overlaps LEARN (S93–S95) which is the *validated* L&D path — XR is the speculative one | **Low–Medium** — adjacency real, fit thin |
| 4 | Universities / immersive-learning research groups | Grant-funded XR pedagogy programmes exist | Education is explicitly *not* Qesto's target (avoid Poll Everywhere / Kahoot turf, `COMPETITOR_PROFILES.md`); slow, non-commercial | **Low** — do not pursue as primary |
| — | General "metaverse" / consumer social-VR | — | Not Qesto's buyer, not its moat, not GDPR-serious. **Out of scope.** | **Excluded** |

**ICP for this spike (who to actually interview):** segments **1 and 2** — hybrid/immersive-event organisers and enterprise innovation labs — are the only two that plausibly produce a *named org + named sponsor + agreed beta date* inside the S98 window. Segment 3 is a secondary probe. Sales (E17) and the existing pipeline are the fastest route to these; do not cold-prospect a new segment for a beta flag.

**Honest aspirational-vs-real line:** the *aspirational* story is "every hybrid event eventually has a spatial mode." The *realistic* spike question is far narrower: "can we find **three** orgs that will each commit a real, dated session in a headset within the quarter?" If we cannot name them, the ICP — however plausible on paper — has not been validated.

---

## 3. Competitive scan — confirming the moat gap (and what it really means)

**Claim under test:** no facilitation incumbent has a credible spatial / immersive session mode.

| Competitor | Spatial / immersive mode? | Evidence (per `COMPETITOR_PROFILES.md` + pulse docs, May 2026) |
|------------|---------------------------|----------------------------------------------------------------|
| **Mentimeter** | **No** | Feature set is slide-integrated polls + recent bolted-on AI recap. Edge-native: No. No WebXR/spatial surface in profile or recent activity. |
| **Slido** | **No** | Event/Q&A engagement inside the Cisco/Webex ecosystem; recent AI recaps. No spatial mode; single-tenant 2D. |
| **Poll Everywhere** | **No** | Legacy SMS-rooted education tool, "aging technology," no AI — categorically not building XR. |
| **Vevox** | **No** | Anonymous-feedback leader for HR/corporate (G2/Capterra/Trustpilot #1, `MARKET_PULSE_INTEGRATION_2026-05-19.md`); 2D web/app polling, no spatial surface. |
| **Kahoot!** | **No (closest adjacency)** | Gamified quizzing; has dabbled in AR/3D novelty for K-12 engagement, but nothing that is a *serious facilitation* spatial mode — and Kahoot is "fun but not serious" for corporate (`COMPETITOR_PROFILES.md`). Not a credible facilitation-XR competitor. |

**Verdict on the moat gap:** ✅ **Confirmed.** No facilitation incumbent ships a credible spatial session mode. Qesto's edge-latency advantage (sub-100ms, sole "Yes" on edge in the landscape table) is the one technically-credible reason Qesto specifically could do XR better than a cloud-VM competitor, since avatar-sync latency is the make-or-break of comfortable shared spatial presence.

**The critical counter-reading (do not skip this):** an empty competitive field is **not** automatically a moat — it is just as likely a signal that the category has correctly judged there is no demand. Every serious, well-resourced incumbent (Mentimeter, Slido, Vevox) has independently chosen *not* to build spatial facilitation. That is five expert market participants voting "not worth it" with their roadmaps. The optimistic read ("clear field, we plant the flag") and the pessimistic read ("the field is clear because the demand isn't there") are **observationally identical from desk research**. Only §4's commitments can tell them apart. A first-mover advantage in a market nobody wants is a liability, not a moat. Treat the confirmed gap as *permission to run the spike*, never as *evidence of demand*.

---

## 4. Validation instrument

### 4a. Design-partner interview guide

Run with a named sponsor at a segment-1 or segment-2 org (§2). 30 minutes. The guide is deliberately built to **separate genuine intent from novelty interest** — every question moves from feeling toward commitment, hardware, and a date. Probe for the booked session, not the enthusiasm.

1. **Current state (no XR framing).** "Walk me through the last interactive session you ran — how did participants engage, and what fell short?" *(Establishes the real job. If polling/engagement isn't even a pain, XR solves nothing for them.)*
2. **Hardware reality.** "How many headsets (Quest 3 / Vision Pro / other) do your participants actually have access to *today*, and who manages them?" *(No device base = no real session. This kills most novelty interest immediately.)*
3. **Concrete occasion.** "Is there a *specific, scheduled* session in the next 90 days where you'd run participants in a headset rather than on their phones — and why that one?" *(Forces a named, dated occasion. Vagueness here = no commitment.)*
4. **Willingness-to-trade.** "A spatial session adds setup friction and excludes anyone without a headset (they'd fall back to 2D). What would the immersive version have to deliver to be worth that trade for your participants?" *(Tests whether they've thought past the novelty to the real cost. Strong answers describe a concrete payoff; weak answers restate "it'd be cool.")*
5. **Sponsorship & resourcing.** "Who internally would own running this beta — name them — and would they allocate prep time and a real audience to it?" *(Surfaces the named sponsor and real resourcing. "I'd have to find someone" = not a commitment.)*
6. **Falsification probe.** "If we built this and it worked perfectly, what's the honest chance you'd actually run it more than once — and what would stop you?" *(Invites them to talk you *out* of it. Genuine partners give specific blockers; novelty interest hand-waves.)*
7. **Commitment ask (closing).** "Would you commit to a named beta session on a specific date, with your sponsor and a real audience, behind our beta flag — yes/no, and which date?" *(The only question that counts toward the kill-criterion. A real "yes" comes with a date.)*

**Scoring note:** count enthusiasm at zero. A partner who loves the idea (Q1–Q6) but cannot answer Q2 (hardware), Q5 (named sponsor), and Q7 (a date) is **novelty interest, not a commitment.** Record interviews against the commitment definition below, not against sentiment.

### 4b. Definition of a "commitment" (what counts toward the kill-criterion)

A commitment that counts toward "≥3 by S98 week 2" requires **all three**, verifiable and recorded:

1. **Named organisation** — a real, identifiable org (not "a few people who seemed keen," not an anonymous community upvote).
2. **Named sponsor** — a specific individual who owns running the beta internally and has the authority/resourcing to do so.
3. **Agreed beta-session date** — a concrete calendar date (or tightly-bounded window) for a *real session with a real audience* in a headset, behind the `beta-xr` flag.

**Explicitly does NOT count:** "sounds cool," ProductHunt/LinkedIn enthusiasm, "we'd love to try it sometime," innovation-lab "we're always interested in piloting emerging tech," a verbal maybe without a date, or interest from anyone who can't name a sponsor and a session. Three vague yeses = **zero** commitments = **kill.**

**Recording:** maintain a simple commitments ledger (org · sponsor · date · interview link · verified Y/N) so the week-2 decision is a count, not a judgement call. Verification (the sponsor confirms in writing) is required before a row counts.

---

## 5. Recommendation

**Recommended path: the disciplined default — minimal flagged beta + hard week-2 gate, ready to defer.**

1. **Build only the minimal flagged beta in S98.** Proceed with the smallest credible slice behind the `beta-xr` feature flag — do not pre-build the full XR epic (XR-SPATIAL-01 / XR-AVATAR-01 / fallback / launcher) ahead of the gate. Keep the spatial spike strictly time-boxed inside XR-00's 13 pts so a kill costs little.
2. **Hold the kill-decision at S98 week 2.** Run §4's interviews against the §4b commitment definition. **≥3 verified commitments → proceed** to the beta build for S99. **<3 → kill / defer to v7.1.** No partial credit, no "almost," no novelty interest counted.
3. **Do not market as GA — ever, this cycle.** XR ships (if at all) as an innovation **beta only**, behind the flag, not in GA messaging. Keep it out of `check:compliance-claims`-bearing marketing. (Handoff to marketing, E15: XR is *not* a positioning input until/unless it clears the gate.)
4. **Be ready to defer cleanly to v7.1.** Deferral is the *expected* outcome given thin demand and must be framed as a disciplined win (capacity returned to STUDIO/CONNECT GA), not a failure. Pre-write the deferral note so the week-2 decision is friction-free.
5. **Protect GA capacity.** S98–S99 is the v7.0 GA-close window. If capacity tightens at any point, XR is the first cut — its priority is below every GA-committed story. Do not let an unvalidated bet displace GA-critical work.

### Conditions under which I'd recommend killing NOW (before the full interview cycle)

Kill immediately — don't even spend the spike — if any of these hold at intake:

- **No credible design-partner pipeline exists.** If sales/PO cannot name **even one** segment-1/2 org with headset inventory and a plausible session occasion to *interview*, the funnel to "≥3 commitments" is already empty. Three commitments cannot come from zero leads in two weeks.
- **Early interviews are uniformly novelty interest.** If the first 3–4 interviews all fail Q2/Q5/Q7 (no hardware, no sponsor, no date) and produce only "sounds cool," the conversion math to three real commitments is dead — kill at week 1, don't burn week 2.
- **Capacity conflict materialises.** If STUDIO or CONNECT GA slips and needs the S98–S99 capacity, kill XR on the spot — its market priority does not justify competing with GA.
- **A documented anti-signal appears.** If interviews surface that the headset *raises* the participation barrier for partners' real audiences (consistent with the #1 "passive participants" pain), that is confirmation the bet is wrong, not early — kill.

**Bottom line:** I do not recommend funding XR as a full epic under any of the evidence currently available. Run the minimal spike, count only real commitments, and expect — with discipline, not regret — that the most likely correct outcome is deferral to v7.1.

---

## Handoffs fired

- **Handoff → PO (E1):** XR-00 demand-validation instrument + commitment ledger definition + kill-gate; **reconcile the Epic 8 KPI inconsistency** (S99/<1 vs S98-wk2/≥3) to the stricter gate; tag the XR backlog stories `MARKET-RESEARCH:XR` with this doc as research context.
- **Handoff → Sales (E17):** source segment-1/2 design-partner interview candidates from existing pipeline; XR beta is not a sell — it's a commitment-test.
- **Handoff → Marketing (E15):** XR is **not** a positioning input and must not appear in GA / `check:compliance-claims` copy unless it clears the week-2 gate. Beta-flag only.

## Docs updated

- This doc: `knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md` (new).
- Recommended follow-on (PO-owned): `BACKLOG_MASTER.md` — annotate XR stories with `MARKET-RESEARCH:XR` tag pointing here.
