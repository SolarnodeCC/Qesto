---
id: AI-CONTEXT
type: reference
domain: ai
category: agents
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - ai
  - agents
  - skills
  - research
relates_to:
  - AGENT_SYSTEM_OVERVIEW
---

# Agent & Skill Governance

_Hub: [Documentation map](./README.md)._

## Versioning model
- Semantic versioning for prompt assets:
  - MAJOR: breaking behavior or structure change.
  - MINOR: new sections/capabilities, backward-compatible.
  - PATCH: clarifications and typo-level improvements.

## Owners (DRI)
- Architect: architect, backend, system contracts, COMMON_RULES, HANDOFFS (edge map)
- PO: product-owner, roadmap and scope, market-research (+ templates)
- QA: tester, review quality gates, investigate
- CSO: security/cso
- DevOps: infra/deployment/devops
- Frontend Lead: frontend, ui-mobile, i18n
- Analytics Lead: analytics
- AI Strategy Lead: ai-strategy
- Growth Lead: marketing, release-notes (with PO)
- Sales Lead: sales, deal cycle, sales enablement
- Knowledge Lead: knowledge, KB integrity + requirement traceability + KB→Vectorize lifecycle

## Edge governance
Cross-role handoffs are defined in `.claude/skills/HANDOFFS.md`. Each edge names an owner
who is accountable for unblocking it. New cross-role dependencies require a new edge row in
the same change (see COMMON_RULES §11).

## Change policy
1. Open PR with:
   - rationale,
   - impacted files,
   - risk class (Low/Medium/High),
   - rollout plan.
2. Require at least one domain-owner review for impacted files.
3. For High risk prompt updates, require one additional reviewer.

## Rollback
- Revert to previous tagged prompt version on regressions.
- Capture regression in monthly scorecard and add remediation action.

## Cadence
- Monthly prompt quality review.
- Quarterly structural audit against template compliance.
