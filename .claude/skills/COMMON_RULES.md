# COMMON_RULES — Qesto Agent & Skill Global Invariants
# VERSION: v1.1.0
# OWNER: Architect

_Last reviewed_: 2026-04-10

## 1) AI Provider Policy (Non-Negotiable)
- Use **Workers AI only** via `c.env.AI.run()`.
- Do **not** call Anthropic/OpenAI/external model APIs from product code.

## 2) State Mutation Policy
- **DRAFT state**: mutate via REST (`functions/api` routes).
- **LIVE state**: mutate via Durable Object / WebSocket only.
- Never introduce mixed mutation paths for the same lifecycle transition.

## 3) Secrets & Config Policy
- Secrets must never be committed to code or `wrangler.toml`.
- Use `wrangler pages secret put <KEY>` for all secrets.
- `wrangler.toml [vars]` is for non-secret config only.

## 4) Privacy, Tenant Isolation, and GDPR
- Preserve anonymity constraints in participant-facing outputs.
- Enforce tenant scoping on KV keys and API authorization paths.
- Treat personal data access/deletion as audited operations.

## 5) Quality Gates Before Commit
- `npm test` must pass.
- `npx tsc --noEmit` must pass.
- Any route/contract/schema change must be reflected in docs (`knowledge-base/api/API_FULL.md`, `knowledge-base/architecture/ARCHITECTURE.md`, etc.).

## 6) Precedence Rule
If a local agent/skill instruction conflicts with this file, treat this file as the default safety baseline and escalate for explicit override in the task scope.
## 6) Error Recovery & Hook Override Pattern

### What If a Safety Hook Fails?

If a hook (pre-bash.sh, post-edit.sh) **blocks** your work, do NOT bypass the hook. Instead:

1. **Understand why it blocked** — read the hook error message carefully
2. **Fix the root cause** — the hook is protecting you from real problems
3. **Escalate if needed** — if the hook is wrong, discuss in the task scope

### When You MUST Override (Rare)

Only if explicitly approved in the task description. Then use:

```bash
# Disable a specific hook category for one command
SKIP_HOOK=1 npm run build    # Dangerous — use only if approved

# Or manually fix what the hook would catch, then:
git add functions/api/routes/my-route.ts src/pages/MyPage.tsx  # Stage specific files only
git commit -m "Fix: {issue} — hook override approved in {task-id}"
```

**Important**: Always document WHY in the commit message.

### Examples of "Hook Said No" → Proper Fix

**Scenario 1: Hook blocks "commit has skipped tests"**
```bash
# ❌ WRONG — try to bypass hook
SKIP_HOOK=1 git commit

# ✅ RIGHT — fix the test
grep -n "it.skip" tests/unit/sessions.test.ts  # Find line 42
# Edit line 42: change "it.skip" to "it"
npm test                                        # Verify it passes
git commit                                       # Now hook allows it
```

**Scenario 2: Hook blocks "route not mounted"**
```bash
# You created: functions/api/routes/decisions.routes.ts
# Hook says: "Not mounted in [[route]].ts"

# ❌ WRONG — bypass hook
SKIP_HOOK=1 git add .

# ✅ RIGHT — mount the route
echo "app.route('/api', decisionsRoutes)" >> functions/api/[[route]].ts
git add functions/api/[[route]].ts functions/api/routes/decisions.routes.ts
git commit                                       # Now hook allows it
```

**Scenario 3: Hook detects secret in file**
```bash
# ❌ WRONG — try to commit anyway
SKIP_HOOK=1 git commit

# ✓ RIGHT — remove the secret
grep "sk_live_" src/billing.ts  # Find line 20
# Remove or replace with c.env.STRIPE_SECRET
git add src/billing.ts
git commit                      # Hook passes
```

## 7) Precedence Rule
If a local agent/skill instruction conflicts with this file, treat this file as the default safety baseline and escalate for explicit override in the task scope.

## 8) Test & Type-Check Minimums (Referenced in all skills)
- `npm test` must pass before every commit
- `npx tsc --noEmit` must pass before every commit
- New route/handler tests required (coverage target in skill file)
- No test.skip or it.skip in committed code (except flaky quarantines with GitHub issue link)

## 9) Documentation Update Obligations
Every skill file must reference which docs to update:
- Policy changes → `docs/AGENT_SKILL_GOVERNANCE.md`
- Architecture changes → `knowledge-base/architecture/ARCHITECTURE.md`
- Security findings → `docs/BACKLOG.md §1` (P0) or `§4 Security`
- QA/test patterns → `docs/QA_FULL.md §2–3`
- Flaky tests → `docs/FLAKY_TESTS.md`

## 10) Skill Governance Alignment (Non-Negotiable)
- Semantic versioning: MAJOR (breaking) / MINOR (backward-compatible) / PATCH (clarifications)
- Owner designation required (DRI per OWNER field in skill header)
- Changelog entry required on update (YYYY-MM-DD: change note)
- Monthly quality scorecard review (keep/improve/retire decision)

## Change Log
- 2026-04-24: Added test/type-check minimums, doc obligations, and governance alignment rules.
- 2026-04-10: Canonicalized file headers and shared rules reference.
