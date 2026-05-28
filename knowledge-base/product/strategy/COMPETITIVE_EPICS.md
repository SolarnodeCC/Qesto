---
id: COMPETITIVE_EPICS
type: planning
domain: product
category: strategy
status: proposed
version: 1.0
created: 2026-05-28
updated: 2026-05-28
tags:
  - strategy
  - epics
  - competitive
  - new-business
  - ideation
relates_to:
  - ROADMAP_FULL
  - BACKLOG_MASTER
  - SPEC_PRODUCT
---

# Qesto — Competitive "New-Business" Epics (Ideation)

_Hub: [Documentation map](../README.md)._

_Status: **Proposed / for PO review.** This is a brainstorm artifact, not committed scope. Any row can be promoted into [`BACKLOG_MASTER.md`](../backlog/BACKLOG_MASTER.md) using the existing `EPIC-NN` convention._

## Purpose

Ten creative epics (plus one bonus) aimed at capabilities competitors **don't** have — including "slightly different product" adjacencies that open **new buyers and markets**, not just parity features. The committed roadmap already covers integrations (Slack/Teams/Zoom), sentiment, compliance, white-label and mobile PWA, so this set deliberately avoids re-proposing those and instead leans on Qesto's four moats:

- **Edge latency** — Cloudflare Workers + Durable Objects, sub-100ms realtime
- **Privacy / zero-knowledge** — anonymity modes, EU residency, GDPR-by-default
- **Native AI** — Workers AI only, no third-party egress
- **Reusable question engine** — 11 question types, energizers, Vectorize insights

Each epic notes the existing Qesto assets it reuses (to keep effort honest) and the competitor gap it attacks. The set is a **mix of bold adjacencies and parity-plus** enhancements.

### Rating key

- **Market Value (1–5):** revenue ceiling + new-buyer / TAM expansion (5 = largest).
- **Change (1–5):** build effort + architectural divergence from today's product (5 = heaviest / most net-new).

---

## Ranked summary (value vs. change)

| # | Epic | Type | Value | Change | Verdict |
|---|------|------|:-----:|:------:|---------|
| 1 | **TOWNHALL** — Moderated anonymous Q&A at scale | Parity+ | 4 | 2 | 🟢 Quick win — ship first |
| 2 | **COPILOT** — Live AI facilitator co-pilot | Parity+ | 4 | 3 | 🟢 High value, near-term |
| 3 | **INSIGHTS+** — Cross-session intelligence | Parity+ | 4 | 3 | 🟢 ARPU + retention |
| 4 | **STAGE** — Hybrid event engagement suite | Adjacency | 4 | 3 | 🟢 Wins back event organizers |
| 5 | **RETRO** — Agile retrospectives & team health | Adjacency | 4 | 3 | 🟢 Recurring/sticky, new buyer |
| 6 | **IDEATE** — Collaborative brainstorm & prioritization | Adjacency | 4 | 3 | 🟢 Facilitator/innovation buyer |
| 7 | **DELIBERATE** — Verifiable governance voting | Adjacency | 4 | 4 | 🔵 Highest-moat, sticky/high-ARPU |
| 8 | **REACTIONS** — Second-screen for streams/webinars | Parity+ | 3 | 3 | 🟡 Speculative, latency moat |
| 9 | **CAPTIONS** — Live captions + realtime translation | Parity+ | 3 | 4 | 🟡 Differentiator, ASR tech risk |
| 10 | **EMBED** — Engagement SDK & public widget API | Adjacency | 4 | 5 | 🟡 Highest ceiling, heaviest build |
| ★ | **CANVAS** — Session themes & adaptive data visualization | Parity+ | 4 | 3 | 🟢 Bonus — presentation moat |

**Sequencing logic:** 🟢 quick/near-term (1–6) prove new value on existing rails; 🔵 strategic bet (7) opens a distinct high-moat buyer; 🟡 (8–10) are higher-risk or heavier and gated on the early wins. The bonus (CANVAS) is a 🟢 presentation-layer lever that compounds the value of every other epic.

---

## The epics

