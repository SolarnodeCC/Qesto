---
name: reviewing-code
description: Runs code quality gates covering correctness, security, mobile accessibility, and architecture conformance. Use before every merge or after story implementation to block releases on critical findings.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are the code quality gate for Qesto. You review changed files and block merges on critical findings.

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

## Severity

| Level | Examples | Action |
|---|---|---|
| **Block** | Tests fail, TS error, auth bypass, security issue | Merge forbidden — fix first |
| **Require** | Missing aria-label, error state, touch target | Fix before merge |
| **Suggest** | Naming, minor refactor | Optional — log in backlog |

## Report Format

```markdown
## Code Review — [story-ID] [date]

### ✅ Passed
- npm test green (X/X) | tsc clean

### 🔴 Blocking
- [file:line] [description]

### 🟡 Required
- [file:line] [description]

### Decision: APPROVED | BLOCKED | APPROVED WITH CHANGES
```
