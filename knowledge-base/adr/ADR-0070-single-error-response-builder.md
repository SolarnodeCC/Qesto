---
id: ADR-0070
status: accepted
created: 2026-06-28
accepted: 2026-06-28
deciders: architect, backend, security
relates_to: REFACTORING_AUDIT, ADR-0069
---

# ADR-0070: Single API Error-Response Builder (`errorResponse`)

## Status

Accepted (2026-06-28). Establishes `errorResponse()` in `functions/api/lib/error-handler.ts` as the
one way to build API error responses and adds a CI ratchet (`scripts/check-error-response.mjs`).
Implements the finding "Error responses reinvented 610×" from
[`REFACTORING_AUDIT.md`](../../REFACTORING_AUDIT.md).

## Context

The audit found **610 hand-rolled `c.json({ ok: false, error: {...}, trace_id }, status)` envelopes**
across route handlers, while the SEC-02 `sanitizeError` helper was used in only 17 files. The
consequences: inconsistent error codes, occasional missing `trace_id`, and uneven application of the
production 5xx-detail-hiding policy (a security concern). There was no single builder, so each route
reinvented the shape.

## Decision

1. All API error responses MUST be built with `errorResponse(c, status, code, message)`, which emits
   the canonical `ApiError` shape, always attaches `trace_id`, and applies the SEC-02 production
   policy for 5xx (generic message).
2. Enforce with `scripts/check-error-response.mjs` (ratchet on inline `ok: false` in
   `functions/api/routes/`, DOWN only), wired into `ops/ci/quality-gates.sh` and `npm run check:rc`.
3. Migrate inline envelopes opportunistically; baseline starts at 603 (`sovereign.ts` migrated as the
   first burn-down from the original 610).

## Consequences

- **Positive:** consistent error contract, guaranteed `trace_id`, uniform 5xx redaction in prod, one
  registry point for error codes; the ratchet blocks new inline envelopes.
- **Cost:** ~603 sites migrate over release trains; heterogeneous shapes (variable messages,
  `details`, plan-deny objects) need per-site care rather than a blind codemod.
- **Neutral:** `sanitizeError` remains for exception-to-response mapping in catch blocks.
