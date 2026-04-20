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
**Documentation map:** [`docs/README.md`](docs/README.md) — which planning files describe **shipped v2.x** versus **reference sequencing**.

- **Shipped / roadmap truth:** [`docs/ROADMAP_FULL.md`](docs/ROADMAP_FULL.md), [`docs/SPEC.md`](docs/SPEC.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **Incremental committed work:** [`docs/BACKLOG.md`](docs/BACKLOG.md) (including Website Design Wave §12), [`docs/ARCHIVED_SPRINTS.md`](docs/ARCHIVED_SPRINTS.md).
- **Reference five-sprint arc (v0.1 → v0.5):** [`docs/SPRINT_PLAN.md`](docs/SPRINT_PLAN.md) — teaching and dependency template aligned to backlog IDs; **not** a literal greenfield schedule.

**Sprint planning rule:** P0 items first, then P1; stories ≤ 13 pts; aim ~40–50 pts per two-week sprint when using the reference arc for estimation drills.

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

### Model tiering (per-agent, per-work-type)

Agent `model:` frontmatter is the source of truth. Main-agent dispatch should match work complexity to model.

| Tier | Model | Agents | Work types |
|---|---|---|---|
| High | **opus** | `qesto-architect`, `qesto-backend`, `qesto-security`, `qesto-ai-strategy` | System design, ADRs, schema migrations, Durable Object / WebSocket protocol, auth flows, OWASP/STRIDE audits, abuse-surface review |
| Medium | **sonnet** | `qesto-frontend`, `qesto-devops`, `qesto-analytics` | React + Tailwind components, client WebSocket state, `wrangler.toml` env matrix, CI workflows, Analytics Engine queries |
| Low | **haiku** | `qesto-tester`, `qesto-product-owner`, `qesto-i18n`, `qesto-marketing` | Vitest scaffolding, user stories, AC, key extraction, translation stubs, release notes, marketing copy |

When the main agent needs a model not matching any sub-agent, invoke the sub-agent whose tier matches. Prefer Opus for anything touching edge runtime correctness (DO lifecycle, JWT, rate limits, multi-tenant isolation); prefer Haiku for template-heavy mechanical work.
