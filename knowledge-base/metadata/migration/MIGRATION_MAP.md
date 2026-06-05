# Migration Mapping: Old Path → New Path

## Overview
- Total files to migrate: 150 (excludes /.claude/ which stays in place)
- Files to split: 3 major files (BACKLOG.md, SPRINT_PLAN.md, some large specs)
- Duplicate folders to consolidate: design-system/ + design_files/ → merge into governance/design-system/
- Archive candidates: 10-15 files marked for review

## ADR Files (All to `/knowledge-base/adr/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/adr/ADR-0001-do-per-session.md` | `/knowledge-base/adr/ADR-0001-do-per-session.md` | ✓ Move with history |
| `/docs/adr/ADR-0002-ai-streaming-transport.md` | `/knowledge-base/adr/ADR-0002-ai-streaming-transport.md` | ✓ Move with history |
| `/docs/adr/ADR-0003-preflight-validation-contract.md` | `/knowledge-base/adr/ADR-0003-preflight-validation-contract.md` | ✓ Move with history |
| `/docs/adr/ADR-0004-custom-rbac-authorization.md` | `/knowledge-base/adr/ADR-0004-custom-rbac-authorization.md` | ✓ Move with history |
| `/docs/adr/ADR-0005-do-protocol-versioning.md` | `/knowledge-base/adr/ADR-0005-do-protocol-versioning.md` | ✓ Move with history |
| `/docs/ADR-workers-ai-capabilities.md` | `/knowledge-base/adr/ADR-0006-workers-ai-capabilities.md` | ⚠ Rename + move |
| `/docs/ADR-CIRCUIT-BREAKER.md` | `/knowledge-base/adr/ADR-0007-circuit-breaker.md` | ⚠ Rename + move |
| `/docs/ADR-INTEGRATION-FOUNDATION.md` | `/knowledge-base/adr/ADR-0008-integration-foundation.md` | ⚠ Rename + move |
| `/docs/ADR-PII-SANITIZATION.md` | `/knowledge-base/adr/ADR-0009-pii-sanitization.md` | ⚠ Rename + move |
| `/docs/adr/ADR-AI-Latency.md` | `/knowledge-base/adr/ADR-AI-Latency.md` | ✓ Move with history |
| `/docs/adr/ADR-DO-Timers.md` | `/knowledge-base/adr/ADR-DO-Timers.md` | ✓ Move with history |
| `/docs/adr/ADR-KV-Tenant-Conventions.md` | `/knowledge-base/adr/ADR-KV-Tenant-Conventions.md` | ✓ Move with history |

## Specification Files (All to `/knowledge-base/specifications/domain/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/spec/SPEC_CORE.md` | `/knowledge-base/specifications/domain/SPEC_CORE.md` | ✓ Move with history |
| `/docs/spec/SPEC_BACKEND.md` | `/knowledge-base/specifications/domain/SPEC_BACKEND.md` | ✓ Move with history |
| `/docs/spec/SPEC_FRONTEND.md` | `/knowledge-base/specifications/domain/SPEC_FRONTEND.md` | ✓ Move with history |
| `/docs/spec/SPEC_DATAMODEL.md` | `/knowledge-base/specifications/domain/SPEC_DATAMODEL.md` | ✓ Move with history |
| `/docs/spec/SPEC_INTEGRATIONS.md` | `/knowledge-base/specifications/domain/SPEC_INTEGRATIONS.md` | ✓ Move with history |
| `/docs/spec/SPEC_REALTIME.md` | `/knowledge-base/specifications/domain/SPEC_REALTIME.md` | ✓ Move with history |
| `/docs/spec/SPEC_DEPLOYMENT.md` | `/knowledge-base/specifications/domain/SPEC_DEPLOYMENT.md` | ✓ Move with history |
| `/docs/spec/SPEC_PRODUCT.md` | `/knowledge-base/specifications/product/SPEC_PRODUCT.md` | ✓ Move with history |
| `/docs/spec/SPEC_INDEX.md` | `/knowledge-base/specifications/SPEC_INDEX.md` | ✓ Move with history |
| `/docs/spec/DESIGN_SPEC_TRIAL_ACTIVATION.md` | `/knowledge-base/specifications/features/DESIGN_SPEC_TRIAL_ACTIVATION.md` | ✓ Move with history |
| `/docs/spec/WEBSITE_DESIGN_SPEC.md` | `/knowledge-base/specifications/product/WEBSITE_DESIGN_SPEC.md` | ✓ Move with history |

