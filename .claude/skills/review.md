---
name: reviewing-code
description: Runs code quality gates covering correctness, security, mobile accessibility, and architecture conformance. Use before every merge or after story implementation to block releases on critical findings.
---
# Skill: Code Review
# SCOPE: pre-merge quality gate, correctness/security/a11y/architecture audit
# LOAD: before every merge, after story implementation
# VERSION: v1.0.0
# OWNER: QA/CSO (shared gate)

## Role
Code quality gate for Qesto. You review changed files against automated and manual gates, block merges on critical findings, and escalate security/architecture issues.

## Preconditions / Inputs
- Diff of all changed files (git diff or PR)
- Test results (npm test, tsc --noEmit)
- Story acceptance criteria (from backlog)
- Changed layer (backend route, frontend component, integration, etc.)

## Workflow

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

## Step 1 — Automated Gates (block on failure)

```bash
npm test        # all unit tests green
tsc --noEmit    # no TypeScript errors
```

## Step 2 — Correctness

```
□ No console.log in production (only console.error in catch blocks)
□ No hardcoded translatable strings — use i18n
□ No hardcoded colours/dimensions — use Tailwind tokens or CSS vars
□ Every fetch() has a catch block → logError() → visible UI error
□ Async buttons have disabled/loading state during request
□ LIVE state: mutations via WebSocket only | DRAFT state: mutations via REST only
□ useState updates are non-mutating (spread/immutable)
```

## Step 3 — Architecture

**Backend (functions/api/):**
```
□ Route mounted in [[route]].ts
□ authMiddleware present (or documented exception)
□ Ownership check: user can only access own resources
□ Input validated (400 on missing/invalid fields)
□ Error response: { error: { code, message, statusCode, requestId } }
□ New KV keys follow conventions in architect.md
□ New secrets via wrangler pages secret put only
□ D1 queries parameterized (no string concatenation)
□ Migrations in schema.sql, not inline
```

**Frontend (src/):**
```
□ No imports from functions/ — use API fetch calls
□ No hardcoded API URLs — relative paths only
□ Error boundary at route level
□ Loading / empty / error states for all async data
□ No dangerouslySetInnerHTML without explicit sanitisation
```

## Step 4 — Mobile & Accessibility

```
□ All buttons/links: min-h-[44px]
□ Icon-only buttons: aria-label present
□ Ghost buttons: visible border (no bg-transparent without border)
□ Focus-visible ring on all interactive elements
□ Active state on all buttons (active:opacity-70 or equivalent)
□ No text-pulse-400/500 on white/light backgrounds (contrast < 4.5:1)
□ Loading state for every async operation
□ Error state visible in UI — not just console
```

## Step 5 — Security (quick)

```
□ No secrets or API keys in code
□ No ANTHROPIC_API_KEY references — use c.env.AI
□ Stripe webhook: constructEvent() verification present
□ New admin routes: requireAdmin() middleware present
□ No user input directly in fetch() URL (SSRF risk)
```

## Risk-Tiered Review Depth

### Tier 1 (High-Risk) — Full Deep Dive Required
**Scope**: Auth flow, payments, DO state, rate limits, GDPR, Stripe webhooks, SAML config
- Run all 5 steps (Automated + Correctness + Architecture + Mobile + Security)
- Require CSO review + architecture review
- Test locally if possible
- Escalate to architect if design changes needed

### Tier 2 (Medium-Risk) — Standard Review
**Scope**: API routes (non-auth), KV operations, session transitions, email
- Run steps 1–4 (skip deep security unless auth-related)
- QA review sufficient (CSO optional unless crypto involved)

### Tier 3 (Low-Risk) — Spot Check
**Scope**: UI/frontend components (no API calls), doc updates, refactoring (no behavior change)
- Run automated gates (step 1) + step 2 (correctness only)
- QA sign-off sufficient

## Severity

| Level | Examples | Action |
|---|---|---|
| **Block** | Tests fail, TS error, auth bypass, security issue | Merge forbidden — fix first |
| **Require** | Missing aria-label, error state, touch target | Fix before merge |
| **Suggest** | Naming, minor refactor | Optional — log in backlog |

## Quality Gates

| Gate | Command | Required |
|---|---|---|
| Unit tests pass | `npm test` | ✓ pre-merge |
| Type check pass | `tsc --noEmit` | ✓ |
| Lint/format | `npm run lint` | ✓ if present |

## Output Contract
Code review report with:
- ✅ Passed gates (tests, TS, lint)
- 🔴 Blocking issues (if any)
- 🟡 Required changes (if any)
- 💡 Suggestions (optional)
- Final decision: APPROVED / BLOCKED / APPROVED WITH CHANGES

## Docs to Update
- Story (backlog) with review checklist items if new patterns found
- `docs/CODE_REVIEW_GUIDE.md` if new gate discovered
- `docs/ARCHITECTURE.md` if architecture change required

## Do Not
- Do not approve if tests fail or TS has errors
- Do not approve high-risk changes without respective owner review (CSO for security, architect for design)
- Do not skip accessibility checks for UI changes
- Do not merge with "Require" severity items unfixed
- Do not review your own code — request peer review

## Metrics
- Review turnaround time (target: <4h)
- Issues caught pre-merge (target: 100% of "Block" severity)
- Rework rate (% of PRs with review rounds > 1)
