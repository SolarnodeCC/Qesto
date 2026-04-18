# Skill: Coordination Patterns — Qesto
# SCOPE: workflow (use when handoffs occur between roles)
# LOAD: when transitioning work between PO→dev, backend→frontend, dev→qa
# VERSION: v1.0.0
# OWNER: Architect
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role

You facilitate smooth handoffs between Product Owner, Backend, Frontend, and QA. You prevent miscommunication, clarify acceptance criteria, and ensure all parties sign off before implementation.

## Shared Rules

Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

---

## Pattern 1: PO → Dev (Story Handoff)

### PO Responsibilities (before story enters sprint)
- [ ] **Story written** in format from `product-owner.md` (As a / I want / So that)
- [ ] **Acceptance criteria** precise and testable (GIVEN/WHEN/THEN format)
- [ ] **Dependencies** identified (blocks/unblocks which stories?)
- [ ] **Scope boundaries** explicit (what's IN, what's OUT)
- [ ] **Story points** agreed (use Fibonacci scale)
- [ ] **Edge cases** documented (empty state, error state, auth failure, etc.)

### Dev Responsibilities (sprint start)
- [ ] **Read story** without asking clarifying questions first — doc should be clear
- [ ] **Identify technical unknowns** (design questions, API contract questions)
- [ ] **Propose AC tests** (unit, integration, e2e) to PO for approval
- [ ] **Flag dependencies** that aren't in sprint yet

### Handoff Checklist
```markdown
## Story Handoff Sign-Off

**Story**: {STORY-ID}
**PO**: {name}
**Dev Lead**: {name}

- [ ] PO: AC written and reviewed by dev
- [ ] Dev: No technical blockers identified
- [ ] Dev: Test approach approved by QA
- [ ] Both: Scope boundaries agreed
- [ ] PO: External dependencies confirmed (e.g., Stripe API version)

**Sign-off**: Date, names
```

---

## Pattern 2: Backend → Frontend (API Contract Sign-Off)

### When to Use
When backend is implementing an API endpoint that frontend will consume.

### Backend Responsibilities
1. **Before implementation starts**:
   - [ ] Write API contract in `.claude/schemas/api-contract.json` format
   - [ ] Include request/response types, error codes, rate limits
   - [ ] Propose in PR as **Draft** with `[WIP]` label
   - [ ] Tag frontend lead for review

2. **Example contract**:
   ```json
   {
     "endpoint": "GET /api/sessions/:id/results",
     "auth": "required",
     "plan_gate": "pro",
     "request_params": { "id": "string (session UUID)" },
     "response_200": {
       "results": [ { "question_id": "string", "type": "string", "votes": "number" } ]
     },
     "errors": {
       "404": "Session not found or user unauthorized",
       "403": "Plan not sufficient"
     },
     "rate_limit": "100 req/min per user",
     "latency_p95": "< 200ms"
   }
   ```

3. **After frontend approval**:
   - [ ] Update PR description with sign-off date
   - [ ] Implement endpoint
   - [ ] Update `docs/API_FULL.md`
   - [ ] Merge when ready

### Frontend Responsibilities
1. **Upon seeing contract**:
   - [ ] Review types (do they match your needs?)
   - [ ] Check auth/plan gates (can you enforce them?)
   - [ ] Verify error codes (can you show user-friendly messages?)
   - [ ] Confirm rate limit is acceptable

2. **Sign off**:
   - [ ] Comment: "✅ Approved — ready to implement"
   - [ ] Or: "🚫 Change needed: {specific feedback}"

### Handoff Checklist
```markdown
## API Contract Sign-Off

**Endpoint**: {METHOD /path}
**Backend Lead**: {name}
**Frontend Lead**: {name}

- [ ] Backend: Contract defined in `.claude/schemas/api-contract.json`
- [ ] Frontend: Types match our state shape
- [ ] Frontend: Error handling strategy agreed
- [ ] Backend: Rate limits documented
- [ ] Both: Latency SLA agreed (e.g., < 200ms p95)

**Frontend Sign-Off**: ✅ or 🚫 + feedback
**Implementation Date**: {date}
```

---

## Pattern 3: Dev → QA (Acceptance Criteria Test Mapping)

### When to Use
When dev has implemented a story and wants QA to verify AC.

### Dev Responsibilities
1. **Before PR submission**:
   - [ ] Map each AC to one or more test cases (unit / integration / e2e)
   - [ ] Create `.claude/test-mappings/{STORY-ID}.md` with AC → test links
   - [ ] Run tests locally and verify they pass

2. **Example mapping**:
   ```markdown
   ## SES-001 Test Mapping
   
   **AC 1**: GIVEN session in DRAFT WHEN user adds question THEN question appears in list
   - Test: `tests/unit/sessions.test.ts::POST /sessions/:id/questions`
   - Type: Unit test (mocked KV)
   
   **AC 2**: GIVEN session LIVE WHEN user edits question THEN 403 Forbidden
   - Test: `tests/unit/sessions.test.ts::PATCH /sessions/:id/questions (LIVE check)`
   - Type: Unit test (state guard)
   ```

