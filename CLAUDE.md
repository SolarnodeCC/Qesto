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
| Realtime | Durable Object `SessionRoom` | WS in ENERGIZING and LIVE states |
| DB | Cloudflare D1 (`DB`) | migrations in `schema.sql` |
| KV stores | USERS/SESSIONS/TEAMS/TEMPLATES/DECISIONS/AUDIT/ACTIONS_KV | JSON blobs |
| AI | `c.env.AI.run()` Workers AI — **NEVER** Anthropic API | `ai.ts` |
| Email | Resend via `RESEND_API_KEY` | `auth.ts:sendEmail()` |
| Payments | Stripe, price IDs in `wrangler.toml [vars]` | `billing.ts`, `stripe.ts` |
| Auth | Magic link (JWT) + SAML SSO | `auth.ts` |
| Vector | DECISIONS_VECTORIZE, HELP_VECTORIZE, KB_VECTORIZE (1024d, cosine, bge-m3) | `vectorize.ts` |
| Embed | EMBED widget mint + public read planes, `EMBED_WIDGET_SECRET` HMAC token (ADR-0050) | `routes/embed.ts`, `routes/embed-widget-v1.ts`, `lib/embed-token.ts` |

### Session State Machine
```
DRAFT ──start()──► ENERGIZING* ──transition_to_live()──► LIVE (active) ──close()──► CLOSED ──► ARCHIVED
  │                       │                                 │
  └─ REST DRAFT-API       └─ WebSocket (DO) only            └─ WebSocket (DO) only
     DO doesn't exist         *if energizers exist               REST forbidden
```
**Critical**: 
- In DRAFT state the DO does not exist. Host configures questions and energizers via REST API.
- When `start()` is called, if draft energizers exist, session enters ENERGIZING state (else goes directly to LIVE).
- In ENERGIZING state participants join and see warm-up activities (energizers) via WebSocket (DO initialized).
- Host clicks "Start Questions" to call `transition-to-live()` and move to LIVE state, where participants see questions.
- In LIVE state all config changes go through WebSocket (`ClientMessage` types in `types.ts`).
- Energizers are created/managed in DRAFT state but only activated during ENERGIZING (via `/api/sessions/:id/energizers` endpoints).

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

### Energizers & Pre-Session Warm-up
**Flow:**
1. **DRAFT state**: Host creates energizers via `POST /api/sessions/:id/energizers` (creates with `state='draft'`)
2. **Start session**: `POST /api/sessions/:id/start`
   - If session has draft energizers → sets `status='energizing'`, initializes DO
   - If no energizers → sets `status='live'`, initializes DO
   - Either way, DO now manages realtime state
3. **ENERGIZING state**: Participants join, see active energizer(s) via WebSocket. Host can manually activate energizers or let them auto-complete.
4. **Transition to LIVE**: `POST /api/sessions/:id/transition-to-live`
   - Checks session is in `status='energizing'`
   - Updates DB to `status='live'`
   - Notifies DO to broadcast `session_energizing_complete` to all clients
   - Frontend automatically shows questions

**Energizer API** (work in both DRAFT and ENERGIZING states):
- `GET /api/sessions/:id/energizers` — list all energizers
- `POST /api/sessions/:id/energizers` — create (creates with `state='draft'`)
- `PATCH /api/sessions/:id/energizers/:energizerId` — update state (e.g., draft → active)
- `GET /api/sessions/:id/energizers/active` — fetch current active energizer

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
6. **AI eval gate (REV-10):** changes to AI prompts, models, output schemas, or AI safety logic require `npm run test:eval` green with updated golden fixtures in `tests/eval/fixtures/` — a change with no eval evidence does not ship (baseline: [`/knowledge-base/operations/monitoring/AI_EVAL_BASELINE.md`](./knowledge-base/operations/monitoring/AI_EVAL_BASELINE.md))
7. **Documentation location:** All specifications, ADRs, and operational guides are in [`/knowledge-base/`](./knowledge-base/). Reference:
   - **Specs**: [`/knowledge-base/specifications/domain/SPEC_{BACKEND,FRONTEND,DATAMODEL,REALTIME,INTEGRATIONS,DEPLOYMENT,CORE}.md`](./knowledge-base/specifications/)
   - **ADRs**: [`/knowledge-base/adr/ADR-{number}-{title}.md`](./knowledge-base/adr/)
   - **Architecture**: [`/knowledge-base/architecture/ARCHITECTURE.md`](./knowledge-base/architecture/)
   - **Roadmap**: [`/knowledge-base/product/roadmap/`](./knowledge-base/product/roadmap/)
   - **Backlog**: [`/knowledge-base/product/backlog/BACKLOG_MASTER.md`](./knowledge-base/product/backlog/)
