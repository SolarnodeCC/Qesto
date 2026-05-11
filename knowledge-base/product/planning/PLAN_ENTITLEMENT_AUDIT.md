# Plan & Entitlement Audit (Pricing vs Enforcement)

_Hub: [Documentation map](./README.md)._

Date: 2026-04-05
Sprint 20 update: 2026-05-04

## Executive summary

Qesto **does have a billing/plan model in place** (Stripe + persisted plan + central limits). Sprint 20 moved entitlement enforcement from partial discovery into an explicit enforced/classified contract matrix.

- ✅ Priced capabilities with backend routes now have server-side allow/deny coverage and contract tests.
- ✅ Pricing claims without product routes are classified so future work cannot silently drift.
- ⚠️ Claims marked `Next` still require gates when their routes land, especially custom branding, standalone semantic search, team analytics, and MCP API access.

## What is in place today

### 1) Billing model and plan source of truth

- Plan IDs and limits are centrally defined in `functions/api/plan-types.ts`.
- User plan is loaded/stored in KV (`plan:<userId>`) via `functions/api/billing.ts`.
- Stripe webhooks update plan state (`checkout.session.completed`, subscription updates/deletes) in `functions/api/stripe.ts`.

### 2) Generic gating primitives

- `requireFeature(feature)` middleware checks `PlanLimits` and returns 402 with structured payload.
- `requireDecisionQuota()` enforces monthly free decision quota.

### 3) Routes that are currently gated

- Decision creation quota: `POST /sessions/:id/decisions` uses `requireDecisionQuota()`.
- AI insights: `POST /sessions/:id/insights` is gated with `requireFeature('aiInsights')`.
- Decision debt: `GET /teams/:id/debt` is gated with `requireFeature('decisionDebt')`.
- Paid-only exports/integrations: several routes use `canExportExcel()` / `canUseIntegrations()`.

## Pricing claim coverage matrix

Legend:
- ✅ = implemented and clearly enforced
- ⚠️ = implemented but weak/incomplete enforcement
- ❌ = not implemented / not found in backend

### Free

- 3 gelijktijdige sessies → ⚠️ Limit exists in plan config, but no clear hard gate found on session creation/start.
- 5 beslissingen per maand → ✅ Enforced by `requireDecisionQuota()`.
- Onbeperkt deelnemers → ⚠️ No explicit cap found (effectively unlimited by absence of cap).
- Magic link login → ✅ Implemented.
- 30 dagen geschiedenis → ⚠️ `historyMonths` exists in limits, but no retention/access enforcement found.
- Basisvragen (MC/open/schaal) → ⚠️ Question types exist, but plan-based type gating not consistently enforced server-side.

### Starter

- Onbeperkte sessies / beslissingen → ⚠️ Decisions are effectively unlimited above free; session concurrency cap not clearly enforced.
- Consent-modus & ranking → ⚠️ Feature flags exist, but no route-level `requireFeature` seen for these question modes.
- Point allocation vragen → ⚠️ Same as above.
- PDF export & audit log → ⚠️ Audit export exists, but no explicit plan gate for `auditLogExport`; PDF-specific backend gate not found.
- Custom branding → ⚠️ Branding endpoints exist, but no explicit `customBranding` gate found.

### Team

- Tot 10 facilitators → ❌ Limit exists in config but enforcement on team member/facilitator count not found.
- AI insights per sessie → ✅ Gated via `requireFeature('aiInsights')`.
- Institutional Memory → ⚠️ Decision/team retrieval exists, but no distinct entitlement gate found.
- Decision Debt dashboard → ✅ Gated via `requireFeature('decisionDebt')`.
- Semantisch zoeken → ⚠️ Semantic search route exists; no plan gate detected.
- Team analytics → ⚠️ Analytics routes are available; no Team+ gate detected on core analytics endpoint.
- MCP API (read-only) → ❌ `mcpAccess` exists in plan model, but MCP token creation/usage routes do not enforce read-only or tier.


## Risks

1. **Revenue leakage risk**: Users may access higher-tier capabilities without paying due to missing server-side gates.
2. **Packaging mismatch risk**: Pricing page promises features that are not enforceable or not yet implemented.
3. **Support/compliance risk**: Enterprise promises (SCIM, dedicated tenant, MCP scope separation) are not technically codified.

