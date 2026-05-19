---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Qesto Knowledge Base

**Migration Date**: 2026-05-11  
**Total Documents**: 123 markdown files + design assets  
**Structure**: Complete reorganization for RAG optimization and discoverability

---

## Overview

This is the centralized knowledge base for the Qesto project. All documentation, specifications, architecture decisions, roadmaps, and operational guides are organized here for easy discovery and AI-powered retrieval.

**Note**: The Claude Code agent/skill runtime system (`/.claude/agents/`, `/.claude/skills/`) remains at the repository root and is NOT part of this structure.

---

## Navigation

### Core Reference

- **[Architecture](./architecture/README.md)** — System design, technical decisions, Cloudflare optimizations
- **[Architecture Decision Records (ADRs)](./adr/)** — 12 key technical decisions
- **[Specifications](./specifications/)** — Domain specs (core, backend, frontend, realtime, integrations, data, deployment)

### Product & Roadmap

- **[Roadmap](./product/roadmap/)** — Strategic direction, epics, version planning
- **[Backlog](./product/backlog/)** — Product backlog (master reference at `BACKLOG_MASTER.md`)
- **[Market Research](./product/research/)** — Competitive intelligence, customer insights, market trends (updated quarterly)
- **[Release Notes](./product/releases/)** — Version history, release plans, audit outcomes
- **[Planning](./product/planning/)** — Sprint plans, implementation specs (sprints 19-32)

### Quality & Operations

- **[Quality Assurance](./quality/)** — Testing pyramid, accessibility, audit findings
- **[Security](./security/)** — Security policy, compliance, rotation procedures
- **[Operations](./operations/)** — Runbooks, deployment, monitoring, incident response

### API & Integration

- **[API Documentation](./api/)** — REST endpoints, WebSocket protocol, MCP tools
- **[Integrations](./specifications/domain/SPEC_INTEGRATIONS.md)** — External services, contracts

### Governance & Standards

- **[Governance](./governance/)** — Brand voice, design system, i18n, compliance
- **[Database Governance](./governance/DATABASE_GOVERNANCE.md)** — Data policy, schema versioning
- **[Design System](./governance/design-system/)** — UI kits, components, tokens, brand assets

### AI & Research

- **[AI Context](./ai-context/)** — Agent system overview, skill governance, research & decisions
- **[AI Decisions](./ai-context/research/)** — AI competency scores, wave execution logs

### Metadata & Supporting

- **[Metadata](./metadata/)** — Templates, schemas, decision logs, spec includes

---

## Quick Links

| Topic | Primary | Secondary |
|---|---|---|
| **"How do we build X?"** | [Specifications](./specifications/) | [ADRs](./adr/) |
| **"What's coming next?"** | [Roadmap](./product/roadmap/) | [Backlog](./product/backlog/) |
| **"What do customers need?"** | [Market Research](./product/research/) | [Backlog](./product/backlog/) |
| **"How are competitors positioned?"** | [Market Research](./product/research/) | [SPEC_PRODUCT](./specifications/product/SPEC_PRODUCT.md) |
| **"What broke?"** | [Operations](./operations/incidents/) | [Error Patterns](./operations/monitoring/ERROR_PATTERNS.md) |
| **"How is X approved?"** | [ADRs](./adr/) | [Security](./security/) |
| **"What are the standards?"** | [Governance](./governance/) | [Design System](./governance/design-system/) |
| **"What tests exist?"** | [Quality](./quality/testing/) | [Accessibility](./quality/accessibility/) |

---

## Folder Structure

```
knowledge-base/
├── adr/                          # 12 Architecture Decision Records
├── architecture/                 # System design and technical overview
├── specifications/               # Domain, product, and feature specs
│   ├── domain/                   # SPEC_CORE, BACKEND, FRONTEND, REALTIME, etc.
│   ├── product/                  # Product and website specs
│   └── features/                 # Feature-specific designs
├── api/                          # REST and WebSocket API documentation
├── security/                     # Security policy, compliance, audits
├── quality/                      # Testing, accessibility, quality audits
│   ├── testing/                  # Test pyramid, QA strategy
│   ├── accessibility/            # A11y guidelines
│   └── audits/                   # Quality and code audits
├── operations/                   # Deployment, incidents, monitoring
│   ├── deployment/               # Bootstrap, infrastructure checklists
│   ├── incidents/                # Runbooks, incident response
│   └── monitoring/               # Observability, error patterns
├── product/                      # Roadmap, backlog, releases, planning, market research
│   ├── roadmap/                  # Strategic direction and epics
│   ├── backlog/                  # Product backlog (master reference)
│   ├── research/                 # Market research, competitive analysis, customer insights
│   ├── releases/                 # Version history and rollout plans
│   └── planning/                 # Sprint plans and implementation specs
├── governance/                   # Brand, i18n, database policy, design system
├── ai-context/                   # Agent system, skill governance, research
│   ├── reference/                # Templates and reference docs
│   └── research/                 # Decisions, evidence logs, planning
├── metadata/                     # Schemas, templates, supporting docs
├── experiments/                  # Active experiments and prototypes
└── archive/                      # Legacy docs, redundant content
```

