# QA_CHECKLIST — Unified Quality Gates
# VERSION: v1.0.0
# OWNER: QA Lead
# SCOPE: Pre-commit, pre-push validation

This is the **single source of truth** for quality gate enforcement. All hooks and CI should validate against this checklist.

## Machine-Readable Gates Configuration

```json
{
  "gates": [
    {
      "id": "TESTS_PASS",
      "name": "Unit tests pass",
      "command": "npm test",
      "blocking": true,
      "scope": ["**/*.ts", "**/*.tsx"],
      "description": "All unit tests must pass before commit"
    },
    {
      "id": "TYPE_CHECK",
      "name": "TypeScript type check",
      "command": "tsc --noEmit",
      "blocking": true,
      "scope": ["src/**/*.ts", "src/**/*.tsx", "functions/api/**/*.ts", "worker/**/*.ts"],
      "description": "No TypeScript errors allowed"
    },
    {
      "id": "NO_SKIPPED_TESTS",
      "name": "No skipped tests",
      "command": "grep -r 'it\\.skip\\|test\\.skip\\|describe\\.skip' tests/ && exit 1 || exit 0",
      "blocking": true,
      "scope": ["tests/**/*.test.ts"],
      "description": "Committed tests must not be skipped"
    },
    {
      "id": "NO_CONSOLE_LOGS",
      "name": "No debug console.log in production code",
      "command": "grep -r 'console\\.log' src/ functions/api/ worker/ | grep -v console\\.error && exit 1 || exit 0",
      "blocking": false,
      "scope": ["src/**/*.ts", "functions/api/**/*.ts", "worker/**/*.ts"],
      "description": "Remove debug logs before commit"
    },
    {
      "id": "API_ROUTES_DOCUMENTED",
      "name": "API routes documented in docs/API_FULL.md",
      "manual": true,
      "blocking": true,
      "scope": ["functions/api/routes/**/*.ts"],
      "reminder": "Update docs/API_FULL.md when HTTP routes change",
      "description": "New endpoints must be documented"
    },
    {
      "id": "SCHEMA_DOCUMENTED",
      "name": "D1 schema changes documented",
      "manual": true,
      "blocking": true,
      "scope": ["schema.sql"],
      "reminder": "Update docs/ARCHITECTURE.md §3.1 when schema changes",
      "description": "Schema migrations must be documented in architecture"
    },
    {
      "id": "DO_DOCUMENTED",
      "name": "DO changes documented",
      "manual": true,
      "blocking": true,
      "scope": ["functions/api/SessionRoom.ts"],
      "reminder": "Update docs/ARCHITECTURE.md §3.3 and docs/API_FULL.md §8",
      "description": "SessionRoom state or protocol changes must be documented"
    },
    {
      "id": "TEST_COVERAGE",
      "name": "New source files have corresponding test files",
      "manual": true,
      "blocking": false,
      "scope": ["functions/api/routes/**/*.ts", "src/pages/**/*.tsx", "src/components/**/*.tsx"],
      "reminder": "Add tests/unit/{name}.test.ts for new source files",
      "description": "New source files should have corresponding unit tests"
    },
    {
      "id": "A11Y_CHECKLIST",
      "name": "Accessibility checklist for UI changes",
      "manual": true,
      "blocking": false,
      "scope": ["src/**/*.tsx"],
      "checklist": [
        "min-h-[44px] on all interactive elements",
        "aria-label on icon-only buttons",
        "focus-visible rings on buttons",
        "Tested on 375px viewport",
        "Color contrast ≥ 4.5:1 for text",
        "Loading state for async operations"
      ],
      "description": "UI changes must meet WCAG 2.1 AA"
    },
    {
      "id": "PERFORMANCE_CHECK",
      "name": "Performance baselines maintained",
      "manual": true,
      "blocking": false,
      "scope": ["src/**/*.tsx", "functions/api/**/*.ts"],
      "targets": {
        "lcp": "< 2.5s",
        "cls": "< 0.1",
        "do_cold_start": "< 100ms",
        "kv_hot_read": "< 5ms",
        "workers_ai_response": "< 8s",
        "backend_route_p95": "< 200ms"
      },
      "description": "Measure perf before/after changes"
    },
    {
      "id": "ROUTES_MOUNTED",
      "name": "New routes mounted in [[route]].ts",
      "command": "grep -l 'app.use.*Routes' functions/api/[[route]].ts 2>/dev/null | wc -l",
      "blocking": true,
      "scope": ["functions/api/routes/**/*.ts"],
      "description": "All route files must be imported and mounted in the main handler"
    },
    {
      "id": "NO_SECRETS_COMMITTED",
      "name": "No secrets in committed files",
      "command": "grep -rE '(sk_live_|sk_test_|ANTHROPIC_API_KEY|OPENAI_API_KEY)' --include='*.ts' --include='*.tsx' --include='*.md' . 2>/dev/null && exit 1 || exit 0",
      "blocking": true,
      "scope": ["**/*.ts", "**/*.tsx", "**/*.md"],
      "description": "Secrets must never be committed"
    }
  ]
}
```

## Quality Gate Legend

| Property | Meaning |
|---|---|
| `id` | Unique identifier (used in hook/CI references) |
| `command` | Bash command to validate (auto = runs via hook) |
| `blocking` | `true` = must pass, `false` = warning only |
| `manual` | `true` = human review required (hook reminds) |
| `scope` | Glob patterns that trigger this gate |
| `reminder` | Message shown when gate is triggered |

## How Hooks Use This

**pre-bash.sh** (on `git commit`):
```bash
# Loop through gates and validate
```

**post-edit.sh** (after Write|Edit):
```bash
# Show reminders for manual gates triggered by this file
```

**on-stop.sh** (before session ends):
```bash
# Final checklist: did dev complete all gates?
```

## Enforcement Rules

1. **Blocking gates** (`blocking: true`) → must pass or commit fails
2. **Manual gates** → reminder shown; human signs off in PR description
3. **Warning gates** (`blocking: false`) → logged but don't fail commit
4. **Scope filtering** → only gates whose `scope` matches changed files are checked

## Example: Backend Route Commit

Changed file: `functions/api/routes/decisions.routes.ts`

Triggered gates:
- ✓ `TESTS_PASS` — must pass
- ✓ `TYPE_CHECK` — must pass
- ✓ `ROUTES_MOUNTED` — validate it's imported in `[[route]].ts`
- ⓘ `API_ROUTES_DOCUMENTED` — reminder to update `docs/API_FULL.md`
- ⓘ `TEST_COVERAGE` — reminder to add `tests/unit/decisions.test.ts`

## Change Log
- 2026-04-11: Created unified checklist v1.0.0
