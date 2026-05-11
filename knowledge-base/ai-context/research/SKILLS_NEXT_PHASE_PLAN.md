# Qesto Skills Review & Next-Phase Strengthening Plan

_Hub: [Documentation map](../README.md)._

_Date: 2026-04-10_

## 1) What was reviewed (step-by-step)

1. Enumerated all skills under `.claude/skills/`.
2. Reviewed each skill for structure consistency (`Role/Rol`, `SCOPE`, `LOAD`, guardrails, output templates).
3. Checked cross-skill alignment with Qesto platform constraints (Workers AI only, DRAFT vs LIVE mutation rules, privacy/GDPR, Stripe/SSO controls).
4. Identified overlap, drift risks, and missing operational guidance.
5. Prioritized improvements into a phased roadmap for the next website/product phase.

---

## 2) Current skill inventory

### Product & strategy
- `product-owner.md`
- `marketing.md`
- `ai-strategy.md`

### Engineering delivery
- `architect.md`
- `backend-dev.md`
- `frontend-dev.md`
- `devops.md`
- `tester.md`
- `review.md`
- `investigate.md`

### Quality, risk, specialization
- `cso.md`
- `analytics.md`
- `i18n.md`
- `ui-mobile.md`

---

## 3) Skill-by-skill review summary and improvements

## `architect.md`
**Strengths**
- Strong invariants and state-model clarity.
- Useful decision checklist and documentation expectations.

**Gaps to improve**
- Add explicit "conflict resolution" guidance when Architect recommendations differ from Backend/DevOps implementation constraints.
- Add architecture decision record (ADR) mini-template for non-trivial choices.

**Action**
- Add `ADR Lite` section with: context, options, trade-offs, final choice, rollback path.

## `backend-dev.md`
**Strengths**
- Excellent edge-runtime-compatible implementation guidance.
- Strong KV/D1/DO patterns and anti-patterns.

**Gaps to improve**
- The file is very long; operationally high cognitive load.
- Need explicit "Definition of Ready" checklist before coding starts.

**Action**
- Split into `core` + `recipes` sections or linked docs.
- Add a concise pre-implementation checklist.

## `frontend-dev.md`
**Strengths**
- Strong implementation direction for React/Tailwind and product context.

**Gaps to improve**
- Duplicates some `ui-mobile.md` quality gates.
- Could better separate hard requirements vs style preferences.

**Action**
- Keep normative rules in one canonical place (`ui-mobile.md`) and reference them from frontend skill.

## `devops.md`
**Strengths**
- Strong deployment and infrastructure focus.

**Gaps to improve**
- Add clear rollback runbook snippets for failed deploys.
- Add environment parity checklist (local/staging/prod binding parity).

**Action**
- Add "incident quick response" section with first 15-minute triage commands.

## `tester.md`
**Strengths**
- Good test patterns and quality gates.
- Covers AI mocking and DO/WS testing.

**Gaps to improve**
- Add flaky-test triage workflow and quarantine policy.
- Add minimum coverage targets by critical domains (auth, billing, session lifecycle).

**Action**
- Introduce coverage gates and flaky-test playbook.

## `review.md`
**Strengths**
- Practical review gate flow and strong merge discipline.

**Gaps to improve**
- Missing docs-update obligations and explicit change-risk scoring.

**Action**
- Add lightweight `risk class` section (Low/Medium/High) to set required review depth.

## `investigate.md`
**Strengths**
- Focused root-cause protocol, good DO/WS troubleshooting checklist.

**Gaps to improve**
- Missing header metadata consistency (`# SCOPE`, `# LOAD`).
- Missing explicit "Do Not" safeguards.

**Action**
- Add standard metadata block and safety constraints.

## `cso.md`
**Strengths**
- Excellent OWASP + STRIDE structure.

**Gaps to improve**
- Missing standard section naming consistency (`Role`, `Do Not`, `Docs to Update`).
- Add explicit secure coding acceptance gates per release type.

**Action**
- Standardize format and include release gate matrix (hotfix, minor, major).

## `analytics.md`
**Strengths**
- Clear AE schema and useful query patterns.

**Gaps to improve**
- Needs data quality checks (event completeness, cardinality anomalies, null-rates).

**Action**
- Add data reliability section and weekly metric sanity checklist.

## `i18n.md`
**Strengths**
- Strong internationalization guardrails and translation process focus.

**Gaps to improve**
- Add guidance for key deprecation/removal lifecycle.
- Add pseudo-localization testing requirements for UI overflow.

**Action**
- Introduce key lifecycle policy and pseudo-locale test gate.