3. **In PR description**:
   ```markdown
   ## Acceptance Criteria Coverage
   
   - AC1: ✅ Unit test + manual demo
   - AC2: ✅ Unit test (403 guard)
   - AC3: ✅ Integration test (DO init)
   
   See `.claude/test-mappings/SES-001.md` for test→AC mapping.
   ```

### QA Responsibilities
1. **Upon PR submission**:
   - [ ] Review test mapping (do tests cover all ACs?)
   - [ ] Check for gaps (untested edge cases?)
   - [ ] Run tests locally: `npm test`
   - [ ] Spot-check manual demo if applicable

2. **Approval**:
   - [ ] Comment: "✅ AC coverage complete" or
   - [ ] "⚠️ Missing test for {AC} — add before merge"

### Handoff Checklist
```markdown
## AC Test Mapping Sign-Off

**Story**: {STORY-ID}
**Dev**: {name}
**QA**: {name}

- [ ] Dev: Test mapping created (AC → test file)
- [ ] QA: All ACs have passing tests
- [ ] QA: Edge cases tested (empty, error, auth, etc.)
- [ ] QA: No test.skip or it.skip in committed code
- [ ] QA: Coverage targets met (if configured)

**QA Sign-Off**: ✅ or 🚫 + missing tests
**Date**: {date}
```

---

## Pattern 4: Frontend → Design (Figma to Component Handoff)

### When to Use
When frontend implements a UI component from design mockup.

### Design Responsibilities
1. **Before frontend starts**:
   - [ ] Figma component published (not just artboard)
   - [ ] Spacing, colors, typography specs documented
   - [ ] Responsive breakpoints shown (mobile, tablet, desktop)
   - [ ] Interaction states (hover, focus, active, disabled, loading)
   - [ ] Link or attach in story AC

### Frontend Responsibilities
1. **Upon starting implementation**:
   - [ ] Match spacing exactly (use Tailwind CSS vars)
   - [ ] Implement all states from Figma (hover, focus, disabled, etc.)
   - [ ] Test on 375px viewport (iPhone SE)
   - [ ] Get sign-off from designer (screenshot or demo)

2. **Sign-off request**:
   - [ ] PR comment with screenshot
   - [ ] Message: "@designer — Does this match Figma (component X)?"

### Designer Responsibilities
1. **Upon seeing PR**:
   - [ ] Compare screenshot to Figma
   - [ ] Verify spacing, colors, typography
   - [ ] Check all states are implemented
   - [ ] Comment: "✅ Matches Figma" or "⚠️ {issue}"

### Handoff Checklist
```markdown
## Design Handoff Sign-Off

**Component**: {ComponentName}
**Designer**: {name}
**Frontend**: {name}

- [ ] Design: Figma component published + linked
- [ ] Frontend: All states implemented (hover, focus, active, disabled, loading)
- [ ] Frontend: Tested on 375px viewport
- [ ] Frontend: Spacing matches Figma (within 1px)
- [ ] Designer: Approved screenshot in PR

**Designer Sign-Off**: ✅ or ⚠️ + feedback
**Date**: {date}
```

---

## Pattern 5: Backend → Devops (Deployment & Monitoring)

### When to Use
When backend makes infra or config changes.

### Backend Responsibilities
1. **Before merging**:
   - [ ] New env vars documented in `docs/CONFIGURATION.txt`
   - [ ] Migration scripts tested locally: `npx wrangler d1 migrations apply DB --local`
   - [ ] Secrets added via: `wrangler pages secret put KEY` (NOT wrangler.toml)
   - [ ] Rollback procedure documented in PR

2. **Deployment plan**:
   ```markdown
   ## Deployment Checklist
   
   - [ ] New bindings: {list KV, D1, DO, etc.}
   - [ ] New secrets: {list STRIPE_KEY, RESEND_KEY, etc.} — use `wrangler pages secret put`
   - [ ] Migrations: {list SQL migrations applied in order}
   - [ ] Rollback: {describe how to revert if needed}
   - [ ] Monitoring: {alert if {metric} exceeds {threshold}}
   ```

### Devops Responsibilities
1. **Before deployment**:
   - [ ] Secrets added to production env
   - [ ] Migrations tested on staging
   - [ ] Monitoring rules created/updated
   - [ ] Rollback procedure verified

2. **Post-deployment**:
   - [ ] Verify endpoints responding (health check)
   - [ ] Monitor error rates for 5 minutes
   - [ ] Confirm new features working as expected

---

## Escalation Triggers

Use these as checkpoints. If any are unmet, escalate before proceeding:

| Situation | Escalate To | Action |
|---|---|---|
| AC unclear or ambiguous | PO | Clarify before dev starts |
| Backend API contract not signed | Frontend | Don't implement until approved |
| Test mapping incomplete | QA | Don't merge until AC→test mapping done |
| Design changes discovered mid-sprint | PO + Design | Add change to current story or next sprint |
| Breaking migration needed | Devops | Plan rollback + monitoring |
| Performance regression found | Architect | Check against performance budgets |

---

## Tools & Templates

### API Contract Template
See: `.claude/schemas/api-contract.json`

### AC Test Mapping Template
See: `.claude/test-mappings/{STORY-ID}.md`

### Deployment Checklist Template
See: checklist above (Pattern 5)

---

## Change Log
- 2026-04-11: Created coordination patterns v1.0.0