8. **Update this file** when new patterns are discovered
9. **No inline `<svg>` elements** — always import icons from `lucide-react`. Never write raw SVG markup for icons in component files. The only permitted exception is the circular timer arc in `src/pages/Present.tsx` (no Lucide equivalent).
10. **Design token conventions (ADR-0071):** cards and panels use `rounded-xl`; buttons use `rounded-lg`. Use CSS custom-property tokens (`var(--surface-border)`, `var(--text-primary)`, etc.) over hardcoded hex where a token exists. See [`/knowledge-base/adr/ADR-0071-design-system-v1.md`](./knowledge-base/adr/ADR-0071-design-system-v1.md) and [`/knowledge-base/specifications/domain/SPEC_DESIGN_SYSTEM_OVERVIEW.md`](./knowledge-base/specifications/domain/SPEC_DESIGN_SYSTEM_OVERVIEW.md).

## Deployment
```bash
npm run build          # Build frontend
wrangler pages deploy  # Deploy to Cloudflare Pages (qesto project)
```

## Active Sprint Context
**Documentation map:** [`/knowledge-base/README.md`](./knowledge-base/README.md) — navigation by role (PO, backend, frontend, devops, security, AI).

- **Shipped / roadmap truth:** [`/knowledge-base/product/roadmap/ROADMAP_FULL.md`](./knowledge-base/product/roadmap/ROADMAP_FULL.md), [`/knowledge-base/specifications/product/SPEC_PRODUCT.md`](./knowledge-base/specifications/product/SPEC_PRODUCT.md), [`/knowledge-base/architecture/ARCHITECTURE.md`](./knowledge-base/architecture/ARCHITECTURE.md).
- **Incremental committed work:** [`/knowledge-base/product/backlog/BACKLOG_ACTIVE.md`](./knowledge-base/product/backlog/BACKLOG_ACTIVE.md) (release trains), [`/knowledge-base/product/planning/RELEASE_TRAIN_MASTER.md`](./knowledge-base/product/planning/RELEASE_TRAIN_MASTER.md) (cadence contract). Archive: [`BACKLOG_MASTER.md`](./knowledge-base/product/backlog/BACKLOG_MASTER.md), [`ARCHIVED_SPRINTS.md`](./knowledge-base/product/releases/ARCHIVED_SPRINTS.md).
- **Reference five-sprint arc (v0.1 → v0.5):** [`/knowledge-base/product/planning/SPRINT_PLAN_MASTER.md`](./knowledge-base/product/planning/SPRINT_PLAN_MASTER.md) — teaching and dependency template aligned to backlog IDs; **not** a literal greenfield schedule.