## `ui-mobile.md`
**Strengths**
- Very strong accessibility and mobile quality specifics.

**Gaps to improve**
- Missing standard metadata fields for auto-loading consistency.
- Could include explicit test ownership mapping by page/team.

**Action**
- Add metadata header + ownership table for ongoing accountability.

## `product-owner.md`
**Strengths**
- Strong backlog dependency logic and acceptance criteria template.

**Gaps to improve**
- Add explicit "scope change protocol" during active sprint.

**Action**
- Add decision tree: accept in sprint vs move to backlog.

## `marketing.md`
**Strengths**
- Clear scope around growth, messaging, and funnel outcomes.

**Gaps to improve**
- Add controlled experimentation structure (hypothesis, duration, stopping criteria).

**Action**
- Add experiment card template and guardrails to avoid vanity metrics.

## `ai-strategy.md`
**Strengths**
- Excellent AI-first vs AI-shaped framing and maturity model.

**Gaps to improve**
- Missing explicit docs-update section for consistency with other skills.
- Add measurable KPI linkage per competency.

**Action**
- Add KPI mapping: latency, adoption, override-rate, insight utility.

---

## 4) Cross-skill systemic issues to fix first

1. **Template inconsistency**
   - Some skills use `Rol` (NL) vs `Role` (EN), and a few miss standard headers/sections.
2. **Duplication drift risk**
   - Mobile/a11y rules repeated in multiple skills.
3. **No global versioning/changelog model**
   - Hard to track when a rule changed and why.
4. **Limited execution metrics for skills themselves**
   - No score for whether skills produce better delivery outcomes.

---

## 5) Next-phase roadmap (8 weeks)

## Phase 1 (Week 1-2): Skill Framework Standardization
- Create a **single canonical skill template** with required blocks:
  - Metadata (`Skill`, `SCOPE`, `LOAD`)
  - Role
  - Inputs required from user
  - Step-by-step workflow
  - Output format
  - Docs to Update
  - Do Not
- Normalize `investigate.md`, `ui-mobile.md`, and `cso.md` to this template.
- Add language policy (English-first with NL examples where needed).

**Success criteria**
- 100% skills use same structural headers.
- 0 skills missing `Do Not` and `Docs to Update`.

## Phase 2 (Week 3-4): De-duplication and Ownership
- Create `skills/COMMON_RULES.md` for shared constraints (AI provider, privacy, DRAFT/LIVE mutation rules, secret handling).
- Refactor each skill to reference shared rules instead of duplicating text.
- Assign **owner per skill** (e.g., Architect owns `architect.md`, QA owns `tester.md`).

**Success criteria**
- Duplicate policy text reduced by at least 40%.
- Every skill has one accountable owner.

## Phase 3 (Week 5-6): Operational Hardening
- Add runbooks/checklists:
  - DevOps rollback
  - Flaky test triage
  - Security release gates
  - Analytics data quality checks
- Add risk tiers for review requirements in `review.md`.

**Success criteria**
- High-risk changes have explicit enhanced checks.
- Incident response and rollback guidance available in-skill.

## Phase 4 (Week 7-8): Measure Skill Effectiveness
- Define a **Skill KPI dashboard** (tracked monthly):
  - Escaped defect rate
  - PR rework cycle count
  - Mean review turnaround
  - Build/test failure recurrence
  - Accessibility regression count
- Add a monthly `skills retrospective` ritual to revise weak sections.

**Success criteria**
- First monthly scorecard published.
- Top 3 skill improvements scheduled each month.

---

## 6) Priority backlog (highest impact first)

1. Standardize metadata/sections across all skills.
2. Add shared rules file and remove duplicate constraints.
3. Add explicit runbooks for incident, rollback, flaky tests, and security release gates.
4. Add skill ownership + review cadence.
5. Add effectiveness metrics and recurring retrospective.

---

## 7) Suggested implementation governance

- **Cadence**: bi-weekly skills maintenance mini-sprint (60-90 minutes).
- **Change control**: any skill change requires:
  1. Rationale,
  2. impacted skills list,
  3. migration notes for existing usage.
- **Quality gate for skill updates**:
  - No contradictory instructions with AGENTS.md constraints.
  - Must include one concrete example and one anti-pattern.

---

## 8) Immediate next actions (this sprint)

1. Normalize `investigate.md`, `ui-mobile.md`, `cso.md` to standard template.
2. Add `Docs to Update` and `Do Not` where missing.
3. Add `COMMON_RULES.md` and replace duplicated policy blocks in first 4 critical skills (`architect`, `backend-dev`, `review`, `tester`).
4. Add ownership table at top of each skill.

