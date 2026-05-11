# Qesto Claude Agents — Step-by-Step Review, Next-Level Updates, and Implementation Spec

_Hub: [Documentation map](../README.md)._

_Date_: 2026-04-10  
_Scope reviewed_: `.claude/agents/*`, `.claude/skills/*`, `CLAUDE.md`, `.claude/settings.json`

## 1) Step-by-step review method used

1. **Baseline context check**
   - Reviewed `CLAUDE.md` to anchor on Qesto runtime, guardrails, and architecture invariants.
2. **Runtime policy check**
   - Reviewed `.claude/settings.json` hooks to verify current automation and guardrails.
3. **Agent inventory review**
   - Reviewed each agent in `.claude/agents/` for:
     - role clarity,
     - boundaries,
     - escalation triggers,
     - output format quality,
     - alignment with Qesto constraints (Workers AI, DRAFT/LIVE split, privacy/GDPR, multi-tenant).
4. **Skill compatibility review**
   - Reviewed each skill in `.claude/skills/` for structural consistency and overlap with agent instructions.
5. **Gap classification**
   - Grouped findings into: structure, policy drift, operational resilience, measurement.
6. **Upgrade plan drafting**
   - Produced a staged implementation plan with specs, owners, acceptance criteria, and rollout risk controls.

---

## 2) Current-state findings (agents)

## A. Strong foundation
- Agent boundaries are generally clear and role-appropriate (e.g., backend vs frontend vs PO).
- Qesto-specific constraints are embedded in most agent prompts.
- Most agents define escalation triggers and an output format.

## B. High-impact gaps to address
1. **Agent format inconsistency**
   - A few agent files are missing standardized metadata and section order.
2. **Potential instruction drift**
   - Shared hard rules (Workers AI only, secret handling, docs update obligations) are repeated with slight variations.
3. **Operational maturity unevenness**
   - Not all agents include explicit runbook-level guidance (rollback, incident triage, failure playbooks).
4. **No versioning/audit model for agent+skill changes**
   - There is no explicit versioning contract for prompts and behavior changes.
5. **No effectiveness loop**
   - No KPI layer ties agent quality to delivery outcomes.

---

## 3) Current-state findings (skills codebase)

1. **Skill quality is high but unevenly structured**
   - Some skills are comprehensive but long; others lack standard metadata blocks.
2. **Duplication across skills**
   - Cross-cutting rules (security, A11Y, docs updates, runtime constraints) are duplicated.
3. **Missing central rule source**
   - No single source of truth for global non-negotiables used by all skills.
4. **Missing lifecycle governance**
   - No formal process for deprecation, supersession, or compatibility mode.

---

## 4) Next-level target architecture (agents + skills)

## 4.1 Canonical Agent Spec (v1)
Each file in `.claude/agents/*.md` must include the exact section set:

1. `Metadata` (`model`, optional priority, version)
2. `Identity`
3. `Boundaries`
4. `Load Your Skill First`
5. `Task Workflow`
6. `Escalation Triggers`
7. `Output Format`
8. `Docs to Update`
9. `Do Not`
10. `Change Log` (short, latest-first)

## 4.2 Canonical Skill Spec (v1)
Each file in `.claude/skills/*.md` must include:

1. `Skill header` (`Skill`, `SCOPE`, `LOAD`, `VERSION`, `OWNER`)
2. `Role`
3. `Preconditions / Inputs`
4. `Workflow`
5. `Quality Gates`
6. `Output Contract`
7. `Docs to Update`
8. `Do Not`
9. `Metrics` (how to measure use quality)
10. `Change Log`

## 4.3 Shared rule registry
Create `.claude/skills/COMMON_RULES.md` as source of truth for:
- Workers AI only (`c.env.AI.run()`)
- No secrets in `wrangler.toml`
- DRAFT via REST, LIVE via DO/WebSocket
- GDPR/anonymity constraints
- required test/typecheck gates before merge/commit

All agents and skills should reference this file and avoid duplicating global rules.

## 4.4 Governance + versioning
Create `docs/AGENT_SKILL_GOVERNANCE.md` with:
- semantic versioning model for prompts,
- owner matrix,
- change approval path,
- compatibility policy (breaking vs non-breaking prompt updates),
- monthly review cadence.