## Sprint Implementation Specs (All to `/knowledge-base/product/planning/sprints/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/spec/sprints/SPRINT_*.md` | `/knowledge-base/product/planning/sprints/SPRINT_*.md` | ✓ Move with history (9 files) |

## Product & Backlog (To `/knowledge-base/product/` with splitting)

| Old Path | New Path | Status | Notes |
|---|---|---|---|
| `/docs/BACKLOG.md` | `/knowledge-base/product/backlog/BACKLOG_*.md` | ⚠ SPLIT | 67K file split into P0, P1, P2-features, P2-technical, overview |
| `/docs/SPRINT_PLAN.md` | `/knowledge-base/product/planning/SPRINT_PLAN_*.md` | ⚠ SPLIT | 52K file split into methodology + reference arc |
| `/docs/ROADMAP_FULL.md` | `/knowledge-base/product/roadmap/ROADMAP_FULL.md` | ✓ Move with history |
| `/docs/EPIC-ROADMAP-V2.2-VALIDATED.md` | `/knowledge-base/product/roadmap/EPIC_ROADMAP_V2.2.md` | ✓ Move with history |
| `/docs/release-notes/v0.1.0.md` | `/knowledge-base/product/releases/v0.1.0.md` | ✓ Move with history |
| `/docs/release-notes/v0.1.0-INTERNAL.md` | `/knowledge-base/product/releases/v0.1.0-INTERNAL.md` | ✓ Move with history |
| `/docs/release.md` | `/knowledge-base/product/releases/RELEASE_GUIDE.md` | ✓ Move with history |
| `/docs/V2_2_ROLLOUT_PLAN.md` | `/knowledge-base/product/releases/V2_2_ROLLOUT_PLAN.md` | ✓ Move with history |
| `/docs/V2_2_AUDIT_OUTCOMES.md` | `/knowledge-base/product/releases/V2_2_AUDIT_OUTCOMES.md` | ✓ Move with history |
| `/docs/ARCHIVED_SPRINTS.md` | `/knowledge-base/product/releases/ARCHIVED_SPRINTS.md` | ✓ Move with history |
| `/docs/IMPLEMENTATION_PLAN_COMPLETE.md` | `/knowledge-base/product/planning/IMPLEMENTATION_PLAN_COMPLETE.md` | ✓ Move with history |

## Architecture & Design (To `/knowledge-base/architecture/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/ARCHITECTURE.md` | `/knowledge-base/architecture/ARCHITECTURE.md` | ✓ Move with history |
| `/docs/CLOUDFLARE_WORKERS_OPTIMIZATION.md` | `/knowledge-base/architecture/CLOUDFLARE_WORKERS_OPTIMIZATION.md` | ✓ Move with history |
| `/design-system/*` | `/knowledge-base/governance/design-system/*` | ⚠ Move (consolidate with design_files) |

