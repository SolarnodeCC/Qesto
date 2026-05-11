# Outstanding Work Across All Audit Workstreams

**Date:** 2026-05-03 (WS5-WS6 polish: matrix + PollOption sweep + Pricing copy honesty)  
**Source of truth:** `audits/remediation-plan.md` for the historical snapshot table, plus this file for remaining work.

## Executive Status

| Workstream | Status | Completed | Outstanding |
|---|---|---|---|
| WS1-WS4 | Done / mostly done | See earlier remediation snapshots. | As listed in `audits/remediation-plan.md`. |
| WS5: Frontend dedupe | Done | Session types; `useApiQuery`; `PollOption` sweep on Join/Dashboard/template + slider helpers. | None. |
| WS6: Plan parity | Done | `GET /api/plans/catalog`; `enrichPricingMatrix` + `PRICING_MATRIX_BASE` drive quota-backed matrix rows; SEO/hero/FAQ/CTA no longer imply unlimited free participants; optional price metadata and row provenance tags are now wired. | Optional: configure live Stripe price IDs / cents values in Cloudflare env once production prices are final. |

## Polish Shipped

- `src/config/pricing-matrix.ts` -- Canonical matrix scaffold. `enrichPricingMatrix` merges sessions/month, participants/session, consent, semantic clusters, private AI endpoint (third column = `insightsAI`), SSO, CSV export, and branded assets from plan data.
- `src/pages/Pricing.tsx` -- `useMemo` hydrates the matrix; `#feature-matrix` anchor added; footer cites `PLAN_QUOTAS` / `GET /api/plans/catalog` as the quota source.
- `tests/unit/pricing-matrix.test.ts` -- Regression coverage for session counts, participant counts, and SSO boolean alignment.
- Poll option type sweep -- Join/Dashboard/session template flows now use the shared `PollOption` shape instead of local re-declarations.
- Stripe/commerce follow-up -- `GET /api/plans/catalog` now includes non-secret pricing metadata when env vars are configured; Pricing displays configured euro cents and public Stripe price IDs when present.
- Matrix provenance follow-up -- Matrix rows now carry `quota`, `static`, or `roadmap` source tags; static/roadmap rows are visually labeled for product review.

## Current Review Notes

- The current WS5/WS6 items are closed from an audit-tracking perspective.
- The remaining work is production configuration/product validation, not code plumbing.
- Keep WS1-WS4 references in `audits/remediation-plan.md` as the historical baseline unless new findings reopen them.

## Recommended Next Execution Order

1. **Product:** Confirm the rows tagged `Static copy` / `Roadmap`, especially retention duration and webhook-related lines, against the actual roadmap.
2. **Commerce:** Configure `STRIPE_STARTER_MONTHLY_PRICE_ID`, `STRIPE_STARTER_ANNUAL_PRICE_ID`, optional `STRIPE_TEAM_ANNUAL_PRICE_ID`, and matching euro-cent vars in Cloudflare once checkout prices are final.