---

## 5) Implementation plan (with specs)

## Phase 1 — Normalize structure (Week 1)
**Goal**: all agents and skills follow a consistent schema.

### Deliverables
1. `docs/AGENT_SKILL_TEMPLATE.md` (canonical templates)
2. Standardized headers/sections across all `.claude/agents/*.md`
3. Standardized headers/sections across all `.claude/skills/*.md`

### Acceptance criteria
- 100% of agents/skills include all required sections.
- No file missing `Do Not` and `Docs to Update`.

### Owner
- Architect + PO

---

## Phase 2 — Centralize shared constraints (Week 2)
**Goal**: remove policy drift.

### Deliverables
1. `.claude/skills/COMMON_RULES.md`
2. Updated references from all agents/skills to common rules
3. Reduced duplication in individual files

### Acceptance criteria
- At least 40% reduction in duplicated global-policy text.
- Zero conflicting statements of global rules.

### Owner
- Architect + CSO + DevOps

---

## Phase 3 — Operational hardening (Weeks 3–4)
**Goal**: improve real-world reliability under failures.

### Deliverables
1. Add runbook blocks to relevant agents/skills:
   - DevOps: deploy rollback + incident first-15-min
   - Tester: flaky test triage + quarantine protocol
   - CSO: release security gate matrix
   - Analytics: data quality checks
2. Add risk-tiered review protocol in review skill

### Acceptance criteria
- Every high-risk domain has an explicit failure playbook.
- Review skill includes Low/Med/High risk class workflow.

### Owner
- DevOps + CSO + QA + Analytics

---

## Phase 4 — Quality measurement loop (Weeks 5–6)
**Goal**: measure whether agent system quality is improving delivery.

### Deliverables
1. `docs/AGENT_SKILL_SCORECARD.md`
2. Monthly KPI dashboard spec with:
   - escaped defect rate,
   - PR rework rounds,
   - mean review turnaround,
   - test failure recurrence,
   - a11y regression count,
   - security finding recurrence.
3. Monthly retro ritual (what changed, what improved, what regressed)

### Acceptance criteria
- First monthly scorecard published.
- Top 3 corrective actions captured for following sprint.

### Owner
- PO + QA + Analytics

---

## 6) Technical specs for implementation artifacts

## Spec A — `docs/AGENT_SKILL_TEMPLATE.md`
Must define:
- required section order,
- minimum content expectations per section,
- concise examples.

## Spec B — `.claude/skills/COMMON_RULES.md`
Must define:
- global invariant list,
- precedence model (`COMMON_RULES` overrides local ambiguity),
- “last reviewed” date.

## Spec C — `docs/AGENT_SKILL_GOVERNANCE.md`
Must define:
- owner per agent/skill,
- review cadence,
- PR checklist for prompt changes,
- rollback process for bad prompt updates.

## Spec D — `docs/AGENT_SKILL_SCORECARD.md`
Must define:
- KPI formulas,
- data sources,
- reporting cadence,
- thresholds for escalation.

---

## 7) Priority backlog (ready to execute)

1. **AS-001** — Canonical templates for agents/skills (5pt)
2. **AS-002** — Introduce COMMON_RULES + de-duplicate files (8pt)
3. **AS-003** — Governance + owner matrix + versioning (5pt)
4. **AS-004** — Operational runbook upgrades by domain (8pt)
5. **AS-005** — KPI scorecard + monthly retrospective process (5pt)

Dependency chain: `AS-001 -> AS-002 -> AS-003`; `AS-004` can start after `AS-001`; `AS-005` starts after `AS-003`.

---

## 8) Risk register

- **Risk**: over-standardization can reduce role nuance.  
  **Mitigation**: keep common template + role-specific extension blocks.
- **Risk**: migration churn across many files.  
  **Mitigation**: phase rollout and gate via template validator checklist.
- **Risk**: ownership ambiguity stalls updates.  
  **Mitigation**: governance doc includes DRI per file.

---

## 9) Recommended immediate next actions (this week)

1. Approve the canonical template structure (Spec A).
2. Create `COMMON_RULES.md` and align 3 pilot agents first (`backend`, `frontend`, `cso`).
3. Ship governance doc and assign owners.
4. Start runbook hardening for DevOps + Tester.

