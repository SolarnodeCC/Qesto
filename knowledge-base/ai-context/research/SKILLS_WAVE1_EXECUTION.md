# Qesto Skills Wave 1 Execution

_Hub: [Documentation map](./README.md)._

_Date: 2026-04-24_
_Status: In execution_

## Scope

This runbook executes **Wave 1** from the skills rollout backlog:

1. `webapp-testing`
2. `mcp-builder`
3. `skill-creator`
4. `frontend-design`
5. `doc-coauthoring`
6. `internal-comms`

## Hard guardrails

- Runtime AI integrations remain **Workers AI only** (`c.env.AI.run`).
- Keep security and secret handling aligned with `CLAUDE.md` + `AGENTS.md`.
- Do not bypass existing quality gates (`npm test`, type checks, route safety).

---

## Wave 1 Board

| Skill | Owner(s) | Priority | Status | Sprint Outcome |
|---|---|---|---|---|
| `webapp-testing` | `qesto-tester` + `qesto-frontend` | P0 | Planned | Browser smoke suite for auth + session lifecycle + billing |
| `mcp-builder` | `qesto-architect` + `qesto-backend` | P0 | Planned | Internal MCP server (8-12 tools) with typed outputs and pagination |
| `skill-creator` | `qesto-product-owner` + `qesto-ai-strategy` | P0 | Planned | 5 internal Qesto skills with eval prompts and baseline loop |
| `frontend-design` | `qesto-frontend` | P0 | Planned | One onboarding flow redesign with WCAG AA and no lighthouse regression |
| `doc-coauthoring` | `qesto-product-owner` | P0 | Planned | Decision-doc workflow + reader testing applied to one architecture doc |
| `internal-comms` | `qesto-marketing` + `qesto-product-owner` | P0 | Planned | Standardized 3P, incident update, and release summary templates |

---

## Skill 1: `webapp-testing`

### Acceptance criteria

- Automate login, session create, `DRAFT -> LIVE -> CLOSED` checks.
- Include billing smoke path verification.
- Flaky rate under 5% across 20 runs.

### Deliverables

- `tests/e2e/wave1-auth-session-billing.spec.ts` (or equivalent test script path)
- `docs/QA_FULL.md` update with Wave 1 smoke scope
- Flake report artifact from 20-run loop

### First eval prompt

`Run browser checks for auth, create session, go LIVE, close session, and verify UI state transitions.`

### Task checklist

- [ ] Define stable selectors and deterministic waits for top flow
- [ ] Implement smoke flow script
- [ ] Run 20x loop and capture flake metrics
- [ ] Fix unstable steps and re-run
- [ ] Publish final pass/fail + flake %

---

## Skill 2: `mcp-builder`

### Acceptance criteria

- Ship one internal MCP server with 8-12 tools.
- Include read-only and write-safe separation.
- Enforce typed/structured outputs, pagination, and actionable errors.

### Deliverables

- MCP server package with tool docs
- Tool matrix (`tool_name`, purpose, auth, read/write classification)
- Basic evaluation set (10 read-only realistic queries)

### First eval prompt

`Create MCP tools for session analytics and team audit queries with read-only and write-safe separation.`

### Task checklist

- [ ] Finalize endpoint inventory and tool naming scheme
- [ ] Implement auth + shared error formatting
- [ ] Add read-only annotations and pagination defaults
- [ ] Add 10 evaluation queries with deterministic answers
- [ ] Run inspection and fix discoverability issues

---

## Skill 3: `skill-creator`

### Acceptance criteria

- Define 5 internal Qesto skills.
- Each skill has trigger description + 2-3 eval prompts.
- Baseline comparison exists for at least 1 pilot skill.

### Deliverables

- Five skill files under the existing skill system
- `evals/evals.json` per pilot skill
- Review output comparing with-skill vs baseline

### First eval prompt

`Build a Qesto release-note skill and show benchmark improvement vs no-skill baseline.`

### Task checklist

- [ ] Select five high-frequency task domains
- [ ] Draft each skill with clear trigger text
- [ ] Create pilot eval prompts and expected outcomes
- [ ] Run baseline vs with-skill evaluation
- [ ] Improve trigger text based on misses/false positives

---

## Skill 4: `frontend-design`

### Acceptance criteria

- Redesign one onboarding/trial activation flow.
- Meet WCAG 2.1 AA checks.
- No lighthouse regression versus baseline.

### Deliverables

- Updated UI implementation in `src/` flow components
- Before/after UX notes
- Accessibility and lighthouse comparison output

### First eval prompt

`Redesign the trial activation page with a distinctive but accessible style system.`

### Task checklist

- [ ] Capture baseline screenshots and lighthouse scores
- [ ] Implement visual redesign with existing token system
- [ ] Verify keyboard/focus/contrast behavior
- [ ] Run lighthouse + regression checks
- [ ] Final design acceptance review with PO/Marketing

---

## Skill 5: `doc-coauthoring`

### Acceptance criteria

- Use coauthoring flow for one architecture or decision document.
- Complete reader-testing pass and apply feedback.
- Reduce review cycle time by at least 25% for the pilot doc.

### Deliverables

- One completed decision doc using staged workflow
- Reader-testing questions and outcomes
- Revision log showing closed gaps

### First eval prompt

`Draft a decision doc for realtime scaling, then run reader-testing feedback loop.`

### Task checklist

- [ ] Pick target decision doc and audience
- [ ] Run context-gathering + section refinement workflow
- [ ] Execute reader-testing with fresh context
- [ ] Patch ambiguity and assumption gaps
- [ ] Record cycle-time delta versus prior doc process

---

## Skill 6: `internal-comms`

### Acceptance criteria

- Standardize templates for weekly 3P, incident update, and release summary.
- Templates are reusable and approved by PO + Marketing.
- First weekly update generated from live sprint inputs.

### Deliverables

- `docs/templates/` comms templates (or existing docs location)
- Example outputs for all 3 formats
- Approval note from responsible owners

### First eval prompt

`Generate this week 3P update from sprint outcomes and unresolved blockers.`

### Task checklist

- [ ] Draft 3 communication templates with required fields
- [ ] Produce one real sample per template
- [ ] Validate voice/tone against `docs/BRAND_VOICE.md`
- [ ] Team review and refinement
- [ ] Publish as default operational templates

---

## Two-week execution sequence

### Week 1

- Day 1-2: `webapp-testing` selector definition + first smoke script
- Day 2-3: `mcp-builder` tool contract and skeleton server
- Day 3-4: `skill-creator` pilot skill drafts + eval prompt set
- Day 5: Mid-week checkpoint, blockers, and scope corrections

### Week 2

- Day 1-2: `frontend-design` implementation and accessibility verification
- Day 2-3: `doc-coauthoring` pilot decision doc + reader testing
- Day 3-4: `internal-comms` templates + first live usage
- Day 5: Wave 1 demo + KPI capture + Wave 2 readiness decision

---

## Exit criteria for Wave 1

- Each of the 6 skills has:
  - owner assigned,
  - pilot deliverable completed,
  - first eval prompt executed,
  - evidence artifact linked,
  - retrospective note captured.
- At least 4/6 skills are adopted in real workflow (3+ real invocations each).
- No violations of Workers AI, secret, or test safety constraints.

---

## Reporting format (end of Wave 1)

Use this exact status block per skill:

`Skill: <name>`
`Owner: <role(s)>`
`Delivered: yes/no`
`Eval run: yes/no`
`AC pass: yes/no`
`Evidence: <path(s)>`
`Blockers: <none or list>`
`Next action: <single action>`