### 1. TOWNHALL — Moderated Anonymous Q&A at Scale · Value 4 / Change 2 🟢
**Pitch:** A dedicated all-hands / AMA mode — attendees submit questions anonymously, upvote each other's, and the host moderates a live queue (approve, group, dismiss, mark answered) on a big-screen view.
**New business:** Internal-comms / People teams running town halls — a buyer Qesto doesn't sell to today. Directly attacks Slido & Vevox's core, and Poll Everywhere's 700-participant cap with Qesto's edge-scale story.
**Reuses:** `open` + `upvote` question types, the `SessionRoom` DO for realtime, anonymity modes.
**Net-new:** moderation queue + host visibility controls + presenter "now answering" spotlight. Lowest-effort, highest-leverage item here.

### 2. COPILOT — Live AI Facilitator Co-pilot · Value 4 / Change 3 🟢
**Pitch:** A presenter-side AI panel during a LIVE session that reads the room and acts — suggests the next follow-up question, flags disengagement/confusion, and drafts an on-the-fly poll from a one-line intent, all without leaving the run screen.
**New business:** Upsell to existing base + a wedge against Mentimeter's newly launched "AI facilitator coaching." Native-AI moat: inference stays on Workers AI, no transcript egress.
**Reuses:** AI wizard/generate + insights pipeline, DO realtime loop, the ADR-0011 sentiment foundation.
**Net-new:** live inference loop wired into the DO, presenter copilot UI.

### 3. INSIGHTS+ — Cross-Session Intelligence · Value 4 / Change 3 🟢
**Pitch:** Lift analytics above a single session: longitudinal theme clustering, engagement trend lines, recurring-topic detection, and a facilitator scorecard across all of a team's sessions — a Voice-of-Customer / L&D analytics product.
**New business:** Sells to research, CX and L&D teams; a clear premium-tier ARPU + retention lever.
**Reuses:** DECISIONS_VECTORIZE (768d semantic search), AI insights, ADMIN-ANALYTICS export.
**Net-new:** cross-session aggregation store + trend dashboards.

### 4. STAGE — Hybrid Event Engagement Suite · Value 4 / Change 3 🟢
**Pitch:** A multi-session event container — agenda/track navigation, per-talk speaker ratings, sponsor engagement spots, and attendee networking match — for conferences, summits and large hybrid events.
**New business:** Event organizers are already the **#2 documented lost-deal reason**; this turns a loss into a vertical. Event-tech is high-ticket.
**Reuses:** the **Find Your Match energizer** (already shipped) as the networking core, DO realtime, scale-proof story.
**Net-new:** event/agenda orchestration layer above sessions.

### 5. RETRO — Agile Retrospectives & Team Health · Value 4 / Change 3 🟢
**Pitch:** Structured, recurring team retrospectives — anonymous "went well / didn't / actions" boards with dot-voting, AI-clustered themes, and action items that carry across sprints, plus a team-mood trend over time.
**New business:** A brand-new recurring buyer — engineering/scrum/agile teams (EasyRetro, Parabol, TeamRetro, Metro Retro adjacency). Weekly cadence makes it sticky and expansion-friendly, and the anonymity moat is exactly what honest retros need.
**Reuses:** anonymity modes, `open` + `upvote` (dot-voting), AI insights theme clustering, ACTIONS_KV for tracked action items.
**Net-new:** retro board layout, recurring cadence, action-item carryover. Mostly additive on existing rails.

### 6. IDEATE — Collaborative Brainstorm & Prioritization Board · Value 4 / Change 3 🟢
**Pitch:** Diverge-then-converge ideation — participants submit ideas, AI auto-clusters them into themes, the group dot-votes, and the room ranks priorities live. A facilitation-grade Miro/Stormboard-lite focused on *decisions*, not a freeform canvas.
**New business:** Workshop facilitators, innovation/strategy and design-thinking teams — adjacent to but distinct from the live-poll buyer. Attacks Mural/Miro voting and Stormboard.
**Reuses:** `open` + `upvote` + `ranking` types, DECISIONS_VECTORIZE for semantic clustering, AI insights, the `SessionRoom` DO.
**Net-new:** idea-board UI, live cluster visualization, converge-to-priority flow.

