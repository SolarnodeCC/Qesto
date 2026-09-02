# Qesto Documentation Index

> Audit generated **2026-09-02**. Indexes `.md` / `.mdx` / `.txt` across the repo.
> Excludes `node_modules/`, build/vendor trees, license boilerplate, and non-doc `.txt` (robots, quarantine, verification tokens).
> `CHANGELOG.md` files are listed as documents; auto-generated changelog *entries* older than 90 days were not expanded into this index.
> **No existing documentation was modified or moved** — this file is an audit artifact only.

## Summary

| Metric | Value |
|---|---|
| Total documents indexed | 593 |
| Current | 512 |
| Stale | 0 |
| Orphaned | 81 |
| Broken internal link occurrences | 114 |

### Category | File Count | Notes

| Category | File Count | Notes |
|---|---:|---|
| Architecture & Infrastructure | 134 | ADRs, stack specs, API contracts, AI-agent context, design-system tokens |
| Product & Feature Specs | 170 | Backlog, roadmaps, sprint plans, help content, product/feature specs |
| Marketing & Growth | 23 | SEO, LinkedIn worker, growth engine, sales, competitor positioning |
| Compliance & Legal | 26 | GDPR/DSA, SOC2 evidence, privacy, security policy docs |
| Audit Prompts / Claude Code Playbooks | 58 | Claude skills/agents, GitHub agent skills — reusable playbooks |
| Operations & DevOps | 101 | Deployment, monitoring, CI, incidents, testing guides, metadata |
| Onboarding & Contributor Docs | 23 | Root/module READMEs, CONTRIBUTING, AGENTS, CLAUDE entrypoints |
| NEW: Quality Assurance & Audit Reports | 48 | FLAGGED NEW — dated audit/review findings (not reusable prompts) |
| Uncategorized / Needs Review | 10 | Archive, ambiguous, or unclear ownership |

## Status legend

- **Current** — git-touched within ~6 months and discoverable (linked, parent-README listed, or owned playbook tree)
- **Stale** — not touched in 6+ months but still referenced
- **Orphaned** — not linked/listed, archived, or frontmatter `status` archived/deprecated/superseded

## Architecture & Infrastructure

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`agent/JANKURAI_STANDARD.md`](agent/JANKURAI_STANDARD.md) | Jankurai standard (Qesto) | 2026-07-04 | Current |
| [`contracts/AGENTS.md`](contracts/AGENTS.md) | Contracts (contracts/) | 2026-06-06 | Current |
| [`contracts/README.md`](contracts/README.md) | API contracts | 2026-06-06 | Current |
| [`db/AGENTS.md`](db/AGENTS.md) | Database layer (db/) | 2026-06-06 | Current |
| [`db/README.md`](db/README.md) | Database Root (D1) | 2026-06-06 | Current |
| [`docs/PHASE1-ANALYTICS-ENGINE.md`](docs/PHASE1-ANALYTICS-ENGINE.md) | Phase 1.3: Analytics Engine — Session Funnel & Realtime Health | 2026-06-04 | Current |
| [`docs/PHASE1-WAF-RULES.md`](docs/PHASE1-WAF-RULES.md) | Phase 1.2: Firewall & Rate Limiting Rules for Qesto | 2026-06-04 | Current |
| [`docs/PHASE2-INFRASTRUCTURE.md`](docs/PHASE2-INFRASTRUCTURE.md) | Phase 2 (Weeks 3–4): Infrastructure Implementation | 2026-06-04 | Current |
| [`docs/architecture.md`](docs/architecture.md) | Architecture (agent router) | 2026-05-27 | Current |
| [`docs/boundaries.md`](docs/boundaries.md) | Ownership boundaries | 2026-06-01 | Current |
| [`knowledge-base/adr/ADR-0001-do-per-session.md`](knowledge-base/adr/ADR-0001-do-per-session.md) | ADR-0001: Durable Object Per Session (LIVE State) | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0002-ai-streaming-transport.md`](knowledge-base/adr/ADR-0002-ai-streaming-transport.md) | ADR-0002: AI Streaming Transport for Wizard Question Generation | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0003-preflight-validation-contract.md`](knowledge-base/adr/ADR-0003-preflight-validation-contract.md) | ADR-0003: Pre-flight Validation Contract (Worker vs. DO) | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0004-custom-rbac-authorization.md`](knowledge-base/adr/ADR-0004-custom-rbac-authorization.md) | ADR-0004: Custom RBAC Authorization | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0005-do-protocol-versioning.md`](knowledge-base/adr/ADR-0005-do-protocol-versioning.md) | ADR-0005: Durable Object Protocol Versioning | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0006-workers-ai-capabilities.md`](knowledge-base/adr/ADR-0006-workers-ai-capabilities.md) | ADR — Workers AI Capabilities for Qesto | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0007-amend-integrations-scope.md`](knowledge-base/adr/ADR-0007-amend-integrations-scope.md) | ADR-0007 Amendment: Circuit Breaker Integration Scope | 2026-05-22 | Current |
| [`knowledge-base/adr/ADR-0007-circuit-breaker.md`](knowledge-base/adr/ADR-0007-circuit-breaker.md) | ADR: Circuit Breaker Pattern for External Dependencies | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0008-integration-foundation.md`](knowledge-base/adr/ADR-0008-integration-foundation.md) | ADR: Integration Provider Architecture | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0009-pii-sanitization.md`](knowledge-base/adr/ADR-0009-pii-sanitization.md) | ADR: PII Sanitization in Error Logging | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-0010-zero-knowledge-mode.md`](knowledge-base/adr/ADR-0010-zero-knowledge-mode.md) | ADR-0010: Zero-Knowledge Anonymity Mode | 2026-05-22 | Current |
| [`knowledge-base/adr/ADR-0011-live-sentiment-inference.md`](knowledge-base/adr/ADR-0011-live-sentiment-inference.md) | ADR-0011: Live Sentiment Inference (Workers AI) | 2026-05-22 | Current |
| [`knowledge-base/adr/ADR-0012-route-service-repository.md`](knowledge-base/adr/ADR-0012-route-service-repository.md) | ADR-0012: Route → Service → Repository Boundaries | 2026-05-22 | Current |
| [`knowledge-base/adr/ADR-0013-energizer-strategy-pattern.md`](knowledge-base/adr/ADR-0013-energizer-strategy-pattern.md) | ADR-0013: Energizer Strategy Pattern | 2026-05-23 | Current |
| [`knowledge-base/adr/ADR-0015-mobile-client-contract.md`](knowledge-base/adr/ADR-0015-mobile-client-contract.md) | ADR-0015: Mobile Client Contract (PWA) | 2026-05-23 | Current |
| [`knowledge-base/adr/ADR-0016-white-label-scoping.md`](knowledge-base/adr/ADR-0016-white-label-scoping.md) | ADR-0016: White-Label Scoping | 2026-05-23 | Current |
| [`knowledge-base/adr/ADR-0017-tournament-state-machines.md`](knowledge-base/adr/ADR-0017-tournament-state-machines.md) | ADR-0017: Tournament State Machines | 2026-05-23 | Current |
| [`knowledge-base/adr/ADR-0018-kb-rag-activation.md`](knowledge-base/adr/ADR-0018-kb-rag-activation.md) | ADR-0018: KB RAG Activation (Decision Memory) | 2026-05-23 | Current |
| [`knowledge-base/adr/ADR-0019-ldap-salesforce-sync.md`](knowledge-base/adr/ADR-0019-ldap-salesforce-sync.md) | ADR-0019: LDAP and Salesforce Sync Model | 2026-05-23 | Current |
| [`knowledge-base/adr/ADR-0020-zoom-salesforce-oauth.md`](knowledge-base/adr/ADR-0020-zoom-salesforce-oauth.md) | ADR-0020 — Zoom & Salesforce OAuth Token Lifecycle | 2026-05-23 | Current |
| [`knowledge-base/adr/ADR-0021-public-api-v1.md`](knowledge-base/adr/ADR-0021-public-api-v1.md) | ADR-0021 — Public API v1 | 2026-05-24 | Current |
| [`knowledge-base/adr/ADR-0022-multi-region-foundation.md`](knowledge-base/adr/ADR-0022-multi-region-foundation.md) | ADR-0022 — Multi-Region Read Replica Foundation | 2026-05-24 | Current |
| [`knowledge-base/adr/ADR-0022-phase-2-write-routing.md`](knowledge-base/adr/ADR-0022-phase-2-write-routing.md) | ADR-0022 Phase 2 — Write Routing Metadata (Sprint 51) | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0023-partner-oauth-scoping.md`](knowledge-base/adr/ADR-0023-partner-oauth-scoping.md) | ADR-0023 — Partner OAuth App Scoping | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0024-public-api-v2-realtime.md`](knowledge-base/adr/ADR-0024-public-api-v2-realtime.md) | ADR-0024 — Public API v2 Realtime Contract | 2026-05-24 | Current |
| [`knowledge-base/adr/ADR-0025-session-room-decomposition.md`](knowledge-base/adr/ADR-0025-session-room-decomposition.md) | ADR-0025 — SessionRoom Coordinator + Subdomain Engines | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0026-repository-layer.md`](knowledge-base/adr/ADR-0026-repository-layer.md) | ADR-0026 — Repository Layer for D1 Session Access | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0027-multi-region-writes.md`](knowledge-base/adr/ADR-0027-multi-region-writes.md) | ADR-0027 — Multi-Region Write Routing (Design) | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0028-public-api-v3.md`](knowledge-base/adr/ADR-0028-public-api-v3.md) | ADR-0028 — Public API v3 Contract | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0029-ai-workflows.md`](knowledge-base/adr/ADR-0029-ai-workflows.md) | ADR-0029 — Long-Running AI via Async Jobs | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0030-slos-error-budgets.md`](knowledge-base/adr/ADR-0030-slos-error-budgets.md) | ADR-0030: SLOs and error budgets | 2026-05-25 | Current |
| [`knowledge-base/adr/ADR-0031-realtime-protocol-v2.md`](knowledge-base/adr/ADR-0031-realtime-protocol-v2.md) | ADR-0031: Realtime protocol v2 (delta broadcasts) | 2026-05-25 | Current |
| [`knowledge-base/adr/ADR-0032-tenant-quota-attribution.md`](knowledge-base/adr/ADR-0032-tenant-quota-attribution.md) | ADR-0032: Tenant quota and cost attribution | 2026-05-25 | Current |
| [`knowledge-base/adr/ADR-0033-federation-trust.md`](knowledge-base/adr/ADR-0033-federation-trust.md) | ADR-0033: Federation trust and cross-org consent | 2026-05-25 | Current |
| [`knowledge-base/adr/ADR-0034-pwa-offline-push.md`](knowledge-base/adr/ADR-0034-pwa-offline-push.md) | ADR-0034: PWA offline shell + push rich actions | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0036-eu-mr-write-ga.md`](knowledge-base/adr/ADR-0036-eu-mr-write-ga.md) | ADR-0036: EU multi-region write GA + tenant pinning | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0038-results-delta-realtime-v3.md`](knowledge-base/adr/ADR-0038-results-delta-realtime-v3.md) | ADR-0038: resultsdelta / realtime v3 wire format | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0042-capacitor-native-shell.md`](knowledge-base/adr/ADR-0042-capacitor-native-shell.md) | ADR-0042: Native shell strategy (Capacitor + push only) | 2026-05-27 | Current |
| [`knowledge-base/adr/ADR-0043-fedramp-moderate-path.md`](knowledge-base/adr/ADR-0043-fedramp-moderate-path.md) | ADR-0043: FedRAMP Moderate control mapping (dedicated tier) | 2026-05-28 | Current |
| [`knowledge-base/adr/ADR-0044-townhall-qa-board.md`](knowledge-base/adr/ADR-0044-townhall-qa-board.md) | ADR-0044: TOWNHALL Persistent Q&A Board State & Delta Protocol | 2026-05-29 | Current |
| [`knowledge-base/adr/ADR-0045-cross-session-intelligence.md`](knowledge-base/adr/ADR-0045-cross-session-intelligence.md) | ADR-0045: Cross-Session Intelligence Aggregation & Privacy Model | 2026-06-10 | Current |
| [`knowledge-base/adr/ADR-0046-live-facilitator-copilot.md`](knowledge-base/adr/ADR-0046-live-facilitator-copilot.md) | ADR-0046: Live Facilitator Copilot — In-Session Context Flow & Action Protocol | 2026-05-30 | Current |
| [`knowledge-base/adr/ADR-0048-recurring-workspace-data-model.md`](knowledge-base/adr/ADR-0048-recurring-workspace-data-model.md) | ADR-0048: Recurring-Workspace Data Model (RETRO / IDEATE / EVENT Persistence + History) | 2026-06-11 | Current |
| [`knowledge-base/adr/ADR-0049-verifiable-voting-receipt-tally-integrity.md`](knowledge-base/adr/ADR-0049-verifiable-voting-receipt-tally-integrity.md) | ADR-0049: Verifiable Voting — Cryptographic Receipt + Merkle Tally Integrity (DELIBERATE mode) | 2026-06-12 | Current |
| [`knowledge-base/adr/ADR-0050-embeddable-sdk-auth-widget-origin-sandboxing.md`](knowledge-base/adr/ADR-0050-embeddable-sdk-auth-widget-origin-sandboxing.md) | ADR-0050: Embeddable SDK Auth + Widget Origin Sandboxing (EMBED public widget) | 2026-06-14 | Current |
| [`knowledge-base/adr/ADR-0051-live-captions-translation-pipeline.md`](knowledge-base/adr/ADR-0051-live-captions-translation-pipeline.md) | ADR-0051: Live Captions & Translation Pipeline (Workers AI) | 2026-06-13 | Current |
| [`knowledge-base/adr/ADR-0052-fedramp-full-ato-sovereign-data-plane.md`](knowledge-base/adr/ADR-0052-fedramp-full-ato-sovereign-data-plane.md) | ADR-0052: FedRAMP Full-ATO Boundary & Sovereign Data Plane | 2026-06-13 | Current |
| [`knowledge-base/adr/ADR-0053-v6-platform-certification.md`](knowledge-base/adr/ADR-0053-v6-platform-certification.md) | ADR-0053: v6.0 Platform Certification & v5.x Deprecation Policy | 2026-06-14 | Current |
| [`knowledge-base/adr/ADR-0054-cadence-9-governance.md`](knowledge-base/adr/ADR-0054-cadence-9-governance.md) | ADR-0054: v6.x Post-GA Stabilization & Cadence-9 Governance | 2026-06-19 | Orphaned |
| [`knowledge-base/adr/ADR-0055-reactions-ga-channel.md`](knowledge-base/adr/ADR-0055-reactions-ga-channel.md) | ADR-0055: REACTIONS GA — Live Reaction Channel at Scale | 2026-06-15 | Current |
| [`knowledge-base/adr/ADR-0056-agentic-maturity-l2-copilot.md`](knowledge-base/adr/ADR-0056-agentic-maturity-l2-copilot.md) | ADR-0056: Agentic Maturity L2 — Supervised Multi-Step Copilot Plans | 2026-06-15 | Current |
| [`knowledge-base/adr/ADR-0057-pulse-analytics-data-model.md`](knowledge-base/adr/ADR-0057-pulse-analytics-data-model.md) | ADR-0057: PULSE Analytics Product Data Model | 2026-06-15 | Current |
| [`knowledge-base/adr/ADR-0058-vertical-packaging-tenant-config.md`](knowledge-base/adr/ADR-0058-vertical-packaging-tenant-config.md) | ADR-0058: Vertical Packaging & Tenant Config Surface | 2026-06-15 | Current |
| [`knowledge-base/adr/ADR-0059-ecosystem-egress-governance.md`](knowledge-base/adr/ADR-0059-ecosystem-egress-governance.md) | ADR-0059: Ecosystem Depth — Extension Data Contracts & Partner Egress Governance | 2026-06-17 | Current |
| [`knowledge-base/adr/ADR-0060-analytics-insight-intelligence.md`](knowledge-base/adr/ADR-0060-analytics-insight-intelligence.md) | ADR-0060: Analytics Insight Intelligence — Privacy-Native AI Session Authoring Co-pilot | 2026-06-18 | Current |
| [`knowledge-base/adr/ADR-0062-federation-trust-isolation-model.md`](knowledge-base/adr/ADR-0062-federation-trust-isolation-model.md) | ADR-0062: CONNECT — Federation Trust Model & Cross-Tenant Isolation Proof | 2026-06-17 | Current |
| [`knowledge-base/adr/ADR-0063-v7-platform-certification.md`](knowledge-base/adr/ADR-0063-v7-platform-certification.md) | ADR-0063: v7.0 Platform Certification & v6.x Deprecation Policy | 2026-06-19 | Current |
| [`knowledge-base/adr/ADR-0064-demand-evidence-adversarial-validation-gates.md`](knowledge-base/adr/ADR-0064-demand-evidence-adversarial-validation-gates.md) | ADR-0064: Demand-Evidence & Adversarial Validation Gates for AI-Native Roadmap Governance | 2026-06-19 | Current |
| [`knowledge-base/adr/ADR-0065-html-shell-swr-edge-caching.md`](knowledge-base/adr/ADR-0065-html-shell-swr-edge-caching.md) | ADR-0065: Short-TTL / Stale-While-Revalidate Edge Caching for the HTML Shell | 2026-06-17 | Current |
| [`knowledge-base/adr/ADR-0066-xr-spatial-session-beta.md`](knowledge-base/adr/ADR-0066-xr-spatial-session-beta.md) | ADR-0066: XR Spatial / Immersive Session Mode (Beta) | 2026-06-18 | Current |
| [`knowledge-base/adr/ADR-0067-release-train-cadence.md`](knowledge-base/adr/ADR-0067-release-train-cadence.md) | ADR-0067: Release-Train Cadence (Replacing Sprint-Based Planning) | 2026-06-19 | Current |
| [`knowledge-base/adr/ADR-0068-workers-ai-gateway-facade.md`](knowledge-base/adr/ADR-0068-workers-ai-gateway-facade.md) | ADR-0068: All Workers AI Inference Through the Gateway Facade (runAI) | 2026-06-29 | Current |
| [`knowledge-base/adr/ADR-0069-route-service-repository-layering.md`](knowledge-base/adr/ADR-0069-route-service-repository-layering.md) | ADR-0069: Route → Service → Repository Layering (No Inline D1 in Routes) | 2026-06-29 | Current |
| [`knowledge-base/adr/ADR-0070-single-error-response-builder.md`](knowledge-base/adr/ADR-0070-single-error-response-builder.md) | ADR-0070: Single API Error-Response Builder (errorResponse) | 2026-06-29 | Current |
| [`knowledge-base/adr/ADR-0071-design-system-v1.md`](knowledge-base/adr/ADR-0071-design-system-v1.md) | ADR-0071 — Design System v1: token aliases, icon policy, component radius | 2026-07-07 | Current |
| [`knowledge-base/adr/ADR-0072-theming-mechanisms.md`](knowledge-base/adr/ADR-0072-theming-mechanisms.md) | ADR-0072 — Theming mechanisms: three bounded systems | 2026-07-01 | Current |
| [`knowledge-base/adr/ADR-0073-atomic-rate-limiting-workers-api.md`](knowledge-base/adr/ADR-0073-atomic-rate-limiting-workers-api.md) | ADR-0073: Atomic Rate Limiting via Workers Rate Limiting API | 2026-08-08 | Current |
| [`knowledge-base/adr/ADR-040-kb-vector-pipeline.md`](knowledge-base/adr/ADR-040-kb-vector-pipeline.md) | ADR-040: Knowledge-Base Vector Embedding & Semantic Search Pipeline | 2026-06-05 | Current |
| [`knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md`](knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md) | ADR-042: Cloudflare Platform Capability Expansion — 6-Week Phased Improvement Plan | 2026-08-08 | Current |
| [`knowledge-base/adr/ADR-AI-Latency.md`](knowledge-base/adr/ADR-AI-Latency.md) | ADR: Workers AI Latency Budgets & Precomputation Strategy | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-DO-Timers.md`](knowledge-base/adr/ADR-DO-Timers.md) | ADR: Timer Semantics in Durable Objects | 2026-05-11 | Current |
| [`knowledge-base/adr/ADR-KV-Tenant-Conventions.md`](knowledge-base/adr/ADR-KV-Tenant-Conventions.md) | ADR: KV Key Scoping & Tenant-Isolation Conventions | 2026-05-11 | Current |
| [`knowledge-base/adr/README.md`](knowledge-base/adr/README.md) | Architecture Decision Records (ADRs) | 2026-08-08 | Current |
| [`knowledge-base/ai-context/AGENT_SKILL_GOVERNANCE.md`](knowledge-base/ai-context/AGENT_SKILL_GOVERNANCE.md) | Agent & Skill Governance | 2026-06-05 | Current |
| [`knowledge-base/ai-context/AGENT_SYSTEM_OVERVIEW.md`](knowledge-base/ai-context/AGENT_SYSTEM_OVERVIEW.md) | Qesto — Codex Project Guide | 2026-05-11 | Current |
| [`knowledge-base/ai-context/RAG_USAGE.md`](knowledge-base/ai-context/RAG_USAGE.md) | RAG Usage Guide | 2026-05-12 | Current |
| [`knowledge-base/ai-context/README.md`](knowledge-base/ai-context/README.md) | AI Context & Research | 2026-06-19 | Current |
| [`knowledge-base/ai-context/reference/AGENTS_NEXT_LEVEL_IMPLEMENTATION.md`](knowledge-base/ai-context/reference/AGENTS_NEXT_LEVEL_IMPLEMENTATION.md) | Qesto Claude Agents — Step-by-Step Review, Next-Level Updates, and Implementation Spec | 2026-05-11 | Current |
| [`knowledge-base/ai-context/reference/AGENTS_VISUAL_OVERVIEW.md`](knowledge-base/ai-context/reference/AGENTS_VISUAL_OVERVIEW.md) | Qesto Agents Visual Overview | 2026-05-11 | Current |
| [`knowledge-base/ai-context/reference/AGENT_SKILL_IMPLEMENTATION_STEPS.md`](knowledge-base/ai-context/reference/AGENT_SKILL_IMPLEMENTATION_STEPS.md) | Step-by-step implementation per agent and skill | 2026-05-11 | Current |
| [`knowledge-base/ai-context/reference/AGENT_SKILL_TEMPLATE.md`](knowledge-base/ai-context/reference/AGENT_SKILL_TEMPLATE.md) | Agent & Skill Canonical Template (Qesto) | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/AGENT_IMPROVEMENT_PRIORITIES.md`](knowledge-base/ai-context/research/AGENT_IMPROVEMENT_PRIORITIES.md) | Agent Improvement Priorities From Audits | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/AGENT_PREDICTABILITY_SCORECARD.md`](knowledge-base/ai-context/research/AGENT_PREDICTABILITY_SCORECARD.md) | Agent Planning Predictability Scorecard | 2026-06-19 | Current |
| [`knowledge-base/ai-context/research/AGENT_SKILL_SCORECARD.md`](knowledge-base/ai-context/research/AGENT_SKILL_SCORECARD.md) | Agent & Skill Scorecard Spec | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/AI_DECISIONS_2026_04.md`](knowledge-base/ai-context/research/AI_DECISIONS_2026_04.md) | AI Insights — Competency Score & 4-Week Action Plan | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/PHASE_9_10_STRATEGY.md`](knowledge-base/ai-context/research/PHASE_9_10_STRATEGY.md) | Phase 9+10 Strategic Implementation Plan | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/SKILLS_NEXT_PHASE_PLAN.md`](knowledge-base/ai-context/research/SKILLS_NEXT_PHASE_PLAN.md) | Qesto Skills Review & Next-Phase Strengthening Plan | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/SKILLS_SCORECARD_2026_04.md`](knowledge-base/ai-context/research/SKILLS_SCORECARD_2026_04.md) | Skills & Agents Scorecard — April 2026 (Baseline) | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/SKILLS_SCORECARD_TRACKER.md`](knowledge-base/ai-context/research/SKILLS_SCORECARD_TRACKER.md) | Skills & Agents Scorecard Tracker | 2026-06-05 | Current |
| [`knowledge-base/ai-context/research/SKILLS_WAVE1_EVIDENCE_LOG.md`](knowledge-base/ai-context/research/SKILLS_WAVE1_EVIDENCE_LOG.md) | Wave 1 Evidence Log | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/SKILLS_WAVE1_EXECUTION.md`](knowledge-base/ai-context/research/SKILLS_WAVE1_EXECUTION.md) | Qesto Skills Wave 1 Execution | 2026-05-11 | Current |
| [`knowledge-base/ai-context/research/SKILLS_WAVE1_OUTPUT.md`](knowledge-base/ai-context/research/SKILLS_WAVE1_OUTPUT.md) | Skills Wave 1 Output | 2026-05-11 | Current |
| [`knowledge-base/api/API_FULL.md`](knowledge-base/api/API_FULL.md) | Qesto — API & Realtime Specification (Current) | 2026-06-18 | Current |
| [`knowledge-base/api/DEVELOPER_COMMUNITY.md`](knowledge-base/api/DEVELOPER_COMMUNITY.md) | Developer Community — Integrators (v3.0) | 2026-05-24 | Orphaned |
| [`knowledge-base/api/MCP_TOOL_MATRIX.md`](knowledge-base/api/MCP_TOOL_MATRIX.md) | Qesto MCP Server — Tool Matrix | 2026-05-11 | Current |
| [`knowledge-base/api/PUBLIC_API_V1.md`](knowledge-base/api/PUBLIC_API_V1.md) | Public API v1 | 2026-05-24 | Current |
| [`knowledge-base/api/PUBLIC_API_V2.md`](knowledge-base/api/PUBLIC_API_V2.md) | Public API v2 — Realtime | 2026-05-24 | Current |
| [`knowledge-base/api/README.md`](knowledge-base/api/README.md) | API & Integration Documentation | 2026-05-11 | Current |
| [`knowledge-base/architecture/AI_CONTEXT_SPEC.md`](knowledge-base/architecture/AI_CONTEXT_SPEC.md) | Session AI Context — Interface Specification (Draft) | 2026-05-22 | Current |
| [`knowledge-base/architecture/ARCHITECTURE.md`](knowledge-base/architecture/ARCHITECTURE.md) | Qesto — Architecture (Current) | 2026-06-12 | Current |
| [`knowledge-base/architecture/CLOUDFLARE_WORKERS_OPTIMIZATION.md`](knowledge-base/architecture/CLOUDFLARE_WORKERS_OPTIMIZATION.md) | Cloudflare Workers Optimization Guide | 2026-05-11 | Current |
| [`knowledge-base/architecture/DESIGN_GRID_GUIDE.md`](knowledge-base/architecture/DESIGN_GRID_GUIDE.md) | Grid Layout Guide — LAYOUT-GRID-01 | 2026-05-11 | Current |
| [`knowledge-base/architecture/README.md`](knowledge-base/architecture/README.md) | Architecture & System Design | 2026-05-11 | Current |
| [`knowledge-base/architecture/VALIDATION_PATTERNS.md`](knowledge-base/architecture/VALIDATION_PATTERNS.md) | Input Validation Patterns — HLT-031 Remediation | 2026-06-01 | Current |
| [`knowledge-base/architecture/VALIDATION_STRATEGY.md`](knowledge-base/architecture/VALIDATION_STRATEGY.md) | Validation Strategy for Trust Boundaries (HLT-031) | 2026-06-01 | Current |
| [`knowledge-base/governance/design-system/README.md`](knowledge-base/governance/design-system/README.md) | Qesto Design System (design-system/) | 2026-07-07 | Current |
| [`knowledge-base/governance/design-system/SKILL.md`](knowledge-base/governance/design-system/SKILL.md) | Qesto Design System — skill entry | 2026-05-11 | Current |
| [`knowledge-base/governance/design-system/assets/fonts/README.md`](knowledge-base/governance/design-system/assets/fonts/README.md) | Self-hosting Qesto's fonts | 2026-07-07 | Current |
| [`knowledge-base/governance/design-system/copy_deck.md`](knowledge-base/governance/design-system/copy_deck.md) | Qesto copy deck | 2026-05-11 | Current |
| [`knowledge-base/governance/design-system/ui_kits/admin/README.md`](knowledge-base/governance/design-system/ui_kits/admin/README.md) | Admin UI kit | 2026-07-07 | Current |
| [`knowledge-base/governance/design-system/ui_kits/dashboard/README.md`](knowledge-base/governance/design-system/ui_kits/dashboard/README.md) | Dashboard UI kit | 2026-07-07 | Current |
| [`knowledge-base/governance/design-system/ui_kits/participant/README.md`](knowledge-base/governance/design-system/ui_kits/participant/README.md) | Participant UI kit | 2026-07-07 | Current |
| [`knowledge-base/governance/design-system/ui_kits/present/README.md`](knowledge-base/governance/design-system/ui_kits/present/README.md) | Present UI kit | 2026-07-07 | Current |
| [`knowledge-base/governance/design-system/ui_kits/website/README.md`](knowledge-base/governance/design-system/ui_kits/website/README.md) | Website UI kit | 2026-07-07 | Current |
| [`knowledge-base/specifications/domain/DESIGN_TOKENS_README.md`](knowledge-base/specifications/domain/DESIGN_TOKENS_README.md) | Design tokens | 2026-07-07 | Current |
| [`knowledge-base/specifications/domain/I18N_ARCHITECTURE_CONTRACT.md`](knowledge-base/specifications/domain/I18N_ARCHITECTURE_CONTRACT.md) | Qesto i18n Architecture Contract | 2026-08-25 | Current |
| [`knowledge-base/specifications/domain/SPEC_BACKEND.md`](knowledge-base/specifications/domain/SPEC_BACKEND.md) | SPECBACKEND — API Routes, Services, Middleware | 2026-05-18 | Current |
| [`knowledge-base/specifications/domain/SPEC_CORE.md`](knowledge-base/specifications/domain/SPEC_CORE.md) | SPECCORE — System Architecture & Design | 2026-07-16 | Current |
| [`knowledge-base/specifications/domain/SPEC_DATAMODEL.md`](knowledge-base/specifications/domain/SPEC_DATAMODEL.md) | SPECDATAMODEL — Database Schema, KV Patterns, Types | 2026-05-11 | Current |
| [`knowledge-base/specifications/domain/SPEC_DEPLOYMENT.md`](knowledge-base/specifications/domain/SPEC_DEPLOYMENT.md) | SPECDEPLOYMENT — Build, Config, Secrets, CI/CD, Monitoring | 2026-07-16 | Current |
| [`knowledge-base/specifications/domain/SPEC_DESIGN_SYSTEM_OVERVIEW.md`](knowledge-base/specifications/domain/SPEC_DESIGN_SYSTEM_OVERVIEW.md) | Qesto Design System — Portable overview | 2026-07-07 | Current |
| [`knowledge-base/specifications/domain/SPEC_FRONTEND.md`](knowledge-base/specifications/domain/SPEC_FRONTEND.md) | SPECFRONTEND — React Architecture, Routing, Hooks, Components | 2026-07-07 | Current |
| [`knowledge-base/specifications/domain/SPEC_INTEGRATIONS.md`](knowledge-base/specifications/domain/SPEC_INTEGRATIONS.md) | SPECINTEGRATIONS — Payments, AI, Auth, Webhooks | 2026-06-17 | Current |
| [`knowledge-base/specifications/domain/SPEC_REALTIME.md`](knowledge-base/specifications/domain/SPEC_REALTIME.md) | SPECREALTIME — WebSocket, Durable Objects, Live Sessions | 2026-06-18 | Current |

