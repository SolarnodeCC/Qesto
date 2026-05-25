---
id: ADR-0025
status: accepted
date: 2026-05-25
---

# ADR-0025 — SessionRoom Coordinator + Subdomain Engines

## Decision

1. **Phase 1 (S61):** Pure vote rules live in `lib/session-room-vote.ts` (shipped).
2. **Phase 2 (S62):** `SessionRoom` delegates vote handling only; energizer/sentiment stay in coordinator until Phase 3.
3. **Phase 3+:** Optional child DOs only if p95 RPC budget stays &lt; 8ms.

## Non-goals

No multi-DO split in S60–S62 without load-test evidence.
