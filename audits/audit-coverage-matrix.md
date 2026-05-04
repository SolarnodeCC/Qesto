# Audit Coverage Matrix

**Date:** 2026-05-03  
**Purpose:** single table showing every audit/workstream document, the issues it introduced or tracks, and where those issues are covered.

## Coverage Status

| Document | Issues / Scope | Coverage | Confirmation |
|---|---|---|---|
| `architecture-audit.md` | `SA-01`-`SA-10`: route/module architecture, peer-route coupling, duplication, dead abstractions, migration placement, `any` usage | Covered by `remediation-plan.md` Phase 2-4 and WS1-WS4 snapshots; related shipped cues include route packages for `energizers/`, `auth/`, `ai-insights/`, shared libs, lifecycle helpers, repository seed, and cache namespace tests. | Covered. Remaining architecture concerns are tracked as WS1-WS4 baseline items, not untracked gaps. |
| `code-complexity-audit.md` | `C-01`-`C-10`, `L-01`-`L-04`, `CC-01`-`CC-03`, `CP-01`-`CP-03`, `COH-01`-`COH-03`, `A-01`-`A-02` | Covered by `remediation-plan.md` Phase 3-4; high-priority route splits are reflected in the shipped snapshot; residual session/admin/team/gamification cleanup remains governed by WS1-WS4 baseline. | Covered. No separate complexity item is outside the remediation plan. |
| `code-duplication-audit.md` | `F-01`-`F-10`: polling hooks, KV helpers, response envelopes, plan catalog, KV keys, shared session types, loading/error boilerplate, user lookup, constants | Covered by `remediation-plan.md` Phase 2 and Phase 5 plus WS6; shipped items include `usePolledApi`, `useApiQuery`, shared session types, `GET /api/plans/catalog`, `lib/kv.ts`, `lib/kv-keys.ts`, `lib/http.ts`, and pricing/catalog tests. | Covered. WS5 and WS6 are closed from an audit-tracking perspective. |
| `design-pattern-audit.md` | `CR-01`-`CR-04`, `ST-01`-`ST-05`, `BH-01`-`BH-06`, `DM-01`-`DM-05`, `MP-01`-`MP-02` | Covered by `remediation-plan.md` Phase 1-4; shipped cues include audit SQL builder tests, KV cache namespace tests, vote policy helper, lifecycle helper, session repository seed, and route package splits. | Covered. Broader repository/service-layer expansion stays under WS1-WS4 baseline. |
| `error-flow-audit.md` | Critical paths plus `EF-01`-`EF-12`: OAuth swallowing, plan/admin D1 boundaries, Stripe/Resend failures, DO errors, schema patching, rate limits, auth codes | Covered by `remediation-plan.md` Phase 0-1 and WS1-WS4 shipped snapshot; regression evidence includes error-hardening, audit-query-builder, KV cache namespace, and related route tests. | Covered. Remaining production behavior questions are tracked under historical WS1-WS4, not missing from the plan. |
| `error-handling-audit.md` | `EH-01`-`EH-13`: raw production errors, energizer JSON/catches, DO voter init, RBAC/OAuth logging, admin JSON, email truthfulness, logger/rate-limit handling, WS errors | Covered by `remediation-plan.md` Phase 0-1 and the shipped parity snapshot; direct regression coverage includes `tests/unit/error-hardening.test.ts` and related targeted suites. | Covered. No EH item is unassigned. |
| `naming-readability-audit.md` | `NC-01`-`NC-16`: casing, trace ids, abbreviations, key names, aliases, error-code strings, boolean args, frontend event names | Covered by WS5 type cleanup, WS6 pricing/polish updates, and WS1-WS4 baseline for broader naming contracts; compatibility-sensitive wire-format items remain intentionally tracked rather than mechanically renamed. | Covered. Naming items are either shipped in touched surfaces or tracked as compatibility-aware baseline work. |
| `resilience-audit.md` | `RES-01`-`RES-15`: timeouts, retries, circuit breakers, bulkheads, KV fail-open, DO degradation, RBAC visibility, Vectorize timeout | Covered by `remediation-plan.md` safety/security phases and WS1-WS4 baseline; Stripe/pricing metadata work now documents production config expectations without exposing secrets. | Covered. Resilience work is tracked; no audit row is orphaned. |
| `remediation-plan.md` | Program plan: Phase 0-5, PR-A-PR-I, dependency order, definition of done | Acts as the historical source of truth for WS1-WS4 and original audit remediation. It now includes the shipped snapshot and points WS6 plan parity to `workstream-outstanding.md`. | Covered. It remains the baseline plan. |
| `workstream-progress.md` | Earlier progress note for WS3, WS4, WS5 | Superseded by `workstream-outstanding.md` and this matrix for final coverage, but still preserved as historical progress. | Covered. No active issues live only here. |
| `workstream-outstanding.md` | Current closeout for WS5 frontend dedupe and WS6 plan parity, plus production follow-ups | Current state: WS5 done, WS6 done; only operational/product validation remains: confirm static/roadmap matrix rows and configure live Stripe public price vars/cents. | Covered. Code-side work is complete; remaining items are configuration/product validation. |

## Overall Confirmation

All audit documents and issue families are covered by either:

1. Implemented code and tests in the current tree.
2. The historical WS1-WS4 remediation baseline in `audits/remediation-plan.md`.
3. The WS5-WS6 closeout and operational follow-ups in `audits/workstream-outstanding.md`.

There are **no untracked audit issues** in the `audits/` folder. The only non-code follow-ups are production validation/configuration:

1. Confirm rows tagged `Static copy` / `Roadmap` in the Pricing matrix.
2. Configure live Stripe public price IDs and euro-cent vars in Cloudflare once final checkout prices are approved.