## Product & Feature Specs

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`knowledge-base/experiments/2026-04-24-trial-activation.md`](knowledge-base/experiments/2026-04-24-trial-activation.md) | Experiment: 3-Step Guided Checklist Increases Activation | 2026-05-11 | Current |
| [`knowledge-base/experiments/README.md`](knowledge-base/experiments/README.md) | Experiments & Prototypes | 2026-05-11 | Current |
| [`knowledge-base/help/account-and-auth.md`](knowledge-base/help/account-and-auth.md) | Account and Sign-In | 2026-06-21 | Current |
| [`knowledge-base/help/billing.md`](knowledge-base/help/billing.md) | Pricing and Plans | 2026-07-02 | Current |
| [`knowledge-base/help/enterprise-data-controls.md`](knowledge-base/help/enterprise-data-controls.md) | Enterprise Data Controls | 2026-06-21 | Current |
| [`knowledge-base/help/faq.md`](knowledge-base/help/faq.md) | Frequently Asked Questions | 2026-06-21 | Current |
| [`knowledge-base/help/gamification.md`](knowledge-base/help/gamification.md) | Badges, Leaderboards, and Tournaments | 2026-06-21 | Current |
| [`knowledge-base/help/getting-started.md`](knowledge-base/help/getting-started.md) | Getting Started with Qesto | 2026-06-21 | Current |
| [`knowledge-base/help/hosting-sessions.md`](knowledge-base/help/hosting-sessions.md) | Hosting and Running Sessions | 2026-06-21 | Current |
| [`knowledge-base/help/live-features.md`](knowledge-base/help/live-features.md) | Live Features | 2026-06-21 | Current |
| [`knowledge-base/help/marketplace.md`](knowledge-base/help/marketplace.md) | Template and Plugin Marketplace | 2026-06-21 | Current |
| [`knowledge-base/help/participant-guide.md`](knowledge-base/help/participant-guide.md) | Joining and Participating in Sessions | 2026-06-21 | Current |
| [`knowledge-base/help/semantic-search.md`](knowledge-base/help/semantic-search.md) | Semantic Decision Search | 2026-06-21 | Current |
| [`knowledge-base/help/session-modes.md`](knowledge-base/help/session-modes.md) | Advanced Session Modes | 2026-06-21 | Current |
| [`knowledge-base/help/teams-and-collaboration.md`](knowledge-base/help/teams-and-collaboration.md) | Teams and Collaboration | 2026-06-21 | Current |
| [`knowledge-base/help/templates-and-ai.md`](knowledge-base/help/templates-and-ai.md) | Templates and AI Features | 2026-06-21 | Current |
| [`knowledge-base/help/troubleshooting.md`](knowledge-base/help/troubleshooting.md) | Troubleshooting Guide | 2026-06-21 | Current |
| [`knowledge-base/operations/help-assistant/HELP_ASSISTANT_API.md`](knowledge-base/operations/help-assistant/HELP_ASSISTANT_API.md) | Help Assistant API Specification | 2026-06-01 | Current |
| [`knowledge-base/operations/help-assistant/HELP_ASSISTANT_DEPLOYMENT.md`](knowledge-base/operations/help-assistant/HELP_ASSISTANT_DEPLOYMENT.md) | Help Assistant Deployment & Operations Guide | 2026-06-01 | Current |
| [`knowledge-base/operations/help-assistant/README.md`](knowledge-base/operations/help-assistant/README.md) | Help assistant | 2026-06-01 | Current |
| [`knowledge-base/product/ENTERPRISE_FEATURE_REVIEW.md`](knowledge-base/product/ENTERPRISE_FEATURE_REVIEW.md) | Qesto — Enterprise Feature Polish Review | 2026-06-19 | Orphaned |
| [`knowledge-base/product/MARKET_PULSE_TO_BACKLOG_WORKFLOW.md`](knowledge-base/product/MARKET_PULSE_TO_BACKLOG_WORKFLOW.md) | Weekly Market Pulse → Backlog Integration Workflow | 2026-06-19 | Current |
| [`knowledge-base/product/README.md`](knowledge-base/product/README.md) | Product Strategy, Roadmap & Planning | 2026-06-19 | Current |
| [`knowledge-base/product/backlog/BACKLOG_ACTIVE.md`](knowledge-base/product/backlog/BACKLOG_ACTIVE.md) | Qesto — Active Backlog (Release Trains) | 2026-08-25 | Current |
| [`knowledge-base/product/backlog/BACKLOG_MASTER.md`](knowledge-base/product/backlog/BACKLOG_MASTER.md) | Qesto — Product Backlog (Epic-Based) | 2026-07-15 | Current |
| [`knowledge-base/product/backlog/QA_COMMITMENT_SPRINTS_60_70.md`](knowledge-base/product/backlog/QA_COMMITMENT_SPRINTS_60_70.md) | QA Commitment for Sprints 60–70 (3× Capacity: 120–150 pts/sprint) | 2026-05-25 | Current |
| [`knowledge-base/product/backlog/QA_COMMITMENT_SPRINTS_71_80.md`](knowledge-base/product/backlog/QA_COMMITMENT_SPRINTS_71_80.md) | QA Commitment for Sprints 71–80 (50k Load Proof + MR Write GA + DR Automation + SLO Paging + v5.0 RC/GA) | 2026-05-27 | Current |
| [`knowledge-base/product/backlog/QA_COMMITMENT_SPRINTS_81_90.md`](knowledge-base/product/backlog/QA_COMMITMENT_SPRINTS_81_90.md) | QA Commitment for Sprints 81–90 (Post-v5.0 Expansion Arc: Native Device Matrix, Marketplace Contracts, Agent Safety, TOW... | 2026-06-01 | Current |
| [`knowledge-base/product/backlog/QA_STORIES_DETAILED_SPRINTS_60_70.md`](knowledge-base/product/backlog/QA_STORIES_DETAILED_SPRINTS_60_70.md) | QA Story Specifications — Sprints 60–70 (Detailed) | 2026-05-25 | Current |
| [`knowledge-base/product/backlog/REV_LOW_STORIES.md`](knowledge-base/product/backlog/REV_LOW_STORIES.md) | Low-Priority Stories from Platform Review REV 2026-06-09 | 2026-06-10 | Current |
| [`knowledge-base/product/planning/ADR0073_ATOMIC_RL_WORKSTREAMS.md`](knowledge-base/product/planning/ADR0073_ATOMIC_RL_WORKSTREAMS.md) | ADR-0073 — Build Workstreams (Atomic Rate Limiting) | 2026-08-08 | Current |
| [`knowledge-base/product/planning/I18N_CI_GATES_SPRINT_60_70.md`](knowledge-base/product/planning/I18N_CI_GATES_SPRINT_60_70.md) | i18n CI Gates — Sprints 60–70 (Validation & Merge Gates) | 2026-06-11 | Current |
| [`knowledge-base/product/planning/I18N_SPRINT_60_70_BACKLOG.md`](knowledge-base/product/planning/I18N_SPRINT_60_70_BACKLOG.md) | i18n Backlog — Sprints 60–70 (Story Cards) | 2026-06-11 | Current |
| [`knowledge-base/product/planning/I18N_SPRINT_60_70_PLAN.md`](knowledge-base/product/planning/I18N_SPRINT_60_70_PLAN.md) | i18n Estimation — Sprints 60–70 (v2.4 → v2.6 horizon) | 2026-06-11 | Current |
| [`knowledge-base/product/planning/I18N_SPRINT_60_70_QUICKREF.md`](knowledge-base/product/planning/I18N_SPRINT_60_70_QUICKREF.md) | i18n Sprints 60–70 — Quick Reference Card | 2026-06-11 | Orphaned |
| [`knowledge-base/product/planning/I18N_SPRINT_60_70_SUMMARY.md`](knowledge-base/product/planning/I18N_SPRINT_60_70_SUMMARY.md) | i18n Sprint 60–70 Estimation — Executive Summary | 2026-06-11 | Current |
| [`knowledge-base/product/planning/I18N_SPRINT_71_80_PLAN.md`](knowledge-base/product/planning/I18N_SPRINT_71_80_PLAN.md) | i18n Sprint 71–80 Plan | 2026-06-11 | Current |
| [`knowledge-base/product/planning/I18N_SPRINT_81_90_PLAN.md`](knowledge-base/product/planning/I18N_SPRINT_81_90_PLAN.md) | i18n Plan — Sprints 81–90 (Post-v5.0 Expansion Arc) | 2026-06-11 | Current |
| [`knowledge-base/product/planning/IMPLEMENTATION_PLAN_COMPLETE.md`](knowledge-base/product/planning/IMPLEMENTATION_PLAN_COMPLETE.md) | Implementation Plan Complete — Transparent Delivery Summary | 2026-05-11 | Current |
| [`knowledge-base/product/planning/NEXT_5_EPICS_PLAN.md`](knowledge-base/product/planning/NEXT_5_EPICS_PLAN.md) | Next 5 Epics Plan — Post-INSIGHTS+ New-Buyer Expansion (S85–S88) | 2026-06-06 | Current |
| [`knowledge-base/product/planning/PLAN_ENTITLEMENT_AUDIT.md`](knowledge-base/product/planning/PLAN_ENTITLEMENT_AUDIT.md) | Plan & Entitlement Audit (Pricing vs Enforcement) | 2026-06-17 | Current |
| [`knowledge-base/product/planning/RELEASE_TRAIN_MASTER.md`](knowledge-base/product/planning/RELEASE_TRAIN_MASTER.md) | Qesto — Release Train Master Plan | 2026-07-15 | Current |
| [`knowledge-base/product/planning/S19_KPI_BASELINE.md`](knowledge-base/product/planning/S19_KPI_BASELINE.md) | S19-MEASURE-01 — Sprint 19 KPI Baseline | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/SPRINT26_32_PLAN.md`](knowledge-base/product/planning/SPRINT26_32_PLAN.md) | Sprint 26-32 Plan — v2.2 Live Engagement to Enterprise Release | 2026-05-21 | Current |
| [`knowledge-base/product/planning/SPRINT30_39_PLAN.md`](knowledge-base/product/planning/SPRINT30_39_PLAN.md) | Sprint 30–39 Plan — v2.2 RC → v2.4 Horizon | 2026-05-23 | Current |
| [`knowledge-base/product/planning/SPRINT33_34_PLAN.md`](knowledge-base/product/planning/SPRINT33_34_PLAN.md) | Sprint 33-34 Plan — v2.3 Integration Suite, Compliance & AI Depth | 2026-05-22 | Current |
| [`knowledge-base/product/planning/SPRINT51_60_DOD_CHECKLIST.md`](knowledge-base/product/planning/SPRINT51_60_DOD_CHECKLIST.md) | Sprint 51–60 — Definition of Done Checklist | 2026-05-27 | Current |
| [`knowledge-base/product/planning/SPRINT51_60_PLAN.md`](knowledge-base/product/planning/SPRINT51_60_PLAN.md) | Sprint 51–60 Plan — v3.1 to v3.5 Horizon (Seven Epics, 10 Sprints) | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/SPRINT60_70_FRONTEND_PROPOSAL.md`](knowledge-base/product/planning/SPRINT60_70_FRONTEND_PROPOSAL.md) | Sprint 60–70 Frontend Proposal — v3.0 Mobile / Partner / Admin | 2026-05-27 | Current |
| [`knowledge-base/product/planning/SPRINT60_70_INFRA_PLAN.md`](knowledge-base/product/planning/SPRINT60_70_INFRA_PLAN.md) | Sprint 60–70 Infrastructure Plan — Multi-Region Prod + D1 Sharding + SLO + Chaos + Partner Env | 2026-07-16 | Current |
| [`knowledge-base/product/planning/SPRINT60_70_PLAN.md`](knowledge-base/product/planning/SPRINT60_70_PLAN.md) | Sprint 60–70 Plan — Post-v3.0 Platform Arc (3× Capacity) | 2026-06-11 | Current |
| [`knowledge-base/product/planning/SPRINT71_80_FRONTEND_PROPOSAL.md`](knowledge-base/product/planning/SPRINT71_80_FRONTEND_PROPOSAL.md) | Sprint 71–80 Frontend Proposal — Post-v4.0 Experience & Platform UX | 2026-06-11 | Current |
| [`knowledge-base/product/planning/SPRINT71_80_INFRA_PLAN.md`](knowledge-base/product/planning/SPRINT71_80_INFRA_PLAN.md) | Sprint 71–80 Infrastructure Plan — MR Write GA + 50k Load Proof + DR Automation + SLO Paging + v5 Infra | 2026-05-27 | Current |
| [`knowledge-base/product/planning/SPRINT71_80_PLAN.md`](knowledge-base/product/planning/SPRINT71_80_PLAN.md) | Sprint 71–80 Plan — Post-v4.0 Platform Maturity Arc (3× Capacity) | 2026-06-11 | Current |
| [`knowledge-base/product/planning/SPRINT81_85_PLAN.md`](knowledge-base/product/planning/SPRINT81_85_PLAN.md) | Sprint 81–85 Plan — Frontier Reconciliation & Early v5.1 (Jun 2 – Aug 10, 2026) | 2026-06-02 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_AI_PLAN.md`](knowledge-base/product/planning/SPRINT81_90_AI_PLAN.md) | Sprint 81–90 AI Plan — Agentic Facilitation → v6.0 (AI-441–AI-480) | 2026-06-01 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_ANALYTICS_PLAN.md`](knowledge-base/product/planning/SPRINT81_90_ANALYTICS_PLAN.md) | Sprint 81–90 Analytics Plan — Measuring the Expansion Arc | 2026-06-01 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_ARCH_NOTES.md`](knowledge-base/product/planning/SPRINT81_90_ARCH_NOTES.md) | Sprint 81–90 Architecture Notes & ADR Brief — Post-v5.0 Expansion Arc | 2026-06-01 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_BACKEND_PROPOSAL.md`](knowledge-base/product/planning/SPRINT81_90_BACKEND_PROPOSAL.md) | Sprint 81–90 Backend Proposal — Post-v5.0 → v6.0 GA Expansion Arc | 2026-06-01 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_FRONTEND_PROPOSAL.md`](knowledge-base/product/planning/SPRINT81_90_FRONTEND_PROPOSAL.md) | Sprint 81–90 Frontend Proposal — Post-v5.0 Platform Expansion Arc | 2026-06-11 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_INFRA_PLAN.md`](knowledge-base/product/planning/SPRINT81_90_INFRA_PLAN.md) | Sprint 81–90 Infrastructure Plan — Native Mobile Pipeline + Marketplace Payout + Agent Runtime + Gov Cloud + v6.0 GA | 2026-06-01 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_PLAN.md`](knowledge-base/product/planning/SPRINT81_90_PLAN.md) | Sprint 81–90 Plan — Post-v5.0 Platform Expansion Arc (3× Capacity) | 2026-06-11 | Current |
| [`knowledge-base/product/planning/SPRINT81_90_SECURITY_PLAN.md`](knowledge-base/product/planning/SPRINT81_90_SECURITY_PLAN.md) | Sprint 81–90 Security Plan — Post-v5.0 Expansion Arc | 2026-06-01 | Current |
| [`knowledge-base/product/planning/SPRINT85_99_ARCH_NOTES.md`](knowledge-base/product/planning/SPRINT85_99_ARCH_NOTES.md) | Sprint 85–99 Architecture Notes & ADR Brief — 9-Day Cadence Re-plan toward v7.0 | 2026-06-11 | Current |
| [`knowledge-base/product/planning/SPRINT85_99_PLAN.md`](knowledge-base/product/planning/SPRINT85_99_PLAN.md) | Sprint 85–99 Plan — 9-Day Cadence Re-plan toward v7.0 GA | 2026-06-19 | Orphaned |
| [`knowledge-base/product/planning/SPRINT91_99_STORIES.md`](knowledge-base/product/planning/SPRINT91_99_STORIES.md) | Sprint 91–99 Story Breakdown — v6.1 → v7.0 GA Horizon | 2026-06-11 | Current |
| [`knowledge-base/product/planning/SPRINT_PLAN_MASTER.md`](knowledge-base/product/planning/SPRINT_PLAN_MASTER.md) | Qesto — Sprint Plan (5-Sprint Roadmap) | 2026-05-21 | Current |
| [`knowledge-base/product/planning/XR_00_DEMAND_VALIDATION.md`](knowledge-base/product/planning/XR_00_DEMAND_VALIDATION.md) | XR-00 — Demand Validation Spike | 2026-06-18 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT19_COMPLETION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT19_COMPLETION_SPEC.md) | Sprint 19 Full Completion Spec | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT20_READINESS_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT20_READINESS_SPEC.md) | Sprint 20 Readiness Implementation Spec | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT21_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT21_IMPLEMENTATION_SPEC.md) | Sprint 21 Implementation Spec | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT22_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT22_IMPLEMENTATION_SPEC.md) | Sprint 22 Implementation Spec — Template Catalogue + Session Creation Polish | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT23_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT23_IMPLEMENTATION_SPEC.md) | Sprint 23 Implementation Spec — Launchpad + Design Polish | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT24_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT24_IMPLEMENTATION_SPEC.md) | Sprint 24 Implementation Spec — v2.2 Realtime Governance + Admin Hardening | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT25_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT25_IMPLEMENTATION_SPEC.md) | Sprint 25 Implementation Spec — LIVE Energizer Protocol Foundation | 2026-05-11 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT26_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT26_IMPLEMENTATION_SPEC.md) | Sprint 26 Implementation Spec — LIVE energizer activation readiness | 2026-05-11 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT27_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT27_IMPLEMENTATION_SPEC.md) | Sprint 27 Implementation Spec — Quick Finger playable loop | 2026-05-11 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT28_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT28_IMPLEMENTATION_SPEC.md) | Sprint 28 Implementation Spec — Team Quiz LIVE loop | 2026-05-11 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT29_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT29_IMPLEMENTATION_SPEC.md) | Sprint 29 Implementation Spec — Leaderboard and badge foundation | 2026-05-11 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT30_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT30_IMPLEMENTATION_SPEC.md) | Sprint 30 Implementation Spec — Admin Engagement Analytics | 2026-05-11 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT31_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT31_IMPLEMENTATION_SPEC.md) | Sprint 31 Implementation Spec — Enterprise Hardening + Integration Foundation | 2026-05-24 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT32_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT32_IMPLEMENTATION_SPEC.md) | Sprint 32 Implementation Spec — v2.2 Release Candidate | 2026-06-01 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT33_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT33_IMPLEMENTATION_SPEC.md) | Sprint 33 Implementation Spec — v2.3 Integrations + AI Context | 2026-05-22 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT34_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT34_IMPLEMENTATION_SPEC.md) | Sprint 34 Implementation Spec — v2.3 Compliance + AI Depth | 2026-05-23 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT35_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT35_IMPLEMENTATION_SPEC.md) | Sprint 35 Implementation Spec — v2.4 SOC 2 + Zoom + Gamification Export | 2026-05-23 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT36_39_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT36_39_IMPLEMENTATION_SPEC.md) | Sprints 36–39 Implementation Spec — v2.4 Horizon | 2026-05-23 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT40_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT40_IMPLEMENTATION_SPEC.md) | Sprint 40 — Enterprise Integrations Phase 1 | 2026-05-23 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT41_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT41_IMPLEMENTATION_SPEC.md) | Sprint 41 — Mobile PWA + Admin Engagement | 2026-05-23 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT42_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT42_IMPLEMENTATION_SPEC.md) | Sprint 42 — Compliance + AI Coaching Maturity | 2026-05-24 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT46_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT46_IMPLEMENTATION_SPEC.md) | Sprint 46 — Performance + Multi-Region Foundation | 2026-05-24 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT47_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT47_IMPLEMENTATION_SPEC.md) | Sprint 47 — v2.6 RC + Compliance Roadmap | 2026-05-24 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT48_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT48_IMPLEMENTATION_SPEC.md) | Sprint 48 — Multi-Region Activation + API v2 | 2026-05-24 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT49_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT49_IMPLEMENTATION_SPEC.md) | Sprint 49 — Observability + Hardening | 2026-05-24 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT50_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT50_IMPLEMENTATION_SPEC.md) | Sprint 50 — v3.0 RC + Launch Pack | 2026-05-24 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT51_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT51_IMPLEMENTATION_SPEC.md) | Sprint 51 — Obsidian KB + Multi-Region Write + LDAP Sync Start | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT52_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT52_IMPLEMENTATION_SPEC.md) | Sprint 52 — LDAP-02 + Multi-Region Drill | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT53_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT53_IMPLEMENTATION_SPEC.md) | Sprint 53 — Webhooks + ARCH-HONO-02 | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT54_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT54_IMPLEMENTATION_SPEC.md) | Sprint 54 — Partner OAuth + API v2 + v3.2 | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT55_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT55_IMPLEMENTATION_SPEC.md) | Sprint 55 — LIVE Tournaments + Coaching UI | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT56_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT56_IMPLEMENTATION_SPEC.md) | Sprint 56 — RAG Coaching + Tournament Export | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT57_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT57_IMPLEMENTATION_SPEC.md) | Sprint 57 — AI Coaching UX + SOC2 Prep | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT58_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT58_IMPLEMENTATION_SPEC.md) | Sprint 58 — SOC2 Execution + Partner Marketplace | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT59_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT59_IMPLEMENTATION_SPEC.md) | Sprint 59 — SOC2 Completion + Partner GTM | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT60_65_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT60_65_IMPLEMENTATION_SPEC.md) | Sprint 60–65 — Implementation Record | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT60_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT60_IMPLEMENTATION_SPEC.md) | Sprint 60 — v3.5 Multi-Tenant AI + Moat | 2026-05-27 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT66_70_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT66_70_IMPLEMENTATION_SPEC.md) | Sprint 66–70 — Implementation Record | 2026-05-25 | Current |
| [`knowledge-base/product/planning/sprints/SPRINT71_80_IMPLEMENTATION_SPEC.md`](knowledge-base/product/planning/sprints/SPRINT71_80_IMPLEMENTATION_SPEC.md) | Sprint 71–80 — Implementation Record | 2026-05-28 | Orphaned |
| [`knowledge-base/product/planning/sprints/SPRINT_DESIGN_TEMPLATE.md`](knowledge-base/product/planning/sprints/SPRINT_DESIGN_TEMPLATE.md) | Sprint Design Template (S51–S60) | 2026-05-27 | Orphaned |
| [`knowledge-base/product/releases/ARCHIVED_SPRINTS.md`](knowledge-base/product/releases/ARCHIVED_SPRINTS.md) | Qesto — Archived Sprints (Historical Reference) | 2026-07-15 | Current |
| [`knowledge-base/product/releases/PHASE4_AUTOMATED_KB_SYNC.md`](knowledge-base/product/releases/PHASE4_AUTOMATED_KB_SYNC.md) | Phase 4: Automated KB Sync CLI | 2026-05-13 | Orphaned |
| [`knowledge-base/product/releases/RELEASE_GUIDE.md`](knowledge-base/product/releases/RELEASE_GUIDE.md) | Release Control Surface | 2026-05-11 | Current |
| [`knowledge-base/product/releases/SPRINT85_EXECUTION.md`](knowledge-base/product/releases/SPRINT85_EXECUTION.md) | Sprint 85 — Execution Summary | 2026-06-11 | Current |
| [`knowledge-base/product/releases/SPRINT86_EXECUTION.md`](knowledge-base/product/releases/SPRINT86_EXECUTION.md) | Sprint 86 — Execution Summary | 2026-06-12 | Orphaned |
| [`knowledge-base/product/releases/SPRINT87_EXECUTION.md`](knowledge-base/product/releases/SPRINT87_EXECUTION.md) | Sprint 87 — Execution Summary | 2026-06-12 | Orphaned |
| [`knowledge-base/product/releases/SPRINT88_EXECUTION.md`](knowledge-base/product/releases/SPRINT88_EXECUTION.md) | Sprint 88 — Execution Summary | 2026-06-13 | Orphaned |
| [`knowledge-base/product/releases/SPRINT89_EXECUTION.md`](knowledge-base/product/releases/SPRINT89_EXECUTION.md) | Sprint 89 — Execution Summary | 2026-06-13 | Current |
| [`knowledge-base/product/releases/SPRINT90_EXECUTION.md`](knowledge-base/product/releases/SPRINT90_EXECUTION.md) | Sprint 90 — Execution Summary | 2026-06-14 | Current |
| [`knowledge-base/product/releases/SPRINT91_EXECUTION.md`](knowledge-base/product/releases/SPRINT91_EXECUTION.md) | Sprint 91 — Execution Summary | 2026-06-15 | Current |
| [`knowledge-base/product/releases/SPRINT92_EXECUTION.md`](knowledge-base/product/releases/SPRINT92_EXECUTION.md) | Sprint 92 — Execution Summary | 2026-06-15 | Current |
| [`knowledge-base/product/releases/SPRINT93_EXECUTION.md`](knowledge-base/product/releases/SPRINT93_EXECUTION.md) | Sprint 93 — Execution Summary | 2026-06-15 | Current |
| [`knowledge-base/product/releases/SPRINT94_EXECUTION.md`](knowledge-base/product/releases/SPRINT94_EXECUTION.md) | Sprint 94 — Execution Summary | 2026-06-17 | Orphaned |
| [`knowledge-base/product/releases/SPRINT95_EXECUTION.md`](knowledge-base/product/releases/SPRINT95_EXECUTION.md) | Sprint 95 — Execution Summary | 2026-06-17 | Current |
| [`knowledge-base/product/releases/SPRINT96_EXECUTION.md`](knowledge-base/product/releases/SPRINT96_EXECUTION.md) | Sprint 96 — Execution Summary | 2026-06-18 | Current |
| [`knowledge-base/product/releases/SPRINT97_EXECUTION.md`](knowledge-base/product/releases/SPRINT97_EXECUTION.md) | Sprint 97 — Execution Plan | 2026-06-18 | Current |
| [`knowledge-base/product/releases/SPRINT98_EXECUTION.md`](knowledge-base/product/releases/SPRINT98_EXECUTION.md) | Sprint 98 — Execution Plan | 2026-06-19 | Current |
| [`knowledge-base/product/releases/SPRINT99_EXECUTION.md`](knowledge-base/product/releases/SPRINT99_EXECUTION.md) | Sprint 99 — Execution Plan | 2026-06-19 | Current |
| [`knowledge-base/product/releases/V2_2_AUDIT_OUTCOMES.md`](knowledge-base/product/releases/V2_2_AUDIT_OUTCOMES.md) | v2.2 Audit Outcomes — LIVE Engagement Release Candidate | 2026-05-20 | Current |
| [`knowledge-base/product/releases/V2_2_ROLLOUT_PLAN.md`](knowledge-base/product/releases/V2_2_ROLLOUT_PLAN.md) | v2.2 LIVE Engagement Rollout Plan | 2026-05-20 | Current |
| [`knowledge-base/product/releases/v0.1.0-INTERNAL.md`](knowledge-base/product/releases/v0.1.0-INTERNAL.md) | Qesto v0.1.0 — Internal Stakeholder Brief | 2026-05-11 | Current |
| [`knowledge-base/product/releases/v0.1.0.md`](knowledge-base/product/releases/v0.1.0.md) | Qesto v0.1.0 Release Notes | 2026-05-11 | Current |
| [`knowledge-base/product/releases/v2.2.0-RC.md`](knowledge-base/product/releases/v2.2.0-RC.md) | v2.2.0 Release Candidate | 2026-05-22 | Orphaned |
| [`knowledge-base/product/releases/v2.4.0-RC.md`](knowledge-base/product/releases/v2.4.0-RC.md) | v2.4.0 Release Candidate | 2026-05-23 | Current |
| [`knowledge-base/product/releases/v2.5.0.md`](knowledge-base/product/releases/v2.5.0.md) | v2.5.0 — Enterprise Integrations + Platform API | 2026-05-23 | Orphaned |
| [`knowledge-base/product/releases/v2.6.0-RC.md`](knowledge-base/product/releases/v2.6.0-RC.md) | v2.6.0 Release Candidate | 2026-05-24 | Current |
| [`knowledge-base/product/releases/v2.6.0.md`](knowledge-base/product/releases/v2.6.0.md) | v2.6.0 — Developer Platform (preview) | 2026-05-23 | Orphaned |
| [`knowledge-base/product/releases/v3.0.0-RC.md`](knowledge-base/product/releases/v3.0.0-RC.md) | v3.0.0 Release Candidate | 2026-05-24 | Current |
| [`knowledge-base/product/releases/v3.1.0.md`](knowledge-base/product/releases/v3.1.0.md) | v3.1.0 — Obsidian KB + Multi-Region Write + LDAP (S51–S52) | 2026-05-27 | Orphaned |
| [`knowledge-base/product/releases/v3.2.0.md`](knowledge-base/product/releases/v3.2.0.md) | v3.2.0 — Integrations + LDAP Maturity | 2026-05-27 | Current |
| [`knowledge-base/product/releases/v3.3.0.md`](knowledge-base/product/releases/v3.3.0.md) | v3.3.0 — Tournaments + AI Coaching Maturity (S55–S57) | 2026-05-27 | Orphaned |
| [`knowledge-base/product/releases/v3.4.0.md`](knowledge-base/product/releases/v3.4.0.md) | v3.4.0 — SOC 2 Type II + Partner GTM (S58–S59) | 2026-05-27 | Orphaned |
| [`knowledge-base/product/releases/v3.5.0.md`](knowledge-base/product/releases/v3.5.0.md) | v3.5.0 — Multi-Tenant AI + Moat Complete (S60) | 2026-05-27 | Current |
| [`knowledge-base/product/releases/v4.0.0-rc.md`](knowledge-base/product/releases/v4.0.0-rc.md) | v4.0.0-rc.1 — Platform RC (Sprint 69) | 2026-05-25 | Orphaned |
| [`knowledge-base/product/releases/v4.0.0.md`](knowledge-base/product/releases/v4.0.0.md) | v4.0.0 — Platform GA (Sprint 70) | 2026-05-25 | Current |
| [`knowledge-base/product/releases/v5.0.0.md`](knowledge-base/product/releases/v5.0.0.md) | v5.0.0 GA | 2026-05-28 | Current |
| [`knowledge-base/product/releases/v5.1.0-rc.md`](knowledge-base/product/releases/v5.1.0-rc.md) | v5.1.0 Release Candidate | 2026-06-04 | Current |
| [`knowledge-base/product/releases/v5.1.0.md`](knowledge-base/product/releases/v5.1.0.md) | v5.1.0 — GA Release | 2026-06-04 | Current |
| [`knowledge-base/product/releases/v5.2.0-rc.md`](knowledge-base/product/releases/v5.2.0-rc.md) | v5.2.0-rc.1 — Release Candidate | 2026-06-12 | Current |
| [`knowledge-base/product/releases/v6.0.0-rc.md`](knowledge-base/product/releases/v6.0.0-rc.md) | v6.0.0-rc.1 — Release Candidate | 2026-06-13 | Current |
| [`knowledge-base/product/releases/v6.0.0.md`](knowledge-base/product/releases/v6.0.0.md) | v6.0.0 — GA | 2026-06-14 | Current |
| [`knowledge-base/product/releases/v7.0.0-rc.md`](knowledge-base/product/releases/v7.0.0-rc.md) | v7.0.0-rc.1 — Release Candidate | 2026-06-18 | Current |
| [`knowledge-base/product/releases/v7.0.0.md`](knowledge-base/product/releases/v7.0.0.md) | v7.0.0 GA — Engagement Intelligence Network | 2026-06-19 | Current |
| [`knowledge-base/product/research/COMPETITOR_PROFILES.md`](knowledge-base/product/research/COMPETITOR_PROFILES.md) | Competitive Profiles | 2026-06-19 | Current |
| [`knowledge-base/product/research/CUSTOMER_PAIN_POINTS.md`](knowledge-base/product/research/CUSTOMER_PAIN_POINTS.md) | Customer Pain Points & Unmet Needs | 2026-05-19 | Current |
| [`knowledge-base/product/research/MARKET_PULSE_INTEGRATION_2026-05-19.md`](knowledge-base/product/research/MARKET_PULSE_INTEGRATION_2026-05-19.md) | Market Pulse → Backlog Integration Log | 2026-05-25 | Current |
| [`knowledge-base/product/research/MARKET_TRENDS.md`](knowledge-base/product/research/MARKET_TRENDS.md) | Market Trends & Industry Analysis | 2026-05-19 | Current |
| [`knowledge-base/product/research/MARKET_VALIDATION_S81_90.md`](knowledge-base/product/research/MARKET_VALIDATION_S81_90.md) | Market Validation — Sprint 81–90 Arc (post-v5.0 → v6.0 GA) | 2026-06-01 | Current |
| [`knowledge-base/product/research/MARKET_VALIDATION_S85_99.md`](knowledge-base/product/research/MARKET_VALIDATION_S85_99.md) | Market Validation — Sprint 85–99 Arc (v5.1 GA → v7.0 horizon) | 2026-06-11 | Current |
| [`knowledge-base/product/research/README.md`](knowledge-base/product/research/README.md) | Market Research Repository | 2026-05-19 | Current |
| [`knowledge-base/product/research/WEEKLY_MARKET_PULSE.md`](knowledge-base/product/research/WEEKLY_MARKET_PULSE.md) | Weekly Market Pulse | 2026-05-25 | Current |
| [`knowledge-base/product/research/WIN_LOSS_ANALYSIS.md`](knowledge-base/product/research/WIN_LOSS_ANALYSIS.md) | Win/Loss Analysis | 2026-05-19 | Current |
| [`knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md`](knowledge-base/product/research/XR_DESIGN_PARTNER_VALIDATION.md) | XR Demand Validation — Design-Partner Spike (XR-00, S98) | 2026-06-18 | Current |
| [`knowledge-base/product/roadmap/EPIC_ROADMAP_V2.2.md`](knowledge-base/product/roadmap/EPIC_ROADMAP_V2.2.md) | Qesto v2.2 Epic Roadmap (Agent-Validated) | 2026-07-16 | Current |
| [`knowledge-base/product/roadmap/ROADMAP_FULL.md`](knowledge-base/product/roadmap/ROADMAP_FULL.md) | Qesto — Roadmap & Release Status (Current) | 2026-07-15 | Current |
| [`knowledge-base/product/strategy/COMPETITIVE_EPICS.md`](knowledge-base/product/strategy/COMPETITIVE_EPICS.md) | Qesto — Competitive "New-Business" Epics (Ideation) | 2026-05-29 | Current |
| [`knowledge-base/specifications/README.md`](knowledge-base/specifications/README.md) | Domain Specifications & Contracts | 2026-05-11 | Current |
| [`knowledge-base/specifications/SPEC.md`](knowledge-base/specifications/SPEC.md) | Qesto — Product specification (stub) | 2026-05-11 | Orphaned |
| [`knowledge-base/specifications/SPEC_INDEX.md`](knowledge-base/specifications/SPEC_INDEX.md) | Qesto Specification Documents — Complete Reference | 2026-07-07 | Current |
| [`knowledge-base/specifications/features/DESIGN_SPEC_TRIAL_ACTIVATION.md`](knowledge-base/specifications/features/DESIGN_SPEC_TRIAL_ACTIVATION.md) | Design Spec: Trial Activation Flow Redesign | 2026-06-17 | Current |
| [`knowledge-base/specifications/product/SPEC_PRODUCT.md`](knowledge-base/specifications/product/SPEC_PRODUCT.md) | Qesto — Product Specification (Current) | 2026-06-19 | Current |
| [`knowledge-base/specifications/product/WEBSITE_DESIGN_SPEC.md`](knowledge-base/specifications/product/WEBSITE_DESIGN_SPEC.md) | Qesto — Website Design Spec | 2026-07-07 | Current |

## Marketing & Growth

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`knowledge-base/marketing/ACCESSIBILITY_MULTILINGUAL_POSITIONING.md`](knowledge-base/marketing/ACCESSIBILITY_MULTILINGUAL_POSITIONING.md) | Accessibility & Multilingual Positioning — Sprint 88 | 2026-06-17 | Current |
| [`knowledge-base/marketing/CAPTIONS_LAUNCH_BRIEF.md`](knowledge-base/marketing/CAPTIONS_LAUNCH_BRIEF.md) | Live Captions & Translation — Launch Brief (Sprint 88) | 2026-06-17 | Current |
| [`knowledge-base/marketing/CONVERSION_REVIEW_LANDING_PRICING.md`](knowledge-base/marketing/CONVERSION_REVIEW_LANDING_PRICING.md) | Conversie-review — Landing (Home), Pricing & Login | 2026-06-20 | Current |
| [`knowledge-base/marketing/EMBED_HUB_CONTENT.md`](knowledge-base/marketing/EMBED_HUB_CONTENT.md) | EMBED Hub Page Content — Sprint 87 | 2026-06-17 | Current |
| [`knowledge-base/marketing/EMBED_ICP_AND_POSITIONING.md`](knowledge-base/marketing/EMBED_ICP_AND_POSITIONING.md) | EMBED ICP & Positioning — Sprint 87 | 2026-06-12 | Current |
| [`knowledge-base/marketing/MKTG_V3_LAUNCH_PACK.md`](knowledge-base/marketing/MKTG_V3_LAUNCH_PACK.md) | v3.0 Launch Marketing Pack | 2026-05-24 | Current |
| [`knowledge-base/marketing/MKTG_V70_GA_ANNOUNCEMENT.md`](knowledge-base/marketing/MKTG_V70_GA_ANNOUNCEMENT.md) | v7.0 GA Announcement Copy (Draft) | 2026-06-19 | Current |
| [`knowledge-base/marketing/seo/CURSOR_SEO_AGENTS.md`](knowledge-base/marketing/seo/CURSOR_SEO_AGENTS.md) | claude-seo in Cursor — Qesto integration | 2026-09-01 | Current |
| [`knowledge-base/marketing/seo/README.md`](knowledge-base/marketing/seo/README.md) | SEO operations | 2026-09-01 | Current |
| [`knowledge-base/marketing/seo/SEO_IMPLEMENTATION_COMPLETE.md`](knowledge-base/marketing/seo/SEO_IMPLEMENTATION_COMPLETE.md) | Qesto SEO Implementation — Phase 1 & 2 Complete ✅ | 2026-06-01 | Current |
| [`knowledge-base/product/growth-engine/GROWTH_ENGINE_COMPLETE.md`](knowledge-base/product/growth-engine/GROWTH_ENGINE_COMPLETE.md) | Qesto Growth Engine — Sprint 1 Complete ✅ | 2026-06-01 | Current |
| [`knowledge-base/product/growth-engine/GROWTH_ENGINE_PHASE4_TESTING.md`](knowledge-base/product/growth-engine/GROWTH_ENGINE_PHASE4_TESTING.md) | Growth Engine Phase 4: E2E Testing Checklist | 2026-06-01 | Current |
| [`knowledge-base/product/growth-engine/GROWTH_ENGINE_SETUP_STATUS.md`](knowledge-base/product/growth-engine/GROWTH_ENGINE_SETUP_STATUS.md) | Growth Engine Sprint 1 — Setup Status & Next Steps | 2026-07-16 | Current |
| [`knowledge-base/product/growth-engine/PROVISIONING_GROWTH_ENGINE.md`](knowledge-base/product/growth-engine/PROVISIONING_GROWTH_ENGINE.md) | Growth Engine Sprint 1 — Provisioning & E2E Testing Guide | 2026-07-16 | Current |
| [`knowledge-base/product/growth-engine/README.md`](knowledge-base/product/growth-engine/README.md) | Growth engine (template gallery) | 2026-06-01 | Current |
| [`knowledge-base/product/marketing/COMPETITIVE_MOAT_V35.md`](knowledge-base/product/marketing/COMPETITIVE_MOAT_V35.md) | Competitive Moat — v3.5 (S60) | 2026-05-27 | Current |
| [`knowledge-base/product/marketing/MARKETING_SPRINTS_71_80.md`](knowledge-base/product/marketing/MARKETING_SPRINTS_71_80.md) | Qesto — Marketing Sprint Track S71–S80 (10-Sprint Horizon) | 2026-05-27 | Current |
| [`knowledge-base/product/marketing/MARKETING_SPRINTS_81_90.md`](knowledge-base/product/marketing/MARKETING_SPRINTS_81_90.md) | Qesto — Marketing Sprint Track S81–S90 (10-Sprint Horizon) | 2026-06-13 | Current |
| [`knowledge-base/product/partners/PARTNER_TIERS.md`](knowledge-base/product/partners/PARTNER_TIERS.md) | Partner Tiers (v3.0) | 2026-05-24 | Current |
| [`knowledge-base/product/sales/VEVOX_COMPARISON.md`](knowledge-base/product/sales/VEVOX_COMPARISON.md) | Qesto vs Vevox — Anonymous Engagement (Sales Brief) | 2026-05-23 | Current |
| [`knowledge-base/quality/audits/MARKETING_TEMPLATE_PIPELINE_AUDIT_2026-07-12.md`](knowledge-base/quality/audits/MARKETING_TEMPLATE_PIPELINE_AUDIT_2026-07-12.md) | Marketing Template Pipeline Audit — 2026-07-12 | 2026-07-15 | Current |
| [`tests/e2e/marketing/MARKETING_DEMO_SCRIPT.md`](tests/e2e/marketing/MARKETING_DEMO_SCRIPT.md) | Qesto marketing demo — Playwright script | 2026-06-25 | Orphaned |
| [`workers/linkedin-scheduler/README.md`](workers/linkedin-scheduler/README.md) | Qesto LinkedIn Auto-Posting | 2026-06-17 | Current |

## Compliance & Legal

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`.github/SECURITY.md`](.github/SECURITY.md) | Security Policy | 2026-07-19 | Current |
| [`.github/SECURITY_INCIDENT.md`](.github/SECURITY_INCIDENT.md) | Security Incident: JWT Token Exposure | 2026-07-19 | Current |
| [`knowledge-base/compliance/DSA_COMPLIANCE_AUDIT_2026.md`](knowledge-base/compliance/DSA_COMPLIANCE_AUDIT_2026.md) | DSA Compliance Audit — Qesto | 2026-07-01 | Current |
| [`knowledge-base/compliance/NOTICE_AND_ACTION_SOP.md`](knowledge-base/compliance/NOTICE_AND_ACTION_SOP.md) | Notice and Action — Standard Operating Procedure | 2026-07-01 | Current |
| [`knowledge-base/help/privacy-gdpr.md`](knowledge-base/help/privacy-gdpr.md) | Privacy, GDPR, and Data Rights | 2026-07-02 | Current |
| [`knowledge-base/operations/compliance/SOC2_TYPE1_STATUS.md`](knowledge-base/operations/compliance/SOC2_TYPE1_STATUS.md) | SOC 2 Type I — Status (Sprint 42) | 2026-05-24 | Current |
| [`knowledge-base/operations/compliance/SOC2_TYPE2_ROADMAP.md`](knowledge-base/operations/compliance/SOC2_TYPE2_ROADMAP.md) | SOC 2 Type II Roadmap (Sprint 47) | 2026-05-24 | Current |
| [`knowledge-base/security/COMPLIANCE-03_TYPE1_AUDIT.md`](knowledge-base/security/COMPLIANCE-03_TYPE1_AUDIT.md) | SOC 2 Type I Audit — Engagement Plan (COMPLIANCE-03) | 2026-05-23 | Current |
| [`knowledge-base/security/COMPLIANCE-04_PENTEST_READINESS.md`](knowledge-base/security/COMPLIANCE-04_PENTEST_READINESS.md) | Penetration Test Readiness (COMPLIANCE-04) | 2026-05-23 | Orphaned |
| [`knowledge-base/security/DPA_SCC_TEMPLATE.md`](knowledge-base/security/DPA_SCC_TEMPLATE.md) | Data Processing Agreement (Template) | 2026-05-23 | Current |
| [`knowledge-base/security/EU_DATA_RESIDENCY.md`](knowledge-base/security/EU_DATA_RESIDENCY.md) | EU Data Residency Evidence (ENT-RESIDENCY-01) | 2026-05-23 | Current |
| [`knowledge-base/security/FEDRAMP_ATO_FULL_PATH.md`](knowledge-base/security/FEDRAMP_ATO_FULL_PATH.md) | FedRAMP Moderate — Full ATO Path (FEDRAMP-ATO-FULL-01) | 2026-06-13 | Current |
| [`knowledge-base/security/GDPR_DATA_SUBJECT_RUNBOOK.md`](knowledge-base/security/GDPR_DATA_SUBJECT_RUNBOOK.md) | GDPR Data Subject Request Runbook | 2026-06-21 | Current |
| [`knowledge-base/security/JANURAI_REVERIFY_2026_06_19.md`](knowledge-base/security/JANURAI_REVERIFY_2026_06_19.md) | Jankurai CRITICAL Re-Verification — 2026-06-19 | 2026-06-19 | Current |
| [`knowledge-base/security/PLATFORM_CERTIFICATION_V6.md`](knowledge-base/security/PLATFORM_CERTIFICATION_V6.md) | Qesto v6.0 — Platform Certification Bundle | 2026-06-14 | Current |
| [`knowledge-base/security/PLATFORM_CERTIFICATION_V7.md`](knowledge-base/security/PLATFORM_CERTIFICATION_V7.md) | Qesto v7.0 — Platform Certification Bundle | 2026-06-19 | Current |
| [`knowledge-base/security/QA_CONNECT_SCALE_01_EVIDENCE.md`](knowledge-base/security/QA_CONNECT_SCALE_01_EVIDENCE.md) | QA-CONNECT-SCALE-01 Evidence (S97) | 2026-06-18 | Orphaned |
| [`knowledge-base/security/README.md`](knowledge-base/security/README.md) | Security & Compliance | 2026-05-11 | Current |
| [`knowledge-base/security/SECRET_ROTATION_POLICY.md`](knowledge-base/security/SECRET_ROTATION_POLICY.md) | Secret Rotation Policy (Sprint 18 - ID 24) | 2026-05-11 | Current |
| [`knowledge-base/security/SECURITY_FULL.md`](knowledge-base/security/SECURITY_FULL.md) | Qesto — Security & Privacy Baseline (Current) | 2026-05-11 | Current |
| [`knowledge-base/security/SEC_PEN5_01_RESULTS.md`](knowledge-base/security/SEC_PEN5_01_RESULTS.md) | SEC-PEN5-01 — Pentest #5 Results (Governance + Embed + Agent) | 2026-06-13 | Current |
| [`knowledge-base/security/SEC_V60_RC_GATE.md`](knowledge-base/security/SEC_V60_RC_GATE.md) | SEC-V6.0-RC — Release-Candidate Security Sign-off | 2026-06-14 | Current |
| [`knowledge-base/security/SOC2_ANNUAL_EVIDENCE_2026.md`](knowledge-base/security/SOC2_ANNUAL_EVIDENCE_2026.md) | SOC 2 Annual Evidence Refresh — v6.0 Cycle (2026) | 2026-06-13 | Current |
| [`knowledge-base/security/SOC2_EVIDENCE.md`](knowledge-base/security/SOC2_EVIDENCE.md) | Qesto SOC 2 Evidence Framework | 2026-06-21 | Current |
| [`knowledge-base/security/SOC2_TYPE_II_EVIDENCE/README.md`](knowledge-base/security/SOC2_TYPE_II_EVIDENCE/README.md) | SOC 2 Type II Evidence Pack (S58–S59) | 2026-05-27 | Current |
| [`knowledge-base/security/ZERO_KNOWLEDGE_PROOF.md`](knowledge-base/security/ZERO_KNOWLEDGE_PROOF.md) | Zero-Knowledge Mode — Technical Proof | 2026-05-23 | Current |

## Audit Prompts / Claude Code Playbooks

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`.claude/QA_CHECKLIST.md`](.claude/QA_CHECKLIST.md) | QACHECKLIST — Unified Quality Gates | 2026-05-11 | Current |
| [`.claude/README.md`](.claude/README.md) | Qesto — Claude Code Configuration (.claude/) | 2026-09-01 | Current |
| [`.claude/agents/ai-engineer-agent.md`](.claude/agents/ai-engineer-agent.md) | AI/GenAI engineer for Qesto. Owns AI implementation quality on Workers AI — prompt design, RAG/retrieval pipelines (embe | 2026-06-05 | Current |
| [`.claude/agents/ai-strategy-agent.md`](.claude/agents/ai-strategy-agent.md) | AI Strategy Advisor for Qesto. Evaluates AI features using the AI-first vs AI-shaped framework and 5-competency maturity | 2026-06-19 | Current |
| [`.claude/agents/analytics-agent.md`](.claude/agents/analytics-agent.md) | Data and analytics engineer for Qesto. Queries Cloudflare Analytics Engine, interprets platform metrics, validates obser | 2026-06-01 | Current |
| [`.claude/agents/architect-agent.md`](.claude/agents/architect-agent.md) | Lead architect for Qesto. Designs systems, produces ADRs, API contracts, and data model changes. Invoke for system desig | 2026-05-04 | Current |
| [`.claude/agents/backend-agent.md`](.claude/agents/backend-agent.md) | Senior backend developer for Qesto. Implements Hono API routes, KV/D1 patterns, Durable Objects, and external integratio | 2026-06-05 | Current |
| [`.claude/agents/cso-agent.md`](.claude/agents/cso-agent.md) | Security reviewer for Qesto. Runs OWASP Top 10 + STRIDE audits, triages vulnerabilities, and blocks releases on critical | 2026-06-19 | Current |
| [`.claude/agents/devops-agent.md`](.claude/agents/devops-agent.md) | Full deploy | 2026-06-05 | Current |
| [`.claude/agents/e2e-tester-agent.md`](.claude/agents/e2e-tester-agent.md) | E2E, load, stress, and a11y test engineer for Qesto. Owns Playwright end-to-end specs, k6 load/smoke scenarios, Vitest-b | 2026-06-09 | Current |
| [`.claude/agents/frontend-agent.md`](.claude/agents/frontend-agent.md) | Senior frontend developer for Qesto. Implements React 19/TypeScript UI, WebSocket real-time state, and Tailwind CSS v4 s | 2026-06-01 | Current |
| [`.claude/agents/i18n-agent.md`](.claude/agents/i18n-agent.md) | i18n engineer for Qesto. Manages translation infrastructure, JSON namespace files, key extraction pipeline, and language | 2026-06-01 | Current |
| [`.claude/agents/knowledge-agent.md`](.claude/agents/knowledge-agent.md) | Knowledge steward for Qesto. Owns knowledge-base integrity, business-requirement capture and traceability, the cross-rol | 2026-06-05 | Current |
| [`.claude/agents/market-research-agent.md`](.claude/agents/market-research-agent.md) | Holistic market intelligence (competitors, customers, trends) with strategic recommendations. Works with PO via on-deman | 2026-06-04 | Current |
| [`.claude/agents/marketing-agent.md`](.claude/agents/marketing-agent.md) | Verify all [CITATION NEEDED] tags are resolved | 2026-06-19 | Current |
| [`.claude/agents/po-agent.md`](.claude/agents/po-agent.md) | Product Owner for Qesto. Writes user stories, acceptance criteria, and manages backlog prioritization. Invoke when groom | 2026-06-19 | Current |
| [`.claude/agents/sales-agent.md`](.claude/agents/sales-agent.md) | Sales lead for Qesto. Runs the deal cycle — outbound prospecting, discovery, qualification (MEDDICC), demo scripts, obje | 2026-06-04 | Current |
| [`.claude/agents/seo-audit-agent.md`](.claude/agents/seo-audit-agent.md) | Orchestrates claude-seo full-site and single-command SEO audits for Qesto in Cursor. Runs parallel specialist agents (te | 2026-09-01 | Current |
| [`.claude/agents/seo-competitor-pages-agent.md`](.claude/agents/seo-competitor-pages-agent.md) | Competitor comparison page SEO specialist for Qesto in Cursor. Plans and audits /vs/[competitor] pages, keyword intent,  | 2026-09-01 | Current |
| [`.claude/agents/seo-content-agent.md`](.claude/agents/seo-content-agent.md) | Content and E-E-A-T SEO specialist for Qesto in Cursor. Search intent fit, on-page quality, heading hierarchy, keyword c | 2026-09-01 | Current |
| [`.claude/agents/seo-geo-agent.md`](.claude/agents/seo-geo-agent.md) | Generative Engine Optimization specialist for Qesto in Cursor. AI Overviews citability, passage structure, question-base | 2026-09-01 | Current |
| [`.claude/agents/seo-reviewer-agent.md`](.claude/agents/seo-reviewer-agent.md) | Senior SEO reviewer for Qesto. Audits crawlability, indexability, technical/on-page SEO, content↔search-intent fit, inte | 2026-09-01 | Current |
| [`.claude/agents/seo-schema-agent.md`](.claude/agents/seo-schema-agent.md) | Schema.org specialist for Qesto SEO audits in Cursor. Detect, validate, and recommend JSON-LD (SoftwareApplication, Brea | 2026-09-01 | Current |
| [`.claude/agents/seo-sitemap-agent.md`](.claude/agents/seo-sitemap-agent.md) | XML sitemap and robots.txt specialist for Qesto in Cursor. Validates static and dynamic sitemaps, IndexNow, crawl direct | 2026-09-01 | Current |
| [`.claude/agents/seo-technical-agent.md`](.claude/agents/seo-technical-agent.md) | Technical SEO specialist for Qesto audits in Cursor. Crawlability, indexability, canonicals, robots/sitemaps, security h | 2026-09-01 | Current |
| [`.claude/agents/tester-agent.md`](.claude/agents/tester-agent.md) | QA lead for Qesto. Writes Vitest unit and integration tests, maps acceptance criteria to test cases, and verifies covera | 2026-06-04 | Current |
| [`.claude/context-preservation.md`](.claude/context-preservation.md) | Agent Context Preservation — Qesto | 2026-06-19 | Current |
| [`.claude/skills/COMMON_RULES.md`](.claude/skills/COMMON_RULES.md) | COMMONRULES — Qesto Agent & Skill Global Invariants | 2026-06-26 | Current |
| [`.claude/skills/HANDOFFS.md`](.claude/skills/HANDOFFS.md) | HANDOFFS — Qesto Agent & Skill Edge Ownership Map | 2026-09-01 | Current |
| [`.claude/skills/OWNERS.md`](.claude/skills/OWNERS.md) | Prompt Asset Ownership Matrix | 2026-09-01 | Current |
| [`.claude/skills/ai-engineering.md`](.claude/skills/ai-engineering.md) | Skill: AI Engineering | 2026-06-05 | Current |
| [`.claude/skills/ai-strategy.md`](.claude/skills/ai-strategy.md) | Evaluates Qesto AI features using the AI-first vs AI-shaped framework and 5-competency maturity model. Use when planning | 2026-06-01 | Current |
| [`.claude/skills/analytics.md`](.claude/skills/analytics.md) | Queries Cloudflare Analytics Engine and interprets Qesto platform metrics, conversion funnels, and observability instrum | 2026-06-01 | Current |
| [`.claude/skills/architect.md`](.claude/skills/architect.md) | [Decision Title] | 2026-06-19 | Current |
| [`.claude/skills/backend-dev.md`](.claude/skills/backend-dev.md) | Skill: Backend Development | 2026-06-04 | Current |
| [`.claude/skills/backend-integrations.md`](.claude/skills/backend-integrations.md) | External integration patterns for Qesto backend: Stripe webhooks, Workers AI, Resend email, Vectorize, and meeting platf | 2026-06-05 | Current |
| [`.claude/skills/backend-perf.md`](.claude/skills/backend-perf.md) | Performance budgets, latency targets, and optimization patterns for the Qesto backend. Use when reviewing performance im | 2026-05-04 | Current |
| [`.claude/skills/cso.md`](.claude/skills/cso.md) | Skill: Security Review (CSO) | 2026-06-19 | Current |
| [`.claude/skills/devops.md`](.claude/skills/devops.md) | Full deploy | 2026-06-05 | Current |
| [`.claude/skills/e2e-tester.md`](.claude/skills/e2e-tester.md) | Skill: E2E, Load, Stress & A11y Testing | 2026-06-09 | Current |
| [`.claude/skills/frontend-dev.md`](.claude/skills/frontend-dev.md) | Skill: Frontend Development | 2026-06-01 | Current |
| [`.claude/skills/i18n.md`](.claude/skills/i18n.md) | 2. Rename hash-keyed strings → semantic paths (formatjs generates hashes for inline JSX) | 2026-06-19 | Current |
| [`.claude/skills/investigate.md`](.claude/skills/investigate.md) | Skill: Investigating Bugs | 2026-05-11 | Current |
| [`.claude/skills/knowledge.md`](.claude/skills/knowledge.md) | Skill: Knowledge Steward | 2026-06-05 | Current |
| [`.claude/skills/market-research-templates.md`](.claude/skills/market-research-templates.md) | Skill: Market Research Output Templates | 2026-06-04 | Current |
| [`.claude/skills/market-research.md`](.claude/skills/market-research.md) | VERSION: v2.0.0 | 2026-06-04 | Current |
| [`.claude/skills/marketing.md`](.claude/skills/marketing.md) | VERSION: v2.0.0 | 2026-06-20 | Current |
| [`.claude/skills/product-owner.md`](.claude/skills/product-owner.md) | Writes user stories, acceptance criteria, and manages backlog prioritization for Qesto. Use when grooming stories, writi | 2026-06-19 | Current |
| [`.claude/skills/release-notes.md`](.claude/skills/release-notes.md) | Skill: Release Notes Generation | 2026-06-19 | Current |
| [`.claude/skills/review.md`](.claude/skills/review.md) | Skill: Code Review | 2026-05-11 | Current |
| [`.claude/skills/sales.md`](.claude/skills/sales.md) | Skill: Sales & Deal Cycle | 2026-06-04 | Current |
| [`.claude/skills/seo-audit.md`](.claude/skills/seo-audit.md) | Skill: SEO Audit Orchestrator (Cursor + claude-seo) | 2026-09-01 | Current |
| [`.claude/skills/seo-reviewer.md`](.claude/skills/seo-reviewer.md) | Skill: SEO Review | 2026-09-01 | Current |
| [`.claude/skills/tester.md`](.claude/skills/tester.md) | Skill: Testing & Quality | 2026-06-22 | Current |
| [`.github/agents/agentic-workflows.md`](.github/agents/agentic-workflows.md) | GitHub Agentic Workflows Agent | 2026-06-19 | Current |
| [`.github/skills/agentic-workflow-designer/SKILL.md`](.github/skills/agentic-workflow-designer/SKILL.md) | Workflow Designer | 2026-06-19 | Current |
| [`.github/skills/agentic-workflows/SKILL.md`](.github/skills/agentic-workflows/SKILL.md) | Agentic Workflows Router | 2026-06-19 | Current |
| [`knowledge-base/security/SEC_STUDIO_PROMPT_01_REVIEW.md`](knowledge-base/security/SEC_STUDIO_PROMPT_01_REVIEW.md) | SEC-STUDIO-PROMPT-01 — STUDIO Authoring Co-pilot Prompt-Injection Hardening Review | 2026-06-18 | Orphaned |

## Operations & DevOps

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`.github/workflows/daily-repo-status.md`](.github/workflows/daily-repo-status.md) | Weekly (Mondays), not daily, to cut Actions-minute burn. Run on demand any | 2026-07-19 | Current |
| [`docs/branch-protection.md`](docs/branch-protection.md) | Branch protection — required checks | 2026-08-25 | Current |
| [`docs/ci-local.md`](docs/ci-local.md) | Local CI parity | 2026-06-19 | Current |
| [`docs/refactoring-deferred-issues.md`](docs/refactoring-deferred-issues.md) | Deferred Refactoring Issues — Ready to File | 2026-07-02 | Current |
| [`docs/release.md`](docs/release.md) | Release process | 2026-06-06 | Current |
| [`docs/testing.md`](docs/testing.md) | Testing and proof lanes | 2026-06-06 | Current |
| [`knowledge-base/metadata/DECISION_DOC_TEMPLATE.md`](knowledge-base/metadata/DECISION_DOC_TEMPLATE.md) | Decision Doc Template | 2026-05-11 | Current |
| [`knowledge-base/metadata/MIGRATION_CHECKLIST.md`](knowledge-base/metadata/MIGRATION_CHECKLIST.md) | Knowledge Base Migration - Final Checklist | 2026-05-11 | Current |
| [`knowledge-base/metadata/README.md`](knowledge-base/metadata/README.md) | Metadata, Schemas & Supporting Docs | 2026-05-11 | Current |
| [`knowledge-base/metadata/YAML_ROLLOUT_PLAN.md`](knowledge-base/metadata/YAML_ROLLOUT_PLAN.md) | YAML Frontmatter Rollout Plan | 2026-05-11 | Current |
| [`knowledge-base/metadata/decisions/2026-04-24-sessions-team-id-analytics.md`](knowledge-base/metadata/decisions/2026-04-24-sessions-team-id-analytics.md) | ADR-lite: Add teamid to sessions table for analytics attribution | 2026-05-11 | Orphaned |
| [`knowledge-base/metadata/migration/BACKLOG_ITEMS_WEEK1.md`](knowledge-base/metadata/migration/BACKLOG_ITEMS_WEEK1.md) | Backlog Items: Knowledge-Base Migration Follow-up | 2026-05-11 | Orphaned |
| [`knowledge-base/metadata/migration/MIGRATION_MAP.md`](knowledge-base/metadata/migration/MIGRATION_MAP.md) | Migration Mapping: Old Path → New Path | 2026-06-05 | Current |
| [`knowledge-base/metadata/migration/MIGRATION_SUMMARY.md`](knowledge-base/metadata/migration/MIGRATION_SUMMARY.md) | Knowledge Base Migration Summary | 2026-06-05 | Current |
| [`knowledge-base/metadata/migration/PHASE1_ADR_YAML_REPORT.md`](knowledge-base/metadata/migration/PHASE1_ADR_YAML_REPORT.md) | YAML Frontmatter Phase 1 Report: ADRs | 2026-05-11 | Orphaned |
| [`knowledge-base/metadata/migration/PHASE1_EXECUTION_SUMMARY.md`](knowledge-base/metadata/migration/PHASE1_EXECUTION_SUMMARY.md) | Phase 1 Execution Summary: Dry-Run Validation Complete | 2026-05-12 | Orphaned |
| [`knowledge-base/metadata/migration/PHASE1_FINAL_GUIDE.md`](knowledge-base/metadata/migration/PHASE1_FINAL_GUIDE.md) | Phase 1 Completion Guide: Knowledge-Base Vector Sync | 2026-05-12 | Current |
| [`knowledge-base/metadata/migration/PHASE1_KB_VECTOR_FOUNDATION.md`](knowledge-base/metadata/migration/PHASE1_KB_VECTOR_FOUNDATION.md) | Phase 1: Knowledge-Base Vector Pipeline Foundation | 2026-05-12 | Orphaned |
| [`knowledge-base/metadata/migration/PHASE2_SPEC_YAML_REPORT.md`](knowledge-base/metadata/migration/PHASE2_SPEC_YAML_REPORT.md) | YAML Frontmatter Phase 2 Report: Specifications | 2026-05-11 | Orphaned |
| [`knowledge-base/metadata/migration/PHASE3_REMAINING_YAML_REPORT.md`](knowledge-base/metadata/migration/PHASE3_REMAINING_YAML_REPORT.md) | YAML Frontmatter Phase 3 Report: Remaining Documents | 2026-05-11 | Orphaned |
| [`knowledge-base/metadata/migration/PHASE_SUMMARY_DEPLOYMENT.md`](knowledge-base/metadata/migration/PHASE_SUMMARY_DEPLOYMENT.md) | Knowledge-Base Vector Pipeline: Deployment Summary | 2026-05-12 | Current |
| [`knowledge-base/metadata/migration/WEEK1_INTEGRATION_SUMMARY.md`](knowledge-base/metadata/migration/WEEK1_INTEGRATION_SUMMARY.md) | Week 1 Integration Summary | 2026-05-11 | Current |
| [`knowledge-base/metadata/reports/i18n-gap-inventory.md`](knowledge-base/metadata/reports/i18n-gap-inventory.md) | i18n Gap Inventory | 2026-05-11 | Orphaned |
| [`knowledge-base/metadata/spec-includes/PREBUILD_AND_DELIVERY.md`](knowledge-base/metadata/spec-includes/PREBUILD_AND_DELIVERY.md) | PREBUILDANDDELIVERY — Scope, gates, sequencing (canonical include) | 2026-05-11 | Current |
| [`knowledge-base/operations/ADR0073_WS0_WS1_EVIDENCE.md`](knowledge-base/operations/ADR0073_WS0_WS1_EVIDENCE.md) | ADR-0073 — WS-0 + WS-1 closeout evidence | 2026-08-08 | Current |
| [`knowledge-base/operations/ADR0073_WS1B_WS2_EVIDENCE.md`](knowledge-base/operations/ADR0073_WS1B_WS2_EVIDENCE.md) | ADR-0073 — WS-1b + WS-2 closeout evidence | 2026-08-08 | Current |
| [`knowledge-base/operations/ADR0073_WS3_WS5_AUDIT.md`](knowledge-base/operations/ADR0073_WS3_WS5_AUDIT.md) | ADR-0073 — WS-3 / WS-4 / WS-5 execution + senior audit | 2026-08-08 | Current |
| [`knowledge-base/operations/CI_RUNNER_STATUS_2026_06_19.md`](knowledge-base/operations/CI_RUNNER_STATUS_2026_06_19.md) | CI Runner Status — 2026-06-19 | 2026-08-25 | Current |
| [`knowledge-base/operations/DR_DRILL_ANNUAL_V6_2026.md`](knowledge-base/operations/DR_DRILL_ANNUAL_V6_2026.md) | Disaster Recovery Drill — v6.0 GA Annual Evidence (S90) | 2026-06-14 | Current |
| [`knowledge-base/operations/DR_DRILL_V6_2026.md`](knowledge-base/operations/DR_DRILL_V6_2026.md) | Disaster Recovery Drill — v6.0 RC Evidence (S89) | 2026-06-13 | Current |
| [`knowledge-base/operations/DR_DRILL_V7_2026.md`](knowledge-base/operations/DR_DRILL_V7_2026.md) | Disaster Recovery Drill — v7.0 RC Evidence, Live-Traffic Exercise (S98) | 2026-07-16 | Current |
| [`knowledge-base/operations/DR_KV_EXPORT_BACKUP.md`](knowledge-base/operations/DR_KV_EXPORT_BACKUP.md) | DR — KV Export Backup (AUDITKV / ACTIONSKV) | 2026-06-19 | Current |
| [`knowledge-base/operations/DR_SNAPSHOT_CADENCE.md`](knowledge-base/operations/DR_SNAPSHOT_CADENCE.md) | DR — SessionRoom R2 Snapshot Cadence | 2026-06-19 | Current |
| [`knowledge-base/operations/DX_SERVICE_LAYER.md`](knowledge-base/operations/DX_SERVICE_LAYER.md) | DX Service Layer (DX-SERVICE-01) | 2026-05-23 | Current |
| [`knowledge-base/operations/GAM_STAGING_SMOKE_CHECKLIST.md`](knowledge-base/operations/GAM_STAGING_SMOKE_CHECKLIST.md) | GAM-STAGING-SMOKE-01 — Cloudflare Staging WebSocket Checklist | 2026-05-22 | Current |
| [`knowledge-base/operations/INTEGRATION_SECRETS_PROVISIONING.md`](knowledge-base/operations/INTEGRATION_SECRETS_PROVISIONING.md) | Integration OAuth Secrets — Sprint 33 Provisioning | 2026-05-30 | Current |
| [`knowledge-base/operations/MULTI_REGION_DRILL_CHECKLIST.md`](knowledge-base/operations/MULTI_REGION_DRILL_CHECKLIST.md) | Multi-Region Failover Drill Checklist (Sprint 52) | 2026-05-27 | Current |
| [`knowledge-base/operations/MULTI_REGION_RUNBOOK.md`](knowledge-base/operations/MULTI_REGION_RUNBOOK.md) | Multi-Region Runbook (Sprint 51) | 2026-05-27 | Current |
| [`knowledge-base/operations/OPS_RUNBOOKS_V3.md`](knowledge-base/operations/OPS_RUNBOOKS_V3.md) | Ops Runbooks — v3.0 (Sprint 49) | 2026-05-24 | Current |
| [`knowledge-base/operations/OPS_S99_CLOSEOUT_EVIDENCE.md`](knowledge-base/operations/OPS_S99_CLOSEOUT_EVIDENCE.md) | S99 Ops Closeout Evidence — RT-01 (OPS-S99-CLOSEOUT-01) | 2026-08-25 | Current |
| [`knowledge-base/operations/README.md`](knowledge-base/operations/README.md) | Operations, Deployment & Incident Response | 2026-06-01 | Current |
| [`knowledge-base/operations/SESSION_ROOM_RECOVERY.md`](knowledge-base/operations/SESSION_ROOM_RECOVERY.md) | Runbook: SESSIONROOM Durable Object Binding Recovery | 2026-07-16 | Current |
| [`knowledge-base/operations/STAGING_MIGRATION_CHECKLIST.md`](knowledge-base/operations/STAGING_MIGRATION_CHECKLIST.md) | Migration & Deployment Checklist | 2026-07-16 | Current |
| [`knowledge-base/operations/STAGING_RITUALS_S51_60.md`](knowledge-base/operations/STAGING_RITUALS_S51_60.md) | Staging Rituals — Sprints 51–60 | 2026-06-19 | Current |
| [`knowledge-base/operations/SUB100MS_PROOF.md`](knowledge-base/operations/SUB100MS_PROOF.md) | Sub-100ms Realtime Proof (Sprint 49) | 2026-05-24 | Current |
| [`knowledge-base/operations/V70_RC_SOAK_EVIDENCE.md`](knowledge-base/operations/V70_RC_SOAK_EVIDENCE.md) | v7.0.0-rc.2 Soak / Hardening Evidence (S98) | 2026-07-16 | Current |
| [`knowledge-base/operations/WCAG_AAA_REATTEST_V70_S98.md`](knowledge-base/operations/WCAG_AAA_REATTEST_V70_S98.md) | v7.0 WCAG 2.1 AAA Re-attestation — S98 P0 Gate | 2026-06-19 | Current |
| [`knowledge-base/operations/config/ENV_VARIABLES.md`](knowledge-base/operations/config/ENV_VARIABLES.md) | Environment Variables Documentation | 2026-07-16 | Orphaned |
| [`knowledge-base/operations/deployment/DEPLOYMENT_READY_CHECKLIST.md`](knowledge-base/operations/deployment/DEPLOYMENT_READY_CHECKLIST.md) | Help Assistant Deployment Readiness Checklist | 2026-06-01 | Current |
| [`knowledge-base/operations/deployment/DEPLOY_BOOTSTRAP.md`](knowledge-base/operations/deployment/DEPLOY_BOOTSTRAP.md) | Qesto — Cloudflare Deploy Bootstrap | 2026-05-11 | Current |
| [`knowledge-base/operations/deployment/DNS_CNAME_SETUP.md`](knowledge-base/operations/deployment/DNS_CNAME_SETUP.md) | DNS CNAME Setup for Bing Webmaster Tools | 2026-06-01 | Current |
| [`knowledge-base/operations/deployment/INDEXNOW_SETUP.md`](knowledge-base/operations/deployment/INDEXNOW_SETUP.md) | IndexNow Configuration Guide — Qesto SEO | 2026-06-01 | Current |
| [`knowledge-base/operations/deployment/INFRA_SPRINT_CHECKLIST.md`](knowledge-base/operations/deployment/INFRA_SPRINT_CHECKLIST.md) | Sprint 20 Infrastructure Checklist | 2026-07-16 | Current |
| [`knowledge-base/operations/deployment/KB_SYNC_CLI_PHASE4.md`](knowledge-base/operations/deployment/KB_SYNC_CLI_PHASE4.md) | Phase 4: Automated KB Sync CLI | 2026-06-05 | Current |
| [`knowledge-base/operations/deployment/KB_SYNC_PHASE5_ENHANCEMENTS.md`](knowledge-base/operations/deployment/KB_SYNC_PHASE5_ENHANCEMENTS.md) | Phase 5: KB Sync Enhancements | 2026-06-05 | Orphaned |
| [`knowledge-base/operations/deployment/KB_SYNC_QUICK_START.md`](knowledge-base/operations/deployment/KB_SYNC_QUICK_START.md) | KB Sync CLI — Quick Start | 2026-06-01 | Current |
| [`knowledge-base/operations/deployment/PHASE1_DEPLOYMENT_READY.md`](knowledge-base/operations/deployment/PHASE1_DEPLOYMENT_READY.md) | Phase 1: Knowledge-Base Vector Pipeline — DEPLOYMENT READY ✅ | 2026-06-01 | Orphaned |
| [`knowledge-base/operations/deployment/PRODUCTION-DB-MIGRATION-FIX-2026-07-15.md`](knowledge-base/operations/deployment/PRODUCTION-DB-MIGRATION-FIX-2026-07-15.md) | Production Database Migration Fix — 0060/0077 Duplicate Index (2026-07-15) | 2026-07-15 | Orphaned |
| [`knowledge-base/operations/deployment/PRODUCTION-DB-MIGRATION-FIX.md`](knowledge-base/operations/deployment/PRODUCTION-DB-MIGRATION-FIX.md) | Production Database Migration Sync — Step-by-Step Fix | 2026-06-01 | Current |
| [`knowledge-base/operations/deployment/RATE_LIMIT_BINDINGS_SETUP.md`](knowledge-base/operations/deployment/RATE_LIMIT_BINDINGS_SETUP.md) | Rate Limit Bindings Setup (Workers Rate Limiting API) | 2026-08-08 | Current |
| [`knowledge-base/operations/deployment/README.md`](knowledge-base/operations/deployment/README.md) | Deployment & infrastructure | 2026-08-08 | Current |
| [`knowledge-base/operations/deployment/STAGING-PROVISIONING-GUIDE.md`](knowledge-base/operations/deployment/STAGING-PROVISIONING-GUIDE.md) | Staging Provisioning Guide | 2026-07-16 | Current |
| [`knowledge-base/operations/deployment/STAGING-QUICK-START.md`](knowledge-base/operations/deployment/STAGING-QUICK-START.md) | Staging Environment Setup — Quick Start | 2026-07-16 | Current |
| [`knowledge-base/operations/deployment/VECTORIZE_DIM_FIX_2026-06.md`](knowledge-base/operations/deployment/VECTORIZE_DIM_FIX_2026-06.md) | Vectorize dimension fix — qesto-help & qesto-decisions (768 → 1024) | 2026-06-05 | Orphaned |
| [`knowledge-base/operations/deployment/VECTORIZE_INDEX_SETUP.md`](knowledge-base/operations/deployment/VECTORIZE_INDEX_SETUP.md) | Help Assistant Vectorize Index Setup | 2026-06-01 | Current |
| [`knowledge-base/operations/deployment/WORKFLOWS_SETUP_CHECKLIST.md`](knowledge-base/operations/deployment/WORKFLOWS_SETUP_CHECKLIST.md) | Cloudflare Workflows Setup Checklist ✅ | 2026-07-16 | Current |
| [`knowledge-base/operations/deployment/v2.2-DEPLOYMENT-CHECKLIST.md`](knowledge-base/operations/deployment/v2.2-DEPLOYMENT-CHECKLIST.md) | Production v2.2 Deployment Checklist | 2026-06-01 | Current |
| [`knowledge-base/operations/incidents/OBSERVABILITY_INCIDENT_2026_04.md`](knowledge-base/operations/incidents/OBSERVABILITY_INCIDENT_2026_04.md) | Observability Incident: Analytics Engine Schema Gaps | 2026-05-11 | Current |
| [`knowledge-base/operations/incidents/RUNBOOKS.md`](knowledge-base/operations/incidents/RUNBOOKS.md) | Operational Runbooks — Incident Response & Recovery (Phase 10 Step 6) | 2026-05-11 | Current |
| [`knowledge-base/operations/incidents/RUNBOOK_SESSION_RECONCILE.md`](knowledge-base/operations/incidents/RUNBOOK_SESSION_RECONCILE.md) | Runbook: Session State Reconciliation | 2026-05-11 | Current |
| [`knowledge-base/operations/incidents/SECRET_RUNBOOK.md`](knowledge-base/operations/incidents/SECRET_RUNBOOK.md) | Secret Governance Runbook (Sprint 18 - ID 24) | 2026-05-11 | Current |
| [`knowledge-base/operations/monitoring/2026-05-25_sprint60-70-obs-analytics-proposals.md`](knowledge-base/operations/monitoring/2026-05-25_sprint60-70-obs-analytics-proposals.md) | Sprint 60–70 Analytics & Observability Story Proposals | 2026-06-19 | Current |
| [`knowledge-base/operations/monitoring/AGENT_FACILITATE_GA_READINESS.md`](knowledge-base/operations/monitoring/AGENT_FACILITATE_GA_READINESS.md) | Agent Facilitation — GA Readiness Assessment (AGENT-FACILITATE-GA-01) | 2026-06-12 | Current |
| [`knowledge-base/operations/monitoring/AI_EVAL_BASELINE.md`](knowledge-base/operations/monitoring/AI_EVAL_BASELINE.md) | AI Eval Baseline — Golden-Set Harness (REV-10) | 2026-06-12 | Current |
| [`knowledge-base/operations/monitoring/ERROR_PATTERNS.md`](knowledge-base/operations/monitoring/ERROR_PATTERNS.md) | Error Patterns & UX Treatment (Sprint 18 - ID 20) | 2026-05-18 | Current |
| [`knowledge-base/operations/monitoring/LATENCY_BENCHMARKS.md`](knowledge-base/operations/monitoring/LATENCY_BENCHMARKS.md) | Qesto — Vote Submission Latency Benchmarks | 2026-05-20 | Current |
| [`knowledge-base/operations/monitoring/OBSERVABILITY.md`](knowledge-base/operations/monitoring/OBSERVABILITY.md) | Qesto — Observability Status (Current) | 2026-05-11 | Current |
| [`knowledge-base/operations/monitoring/OBSERVABILITY_AUDIT_2026-06-05.md`](knowledge-base/operations/monitoring/OBSERVABILITY_AUDIT_2026-06-05.md) | Qesto Admin Pages & Observability Infrastructure Audit | 2026-06-11 | Current |
| [`knowledge-base/operations/monitoring/RELEASE_HEALTH_DASHBOARD.md`](knowledge-base/operations/monitoring/RELEASE_HEALTH_DASHBOARD.md) | v2.2 Release Health Dashboard Checklist | 2026-05-30 | Current |
| [`knowledge-base/operations/monitoring/analytics/README.md`](knowledge-base/operations/monitoring/analytics/README.md) | Analytics query archive | 2026-06-01 | Current |
| [`knowledge-base/operations/security/GITHUB_INFRA_AUDIT_2026-07.md`](knowledge-base/operations/security/GITHUB_INFRA_AUDIT_2026-07.md) | GitHub Repository & Actions Security Audit — SolarnodeCC/Qesto | 2026-07-19 | Orphaned |
| [`knowledge-base/operations/security/PENTEST_02_SCOPE.md`](knowledge-base/operations/security/PENTEST_02_SCOPE.md) | Penetration Test #2 — Scope (SECURITY-PENTEST-02-EXEC) | 2026-05-24 | Current |
| [`knowledge-base/operations/security/PENTEST_4_SCOPE.md`](knowledge-base/operations/security/PENTEST_4_SCOPE.md) | Pentest #4 — Scope (Sprint 81) | 2026-06-02 | Current |
| [`knowledge-base/operations/security/RUNBOOK_PLATFORM_ADMIN_GRANT.md`](knowledge-base/operations/security/RUNBOOK_PLATFORM_ADMIN_GRANT.md) | Runbook — Grant / revoke platform admin | 2026-07-16 | Orphaned |
| [`knowledge-base/quality/README.md`](knowledge-base/quality/README.md) | Quality Assurance, Testing & Accessibility | 2026-06-01 | Current |
| [`knowledge-base/quality/accessibility/A11Y_FULL.md`](knowledge-base/quality/accessibility/A11Y_FULL.md) | Qesto — Accessibility Baseline (Current) | 2026-06-17 | Current |
| [`knowledge-base/quality/accessibility/AAA_CONFORMANCE_S88.md`](knowledge-base/quality/accessibility/AAA_CONFORMANCE_S88.md) | WCAG AAA Conformance — Sprint 88 | 2026-06-13 | Current |
| [`knowledge-base/quality/accessibility/AAA_CONFORMANCE_S89.md`](knowledge-base/quality/accessibility/AAA_CONFORMANCE_S89.md) | WCAG AAA Re-attestation — Sprint 89 (v6.0-rc) | 2026-06-13 | Current |
| [`knowledge-base/quality/accessibility/ACCESSIBILITY_GUIDE.md`](knowledge-base/quality/accessibility/ACCESSIBILITY_GUIDE.md) | Accessibility (A11y) Implementation Guide | 2026-05-11 | Current |
| [`knowledge-base/quality/captions/CAPTIONS_WER_SIGNOFF_S89.md`](knowledge-base/quality/captions/CAPTIONS_WER_SIGNOFF_S89.md) | CAPTIONS-GA-01 — Word-Error-Rate Sign-off (Sprint 89) | 2026-06-13 | Current |
| [`knowledge-base/quality/load/TOWNHALL_SCALE_PROOF_50K.md`](knowledge-base/quality/load/TOWNHALL_SCALE_PROOF_50K.md) | TOWNHALL-SCALE-PROOF-50K Evidence (S85) | 2026-07-16 | Current |
| [`knowledge-base/quality/security/PENTEST_3_PREP.md`](knowledge-base/quality/security/PENTEST_3_PREP.md) | Pentest #3 — Preparation Checklist (SEC-PEN3-01, S71) | 2026-05-27 | Current |
| [`knowledge-base/quality/testing/QA_FULL.md`](knowledge-base/quality/testing/QA_FULL.md) | Qesto — QA & Test Strategy (Current) | 2026-05-11 | Current |
| [`knowledge-base/quality/testing/QA_SPRINTS_60_70_REFERENCE.md`](knowledge-base/quality/testing/QA_SPRINTS_60_70_REFERENCE.md) | QA Commitment for Sprints 60–70: Quick Reference | 2026-05-25 | Orphaned |
| [`knowledge-base/quality/testing/TESTING_PYRAMID.md`](knowledge-base/quality/testing/TESTING_PYRAMID.md) | Testing Pyramid & CI Quality Gates | 2026-05-11 | Current |
| [`ops/AGENTS.md`](ops/AGENTS.md) | ops/ — CI, hooks, and deployment lanes | 2026-06-19 | Current |
| [`ops/PROFILE.md`](ops/PROFILE.md) | Operations Reference Profile | 2026-05-27 | Current |
| [`scripts/KB_SYNC_QUICK_START.md`](scripts/KB_SYNC_QUICK_START.md) | KB Sync CLI — moved | 2026-06-01 | Current |
| [`tests/README.md`](tests/README.md) | Testing assets | 2026-05-04 | Current |
| [`tests/docs/playwright-local.md`](tests/docs/playwright-local.md) | Playwright Local E2E | 2026-07-31 | Current |
| [`tests/load/README.md`](tests/load/README.md) | Load tests (S71+) | 2026-07-16 | Current |

## Onboarding & Contributor Docs

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`.github/AGENTS.md`](.github/AGENTS.md) | GitHub Actions — workflow entrypoints | 2026-06-19 | Current |
| [`.github/ISSUE_TEMPLATE/bug_report.md`](.github/ISSUE_TEMPLATE/bug_report.md) | [bug] | 2026-07-19 | Current |
| [`.github/ISSUE_TEMPLATE/feature_request.md`](.github/ISSUE_TEMPLATE/feature_request.md) | [feat] | 2026-07-19 | Current |
| [`.github/pull_request_template.md`](.github/pull_request_template.md) | <!-- What does this PR change, and why? One or two sentences. --> | 2026-07-19 | Current |
| [`AGENTS.md`](AGENTS.md) | Qesto — Codex Project Guide | 2026-09-01 | Current |
| [`CLAUDE.md`](CLAUDE.md) | Qesto — AI Framework (L1 Context) | 2026-09-01 | Current |
| [`README.md`](README.md) | Handoff: Qesto — Real-Time AI-Amplified Session Platform | 2026-05-11 | Current |
| [`apps/web/AGENTS.md`](apps/web/AGENTS.md) | Web surface (apps/web) | 2026-05-27 | Current |
| [`docs/README.md`](docs/README.md) | Agent documentation hub (docs/) | 2026-06-01 | Current |
| [`knowledge-base/CHANGELOG.md`](knowledge-base/CHANGELOG.md) | Knowledge Base Changelog | 2026-05-11 | Current |
| [`knowledge-base/CONTRIBUTING.md`](knowledge-base/CONTRIBUTING.md) | Contributing to the Knowledge Base | 2026-05-27 | Current |
| [`knowledge-base/README.md`](knowledge-base/README.md) | Qesto Knowledge Base | 2026-07-07 | Current |
| [`knowledge-base/governance/BRAND_VOICE.md`](knowledge-base/governance/BRAND_VOICE.md) | Qesto Brand Voice — Comprehensive Guide | 2026-05-11 | Current |
| [`knowledge-base/governance/DATABASE_GOVERNANCE.md`](knowledge-base/governance/DATABASE_GOVERNANCE.md) | Database Governance Policy (Sprint 18 - ID 6) | 2026-05-11 | Current |
| [`knowledge-base/governance/GLOSSARY_FULL.md`](knowledge-base/governance/GLOSSARY_FULL.md) | Qesto — Glossary (Current) | 2026-05-11 | Current |
| [`knowledge-base/governance/I18N_GLOSSARY.md`](knowledge-base/governance/I18N_GLOSSARY.md) | Qesto — i18n Terminology Glossary | 2026-06-17 | Current |
| [`knowledge-base/governance/I18N_PSEUDO_LOC_AUDIT.md`](knowledge-base/governance/I18N_PSEUDO_LOC_AUDIT.md) | I18N Pseudo-Localization Audit (Wave 2) - Cold-Start Drill | 2026-05-11 | Current |
| [`knowledge-base/governance/OBSIDIAN_KB_STANDARD.md`](knowledge-base/governance/OBSIDIAN_KB_STANDARD.md) | Obsidian Knowledge Base Standard | 2026-05-27 | Current |
| [`knowledge-base/governance/PAGE_QUALITY_CHECKLIST.md`](knowledge-base/governance/PAGE_QUALITY_CHECKLIST.md) | Page Quality Checklist | 2026-05-11 | Current |
| [`knowledge-base/governance/README.md`](knowledge-base/governance/README.md) | Governance, Standards & Brand | 2026-05-11 | Current |
| [`knowledge-base/governance/TEMPLATES_INTERNAL_COMMS.md`](knowledge-base/governance/TEMPLATES_INTERNAL_COMMS.md) | Internal Comms Templates | 2026-05-11 | Current |
| [`packages/sdk-js/README.md`](packages/sdk-js/README.md) | Qesto JavaScript SDK (Public API v1) | 2026-05-26 | Current |
| [`src/AGENTS.md`](src/AGENTS.md) | Frontend (src/) | 2026-07-01 | Current |

## NEW: Quality Assurance & Audit Reports

> **New category (flagged):** dated QA/security audit *results*. Reusable prompts live under *Audit Prompts / Claude Code Playbooks*.

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`knowledge-base/quality/audits/BACKLOG_AUDIT_2026-07-14.md`](knowledge-base/quality/audits/BACKLOG_AUDIT_2026-07-14.md) | Backlog & Documentation Audit — 2026-07-14 | 2026-07-15 | Current |
| [`knowledge-base/quality/audits/BRANCH_AUDIT_2026-05-25.md`](knowledge-base/quality/audits/BRANCH_AUDIT_2026-05-25.md) | Branch Audit — 2026-05-25 | 2026-05-27 | Orphaned |
| [`knowledge-base/quality/audits/CORE_FEATURES_AUDIT_2026-07-09.md`](knowledge-base/quality/audits/CORE_FEATURES_AUDIT_2026-07-09.md) | Core Features Audit — AI Wizard, Energizers, Launchpad, Presenter | 2026-07-15 | Current |
| [`knowledge-base/quality/audits/CORE_FEATURES_AUDIT_2026-07-14.md`](knowledge-base/quality/audits/CORE_FEATURES_AUDIT_2026-07-14.md) | Core Features Audit — Dashboard AI Suite, Energizers, Launchpad, Presenter | 2026-07-14 | Current |
| [`knowledge-base/quality/audits/DESIGN_SYSTEM_AUDIT_2026-07-01.md`](knowledge-base/quality/audits/DESIGN_SYSTEM_AUDIT_2026-07-01.md) | Design System Compliance Audit — July 2026 | 2026-07-01 | Current |
| [`knowledge-base/quality/audits/FUTURE_READY_REVIEW_2026-06.md`](knowledge-base/quality/audits/FUTURE_READY_REVIEW_2026-06.md) | Future-Ready Refactoring Review — June 2026 | 2026-06-01 | Current |
| [`knowledge-base/quality/audits/JANKURAI_AUDIT_2026_07_02.md`](knowledge-base/quality/audits/JANKURAI_AUDIT_2026_07_02.md) | Jankurai Full Audit — 2026-07-02 | 2026-07-05 | Current |
| [`knowledge-base/quality/audits/KB_COVERAGE_AUDIT_2026-06-21.md`](knowledge-base/quality/audits/KB_COVERAGE_AUDIT_2026-06-21.md) | Knowledge Base Coverage Audit — 2026-06-21 | 2026-06-21 | Current |
| [`knowledge-base/quality/audits/LAYOUT_RESPONSIVENESS_AUDIT_2026-07-10.md`](knowledge-base/quality/audits/LAYOUT_RESPONSIVENESS_AUDIT_2026-07-10.md) | Layout & Responsiveness Audit — 2026-07-10 | 2026-07-13 | Current |
| [`knowledge-base/quality/audits/PLATFORM_AUDIT_2026-07-08.md`](knowledge-base/quality/audits/PLATFORM_AUDIT_2026-07-08.md) | Qesto Platform Audit — 2026-07-08 | 2026-08-25 | Current |
| [`knowledge-base/quality/audits/PLATFORM_REVIEW_2026-06-09.md`](knowledge-base/quality/audits/PLATFORM_REVIEW_2026-06-09.md) | Qesto Platform Review — Features, Improvement Backlog & Strategic Alignment | 2026-06-10 | Orphaned |
| [`knowledge-base/quality/audits/PROMISE_AUDIT_GITHUB_ISSUES.md`](knowledge-base/quality/audits/PROMISE_AUDIT_GITHUB_ISSUES.md) | Promise Audit — GitHub Issues to File | 2026-07-02 | Current |
| [`knowledge-base/quality/audits/PROMISE_AUDIT_QUICK_REFERENCE.md`](knowledge-base/quality/audits/PROMISE_AUDIT_QUICK_REFERENCE.md) | Qesto Promise-to-Implementation Audit — Quick Reference | 2026-07-04 | Current |
| [`knowledge-base/quality/audits/PROMISE_AUDIT_RESOLUTION_2026-07-01.md`](knowledge-base/quality/audits/PROMISE_AUDIT_RESOLUTION_2026-07-01.md) | Promise-to-Implementation Audit — Resolution Log | 2026-07-02 | Current |
| [`knowledge-base/quality/audits/PROMISE_TO_IMPLEMENTATION_AUDIT.md`](knowledge-base/quality/audits/PROMISE_TO_IMPLEMENTATION_AUDIT.md) | Qesto Promise-to-Implementation Audit | 2026-07-04 | Current |
| [`knowledge-base/quality/audits/REFACTORING_AUDIT_2026-07-08.md`](knowledge-base/quality/audits/REFACTORING_AUDIT_2026-07-08.md) | Refactoring Opportunities Audit — 2026-07-08 | 2026-07-11 | Current |
| [`knowledge-base/quality/audits/REMEDIATION_PLAN.md`](knowledge-base/quality/audits/REMEDIATION_PLAN.md) | Refactoring Remediation & Maintainability Plan — Qesto | 2026-07-05 | Current |
| [`knowledge-base/quality/audits/REMEDIATION_SUMMARY.md`](knowledge-base/quality/audits/REMEDIATION_SUMMARY.md) | Security Audit Remediation — Complete Summary | 2026-06-01 | Current |
| [`knowledge-base/quality/audits/STABILITY_REVIEW.md`](knowledge-base/quality/audits/STABILITY_REVIEW.md) | Stability Review: LIVEENERGIZERSENABLED & SENTIMENTENABLED | 2026-06-01 | Current |
| [`knowledge-base/quality/audits/TECH_DEBT_AUDIT_2026-05.md`](knowledge-base/quality/audits/TECH_DEBT_AUDIT_2026-05.md) | Technical Debt Audit — May 2026 | 2026-06-01 | Current |
| [`knowledge-base/quality/audits/UI_UX_AUDIT_2026-08-03.md`](knowledge-base/quality/audits/UI_UX_AUDIT_2026-08-03.md) | Critical UI/UX Audit — 3 August 2026 | 2026-08-03 | Orphaned |
| [`knowledge-base/quality/audits/architecture-audit.md`](knowledge-base/quality/audits/architecture-audit.md) | Software Architecture Audit — Qesto | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/audit-coverage-matrix.md`](knowledge-base/quality/audits/audit-coverage-matrix.md) | Audit Coverage Matrix | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/code-complexity-audit.md`](knowledge-base/quality/audits/code-complexity-audit.md) | Code Complexity Audit — Qesto | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/code-duplication-audit.md`](knowledge-base/quality/audits/code-duplication-audit.md) | Code Duplication Audit — Qesto | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/design-pattern-audit.md`](knowledge-base/quality/audits/design-pattern-audit.md) | Design Pattern Audit — Qesto | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/error-flow-audit.md`](knowledge-base/quality/audits/error-flow-audit.md) | Error Flow Audit — Qesto Backend | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/error-handling-audit.md`](knowledge-base/quality/audits/error-handling-audit.md) | Error Handling Audit — Qesto Backend | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/naming-readability-audit.md`](knowledge-base/quality/audits/naming-readability-audit.md) | Naming Conventions & Readability Audit | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/remediation-plan.md`](knowledge-base/quality/audits/remediation-plan.md) | Audit Remediation Plan — Dependency-Safe Execution | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/resilience-audit.md`](knowledge-base/quality/audits/resilience-audit.md) | System Resilience Audit | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/workstream-outstanding.md`](knowledge-base/quality/audits/workstream-outstanding.md) | Outstanding Work Across All Audit Workstreams | 2026-05-11 | Current |
| [`knowledge-base/quality/audits/workstream-progress.md`](knowledge-base/quality/audits/workstream-progress.md) | Audit Workstream Progress | 2026-05-11 | Current |
| [`knowledge-base/quality/ui-reviews/2026-06-20-full-app-scan.md`](knowledge-base/quality/ui-reviews/2026-06-20-full-app-scan.md) | UI/UX Review — Full-App Scan (host, presenter, results, dashboard, config) | 2026-06-20 | Orphaned |
| [`knowledge-base/quality/ui-reviews/2026-06-20-participant-join-auth.md`](knowledge-base/quality/ui-reviews/2026-06-20-participant-join-auth.md) | UI/UX Review — Participant Join Flow + Auth Entry | 2026-06-20 | Current |
| [`knowledge-base/security/PENTEST_5_PREP.md`](knowledge-base/security/PENTEST_5_PREP.md) | SEC-PEN5-PREP-01 — Pentest #5 Preparation (Governance + Embed + Agent) | 2026-06-12 | Current |
| [`knowledge-base/security/PHASE4_AUDIT.md`](knowledge-base/security/PHASE4_AUDIT.md) | Qesto — Phase 4 Security Audit | 2026-05-11 | Current |
| [`knowledge-base/security/SECURITY_AUDIT_2026-07-08.md`](knowledge-base/security/SECURITY_AUDIT_2026-07-08.md) | Security Audit Report: Qesto | 2026-07-09 | Current |
| [`knowledge-base/security/SECURITY_AUDIT_2026-08-12.md`](knowledge-base/security/SECURITY_AUDIT_2026-08-12.md) | Security Audit Report: Qesto | 2026-08-14 | Current |
| [`knowledge-base/security/SECURITY_AUDIT_BACKLOG.md`](knowledge-base/security/SECURITY_AUDIT_BACKLOG.md) | Security Audit Follow-up Backlog (2026-07-08) | 2026-08-14 | Orphaned |
| [`knowledge-base/security/SEC_EMBED_ORIGIN_01_REVIEW.md`](knowledge-base/security/SEC_EMBED_ORIGIN_01_REVIEW.md) | SEC-EMBED-ORIGIN-01 — EMBED Widget Origin-Sandboxing Security Review | 2026-06-12 | Current |
| [`knowledge-base/security/SEC_VOTE_INTEGRITY_01_REVIEW.md`](knowledge-base/security/SEC_VOTE_INTEGRITY_01_REVIEW.md) | SEC-VOTE-INTEGRITY-01 — DELIBERATE Verifiable-Voting Security Review | 2026-06-12 | Current |
| [`knowledge-base/security/XR_BETA_SECURITY_REVIEW.md`](knowledge-base/security/XR_BETA_SECURITY_REVIEW.md) | XR Spatial Session Beta — Security Review (S98 Gate) | 2026-06-18 | Current |
| [`knowledge-base/security/reviews/README.md`](knowledge-base/security/reviews/README.md) | Security reviews & fix logs | 2026-06-01 | Current |
| [`knowledge-base/security/reviews/SECURITY_AUDIT_FINDINGS.md`](knowledge-base/security/reviews/SECURITY_AUDIT_FINDINGS.md) | Jankurai Security Audit Findings — Action Plan | 2026-06-01 | Current |
| [`knowledge-base/security/reviews/SECURITY_FIXES_MERGE_INSTRUCTIONS.md`](knowledge-base/security/reviews/SECURITY_FIXES_MERGE_INSTRUCTIONS.md) | Security Fixes: Merge Instructions for PRs #355–#364 | 2026-06-01 | Current |
| [`knowledge-base/security/reviews/SECURITY_FIXES_S71_S80.md`](knowledge-base/security/reviews/SECURITY_FIXES_S71_S80.md) | Security Fixes Summary — S71–S80 Sprint Arc | 2026-06-01 | Current |
| [`knowledge-base/security/reviews/SECURITY_REVIEW_2026-06.md`](knowledge-base/security/reviews/SECURITY_REVIEW_2026-06.md) | Qesto — Deep Security Review (2026-06) | 2026-06-01 | Current |

## Uncategorized / Needs Review

| Path | Summary | Last modified | Status |
|---|---|---|---|
| [`DOCS_INDEX.md`](DOCS_INDEX.md) | Qesto Documentation Index | unknown | Current |
| [`docs/agent-native-standard.md`](docs/agent-native-standard.md) | Agent-native standard (Qesto pointer) | 2026-07-03 | Current |
| [`knowledge-base/archive/CONTENT_DRAFT_PLAN.md`](knowledge-base/archive/CONTENT_DRAFT_PLAN.md) | Content Drafting Plan — Solutions, Features & Use Cases | 2026-05-11 | Orphaned |
| [`knowledge-base/archive/GOOGLE_OAUTH_VERIFICATION.md`](knowledge-base/archive/GOOGLE_OAUTH_VERIFICATION.md) | Google OAuth Verification Notes | 2026-05-11 | Orphaned |
| [`knowledge-base/archive/README.md`](knowledge-base/archive/README.md) | Archive | 2026-06-05 | Orphaned |
| [`knowledge-base/archive/_README.md`](knowledge-base/archive/_README.md) | Qesto | 2026-05-11 | Orphaned |
| [`knowledge-base/archive/design_files_redundant/DESIGN_SYSTEM.md`](knowledge-base/archive/design_files_redundant/DESIGN_SYSTEM.md) | Qesto Design System (designfiles/) | 2026-05-11 | Orphaned |
| [`knowledge-base/archive/design_files_redundant/copy_deck.md`](knowledge-base/archive/design_files_redundant/copy_deck.md) | Qesto copy deck | 2026-05-11 | Orphaned |
| [`knowledge-base/archive/notion-import/README.md`](knowledge-base/archive/notion-import/README.md) | Notion import archive | 2026-05-27 | Orphaned |
| [`migrations/.metadata/README.md`](migrations/.metadata/README.md) | Migration Safety Metadata | 2026-06-06 | Current |

## Needs Attention

Ordered by severity (High → Low).

### 1. [High] Duplicate architecture entry points

`docs/architecture.md` and `knowledge-base/architecture/ARCHITECTURE.md` both describe the runtime stack. `docs/README.md` points agents at short paths while declaring KB canonical — high drift risk.

### 2. [High] Broken links to docs migrated out of `docs/`

`docs/refactoring-deferred-issues.md` → missing `./REFACTORING_AUDIT.md`, `./REMEDIATION_PLAN.md`. `docs/testing.md` → missing `VALIDATION_PATTERNS.md`, `VALIDATION_STRATEGY.md`. ADRs 0068–0070 link to repo-root `REFACTORING_AUDIT.md` (file lives under `knowledge-base/quality/audits/`).

### 3. [High] Broken internal markdown links (114 occurrences, 66 unique targets)

Most frequent broken targets:
- `includes/PREBUILD_AND_DELIVERY.md` ← 17 ref(s), e.g. `knowledge-base/specifications/SPEC_INDEX.md`
- `./README.md` ← 13 ref(s), e.g. `knowledge-base/ai-context/research/SKILLS_WAVE1_EXECUTION.md`
- `../../REFACTORING_AUDIT.md` ← 3 ref(s), e.g. `knowledge-base/adr/ADR-0068-workers-ai-gateway-facade.md`
- `../../operations/reliability/DR_DRILL_S98.md` ← 3 ref(s), e.g. `knowledge-base/product/backlog/BACKLOG_MASTER.md`
- `./REFACTORING_AUDIT.md` ← 2 ref(s), e.g. `docs/refactoring-deferred-issues.md`
- `../operations/DR_DRILL_ANNUAL_V7_2026.md` ← 2 ref(s), e.g. `knowledge-base/adr/ADR-0063-v7-platform-certification.md`
- `CLAUDE.md` ← 2 ref(s), e.g. `knowledge-base/archive/_README.md`
- `./KB_EMBEDDING_PHASE1.md` ← 2 ref(s), e.g. `knowledge-base/operations/deployment/KB_SYNC_CLI_PHASE4.md`
- `./VECTORIZE_SETUP.md` ← 2 ref(s), e.g. `knowledge-base/operations/deployment/KB_SYNC_CLI_PHASE4.md`
- `spec/SPEC_PRODUCT.md` ← 2 ref(s), e.g. `knowledge-base/operations/incidents/RUNBOOKS.md`
- `../../../.claude/skills/HANDOFFS.md` ← 2 ref(s), e.g. `knowledge-base/product/backlog/BACKLOG_ACTIVE.md`
- `../../operations/reliability/RC_SOAK_S98.md` ← 2 ref(s), e.g. `knowledge-base/product/backlog/BACKLOG_MASTER.md`
- `../../quality/WCAG_AAA_ATTEST_S98.md` ← 2 ref(s), e.g. `knowledge-base/product/backlog/BACKLOG_MASTER.md`
- `./knowledge-base/product/backlog/BACKLOG_MASTER.md` ← 2 ref(s), e.g. `knowledge-base/product/growth-engine/GROWTH_ENGINE_COMPLETE.md`
- `./knowledge-base/product/planning/SPRINT60_70_PLAN.md` ← 2 ref(s), e.g. `knowledge-base/product/marketing/MARKETING_SPRINTS_71_80.md`

### 4. [High] Duplicate remediation plan case-variants

`knowledge-base/quality/audits/REMEDIATION_PLAN.md` and `remediation-plan.md` coexist. Case-insensitive filesystems will collide.

### 5. [High] Missing READMEs for major code subsystems

No README in `functions/`, `functions/api/`, `worker/`, `migrations/`, `scripts/`, `tools/`, `packages/sdk-python/`. Code present without colocated docs: Embed widget (`routes/embed*`), Ideate / Retro / EventAgenda / Federation / Marketplace pages, `SessionRoom` DO, `TemplateGenerationWorkflow`.

### 6. [Medium] Overlapping sprint-plan corpus vs release-train cadence

Large sets of `SPRINT*_IMPLEMENTATION_SPEC`, `SPRINT*_EXECUTION`, and overlapping range plans (`SPRINT81_85` / `SPRINT81_90` / `SPRINT85_99`). Active contract is release-train (`BACKLOG_ACTIVE.md`, `RELEASE_TRAIN_MASTER.md`, ADR-0067) — sprint docs can conflict.

### 7. [Medium] Multiple security audit snapshots without supersession map

`SECURITY_AUDIT_2026-07-08.md`, `SECURITY_AUDIT_2026-08-12.md`, `reviews/SECURITY_REVIEW_2026-06.md`, `reviews/SECURITY_AUDIT_FINDINGS.md` overlap without a baseline pointer.

### 8. [Medium] Design-system documentation triplicated

`SPEC_DESIGN_SYSTEM_OVERVIEW.md`, `governance/design-system/`, and `archive/design_files_redundant/DESIGN_SYSTEM.md`.

### 9. [Medium] AGENTS.md vs CLAUDE.md Vectorize dimension conflict

`AGENTS.md` documents DECISIONS_VECTORIZE as 768-d; `CLAUDE.md` documents Vectorize indexes as 1024-d (bge-m3).

### 10. [Medium] Clippy / help-assistant and Platformbeheer naming gaps

Help assistant split across `knowledge-base/help/` and `operations/help-assistant/` without a “Clippy” index. Admin/`Platformbeheer` surfaces exist in `src/pages/AdminDashboard.tsx` and design-system admin kits but lack a clearly named product spec.

### 11. [Medium] 81 orphaned docs

Not linked and not listed from a parent README (archive + one-off reports dominate). Examples: `knowledge-base/adr/ADR-0054-cadence-9-governance.md`, `knowledge-base/api/DEVELOPER_COMMUNITY.md`, `knowledge-base/product/ENTERPRISE_FEATURE_REVIEW.md`, `knowledge-base/product/planning/I18N_SPRINT_60_70_QUICKREF.md`, `knowledge-base/product/planning/S19_KPI_BASELINE.md`, `knowledge-base/product/planning/SPRINT51_60_PLAN.md`, `knowledge-base/product/planning/SPRINT85_99_PLAN.md`, `knowledge-base/product/planning/sprints/SPRINT19_COMPLETION_SPEC.md`, `knowledge-base/product/planning/sprints/SPRINT20_READINESS_SPEC.md`, `knowledge-base/product/planning/sprints/SPRINT21_IMPLEMENTATION_SPEC.md` … +71 more

### 12. [Low] Sprint / Notion language remains in active trees

`archive/notion-import/` retained; many active docs still use sprint cadence language despite ADR-0067.

### 13. [Low] Stale heuristic rarely fires (repo git age < 6 months)

Oldest git-touched doc ≈ 2026-04-18. KB migration refreshed paths; rely on frontmatter `status` and `archive/` for obsolescence.

---

## Methodology

1. **Discover** — recursive walk; include `.github/` and `.claude/`; exclude dependency/build trees.
2. **Categorize** — path-first heuristics with keyword overrides; exactly one category per file.
3. **Assess** — last modified from `git log`; orphan via markdown link graph + parent README listing; owned trees (`.claude`, ADR hub, help) not marked orphan for missing inbound links alone.
4. **Flag** — duplicates, deprecated path refs, missing subsystem READMEs, broken links (see Needs Attention).