**Release-train planning rule (cadence, not sprints):** Qesto plans in **release trains** (`RT-YYYY-MM`), not sprints. P0 items first, then P1; stories ≤ 13 pts; each train is 2–3 weeks, one major outcome, and targets **40–60 pts** (solo+AI) — ignore the 120–194 pt sprint figures in historical docs. Closeout date = last merge date on `main`; a story is committed only when it has a row in `BACKLOG_ACTIVE.md`; horizon = current + next train, everything further out is conditional behind EPIC-VALID gates (ADR-0064). Cadence formally ratified by [`ADR-0067`](./knowledge-base/adr/ADR-0067-release-train-cadence.md) (supersedes ADR-0054). Cadence contract: [`RELEASE_TRAIN_MASTER.md`](./knowledge-base/product/planning/RELEASE_TRAIN_MASTER.md); committed work: [`BACKLOG_ACTIVE.md`](./knowledge-base/product/backlog/BACKLOG_ACTIVE.md). Reference arc in [`SPRINT_PLAN_MASTER.md`](./knowledge-base/product/planning/SPRINT_PLAN_MASTER.md) is pedagogical only.

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
/e2e-tester     → loads e2e-tester.md skill pack   (Playwright E2E, k6 load, DO stress, axe a11y)
/product-owner  → loads product-owner.md skill pack (stories, backlog, AC)
/ai-strategy    → loads ai-strategy.md skill pack   (AI feature advisory, maturity scoring, 4-week action plans)
/ai-engineer    → loads ai-engineering.md skill pack (Workers-AI craft: prompts, RAG/retrieval quality, evals, AI guardrails)
/marketing      → loads marketing.md skill pack     (top-of-funnel: CRO, copy, lifecycle email, SEO, content)
/seo-reviewer   → loads seo-reviewer.md skill pack  (organic-visibility audit: crawl/index, technical/on-page SEO, intent, internal links, E-E-A-T)
/sales          → loads sales.md skill pack         (deal cycle: discovery, MEDDICC, demos, objections, proposals)
/market-research → loads market-research.md skill pack (competitors, ICP/competitor source of truth, pulse)
/devops         → loads devops.md skill pack        (deployment, wrangler, CF infra, secrets, monitoring)
/security       → loads cso.md skill pack           (OWASP Top 10, STRIDE, GDPR, Stripe, SAML audits)
/analytics      → loads analytics.md skill pack     (AE queries, conversion funnel, platform metrics)
/i18n           → loads i18n.md skill pack          (translations, key extraction, EN/NL/ES/DE/FR)
/review         → loads review.md skill pack        (code review gates, correctness, security, mobile/a11y)
/investigate    → loads investigate.md skill pack   (DO/WebSocket root-cause analysis, 5-step debug protocol)
/knowledge      → loads knowledge.md skill pack     (KB integrity, requirement traceability, KB→Vectorize lifecycle, kb_search)
```
Knowledge packs auto-revoke at end of task — do not carry state between roles.

**Edges (handoffs between roles)** are defined and owned in [`.claude/skills/HANDOFFS.md`](.claude/skills/HANDOFFS.md) — consult it before handing work to another role.

**Researching the knowledge base:** for conceptual questions (requirements, decisions, constraints), use the `kb_search` MCP tool (semantic search over `knowledge-base/`, configured in [`.mcp.json`](.mcp.json)) and Read the returned `file_path`; use Grep/Glob for exact symbols. The **knowledge** node owns this tool and KB integrity.

### Model tiering (per-agent, per-work-type)

Agent `model:` frontmatter is the source of truth. Main-agent dispatch should match work complexity to model.

| Tier | Model | Agents | Work types |
|---|---|---|---|
| High | **opus** | `qesto-architect`, `qesto-backend`, `qesto-security`, `qesto-ai-strategy`, `qesto-ai-engineer`, `qesto-market-research` | System design, ADRs, schema migrations, Durable Object / WebSocket protocol, auth flows, OWASP/STRIDE audits, abuse-surface review, prompt/RAG/eval quality, deep competitive synthesis |
| Medium | **sonnet** | `qesto-frontend`, `qesto-devops`, `qesto-analytics`, `qesto-sales`, `qesto-knowledge`, `qesto-seo-reviewer` | React + Tailwind components, client WebSocket state, `wrangler.toml` env matrix, CI workflows, Analytics Engine queries, deal qualification + objection strategy, KB integrity + requirement traceability, organic-visibility / technical-SEO audits |
| Low | **haiku** | `qesto-tester`, `qesto-e2e-tester`, `qesto-product-owner`, `qesto-i18n`, `qesto-marketing` | Vitest scaffolding, Playwright E2E/load/stress/a11y specs, user stories, AC, key extraction, translation stubs, release notes, marketing copy |

When the main agent needs a model not matching any sub-agent, invoke the sub-agent whose tier matches. Prefer Opus for anything touching edge runtime correctness (DO lifecycle, JWT, rate limits, multi-tenant isolation); prefer Haiku for template-heavy mechanical work.
