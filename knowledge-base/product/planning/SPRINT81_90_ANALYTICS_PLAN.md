---
id: SPRINT81_90_ANALYTICS_PLAN
type: planning
domain: analytics
category: planning
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - analytics
  - measurement
  - sprints-81-90
  - analytics-engine
  - north-star
  - funnels
  - marketplace-gmv
relates_to:
  - SPRINT81_90_PLAN
  - BACKLOG_MASTER
  - S19_KPI_BASELINE
---

# Sprint 81–90 Analytics Plan — Measuring the Expansion Arc

_Prepared: 2026-06-01 — Analytics synthesis aligned to [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md). All instrumentation via Cloudflare **Analytics Engine (AE)**; no third-party analytics egress._

---

## Arc north-star + guardrails

The S30+ north-star (**session starts** + **engagement rate**) remains the platform metric, but the expansion arc adds an **economic** and **new-buyer** dimension. Proposed arc north-star:

> **Activated value per new surface** = weekly count of teams that reach the activation milestone of a *newly shipped surface* (native app session, marketplace install, agent-facilitated session, town hall, retro workspace, governance vote, embed).

This keeps the arc honest: shipping E81–E90 only counts if **new buyers activate**, not just if code lands.

| Guardrail | Threshold intent |
|-----------|------------------|
| Agent safety incident rate | ~0 unsafe autonomous actions (hard) |
| Marketplace payout error rate | < 0.1% of payouts |
| Native crash-free sessions | ≥ 99.5% |
| Captions WER | ≤ agreed bar per locale |
| Anonymity-leak events (TOWNHALL) | 0 (hard) |
| Realtime push SLA regression | none vs v5.0 baseline |

---

## Metric tree (per epic)

| Epic | Primary metric | Supporting |
|------|----------------|------------|
| E81 Native Mobile | Mobile MAU + native session share | install→activate→retain; crash-free rate |
| E82 Marketplace | **Marketplace GMV** + take-rate | listing→install→purchase→payout; partner activation |
| E83 Agentic | Agent-facilitated session count | agent activation rate; agent safety incidents (guardrail) |
| E84 Town Hall | Town halls run + peak concurrency | questions/upvotes per session; anonymity-leak (guardrail) |
| E85 Retro/Ideate | Recurring workspaces with ≥2 sessions | week-over-week retention (stickiness signal) |
| E86 Deliberate | Governance votes cast + receipts verified | independent re-tally completion rate |
| E87 Embed | Embedded sessions + unique embedding domains | SDK key activation; widget load→interact |
| E88 Captions/Canvas | Captioned-session minutes; theme adoption | translation locale coverage |
| E89 Gov/Sovereign | Sovereign-tier tenants activated | (compliance, not growth) |

---

## Required AE events (engineering instrumentation contract)

Every story below must emit its AE event(s) as part of Definition of Done. Event name → key dimensions:

| Event | Dimensions |
|-------|-----------|
| `native.session.start` | platform(ios/android/web), app_version, offline(bool) |
| `native.app.install` | platform, locale, store(appstore/play) |
| `marketplace.listing.view` | listing_id, category, price_tier |
| `marketplace.purchase` | listing_id, amount, currency, buyer_team |
| `marketplace.payout` | partner_id, amount, status |
| `agent.session.activate` | agent_id, session_id, model |
| `agent.action` | agent_id, action_type, allowed(bool) |
| `agent.safety.block` | agent_id, reason | 
| `townhall.question.submit` | session_id, anonymous(bool) |
| `townhall.question.upvote` | session_id, question_id |
| `retro.workspace.session` | workspace_id, team_id, sequence_n |
| `deliberate.vote.cast` | session_id, has_receipt(bool) |
| `deliberate.receipt.verify` | session_id, result(ok/mismatch) |
| `embed.widget.load` | api_key, origin_domain |
| `embed.widget.interact` | api_key, interaction_type |
| `captions.session.minutes` | session_id, source_locale, target_locale |

**Privacy rule:** no PII in AE dimensions — hash team/user identifiers; TOWNHALL events never carry questioner identity.

---

## Conversion funnels to track

1. **Native adoption:** `native.app.install` → `native.session.start` → return within 14 days (retention).
2. **Marketplace economy:** `marketplace.listing.view` → `marketplace.purchase` → `marketplace.payout` (GMV + take-rate + partner health).
3. **Agent activation:** session created → `agent.session.activate` → completed session with ≥1 safe `agent.action`.
4. **New-buyer activation (per segment):** segment landing → signup → first `townhall.*` / `retro.workspace.session` / `deliberate.vote.cast` / `embed.widget.load`.

---

## Example AQL query shapes

```sql
-- Marketplace GMV + take-rate, last 30d
SELECT sum(double1) AS gmv, count() AS purchases
FROM marketplace_purchase
WHERE timestamp > now() - INTERVAL '30' DAY;

-- Mobile 14-day retention cohort
SELECT blob1 AS platform, count(DISTINCT blob2) AS retained
FROM native_session_start
WHERE timestamp > now() - INTERVAL '14' DAY
GROUP BY platform;

-- Agent safety guardrail (must trend ~0)
SELECT count() AS unsafe_blocks
FROM agent_safety_block
WHERE timestamp > now() - INTERVAL '7' DAY;
```

_(AE schema uses indexed `blob*`/`double*` columns; the logical names above map to the project's AE binding conventions.)_

---

## Instrumentation acceptance criteria (applies to every product story)

- [ ] Emits its contracted AE event(s) with the dimensions above.
- [ ] No PII in any dimension (hashed identifiers only).
- [ ] Event verified in the analytics review per sprint (instrumentation gate).
- [ ] Funnel dashboard updated before the relevant RC.
- [ ] Guardrail metrics wired to alerting where marked "hard".

---

## Reporting cadence

| Report | When |
|--------|------|
| Arc north-star (activated value per surface) | weekly |
| Marketplace GMV / payout health | weekly from S83 |
| Agent safety guardrail | daily from S84 |
| New-buyer activation by segment | per RC (S83, S86, S89, S90) |
| v6.0 GA metrics pack | S90 |
