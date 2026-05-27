# ADR-0038: results_delta / realtime v3 wire format

**Status:** Accepted (S76)  
**Date:** 2026-05-27

## Decision

- v2 ships `delta_results` feature flag; v3 protocol (S79) adds `results_delta` message type.
- Client negotiation via `?v=3` on WebSocket (S79 default shadow).
