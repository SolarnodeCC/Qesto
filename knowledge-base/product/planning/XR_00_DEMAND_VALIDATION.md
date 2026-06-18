---
id: XR_00_DEMAND_VALIDATION
type: planning
domain: product
category: spike-gate
status: active
version: 1.0
created: 2026-10-09
updated: 2026-10-09
tags:
  - xr
  - spatial
  - demand-validation
  - s98
  - kill-gate
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT91_99_STORIES
  - SPRINT98_EXECUTION
  - MARKET_VALIDATION_S85_99
---

# XR-00 — Demand Validation Spike

_Spike owner: Market Research. Decision gate owner: PO + Market Research. Sprint: S98 (2026-10-09 → 10-20, UTC)._

_Purpose: Validate whether the XR (spatial/hybrid session mode) feature should proceed to beta ship in S99, or be deferred to v7.1 backlog. Spike closes with a kill-criterion decision by 2026-10-13 (end of S98 week 2)._

---

## Kill Criterion

**XR-SPATIAL-01 (3D rendering) and XR-AVATAR-01 (avatars) proceed to build (days 6–9) if and only if:**

**≥ 3 design partners commit in writing (signed LOI, confirmed beta session calendar invite, or equivalent formal signal) by 2026-10-13 (end of week 2).**

**If fewer than 3 partners commit:**
- XR-SPATIAL-01 and XR-AVATAR-01 are deferred to v7.1 backlog.
- Freed 21 pts reallocate to S99 GA prep or critical RC fixes.
- v7.0 ships without XR beta.

**Escalation:** PO + Market Research sign off the kill decision; no override without leadership consensus.

---

## Design-Partner ICP (Ideal Customer Profile)

| Dimension | Profile |
|---|---|
| Industry | Hybrid events, enterprise training, innovation labs, webinar hosts |
| Company size | 500–50k employees (mid-market + enterprise) |
| Use case | Multi-location team engagement, investor briefings, annual conferences, training with real-time interaction |
| Pain point | Current tools (Menti, Slido, Hopin) lack immersive mode; teams want "novelty + engagement" for large events |
| Tech maturity | VR/XR familiarity preferred but not required (will be trained on Quest 3 basics) |
| Budget | ≥$50k annual engagement technology spend (sign of commitment) |

**Sources for prospecting:**
- Existing Qesto base: mid-market + enterprise accounts with 500+ monthly active users + event focus.
- Hybrid-event conference attendees (2026 H2 conference calendar): Dreamforce, SXSW, Web Summit, HR tech summits.
- VR/XR community networks: WebXR Working Group, Mixed Reality Forum, AR/VR Association.
- Gartner HTR and IDC Informa analyst relationships.

---

## Interview Script Outline

### Part 1: Discovery (5 min)
- "Tell me about your biggest engagement challenge in a hybrid/multi-location setting."
- "What would 'immersive' do for you that current tools can't?"
- "How do your decision-makers think about VR/XR for internal events? Gimmick or strategic?"

### Part 2: Concept Sell (5 min)
- Show mockups or live demo of XR beta concept:
  - Participants join a LIVE session on Quest 3 (or iOS Safari).
  - See each other as non-photorealistic avatars in a shared 3D space.
  - Questions appear as interactive objects in the space.
  - Vote/Q&A via spatial gesture or traditional buttons (fallback).
- "If we shipped this in beta form (October 2026) and you could be one of the first to pilot it, would you be interested?"

### Part 3: Commitment (5 min)
- **Soft commitment:** "Would you commit to a 30-minute hands-on session in October with our team to evaluate the beta?"
- **Hard commitment:** "Would you sign a letter of intent to pilot this with your team (non-binding, feedback loop, 3-month window)?"
- "What would success look like for a first beta engagement?"

### Part 4: Objection Capture
- "What's the biggest concern for you with VR/XR at scale?"
- "What would we need to do to make this worth your investment?"

---

## Validation Metrics

| Signal | Target | Notes |
|---|---|---|
| **Design-partner letters of intent** | ≥3 by 2026-10-13 | Signed or digital equivalent (email + calendar confirm) |
| **Hands-on beta session commitments** | ≥3 within 2 weeks of ship | Scheduled session with named stakeholder |
| **Sentiment feedback** | Avg >7/10 (scale: gimmick 1–10 strategic) | Aggregate from interviews |
| **Company-size match** | 100% of 3+ profiles match ICP | $50k+ spend signal or equivalent |

---

## Results Placeholder

### Interview Log (S98 Week 1–2)

| # | Company | Stakeholder | Role | Sentiment (1–10) | Commitment | Notes |
|---|---|---|---|---|---|---|
| 1 | — | — | — | — | [ ] LOI [ ] Calendar [ ] None | TBD |
| 2 | — | — | — | — | [ ] LOI [ ] Calendar [ ] None | TBD |
| 3 | — | — | — | — | [ ] LOI [ ] Calendar [ ] None | TBD |
| 4 | — | — | — | — | [ ] LOI [ ] Calendar [ ] None | TBD |
| 5 | — | — | — | — | [ ] LOI [ ] Calendar [ ] None | TBD |

**Aggregate sentiment:** TBD  
**Committed partners:** 0/5 (TBD)  
**Kill-gate status:** [ ] PASS (≥3 committed) [ ] FAIL (<3 committed)

---

## Decision Gate Owner Checklist

**By 2026-10-13 (end of week 2):**

- [ ] Market Research completes ≥5 design-partner interviews.
- [ ] Interview notes + sentiment scores aggregated in [`knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md`](../research/XR_DESIGN_PARTNER_VALIDATION.md).
- [ ] ≥3 partners have signed LOI or confirmed beta calendar (documented in results table above).
- [ ] PO + Market Research review results and sign off: **Go** (XR-SPATIAL-01 + XR-AVATAR-01 proceed) or **No-go** (defer to v7.1).
- [ ] Escalation (if needed): PO briefs leadership with kill rationale (if <3 partners).

**Handoff to build (if Go decision):**
- Market Research publishes validated design-partner list to [`knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md`](../research/XR_DESIGN_PARTNER_VALIDATION.md).
- Backend/Frontend/I18n leads receive go-ahead to start day 6 (2026-10-15).

---

## Cross-Reference

See [`knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md`](../research/XR_DESIGN_PARTNER_VALIDATION.md) for the detailed market research findings and partner commitments (to be produced in parallel during S98 week 1–2).

---

## Success Definition (for the spike itself, not the feature)

**Spike succeeds if:**
1. ≥5 design-partner interviews completed.
2. Feedback aggregated and decision gate executed by 2026-10-13.
3. Go/No-go decision made with clear rationale.
4. Results handed off to PO for build-team communication.

**Spike fails if:**
- <4 interviews completed by EOD 2026-10-12 (no data to make decision).
- Decision gate missed (no Go/No-go call by 2026-10-13).
- Rationale unclear or contested (leadership escalation unresolved).
