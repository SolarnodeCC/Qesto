---
id: ADR-0058
status: accepted
created: 2026-07-31
accepted: 2026-07-31
deciders: architect, product-owner, dpo, security
relates_to: ADR-0050, ADR-0057, ADR-0056, SPRINT85_99_PLAN, SPRINT91_99_STORIES
---

# ADR-0058: Vertical Packaging & Tenant Config Surface

## Status

Accepted (S93). Governs the **E94 LEARN** (corporate L&D / LMS) and **E95 SOVEREIGN+**
(per-region edge residency) verticals, plus the tenant configuration surface they share.

## Context

The S93–S95 arc opens two verticals on top of the existing platform:

- **LEARN** — engagement embedded in an LMS (Canvas / Blackboard / Moodle) via the EMBED
  rails (ADR-0050) and an LTI 1.1 launch.
- **SOVEREIGN+** — per-region data residency (`eu-001`, `uk-001`, `ca-001`) with a hard
  no-cross-region-leak boundary for EU/DACH public-sector and UK/CA buyers.

The non-negotiable constraint (CLAUDE.md): **no per-vertical code forks**. A vertical is a
data/config edit plus thin adapters — not a parallel codebase. Adding a region or an LMS
consumer must not require new branching logic in the hot path.

LEARN also carries a **traction gate** (LEARN-00): it only proceeds when the EMBED surface
it depends on has real adoption (≥10 live embeds, 0 open security incidents). If the gate is
not met, LEARN defers to S96 and capacity reallocates to PULSE/COPILOT.

## Decision

### 1. Config-as-data region registry (SOVEREIGN)

`lib/region-residency.ts` holds a frozen `SOVEREIGN_REGIONS` record keyed by region id. Each
entry carries `{ label, residencyZone, kvPrefix, jurisdiction }`. Adding a region is a data
edit. Enforcement is three pure helpers, identical on every call site:

- `resolveRegion(id)` — id → config, falling back to `DEFAULT_REGION_ID` (`eu-001`, EU-first).
- `regionKvKey(id, key)` — prepends the region's `kvPrefix` so a key for one region can never
  collide with another under a shared KV binding.
- `assertSameRegion(tenantRegion, dataRegion)` — returns a typed
  `cross_region_data_leak` violation on mismatch. Callers **deny** on a violation; a mismatch
  is a residency incident, never silently coerced.

The public catalog (`GET /api/platform/regions`) never exposes `kvPrefix`. Physical Worker
bindings per region are a DevOps provisioning concern; the residency boundary is enforced in
code regardless of binding topology.

### 2. LTI 1.1 consumer (LEARN)

`lib/lti.ts` verifies an inbound `basic-lti-launch-request` by re-deriving its OAuth 1.0a
HMAC-SHA1 signature (Web Crypto) and constant-time comparing it. The base-string builder and
course-context extractor are pure (unit-tested); the route (`POST /api/learn/lti/launch`)
adds no user-auth middleware — the request authenticates **by signature**. The launch is
disabled (503) unless `LTI_CONSUMER_KEY` + `LTI_CONSUMER_SECRET` are configured (no open
launch surface). Timestamp skew is bounded (±5 min) to limit replay.

### 3. EMBED traction gate (LEARN-00)

`lib/learn-gate.ts` exposes `evaluateEmbedTractionGate({ liveEmbedCount, openSecurityIncidents })`
→ a single `{ proceed, reason, deferTarget: 'S96' }` decision with no "proceed anyway" path.
`GET /api/admin/learn/gate` computes it from live (`revoked_at IS NULL`) embed widgets.

### 4. Tenant config surface

Vertical behaviour is selected by tenant config (region id, LMS consumer registration,
feature entitlements), never by a code branch per vertical. New verticals extend the config
schema and reuse the existing session/DO/KV planes.

## Consequences

- **Positive:** adding a region or LMS consumer is a config edit; residency enforcement is one
  pure, tested function; LTI surface is signature-authenticated and fail-closed.
- **Negative:** physical per-region binding provisioning still requires DevOps work
  (SOVEREIGN-REGIONS-01 follow-up) before regions are independently hosted.
- **Security (Pentest #6 surface):** LTI launch and cross-region boundary are both adversarial
  surfaces; both are pure-function gated and covered by unit tests. Egress governance for
  SOVEREIGN exclusion (CONNECT) is deferred to ADR-0059 (S94).

## Compliance

- SOVEREIGN residency requires architect + DPO sign-off per SOVEREIGN-00 — recorded here.
- Region `jurisdiction` labels (GDPR / UK GDPR / PIPEDA) feed the per-tenant compliance
  posture surface (SOVEREIGN-POSTURE-01, S94).