## Security & Governance (To `/knowledge-base/security/` + `/knowledge-base/governance/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/SECURITY_FULL.md` | `/knowledge-base/security/SECURITY_FULL.md` | ✓ Move with history |
| `/docs/SECRET_ROTATION_POLICY.md` | `/knowledge-base/security/SECRET_ROTATION_POLICY.md` | ✓ Move with history |
| `/docs/SECRET_RUNBOOK.md` | `/knowledge-base/operations/incidents/SECRET_RUNBOOK.md` | ✓ Move with history |
| `/docs/DATABASE_GOVERNANCE.md` | `/knowledge-base/governance/DATABASE_GOVERNANCE.md` | ✓ Move with history |
| `/docs/BRAND_VOICE.md` | `/knowledge-base/governance/BRAND_VOICE.md` | ✓ Move with history |
| `/docs/DESIGN_GRID_GUIDE.md` | `/knowledge-base/governance/DESIGN_GRID_GUIDE.md` | ✓ Move with history |
| `/docs/I18N_GLOSSARY.md` | `/knowledge-base/governance/I18N_GLOSSARY.md` | ✓ Move with history |
| `/docs/I18N_PSEUDO_LOC_AUDIT_2026_04.md` | `/knowledge-base/governance/I18N_PSEUDO_LOC_AUDIT.md` | ✓ Move with history |
| `/docs/TEMPLATES_INTERNAL_COMMS.md` | `/knowledge-base/governance/TEMPLATES_INTERNAL_COMMS.md` | ✓ Move with history |
| `/docs/PAGE_QUALITY_CHECKLIST.md` | `/knowledge-base/governance/PAGE_QUALITY_CHECKLIST.md` | ✓ Move with history |

## Quality & Testing (To `/knowledge-base/quality/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/TESTING_PYRAMID.md` | `/knowledge-base/quality/testing/TESTING_PYRAMID.md` | ✓ Move with history |
| `/docs/QA_FULL.md` | `/knowledge-base/quality/testing/QA_FULL.md` | ✓ Move with history |
| `/docs/A11Y_FULL.md` | `/knowledge-base/quality/accessibility/A11Y_FULL.md` | ✓ Move with history |
| `/docs/ACCESSIBILITY_GUIDE.md` | `/knowledge-base/quality/accessibility/ACCESSIBILITY_GUIDE.md` | ✓ Move with history |
| `/audits/*.md` (11 files) | `/knowledge-base/quality/audits/` | ✓ Move with history |

## API & Integration (To `/knowledge-base/api/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/API_FULL.md` | `/knowledge-base/api/API_FULL.md` | ✓ Move with history |
| `/docs/MCP_TOOL_MATRIX.md` | `/knowledge-base/api/MCP_TOOL_MATRIX.md` | ✓ Move with history |

## Operations & Incidents (To `/knowledge-base/operations/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/RUNBOOKS.md` | `/knowledge-base/operations/incidents/RUNBOOKS.md` | ✓ Move with history |
| `/docs/RUNBOOK_SESSION_RECONCILE.md` | `/knowledge-base/operations/incidents/RUNBOOK_SESSION_RECONCILE.md` | ✓ Move with history |
| `/docs/OBSERVABILITY.md` | `/knowledge-base/operations/monitoring/OBSERVABILITY.md` | ✓ Move with history |
| `/docs/OBSERVABILITY_INCIDENT_2026_04.md` | `/knowledge-base/operations/incidents/OBSERVABILITY_INCIDENT_2026_04.md` | ✓ Move with history |
| `/docs/INFRA-SPRINT-20-CHECKLIST.md` | `/knowledge-base/operations/deployment/INFRA_SPRINT_CHECKLIST.md` | ✓ Move with history |
| `/docs/DEPLOY_BOOTSTRAP.md` | `/knowledge-base/operations/deployment/DEPLOY_BOOTSTRAP.md` | ✓ Move with history |
| `/docs/ERROR_PATTERNS.md` | `/knowledge-base/operations/monitoring/ERROR_PATTERNS.md` | ✓ Move with history |

## AI Context & Research (To `/knowledge-base/ai-context/`)

