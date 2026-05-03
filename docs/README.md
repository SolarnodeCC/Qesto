# Qesto — Documentation map

_Last updated: 2026-04-19 (UTC)_

This file is the **entry point** for everything under `docs/`: how documents connect, what to read first, and **which source wins** when wording differs. The repository root **[`README.md`](../README.md)** links here so clones and Git hosts land on the same map.

---

## Truth hierarchy (when documents conflict)

1. **Running code** (`functions/`, `src/`, `worker/`, migrations, `wrangler.*`) — authority for actual behaviour.
2. **Domain specifications** (`docs/spec/SPEC_*.md`) — implementation and API contracts. Each SPEC states that **code wins** until an intentional spec PR updates the document.
3. **Shipped product and roadmap** — **`ROADMAP_FULL.md`** and **`SPEC.md`** describe what is live and what is targeted next at release level.
4. **Incremental product work** — **`BACKLOG.md`** (including §12 Website Design Wave) plus **`ARCHIVED_SPRINTS.md`** for historical sprint summaries.
5. **Reference sprint arc** — **`SPRINT_PLAN.md`** describes a **v0.1.0 → v0.5.0 teaching / dependency sequence** aligned to backlog epics. It is **not** a literal greenfield schedule; the repository is already on **v2.x**. Story-level fields such as **Sprint: 1–5** in **`BACKLOG.md`** refer to this reference arc for ordering, not to calendar week truth.
6. **Architecture snapshot** — **`ARCHITECTURE.md`** — short current technical overview; depth lives in **`spec/SPEC_CORE.md`** and linked specs.

---

## Recommended reading order

### New engineer (implementation)

1. Root **`CLAUDE.md`** and **`AGENTS.md`** (tooling, commands, guardrails).
2. **`ARCHITECTURE.md`** — runtime and data overview.
3. **`spec/INDEX.md`** — open **`includes/PREBUILD_AND_DELIVERY.md`**, then the **`SPEC_*.md`** for your area.
4. **`QA_FULL.md`** and **`TESTING_PYRAMID.md`** before your first merge.

### Product, planning, and stakeholders

1. **`ROADMAP_FULL.md`**
2. **`SPEC.md`**
3. **`BACKLOG.md`**
4. **`SPRINT_PLAN.md`** (reference sequencing only; see hierarchy above)

### Security, compliance, and operations

- **`SECURITY_FULL.md`**, **`SECRET_RUNBOOK.md`**, **`SECRET_ROTATION_POLICY.md`**
- **`DATABASE_GOVERNANCE.md`**, **`OBSERVABILITY.md`**
- **`spec/SPEC_DEPLOYMENT.md`**

### Visual design and dashboard / marketing UI

- **`specs/WEBSITE_DESIGN_SPEC.md`**, **`specs/design-tokens.json`**
- **`spec/SPEC_FRONTEND.md`**, **`BACKLOG.md`** §12

### Internationalisation

- **`I18N_GLOSSARY.md`**, **`spec/SPEC_FRONTEND.md`** (i18n sections)
- **`I18N_ARCHITECTURE_CONTRACT.md`** for the runtime/source-of-truth contract and app-vs-marketing scope boundary
- CI: `npm run check:i18n`
- Inventory report: `npm run report:i18n:gaps` (writes `docs/reports/i18n-gap-inventory.md` + `.json`)

### AI agent framework (skills, governance, scorecards)

- **`AGENT_SKILL_GOVERNANCE.md`**, **`AGENT_SKILL_TEMPLATE.md`**, **`AGENT_SKILL_SCORECARD.md`**
- **`AGENT_SKILL_IMPLEMENTATION_STEPS.md`**, **`AGENTS_NEXT_LEVEL_IMPLEMENTATION.md`**, **`SKILLS_NEXT_PHASE_PLAN.md`**

---

## File index

### `docs/` (narratives, governance, QA, runbooks)

| Document | Role |
|----------|------|
| `README.md` | This map — start here |
| `SPEC.md` | Short product specification |
| `ARCHITECTURE.md` | Short architecture snapshot |
| `ROADMAP_FULL.md` | Release and epic status |
| `BACKLOG.md` | Epics, stories, Website Design Wave |
| `SPRINT_PLAN.md` | Reference five-sprint v0.x arc (pedagogical) |
| `ARCHIVED_SPRINTS.md` | Historical sprints |
| `API_FULL.md` | API / realtime summary |
| `QA_FULL.md` | QA and test strategy |
| `SECURITY_FULL.md` | Security and privacy baseline |
| `A11Y_FULL.md`, `ACCESSIBILITY_GUIDE.md` | Accessibility |
| `GLOSSARY_FULL.md` | Product and technical terms |
| `ERROR_PATTERNS.md` | Error patterns |
| `DATABASE_GOVERNANCE.md` | Database practices |
| `OBSERVABILITY.md` | Logging and metrics posture |
| `TESTING_PYRAMID.md` | Test layering |
| `PLAN_ENTITLEMENT_AUDIT.md` | Entitlement audit plan |
| `SPRINT20_READINESS_SPEC.md` | Sprint 20 entitlement, observability, and KPI baseline implementation spec |
| `ADR-workers-ai-capabilities.md` | Architecture decision record |
| `CLOUDFLARE_WORKERS_OPTIMIZATION.md` | Workers performance notes |

### `docs/spec/` (technical specifications)

| Document | Role |
|----------|------|
| `INDEX.md` | Master table of contents and task matrix |
| `includes/PREBUILD_AND_DELIVERY.md` | Scope, gates, golden path |
| `SPEC_CORE.md` | Architecture and constraints |
| `SPEC_DATAMODEL.md` | D1, KV, types |
| `SPEC_FRONTEND.md` | React, routing, hooks, UI contracts |
| `SPEC_BACKEND.md` | Routes, middleware, services |
| `SPEC_REALTIME.md` | WebSocket and Durable Objects |
| `SPEC_INTEGRATIONS.md` | Stripe, AI, email, external systems |
| `SPEC_DEPLOYMENT.md` | Build, secrets, CI/CD, environments |

### `docs/specs/` (visual design system)

| Document | Role |
|----------|------|
| `WEBSITE_DESIGN_SPEC.md` | Visual and UX source of truth |
| `design-tokens.json` | Machine-readable tokens |
| `design-tokens.README.md` | How tokens relate to the spec, repo docs, and `src/ui/tokens.ts` |

---

## Maintenance rule

When you ship a feature, change a public contract, or retire a document, update **this README** (if navigation changes), **`ROADMAP_FULL.md`**, **`SPEC.md`** where relevant, **`BACKLOG.md`** / **`ARCHIVED_SPRINTS.md`** for planning truth, and the affected **`spec/SPEC_*.md`** in the **same PR** when practical.