### 7. DELIBERATE — Verifiable Anonymous Governance Voting · Value 4 / Change 4 🔵
**Pitch:** Auditable, anonymous decision-making for boards, associations, co-ops and **works councils** — ranked-choice/approval ballots, quorum rules, voter-verifiable receipts, and a tamper-evident audit trail.
**New business:** Niche but high-ARPU and extremely sticky; the privacy + audit moat is near-unbeatable. Strong fit for DACH/NL works councils where Qesto already ships **DE/NL locales** and EU residency.
**Reuses:** `consent` + `ranking` question types, AUDIT_KV, DECISIONS store, zero-knowledge mode.
**Net-new:** verifiable-ballot crypto + tally engine + quorum/eligibility logic.

### 8. REACTIONS — Second-Screen for Streams & Webinars · Value 3 / Change 3 🟡
**Pitch:** A lightweight live-reactions/predictions overlay for webinars, livestreams and watch-parties — emoji storms, live polls and prediction markets synced to a stream, embeddable as a second-screen layer.
**New business:** Creator-economy / webinar adjacency; Qesto's edge latency is the headline feature for high-throughput ephemeral reactions.
**Reuses:** DO realtime, energizer reaction primitives.
**Net-new:** high-volume ephemeral reaction pipeline + embeddable overlay. Crowded space — speculative.

### 9. CAPTIONS — Live Captions & Realtime Translation · Value 3 / Change 4 🟡
**Pitch:** Real-time captions and on-the-fly translation of presenter audio + open responses, so hybrid/multilingual audiences participate in their own language.
**New business:** Inclusion/accessibility wedge for global enterprises; leverages the existing 5-locale i18n investment (EN/NL/ES/DE/FR).
**Reuses:** i18n bundles, DO realtime broadcast.
**Net-new:** streaming speech-to-text + translation. **Risk flag:** depends on Workers AI ASR capability/quality — validate feasibility before committing.

### 10. EMBED — Engagement SDK & Public Widget API · Value 4 / Change 5 🟡
**Pitch:** Make Qesto a platform — embeddable poll/Q&A widgets and a public, usage-metered API/SDK so product teams, LMSs and streaming tools can drop Qesto engagement into *their* surfaces.
**New business:** Highest ceiling — opens PLG/developer + partner-tier revenue and massively expands TAM beyond the Qesto app itself.
**Reuses:** existing API surface, entitlements/usage metering, billing.
**Net-new:** hardened public API (v2), embeddable widget, SDK, CORS/rate-limit/auth model. Heaviest build; partially anticipated by the v3.0 "Public API v2" roadmap line, so could be pulled forward.

### ★ BONUS · CANVAS — Session Themes & Adaptive Data Visualization · Value 4 / Change 3 🟢
**Pitch:** A presentation layer that gives hosts control over *how the audience sees the room*. Two parts:
1. **Selectable session themes** — a gallery of visual themes (color palette, typography, light/dark, motion level, background) that a host applies per session, with a team default and an "on-brand" custom theme for higher tiers.
2. **Adaptive result visualizations** — per question, the host chooses how live data renders on the big screen: bar / donut / live word-cloud / bubble / racing-bars / heatmap / "spotlight quote" reveal, with sensible defaults per question type and smooth realtime transitions as votes land.

**New business:** Presentation polish is the exact axis Mentimeter wins on ("looks great on stage"). Selectable themes drive trial→paid conversion, a future **theme marketplace** is an upsell, and on-brand themes are the on-ramp to the white-label tier already on the roadmap.
**Reuses:** the existing 11-question-type render layer, `LAYOUT-DENSITY` preference plumbing, `DESIGN-POLISH` motion work, and the planned dark-mode tokens — this epic generalizes them into a **per-session theme engine** rather than a global setting.
**Net-new:** theme token system + picker, per-question visualization selector, audience-facing "canvas" view, theme gallery. Distinct from (and complementary to) the roadmap's global dark-mode GA and white-label items — this is *host-selectable, per-session* theming, which neither covers.

---

## Next steps for the PO

1. **Triage** the table — pick the rows worth promoting (the 🟢 cluster 1–6 + CANVAS are the lowest-friction, highest-leverage candidates).
2. **Promote** chosen epics into [`BACKLOG_MASTER.md`](../backlog/BACKLOG_MASTER.md) with `EPIC-NN` IDs and break into stories (≤ 13 pts each).
3. **Feasibility gate** for CAPTIONS (Workers AI ASR) and DELIBERATE (verifiable-ballot crypto) before committing — both carry net-new technical risk.
