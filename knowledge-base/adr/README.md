# Architecture Decision Records (ADRs)

48 documented decisions (+ 6 planned slots) that guide the Qesto architecture.

> **To regenerate this index:** `node scripts/generate-adr-index.mjs --write`

## Decision Summary

| ADR | Title | Domain | Status |
|---|---|---|---|
| [ADR-0001](./ADR-0001-do-per-session.md) | Durable Object Per Session (LIVE State) | Architecture | Approved |
| [ADR-0002](./ADR-0002-ai-streaming-transport.md) | AI Streaming Transport for Wizard Question Generation | AI/Backend | Accepted |
| [ADR-0003](./ADR-0003-preflight-validation-contract.md) | Pre-flight Validation Contract (Worker vs. DO) | Backend | Accepted |
| [ADR-0004](./ADR-0004-custom-rbac-authorization.md) | Custom RBAC Authorization | Security | Approved |
| [ADR-0005](./ADR-0005-do-protocol-versioning.md) | Durable Object Protocol Versioning | Realtime | Accepted |
| [ADR-0006](./ADR-0006-workers-ai-capabilities.md) | Workers AI Capabilities for Qesto | AI/Backend | Accepted |
| [ADR-0007](./ADR-0007-circuit-breaker.md) | Circuit Breaker Pattern for External Dependencies | Resilience | Accepted |
| [ADR-0007-amend](./ADR-0007-amend-integrations-scope.md) | ADR-0007 Amendment: Circuit Breaker Integration Scope | Resilience | Accepted |
| [ADR-0008](./ADR-0008-integration-foundation.md) | Integration Provider Architecture | Integrations | Accepted |
| [ADR-0009](./ADR-0009-pii-sanitization.md) | PII Sanitization in Error Logging | Security | Approved |
| [ADR-0010](./ADR-0010-zero-knowledge-mode.md) | Zero-Knowledge Anonymity Mode | Security | Accepted |
| [ADR-0011](./ADR-0011-live-sentiment-inference.md) | Live Sentiment Inference (Workers AI) | AI/Backend | Accepted |
| [ADR-0012](./ADR-0012-route-service-repository.md) | Route → Service → Repository Boundaries | Backend | Proposed |
| [ADR-0013](./ADR-0013-energizer-strategy-pattern.md) | Energizer Strategy Pattern | Backend | Accepted |
| ADR-0014 | AI Capability Tier Ladder | AI/Backend | [SLOT] |
| [ADR-0015](./ADR-0015-mobile-client-contract.md) | Mobile Client Contract (PWA) | Frontend | Accepted |
| [ADR-0016](./ADR-0016-white-label-scoping.md) | White-Label Scoping | Multi-tenant | Accepted |
| [ADR-0017](./ADR-0017-tournament-state-machines.md) | Tournament State Machines | Backend | Accepted |
| [ADR-0018](./ADR-0018-kb-rag-activation.md) | KB RAG Activation (Decision Memory) | AI/Backend | Accepted |
| [ADR-0019](./ADR-0019-ldap-salesforce-sync.md) | LDAP and Salesforce Sync Model | Integrations | Accepted |
| [ADR-0020](./ADR-0020-zoom-salesforce-oauth.md) | Zoom & Salesforce OAuth Token Lifecycle | Integrations | Accepted |
| [ADR-0021](./ADR-0021-public-api-v1.md) | Public API v1 | Integrations | Accepted |
| [ADR-0022](./ADR-0022-multi-region-foundation.md) | Multi-Region Read Replica Foundation | Data | Accepted |
| [ADR-0022-phase2](./ADR-0022-phase-2-write-routing.md) | ADR-0022 Phase 2 — Write Routing Metadata (Sprint 51) | Data | Accepted |
| [ADR-0023](./ADR-0023-partner-oauth-scoping.md) | Partner OAuth App Scoping | Integrations | Accepted |
| [ADR-0024](./ADR-0024-public-api-v2-realtime.md) | Public API v2 Realtime Contract | Integrations | Accepted |
| [ADR-0025](./ADR-0025-session-room-decomposition.md) | SessionRoom Coordinator + Subdomain Engines | Realtime | Accepted |
| [ADR-0026](./ADR-0026-repository-layer.md) | Repository Layer for D1 Session Access | Backend | Accepted |
| [ADR-0027](./ADR-0027-multi-region-writes.md) | Multi-Region Write Routing (Design) | Data | Accepted |
| [ADR-0028](./ADR-0028-public-api-v3.md) | Public API v3 Contract | Integrations | Accepted |
| [ADR-0029](./ADR-0029-ai-workflows.md) | Long-Running AI via Async Jobs | AI/Backend | Accepted |
| [ADR-0030](./ADR-0030-slos-error-budgets.md) | SLOs and error budgets | Resilience | Accepted |
| [ADR-0031](./ADR-0031-realtime-protocol-v2.md) | Realtime protocol v2 (delta broadcasts) | Realtime | Accepted |
| [ADR-0032](./ADR-0032-tenant-quota-attribution.md) | Tenant quota and cost attribution | Multi-tenant | Accepted |
| [ADR-0033](./ADR-0033-federation-trust.md) | Federation trust and cross-org consent | Security | Accepted |
| [ADR-0034](./ADR-0034-pwa-offline-push.md) | PWA offline shell + push rich actions | Frontend | Accepted |
| ADR-0035 | SessionRoom Decomposition (Lobby / Live / Results DO) | Realtime | [SLOT] |
| [ADR-0036](./ADR-0036-eu-mr-write-ga.md) | EU multi-region write GA + tenant pinning | Data | Proposed |
| ADR-0037 | Tenant Namespace Isolation (enforcement S81+) | Security | [SLOT] |
| [ADR-0038](./ADR-0038-results-delta-realtime-v3.md) | results_delta / realtime v3 wire format | Realtime | Accepted |
| ADR-0039 | AI Agent Runtime (superseded by ADR-0046) | AI/Backend | [SLOT] |
| [ADR-040](./ADR-040-kb-vector-pipeline.md) | Knowledge-Base Vector Embedding & Semantic Search Pipeline | AI/Backend | Proposed |
| ADR-0041 | Customer-Managed Key (CMK) Envelope | Security | [SLOT] |
| [ADR-0042](./ADR-0042-capacitor-native-shell.md) | Native shell strategy (Capacitor + push only) | Frontend | Accepted |
| [ADR-042](./ADR-042-cloudflare-capability-expansion.md) | Cloudflare Platform Capability Expansion — 6-Week Phased Improvement Plan | Infrastructure | Proposed |
| [ADR-0043](./ADR-0043-fedramp-moderate-path.md) | FedRAMP Moderate control mapping (dedicated tier) | Security | Accepted |
| [ADR-0044](./ADR-0044-townhall-qa-board.md) | TOWNHALL Persistent Q&A Board State & Delta Protocol | Realtime | Proposed |
| [ADR-0045](./ADR-0045-cross-session-intelligence.md) | Cross-Session Intelligence Aggregation & Privacy Model | AI/Backend | Accepted |
| [ADR-0046](./ADR-0046-live-facilitator-copilot.md) | Live Facilitator Copilot — In-Session Context Flow & Action Protocol | AI/Backend | Accepted |
| ADR-0047 | Town-Hall Moderation Queue DO + Upvote Scale | Realtime | [SLOT] |
| [ADR-0048](./ADR-0048-recurring-workspace-data-model.md) | Recurring-Workspace Data Model (RETRO / IDEATE / EVENT Persistence + History) | Data | Proposed |
| [ADR-AI-Latency](./ADR-AI-Latency.md) | Workers AI Latency Budgets & Precomputation Strategy | AI/Performance | Accepted |
| [ADR-DO-Timers](./ADR-DO-Timers.md) | Timer Semantics in Durable Objects | Realtime | Accepted |
| [ADR-KV-Tenant-Conventions](./ADR-KV-Tenant-Conventions.md) | KV Key Scoping & Tenant-Isolation Conventions | Data | Accepted |

### Numbering notes

- **Dual files at 0007**: `ADR-0007-circuit-breaker.md` is the primary decision; `ADR-0007-amend-integrations-scope.md` is a formal amendment expanding scope.
- **Dual files at 0022**: `ADR-0022-multi-region-foundation.md` (Phase 1 read replicas) and `ADR-0022-phase-2-write-routing.md` (Phase 2 write routing).
- **Legacy 3-digit names**: `ADR-040` (KB vector pipeline) and `ADR-042` (Cloudflare capability expansion) predate the 4-digit zero-padded convention; their filenames are kept as-is to avoid breaking cross-references.
- **Named ADRs** (AI-Latency, DO-Timers, KV-Tenant-Conventions) were written before the numeric scheme was adopted.
- **[SLOT]** rows are ADRs planned in sprint notes or referenced by other ADRs but not yet written. Files will be added when the ADR is formally accepted.

---

**See**: [Main Knowledge Base](../README.md) | [Architecture Overview](../architecture/)