---

## File Naming Conventions

All files follow these patterns:

- **ADRs**: `ADR-{number}-{kebab-case-title}.md` (e.g., `ADR-0001-do-per-session.md`)
- **Specifications**: `SPEC_{DOMAIN}.md` (e.g., `SPEC_BACKEND.md`, `SPEC_FRONTEND.md`)
- **Audit Files**: `{audit-type}-audit.md` (e.g., `architecture-audit.md`)
- **Runbooks**: `RUNBOOK_{PROCESS}.md` (e.g., `RUNBOOK_SESSION_RECONCILE.md`)
- **Sprint Specs**: `SPRINT{number}_{TYPE}_SPEC.md` (e.g., `SPRINT28_IMPLEMENTATION_SPEC.md`)

---

## Metadata Headers

Every document includes YAML frontmatter for discoverability:

```yaml
---
id: ADR-0001
type: adr|specification|guide|policy|template
domain: architecture|backend|frontend|data|realtime|operations|security
status: approved|draft|deprecated|archived
owner: Team or @username
version: 1.0
relates_to:
  - ADR-0002
  - SPEC-BACKEND
tags:
  - keyword1
  - keyword2
---
```

---

## Entry Points by Role

### Product Owner / Manager
1. Start: [Roadmap](./product/roadmap/)
2. Customer research: [Market Research](./product/research/) for competitive context and customer insights
3. Drill down: [Backlog](./product/backlog/)
4. Reference: [ADRs](./adr/) for constraints

### Backend Developer
1. Start: [SPEC_BACKEND](./specifications/domain/SPEC_BACKEND.md)
2. Design review: [ADRs](./adr/) (especially ADR-0001, 0007, 0008)
3. Data model: [SPEC_DATAMODEL](./specifications/domain/SPEC_DATAMODEL.md)
4. Integration: [SPEC_INTEGRATIONS](./specifications/domain/SPEC_INTEGRATIONS.md)

### Frontend Developer
1. Start: [SPEC_FRONTEND](./specifications/domain/SPEC_FRONTEND.md)
2. Design system: [Design System](./governance/design-system/)
3. Realtime: [SPEC_REALTIME](./specifications/domain/SPEC_REALTIME.md)
4. Accessibility: [A11Y Guide](./quality/accessibility/)

### DevOps / Infrastructure
1. Start: [Deployment Guide](./operations/deployment/)
2. Infrastructure: [SPEC_DEPLOYMENT](./specifications/domain/SPEC_DEPLOYMENT.md)
3. Incidents: [Runbooks](./operations/incidents/)
4. Monitoring: [Observability](./operations/monitoring/)

### Security / Compliance
1. Start: [Security Policy](./security/SECURITY_FULL.md)
2. Governance: [Database Governance](./governance/DATABASE_GOVERNANCE.md)
3. Rotation procedures: [Secret Runbook](./operations/incidents/SECRET_RUNBOOK.md)
4. Audit findings: [Quality Audits](./quality/audits/)

### AI Strategy / Agent Development
1. Start: [AI Context Overview](./ai-context/)
2. Governance: [Skill Governance](./ai-context/AGENT_SKILL_GOVERNANCE.md)
3. Research: [AI Decisions & Evidence](./ai-context/research/)
4. Templates: [Skill Template](./ai-context/reference/AGENT_SKILL_TEMPLATE.md)

---

## Recent Changes

**2026-05-11**: Complete knowledge-base migration
- Reorganized 123 files from `/docs/`, `/audits/`, root level into unified structure
- Preserved all git history using `git mv`
- Consistent naming conventions applied
- Added folder-level navigation
- /.claude/ runtime system remains unchanged

---

## Contributing

To add or update documentation:

1. Place files in the appropriate folder based on type/domain
2. Follow naming conventions (kebab-case, ADR-{num}, SPEC_, etc.)
3. Include YAML frontmatter with metadata
4. Update parent folder README if creating new section
5. Run link validation before committing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## Search & Discovery

For AI agent retrieval, documents are optimized:
- Small, focused semantic units (avoid oversized files)
- Consistent metadata (YAML frontmatter)
- Cross-references and `relates_to` fields
- Clear type/domain/status tags
- Regular link validation

---

## Archived Content

Legacy, superseded, or implementation-specific docs are preserved in [`/archive/`](./archive/) for reference. Do not use as current source of truth.

---

**Last Updated**: 2026-05-11  
**Maintainer**: Knowledge Base Migration Script  
**Source**: claude/migrate-knowledge-base-I0PpQ branch
