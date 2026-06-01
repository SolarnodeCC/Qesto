---
id: MARKETING_SPRINTS_81_90
type: planning
domain: marketing
category: growth-strategy
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - marketing
  - growth
  - sprints-81-90
  - new-buyer-segments
  - competitor-strategy
  - app-launch
  - marketplace
relates_to:
  - SPRINT81_90_PLAN
  - COMPETITIVE_EPICS
  - MARKETING_SPRINTS_71_80
---

# Qesto — Marketing Sprint Track S81–S90 (10-Sprint Horizon)

_Master plan: v5.1 → v5.2 → v6.0 GTM execution. Created 2026-06-01 (UTC). Aligned to [`SPRINT81_90_PLAN.md`](../planning/SPRINT81_90_PLAN.md) and [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md). Marketing budget ~10–16 pts/sprint._

---

## Overview

S71–S80 sold the **certified, scaled platform**. S81–S90 sells **reach + new buyers**: native apps, a creator marketplace, agentic AI, and — most importantly — the new-business segments unlocked by promoting the `COMPETITIVE_EPICS.md` set to committed scope. This track stops selling Qesto only to "presenters who run polls" and starts selling to **internal-comms teams, event organizers, agile teams, governance/associations, and developers**.

**The three highest-leverage new buyer segments** (validated in [`MARKET_VALIDATION_S81_90.md`](../research/MARKET_VALIDATION_S81_90.md)):
1. **Agile teams** (RETRO/IDEATE) — recurring, sticky, low CAC, attacks Parabol/Retrium/EasyRetro.
2. **Internal-comms** (TOWNHALL) — high ACV, attacks Slido/Vevox at Poll Everywhere's scale ceiling.
3. **Developers/embedders** (EMBED) — highest TAM ceiling, product-led growth via the SDK.

**Compliance-claim gate:** every public claim must pass `check:compliance-claims`. No "native app", "FedRAMP", "100k", "verifiable voting", or "AAA" claim ships before the gating sprint lands evidence.

---

## Per-sprint deliverables

| Sprint | IDs | Deliverables | Pts |
|--------|-----|--------------|-----|
| S81 | `MKTG-81-01`, `MKTG-81-02` | App-launch teaser + App Store Optimization (ASO) keyword/asset kit | 14 |
| S82 | `MKTG-82-01`, `MKTG-82-02` | Creator/partner program launch page; `/vs/slido` (apps); native GA announcement | 16 |
| S83 | `MKTG-83-01`, `MKTG-83-02` | Marketplace launch pack; first creator case study; **v5.1 launch** | 15 |
| S84 | `MKTG-84-01` | Internal-comms ICP + `/solutions/town-hall` page; `/vs/slido`, `/vs/vevox` | 14 |
| S85 | `MKTG-85-01` | Agile-team ICP + `/solutions/retrospectives`; `/vs/parabol`, `/vs/retrium` | 14 |
| S86 | `MKTG-86-01` | v5.1 nurture pack; governance teaser; **v5.2 RC comms** | 16 |
| S87 | `MKTG-87-01` | Developer/embed ICP + `/embed` hub + SDK docs landing; `/vs/typeform` (embed) | 14 |
| S88 | `MKTG-88-01` | Accessibility + multilingual story (`/accessibility`, AAA + captions) | 14 |
| S89 | `MKTG-89-01` | **v5.2 launch**; gov/public-sector GTM page (FedRAMP path) | 16 |
| S90 | `MKTG-90-01` | **v6.0 GA launch** + year-end metrics + v6→v7 teaser | 15 |

**Total:** ~148 pts across 10 sprints.

---

## New-buyer ICP / persona work (per competitive epic)

| Epic | Buyer persona | Page / asset | Competitor attacked |
|------|---------------|--------------|---------------------|
| TOWNHALL | Internal-comms / People lead | `/solutions/town-hall` | Slido, Vevox |
| STAGE | Event organizer / producer | `/solutions/events` | Slido, Poll Everywhere |
| RETRO | Scrum master / agile coach | `/solutions/retrospectives` | Parabol, Retrium, EasyRetro |
| IDEATE | Innovation / facilitation lead | `/solutions/brainstorm` | Miro voting, Mentimeter |
| DELIBERATE | Association / governance admin | `/solutions/governance` | ElectionBuddy, association-voting tools |
| EMBED | Developer / product team | `/embed` + SDK docs | Typeform embed, generic widgets |
| CANVAS/CAPTIONS | Accessibility / global-events lead | `/accessibility` | (differentiator, few direct rivals) |

---

## Competitor `/vs/[competitor]` page priority (from market validation)

1. `/vs/parabol` (RETRO — highest-intent, low CAC)
2. `/vs/slido` (TOWNHALL + apps)
3. `/vs/vevox` (anonymity + town hall)
4. `/vs/retrium` (RETRO)
5. `/vs/typeform` (EMBED)

Each page: SEO-targeted, honest comparison table (compliance-claim gated), migration guide, and a Qesto-moat callout (edge latency / privacy / Workers AI / question engine).

---

## Release launch packs

| Release | Sprint | Pack |
|---------|--------|------|
| v5.1 | S83 | Native apps + marketplace economy — app-store badges, creator program, PR |
| v5.2 | S89* | New-business suite (town hall, events, retro, ideate, governance) — segment launches staggered S84–S89 |
| v6.0 GA | S90 | Embeddable platform + AAA + gov cloud — flagship launch, YE metrics, analyst brief |

_(*v5.2 features ship S84–S86 and are marketed as each segment page goes live; the consolidated v5.2 launch comms run at S89 alongside the v6.0 RC build-up.)_

---

## CRO / funnel focus

- **Product-led for EMBED:** self-serve SDK key → embed → activation, instrumented per [`SPRINT81_90_ANALYTICS_PLAN.md`](../planning/SPRINT81_90_ANALYTICS_PLAN.md).
- **Sales-assist for TOWNHALL/DELIBERATE:** higher ACV, demo-driven; build sales kit + ROI calculator.
- **Recurring/expansion for RETRO:** activation = 2nd workspace session; nurture toward team-wide rollout.

---

## Guardrails

- All scale/compliance/AI/accessibility copy gated on the evidence sprint (`check:compliance-claims`).
- No comparison claim about a competitor without a dated, sourced reference.
- Workers-AI privacy moat is the headline for agentic positioning — never imply third-party AI.
