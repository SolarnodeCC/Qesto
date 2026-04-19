# Qesto — AI Framework (L1 Context)

## WHAT
Qesto is a real-time interactive session platform (Mentimeter-style). Teams create question-driven sessions (polls, rankings, consent votes, open questions), run them live via WebSocket, and surface AI-powered insights afterward.

## WHY
- **Edge-first**: No cold starts, global low-latency via Cloudflare Workers + Durable Objects
- **Privacy-by-default**: Anonymity modes, GDPR consent log, no third-party AI calls (Workers AI only)
- **Multi-tenant**: Teams, roles (owner/member/viewer), plan-gated features (Stripe)

## HOW

### Runtime Architecture
```
Browser ──HTTP──► Cloudflare Pages (static assets)
         ──API──► functions/api/[[route]].ts  (Hono, edge)
         ──WS───► SessionRoom DO              (stateful realtime)

worker/  ──scheduled──► cleanup, cron triggers
```

### Stack
| Layer | Technology | Location |
|---|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS v4 | `src/` |
| Backend | Hono on CF Pages Functions | `functions/api/[[route]].ts` |
| Realtime | Durable Object `SessionRoom` | WS only in LIVE state |
| DB | Cloudflare D1 (`DB`) | migrations in `schema.sql` |
| KV stores | USERS/SESSIONS/TEAMS/TEMPLATES/DECISIONS/AUDIT/ACTIONS_KV | JSON blobs |
| AI | `c.env.AI.run()` Workers AI — **NEVER** Anthropic API | `ai.ts` |
| Email | Resend via `RESEND_API_KEY` | `auth.ts:sendEmail()` |
| Payments | Stripe, price IDs in `wrangler.toml [vars]` | `billing.ts`, `stripe.ts` |
| Auth | Magic link (JWT) + SAML SSO | `auth.ts` |
| Vector | DECISIONS_VECTORIZE (768d, cosine) | `vectorize.ts` |

### Session State Machine
```
DRAFT ──start()──► LIVE (active) ──close()──► CLOSED ──► ARCHIVED
  │                     │
  └─ REST DRAFT-API      └─ WebSocket (DO) only
     DO doesn't exist         REST forbidden
```
**Critical**: In DRAFT state the DO does not exist.
In LIVE state all config changes go through WebSocket (`ClientMessage` types in `types.ts`).

### Key Code Patterns
```typescript
// Route (all API routes follow this pattern)
app.get('/resource/:id', authMiddleware, planMiddleware, async (c: Context<{Bindings: Env}>) => {
  return c.json({ ... })
})

// Workers AI (only approved AI method)
const result = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
  messages: [{ role: 'user', content: prompt }]
})

// KV read/write
await c.env.SESSIONS_KV.put(key, JSON.stringify(data), { expirationTtl: 86400 })
const raw = await c.env.SESSIONS_KV.get(key)
const data = raw ? JSON.parse(raw) : null
```

### Context Hub (fetch before any integration)
```bash
chub get cloudflare/workers --lang js    # Workers, KV, DO, D1
chub get stripe/api --lang js            # Stripe billing
chub get stripe/payments --lang js       # Stripe checkout/webhooks
chub annotate --list                     # Qesto-specific annotations
chub annotate cloudflare/workers "finding"  # Add new annotation
```

## Hard Rules
1. **No `ANTHROPIC_API_KEY`** — use `c.env.AI` only
2. **Secrets never in `wrangler.toml`** — `wrangler pages secret put`
3. **`npm test` must pass** before every commit (Vitest in `tests/unit/`)
4. **`tsc --noEmit` must pass** — no TypeScript errors
5. **DRAFT-API for draft state**, WebSocket for LIVE — never mix
6. **Update this file** when new patterns are discovered

## Deployment
```bash
npm run build          # Build frontend
wrangler pages deploy  # Deploy to Cloudflare Pages (qesto project)
```

## Active Sprint Context
See `docs/SPRINT_PLAN.md` for current sprint scope and exit criteria (5-sprint roadmap: v0.1 → v0.5).
See `docs/BACKLOG.md` for the full epic-based product backlog (6 epics: Core, Billing, Auth, Enterprise, i18n, Gamification).

**Sprint planning rule**: P0 items always enter the sprint first. Then P1. All stories must be <= 13pts (split larger items before sprint start). Aim for 40-50 pts committed per 2-week sprint.

---

## L2–L4 AI Agent Framework

This project uses a layered AI agent framework:

| Layer | Location | Purpose |
|---|---|---|
| **L1** | `CLAUDE.md` (this file) | Project context — what, why, how |
| **L2** | `.claude/skills/` | Role-scoped knowledge packs (auto-revoke after task) |
| **L3** | `.claude/settings.json` | Hooks: safety gates + automation |
| **L4** | `.claude/agents/` | Sub-agents with isolated context windows |

### Invoking roles (L2)
```
/frontend-dev   → loads frontend-dev.md skill pack  (src/, React, Tailwind, WebSocket UI)
/backend-dev    → loads backend-dev.md skill pack   (functions/api/, KV, D1, DO, integrations)
/architect      → loads architect.md skill pack     (system design, data model, ADRs)
/tester         → loads tester.md skill pack        (Vitest, coverage, CI)
/product-owner  → loads product-owner.md skill pack (stories, backlog, AC)
/ai-strategy    → loads ai-strategy.md skill pack   (AI feature advisory, maturity scoring, 4-week action plans)
/marketing      → loads marketing.md skill pack     (CRO, copy, email, SEO, sales, content)
/devops         → loads devops.md skill pack        (deployment, wrangler, CF infra, secrets, monitoring)
/security       → loads cso.md skill pack           (OWASP Top 10, STRIDE, GDPR, Stripe, SAML audits)
/analytics      → loads analytics.md skill pack     (AE queries, conversion funnel, platform metrics)
/i18n           → loads i18n.md skill pack          (translations, key extraction, EN/NL/ES/DE/FR)
/review         → loads review.md skill pack        (code review gates, correctness, security, mobile/a11y)
/investigate    → loads investigate.md skill pack   (DO/WebSocket root-cause analysis, 5-step debug protocol)
```
Knowledge packs auto-revoke at end of task — do not carry state between roles.
