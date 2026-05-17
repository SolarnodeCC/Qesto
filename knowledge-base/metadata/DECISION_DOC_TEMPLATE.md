---
id: METADATA
type: schema
category: templates
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - schema
  - templates
  - metadata
relates_to:
  - CONTRIBUTING
---

# Decision Doc Template
# OWNER: Product Owner
# Version: v1.0.0

_Use this template to document architectural, product, or operational decisions. Publish in `docs/DECISIONS/`._

---

## Metadata
- **Title**: [Brief decision name, e.g., "Realtime Scaling Strategy"]
- **Decision ID**: [ARCH-XXX or PROD-XXX]
- **Date**: [YYYY-MM-DD]
- **Owner**: [Name / Role]
- **Status**: [Proposed / Approved / Implemented / Obsolete]

---

## Problem Statement
**What problem are we solving?**

- Context: When/where does this problem occur?
- Impact: How much does it cost (time, resources, customers)?
- Scope: What systems are affected?

Example: "Qesto sessions >500 participants hit Durable Object CPU limits, blocking Pro tier growth."

---

## Options Considered
**What were the alternatives?**

For each option:
1. **Title**: [e.g., "Option A: Shard DO by question"]
2. **Approach**: Brief description
3. **Pros**: [List 3–5]
4. **Cons**: [List 3–5]
5. **Estimated effort**: [Person-weeks, relative scale]
6. **Risk**: [Known gotchas, unknowns]

---

## Recommendation
**Which option do we choose and why?**

- Selected option: [Name]
- Rationale: [2–3 sentences on why this beats others]
- Trade-offs accepted: [What we're giving up]

---

## Implementation Plan
**How will we execute?**

- Phase 1: [Week 1–2] What
- Phase 2: [Week 3–4] What
- Rollout strategy: [Staged / all-at-once / feature-flag]
- Success criteria: [How do we know it worked?]
- Rollback plan: [How do we undo if it fails?]

---

## Dependencies & Blockers
- Depends on: [ARCH-XXX, PROD-YYY, etc.]
- Blocked by: [None / list items]
- External dependencies: [Infrastructure, third-party APIs, etc.]

---

## Assumptions
- [Assumption 1: e.g., "D1 query latency stays <100ms at 10k sessions"]
- [Assumption 2]

---

## Known Unknowns
- [e.g., "DO memory overhead per shard not yet measured"]
- [e.g., "Customer impact of migration downtime unknown"]

---

## Timeline
- **Decision deadline**: [YYYY-MM-DD]
- **Start date**: [YYYY-MM-DD]
- **Completion target**: [YYYY-MM-DD]

---

## Approval
- [ ] Architect sign-off: [Name, Date]
- [ ] Security review: [Name, Date]
- [ ] Product sign-off: [Name, Date]

---

## Decision Log
- **[YYYY-MM-DD]**: Decision proposed
- **[YYYY-MM-DD]**: Approved by [team]
- **[YYYY-MM-DD]**: Implementation started
- **[YYYY-MM-DD]**: Completed
