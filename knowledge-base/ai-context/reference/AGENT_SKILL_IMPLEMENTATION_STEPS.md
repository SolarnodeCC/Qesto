# Step-by-step implementation per agent and skill

_Hub: [Documentation map](./README.md)._

_Date_: 2026-04-10

## Implementation status summary
- ✅ Common rules created
- ✅ Canonical template created
- ✅ Governance spec created
- ✅ Scorecard spec created
- ✅ Per-agent and per-skill rollout steps defined below

---

## Agent-by-agent implementation steps

### 1) `architect-agent.md`
1. Add `VERSION` and `OWNER` header lines.
2. Add mandatory reference to `.claude/skills/COMMON_RULES.md`.
3. Align section order to canonical template.
4. Add `Change Log` section.

### 2) `backend-agent.md`
1. Add `VERSION` and `OWNER` header lines.
2. Add shared-rules reference.
3. Move runbook-like pieces under explicit `Task Workflow`.
4. Add `Change Log`.

### 3) `frontend-agent.md`
1. Add `VERSION` and `OWNER`.
2. Replace duplicated global constraints with `COMMON_RULES` reference.
3. Keep UI/A11Y specifics delegated to `ui-mobile` skill.
4. Add `Change Log`.

### 4) `tester-agent.md`
1. Add `VERSION` and `OWNER`.
2. Add flaky test triage subsection under workflow.
3. Add shared-rules reference and change log.

### 5) `cso-agent.md`
1. Normalize headings to canonical order.
2. Add `VERSION`, `OWNER`, and `Change Log`.
3. Ensure release gate matrix is explicitly included.

### 6) `devops-agent.md`
1. Add `VERSION` and `OWNER`.
2. Add rollback and first-15-minute incident flow.
3. Add change log and shared-rules reference.

### 7) `analytics-agent.md`
1. Add `VERSION` and `OWNER`.
2. Add data quality gate subsection.
3. Add change log.

### 8) `i18n-agent.md`
1. Add `VERSION` and `OWNER`.
2. Add key lifecycle/deprecation subsection.
3. Add change log.

### 9) `ai-strategy-agent.md`
1. Add docs-update section if missing.
2. Add KPI linkage subsection.
3. Add change log.

### 10) `marketing-agent.md`
1. Add experiment card template subsection.
2. Add `VERSION`, `OWNER`, change log.

### 11) `po-agent.md`
1. Add in-sprint scope-change protocol section.
2. Add `VERSION`, `OWNER`, change log.

---

## Skill-by-skill implementation steps

### Core delivery skills
- `architect.md`, `backend-dev.md`, `frontend-dev.md`, `tester.md`, `review.md`, `investigate.md`
1. Add canonical header fields (`VERSION`, `OWNER`).
2. Add `Metrics` and `Change Log` sections.
3. Replace duplicated global constraints with links to `COMMON_RULES.md`.

### Specialization skills
- `cso.md`, `devops.md`, `analytics.md`, `i18n.md`, `ui-mobile.md`, `ai-strategy.md`, `marketing.md`, `product-owner.md`
1. Align section ordering with canonical template.
2. Ensure each includes explicit quality gates.
3. Ensure each includes docs-update mapping and change log.

---

## Execution sequence
1. Baseline: apply canonical headers to all agents/skills.
2. Add `COMMON_RULES` references and deduplicate constraints.
3. Add missing sections (`Metrics`, `Change Log`, runbooks).
4. Validate template compliance via review checklist.
5. Run `npm test` and `npm run typecheck`.

## Definition of done
- Every agent/skill file has required canonical sections.
- No conflicting global rules remain.
- Governance + scorecard docs are live.
- Review checklist can validate compliance in one pass.