| Old Path | New Path | Status | Notes |
|---|---|---|---|
| `AGENTS.md` (root) | `/knowledge-base/ai-context/AGENT_SYSTEM_OVERVIEW.md` | ✓ Copy | Keep original at root for compatibility |
| `/docs/AGENTS_VISUAL_OVERVIEW.md` | `/knowledge-base/ai-context/reference/AGENTS_VISUAL_OVERVIEW.md` | ✓ Move with history |
| `/docs/AGENTS_NEXT_LEVEL_IMPLEMENTATION.md` | `/knowledge-base/ai-context/reference/AGENTS_NEXT_LEVEL_IMPLEMENTATION.md` | ✓ Move with history |
| `/docs/AGENT_SKILL_GOVERNANCE.md` | `/knowledge-base/ai-context/AGENT_SKILL_GOVERNANCE.md` | ✓ Move with history |
| `/docs/AGENT_SKILL_TEMPLATE.md` | `/knowledge-base/ai-context/reference/AGENT_SKILL_TEMPLATE.md` | ✓ Move with history |
| `/docs/AGENT_SKILL_IMPLEMENTATION_STEPS.md` | `/knowledge-base/ai-context/reference/AGENT_SKILL_IMPLEMENTATION_STEPS.md` | ✓ Move with history |
| `/docs/AGENT_IMPROVEMENT_PRIORITIES.md` | `/knowledge-base/ai-context/research/AGENT_IMPROVEMENT_PRIORITIES.md` | ✓ Move with history |
| `/docs/AI_DECISIONS/2026-04-24-*.md` | `/knowledge-base/ai-context/research/AI_DECISIONS_2026_04.md` | ✓ Move with history |
| `/docs/SKILLS_WAVE1_EXECUTION.md` | `/knowledge-base/ai-context/research/SKILLS_WAVE1_EXECUTION.md` | ✓ Move with history |
| `/docs/SKILLS_WAVE1_EVIDENCE_LOG.md` | `/knowledge-base/ai-context/research/SKILLS_WAVE1_EVIDENCE_LOG.md` | ✓ Move with history |
| `/docs/SKILLS_WAVE1_OUTPUT.md` | `/knowledge-base/ai-context/research/SKILLS_WAVE1_OUTPUT.md` | ✓ Move with history |
| `/docs/SKILLS_SCORECARD_*.md` | `/knowledge-base/ai-context/research/SKILLS_SCORECARD_2026_04.md` | ✓ Move with history |
| `/docs/SKILLS_NEXT_PHASE_PLAN.md` | `/knowledge-base/ai-context/research/SKILLS_NEXT_PHASE_PLAN.md` | ✓ Move with history |
| `/docs/PHASE_9_10_STRATEGY.md` | `/knowledge-base/ai-context/research/PHASE_9_10_STRATEGY.md` | ✓ Move with history |

## Experiments (To `/knowledge-base/experiments/`)

| Old Path | New Path | Status |
|---|---|---|
| `/docs/EXPERIMENTS/2026-04-24-*.md` | `/knowledge-base/experiments/2026-04-24-trial-activation.md` | ✓ Move with history |

## Files to Archive (Do Not Delete)

| Old Path | Archive Path | Reason |
|---|---|---|
| `/design_files/` | `/knowledge-base/archive/design_files_redundant/` | Duplicate with design-system; consolidate |
| `/docs/GOOGLE_OAUTH_VERIFICATION.md` | `/knowledge-base/archive/oauth-setup/` | Implementation-specific, not documentation |
| `/docs/CONTENT_DRAFT_PLAN.md` | `/knowledge-base/archive/legacy-planning/` | Superseded by current roadmap |
| `/_README.md` | Archive | Superseded by main README.md |

## Root Files (Update References)

| File | Action | Reason |
|---|---|---|
| `/README.md` | Update links | Reference knowledge-base/ for specs, ADRs, roadmap |
| `/CLAUDE.md` | Update section 6 | Reference knowledge-base/ structure |
| `/AGENTS.md` | Keep + reference | Compatibility; add link to knowledge-base/ai-context/ |

---

## Key Notes

1. **Design System Consolidation**: `design-system/` has complete assets + docs; `design_files/` is redundant. Keep design-system/, archive design_files/.
2. **Large File Splitting**: BACKLOG.md and SPRINT_PLAN.md are RAG-unfriendly. Split into priority tiers and semantic units.
3. **ADR Renaming**: Non-standard ADRs (root-level) should be numbered to 0009, 0010, etc. for consistency.
4. **AI Context**: Mirror key docs in ai-context/ for discovery; keep originals at source.
5. **No /.claude/ Migration**: Runtime system stays in place; only documentation is reorganized.
6. **Git History**: All moves use `git mv` to preserve blame and history.

