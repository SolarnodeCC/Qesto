# ADR-0031: Realtime protocol v2 (delta broadcasts)

**Status:** Accepted (S67)  
**Date:** 2026-05-25

## Context

Full `results` broadcasts at scale waste bandwidth; v2 adds negotiated delta mode.

## Decision

- Protocol version `v=2` is opt-in via `x-qesto-protocol-v: 2` on WebSocket upgrade (shadow from S67, default-on S70 when `REALTIME_V2_DEFAULT=true`).
- v2 clients receive `init.features: ['delta_results']`; server may emit `results_delta` (subset) alongside v1 `results` during shadow.
- v1 remains supported until S70 sunset notice on public API v1.

## Consequences

- SessionRoom accepts v1 and v2 when `REALTIME_V2_ENABLED=true`.
- Contract tests in `tests/unit/realtime-v2.test.ts`.