## Recommended remediation model

1. **Single entitlement engine**
   - Introduce centralized `checkEntitlement(userId, feature, context)` used by every protected route.
   - Eliminate route-specific ad-hoc checks (`plan !== free`) where feature granularity is needed.

2. **Mandatory backend gates for every paid claim**
   - Add `requireFeature(...)` (or equivalent) to all claim-backed endpoints:
     - semantic search
     - analytics endpoints
     - branding endpoints
     - audit export
     - collaboration/facilitator management
     - MCP token issuance and MCP method-level permissions

3. **Quantitative limit enforcement**
   - Enforce `concurrentSessions`, `facilitatorsPerTeam`, and `historyMonths` in backend logic.

4. **MCP scope enforcement**
   - Store token scope (`readonly|full`) based on plan at issuance time.
   - Block write/administrative MCP tools for non-enterprise plans.

5. **Automated verification**
   - Add entitlement contract tests that map each pricing-row claim to at least one protected API behavior.

## Sprint 20 entitlement contract matrix

Legend:
- **Enforced**: route/service has server-side allow/deny logic and should have contract tests.
- **Classified**: no route exists yet, or behaviour is intentionally ungated; keep documented so pricing changes do not silently drift.
- **Next**: still requires code or test coverage.

| Pricing / package claim | Backend contract | Current enforcement | Sprint 20 status |
|---|---|---|---|
| Monthly session quota | `POST /api/sessions`, `POST /api/sessions/:id/duplicate` check `PLAN_QUOTAS.maxSessionsPerMonth` through `incrementSessionQuota()` | Enforced | Contract tests cover create quota and duplicate-path denial |
| Participant capacity | `SessionRoom` join path checks `PLAN_QUOTAS.maxParticipantsPerSession` | Enforced | Covered by realtime/session lifecycle tests; keep load/stress evidence separate |
| Results export | `GET /api/sessions/:id/export.csv` requires `resultsExport` | Enforced 2026-05-01 | Contract tests added 2026-05-01 for free deny + starter allow |
| Ranking questions | DRAFT question create/update paths reject `ranking` when `rankingQuestions` is false | Enforced 2026-05-01 | Contract tests added 2026-05-01 for free deny + starter allow |
| Consent mode/questions | DRAFT question create/update paths reject `consent` when `consentMode` is false | Enforced 2026-05-01 | Contract tests added 2026-05-01 for free deny |
| AI insights / Insights tab | `GET /api/sessions/:id/insights`, `GET /api/sessions/:id/insights/themes`, and legacy `POST /sessions/:id/insights/analyze` require `insightsAI` through the shared entitlement helper | Enforced 2026-05-01 | Contract tests cover free/starter denial and team allow for precomputed themes; legacy analyze uses shared `feature_not_available` response |
| Custom branding | `customBranding` exists in plan config, but no backend branding route is present in this codebase | Classified: not implemented | Next: add route gate when branding API lands |
| SAML SSO | `PATCH /api/teams/:id` rejects non-null `samlConfig` unless `samlSso` is true | Enforced 2026-05-01 | Contract tests added 2026-05-01 for starter deny + team allow |
| Team/facilitator count | `POST /api/teams/:id/members` enforces plan member cap: free=1, starter=3, team=10 | Enforced 2026-05-01 | Contract test added 2026-05-01 for limit deny |
| Semantic search / evidence clusters | `semanticSearch` exists in plan config; no standalone semantic-search route was found. Vectorize lookup inside AI insights is currently tied to insights generation. | Classified: coupled to insights | Next: gate standalone search route if/when exposed |
| Team analytics | Admin analytics is role-gated; session Insights is plan-gated. Team-wide analytics route is not a distinct paid endpoint yet. | Classified: mixed admin/insights coverage | Next: define route ownership before adding plan gate |
| MCP API access | No MCP token or method route found in `functions/api/routes` | Classified: not implemented | Next: add scope-aware gate when MCP API lands |

## Bottom line

- Sprint 20 establishes a **good entitlement foundation** for billing and plan state.
- New priced capabilities must be added through the same matrix: route owner, entitlement key, allow/deny contract tests, and pricing-copy classification.
