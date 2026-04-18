# Plan & Entitlement Audit (Pricing vs Enforcement)

Date: 2026-04-05

## Executive summary

Qesto **does have a billing/plan model in place** (Stripe + persisted plan + central limits), but entitlement enforcement is currently **partial**.

- ✅ A subset of features is enforced server-side (e.g. decision quota, AI insights, decision debt, paid-only exports/integrations).
- ⚠️ Several pricing promises are present in UI/config but not consistently enforced by backend middleware.
- ❌ Multiple Enterprise claims in pricing appear not implemented as product capabilities in this codebase (or at least not discoverable via routes/services).

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

### Enterprise

- Onbeperkte facilitators → ❌ Depends on missing facilitator limit enforcement.
- SSO/SAML & SCIM → ⚠️ SSO/SAML flows exist, but no enterprise entitlement gate detected; SCIM endpoints not found.
- Dedicated EU tenant → ❌ Not found as enforceable runtime capability in routes/services.
- Decision Quality Analytics → ❌ Not found as a distinct feature/endpoint.
- Volledige MCP API → ❌ No enforcement split found between Team read-only and Enterprise full.
- SLA 99.9% / Customer Success Manager → ❌ Commercial/operational commitments, not enforceable in code.

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

5. **Enterprise-only controls**
   - Gate SAML/SSO setup operations by enterprise entitlement.
   - Implement (or remove from pricing) SCIM, dedicated tenant behaviors, decision quality analytics.

6. **Automated verification**
   - Add entitlement contract tests that map each pricing-row claim to at least one protected API behavior.

## Bottom line

- The project already has a **good foundation** for billing and plan state.
- To reliably ensure users only get what they pay for, Qesto still needs a **broader and stricter entitlement enforcement rollout** across all priced capabilities.
