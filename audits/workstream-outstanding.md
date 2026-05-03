# Outstanding Work Across All Audit Workstreams

**Date:** 2026-05-03 (WS5–WS6 polish: matrix + PollOption sweep + Pricing copy honesty)  
**Source of truth:** `audits/remediation-plan.md` (snapshot table) + this file for **remaining** work.

## Executive status


| Workstream           | Status             | Completed                                                                                                                                                                         | Outstanding                                                                                                 |
| -------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| WS1–WS4              | Done / mostly done | See earlier snapshots                                                                                                                                                             | As listed in remediation plan                                                                               |
| WS5: Frontend dedupe | Done               | Session types; `useApiQuery`; `**PollOption`** on **Join/Dashboard** template + slider helpers                                                                                    | —                                                                                                           |
| WS6: Plan parity     | Done               | `**GET /api/plans/catalog`**; `**enrichPricingMatrix**` + `**PRICING_MATRIX_BASE**` drives quota-backed matrix rows; SEO/hero/FAQ/CTA no longer imply unlimited free participants | Optional: **Stripe live price IDs** surfaced next to euro display; roadmap rows in matrix explicitly tagged |


## Polish shipped (same session)

- `**src/config/pricing-matrix.ts`** — Canonical matrix scaffold + `**enrichPricingMatrix**` merges **sessions/month**, **participants/session**, **consent**, **semantic clusters**, **private AI endpoint** (third column = `insightsAI`), **SSO**, **CSV export**, **branded**.
- `**Pricing.tsx`** — `useMemo` hydrates matrix; `**#feature-matrix**` anchor; footer cites `**PLAN_QUOTAS**` / `**GET /api/plans/catalog**`.
- `**tests/unit/pricing-matrix.test.ts**` — Session counts + SSO boolean alignment regression tests.

## Recommended next execution order

1. **Product:** review matrix rows still “marketing static” (retention durations, webhook line) vs roadmap.
2. **Commerce:** Wire displayed € prices to Stripe/price metadata if checkout amounts diverge.

