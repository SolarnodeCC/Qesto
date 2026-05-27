# ADR-0032: Tenant quota and cost attribution

**Status:** Accepted (S68)  
**Date:** 2026-05-25

## Context

Partner ecosystem and 50k scale proof require per-tenant limits beyond API key rate limits.

## Decision

- Team-level quotas in `INTEGRATIONS_KV` (`tenant:quota:{teamId}`): API calls/day, concurrent LIVE sessions.
- Enforcement on Public API v3 and session create; attribution events via `api.request` + `tenant.quota_checked`.

## Consequences

- Enterprise overrides via admin KV patch (future); no Stripe metering integration in S68.
