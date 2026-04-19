# Qesto Specification Documents — Complete Reference

**Repository documentation hub:** [`../README.md`](../README.md) (how `docs/` fits together, truth hierarchy, reading order).

## Overview

This directory contains **7 consolidated specification documents** that comprehensively document Qesto's architecture, codebase, and operations.

All specs are optimized for:
- ✅ **AI Reconstruction**: Complete enough for GPT to rebuild any feature
- ✅ **Token Efficiency**: Structured (tables, code) > prose
- ✅ **Discoverability**: Cross-linked, hierarchical TOC
- ✅ **Maintainability**: Single source of truth per domain
- ✅ **Readers ladder**: Each `SPEC_*.md` opens with **Doc contract** + **Readers** table — **Architect** row is always **Primary** for tradeoffs; **Backend**, **Frontend**, **UI**, **Cloudflare**, **API/middleware** rows say what to skim first
- ✅ **AI usage recipe**: Each domain spec ends with copy-paste prompt lines + a short **trust checklist** (anchors, verbs, hostnames)
- ✅ **Pre-build include**: [includes/PREBUILD_AND_DELIVERY.md](includes/PREBUILD_AND_DELIVERY.md) — scope, LIVE spike, gates, abuse reminders, retention intent, golden path, ADR index

---

## Before you start building

Read the canonical include first: **[includes/PREBUILD_AND_DELIVERY.md](includes/PREBUILD_AND_DELIVERY.md)**.

| Question | Jump to |
|----------|---------|
| What do we ship first? | [Vertical slice](includes/PREBUILD_AND_DELIVERY.md#vertical-slice-v1-scope) · [Principles](includes/PREBUILD_AND_DELIVERY.md#pre-build-and-delivery-principles) |
| When is LIVE “proven enough”? | [LIVE spike acceptance](includes/PREBUILD_AND_DELIVERY.md#live-spike-acceptance) + [SPEC_REALTIME.md](SPEC_REALTIME.md) |
| Environments, CI, secrets, health? | [Pre-production gates](includes/PREBUILD_AND_DELIVERY.md#pre-production-gates) + [SPEC_DEPLOYMENT.md](SPEC_DEPLOYMENT.md) |
| Public / anonymous abuse surface? | [Abuse table](includes/PREBUILD_AND_DELIVERY.md#abuse-and-public-endpoints) + [SPEC_BACKEND.md](SPEC_BACKEND.md) |
| Data retention / TTL intent? | [Retention](includes/PREBUILD_AND_DELIVERY.md#retention-and-deletion-intent) + [SPEC_DATAMODEL.md](SPEC_DATAMODEL.md) |
| One local dev path? | [Golden path](includes/PREBUILD_AND_DELIVERY.md#golden-path-local) |
| **Build UI / apply design system?** | [WEBSITE_DESIGN_SPEC.md](../specs/WEBSITE_DESIGN_SPEC.md) (colour, typography, spacing, component specs, motion, KPIs) · [design-tokens.json](../specs/design-tokens.json) (machine-readable tokens) |

---

## Document Navigation

### 🏗️ **SPEC_CORE.md** — Architecture & Design Fundamentals
**Purpose**: Top-level system overview, design decisions, constraints.

**Readers**: Architect (Primary) + five role lenses — see doc header in [SPEC_CORE.md](SPEC_CORE.md).

**Key Sections**:
- System architecture diagram (browser → Pages Functions → D1/KV/DO)
- Tech stack with versions & bindings
- Session state machine (DRAFT → LIVE → CLOSED → ARCHIVED)
- 5 critical constraints (secrets never in config, etc.)
- Authentication & authorization overview
- Real-time architecture intro
- Data lifecycle
- Error handling strategy
- Deployment targets

**When to Read**: First — establishes mental model of the entire system.

**Size**: ~2.5K tokens

---

### 💾 **SPEC_DATAMODEL.md** — Database, KV, Types
**Purpose**: Complete data model, schema, persistence patterns, type system.

**Readers**: Architect (Primary) + Backend/KV/D1 focus — see doc header.

**Key Sections**:
- D1 schema (7 tables: sessions, decisions, actions, audit_log, etc.)
- KV namespaces (7 stores with key patterns, TTLs, examples)
- Core TypeScript types (User, SessionState, Question, Decision, etc.)
- User plan limits (free/starter/team)
- Database indices & optimization
- Validation patterns (Zod schemas)
- Migration pattern

**When to Read**: Second — foundation for understanding all data flows.

**Size**: ~2.1K tokens

---

### 🎨 **Design Specs** — Visual Design System & Tokens

**Location**: [`docs/specs/`](../specs/)

**Files**:
- [`WEBSITE_DESIGN_SPEC.md`](../specs/WEBSITE_DESIGN_SPEC.md) — colour language, typography scale, spacing grid, component specs (hero, dashboard, wizard, launchpad), motion rules, accessibility as layout, KPIs.
- [`design-tokens.json`](../specs/design-tokens.json) — machine-readable design tokens; source of truth for `src/ui/tokens.ts` and Tailwind config (see backlog item `DESIGN-TOK-01`).

**Key Sections in WEBSITE_DESIGN_SPEC.md**:
- §4 Design language — colour tokens, gradients, AI surface rules, typography, spacing, radius/elevation/motion, iconography (AI sparkle mark)
- §5 Layout system — 4px baseline grid, responsive column grid, density tiers, page templates (T1–T6), skeleton/empty/error parity
- §5.1–5.7 Component specs — Hero, Insights tab, Sessions list, "+New session" button, AIBadge primitive, Session Creation Wizard, Session Launchpad
- §7 Measurement — instrumented events and 30-day KPI targets for the Website Design Wave

**When to Read**: Before building any public-facing or dashboard UI component. These files are the source of truth for all visual decisions — they take precedence over any inline values in technical specs.

---

### 🖥️ **SPEC_FRONTEND.md** — React Architecture, Routing, State
**Purpose**: Frontend architecture, component tree, hooks, WebSocket client, design system.

**Readers**: Architect (Primary surfaces) + Frontend/UI **Lead** rows — see doc header.

**Key Sections**:
- Route table (30+ routes with auth requirements)
- Component hierarchy (pages, reusable components, energizers)
- Hooks API (useAuth, useSession, usePlan, usePlanGate, useInsights, useColorScheme)
- Design system (colors, typography, animations)
- WebSocket protocol (message types, subprotocol auth)
- i18n & localization (5 languages, JSON files)
- State management patterns (Auth context, useSession reducer, local state)
- Error handling & telemetry
- Performance optimization (code splitting, memoization)

**When to Read**: For building UI components or understanding client-side flows.

**Size**: ~3.8K tokens

---

### 🔌 **SPEC_BACKEND.md** — API Routes, Services, Middleware
**Purpose**: Route inventory (tables authoritative), middleware order, envelopes, AuthZ legend.

**Readers**: Architect (Primary) + API/middleware **Lead** — see doc header in [SPEC_BACKEND.md](SPEC_BACKEND.md).

**Key Sections**:
- **Contract header** + **AuthZ legend** (`A` … `WSV`) + **Readers** table
- **Endpoint directory**: routes by domain (no stale counts):
  - Auth (12 endpoints: magic link, OAuth, SAML, password)
  - Sessions (25+ endpoints: CRUD, lifecycle, realtime, export)
  - Decisions (8 endpoints: create, lock, search, actions)
  - AI (9 endpoints: suggest questions, recap, rephrase, etc.)
  - Teams (10 endpoints)
  - Templates (7 endpoints)
  - Admin (30+ endpoints)
  - Integrations (15+ endpoints)
  - Billing (7 endpoints)
  - Collaboration (12+ endpoints)
  - Misc (8 endpoints)
- Middleware stack (trace ID, CORS, errors, rate limits, auth, logging)
- Service layer (sessionLifecycle, auth, billing, ai, db, etc.)
- Standard response format (success & error)
- Error codes & meanings
- Validation patterns
- Database operations
- Request/response examples

**When to Read**: For understanding endpoint contracts, service integration, or building new routes.

**Size**: ~5.2K tokens

---

### ⚡ **SPEC_REALTIME.md** — WebSocket, Durable Objects, Live Sessions
**Purpose**: Real-time communication, SessionRoom DO internals, WebSocket protocol, session modes.

**Readers**: Architect (Primary) + DO/WebSocket lenses — see doc header in [SPEC_REALTIME.md](SPEC_REALTIME.md).

**Key Sections**:
- WebSocket protocol (connection URL, handshake, close codes)
- ClientMessage types (vote, feedback, emoji, advance, timer, etc.)
- ServerMessage types (init, question, results, timer, participants, etc.)
- SessionRoom DO structure (persisted state, in-memory maps, HTTP endpoints)
- WebSocket handlers (connection, message dispatch, vote accumulation, broadcast)
- Session modes:
  - Regular live (presenter controls flow)
  - Speed round (rapid-fire with scoring)
  - Async voting (24-72h without presenter)
  - Team mode (aggregated results by team)
- Voter deduplication (PSM-007: IP hash + fingerprint)
- Reconnection logic
- Performance & scaling constraints

**When to Read**: For understanding live session architecture, WebSocket protocol, or mode implementation.

**Size**: ~3.4K tokens

---

### 🔗 **SPEC_INTEGRATIONS.md** — Payments, AI, Auth, Email, Chat
**Purpose**: Third-party service integrations (Stripe, Workers AI, OAuth, SAML, email, Slack, Teams, etc.).

**Readers**: Architect (Primary) + vendor integration leads — see doc header in [SPEC_INTEGRATIONS.md](SPEC_INTEGRATIONS.md).

**Key Sections**:
- **Stripe**: Checkout, customer portal, webhook handlers (idempotent), subscription states
- **Workers AI**: Model gateway, use cases (questions, recap, rephrase, chat), rate limits
- **Auth Flows**:
  - Magic Link (OTT → email → JWT)
  - OAuth 2.0 (Microsoft, Google with PKCE)
  - SAML 2.0 (SP-initiated, assertion validation)
- **Email** (Resend): Magic link, password reset, team invites, notifications
- **Slack**: OAuth setup, share to channel
- **Teams, Zoom, Webex, Hopin**: Share endpoints
- **PowerPoint**: Embed slide, duplicate
- **Vectorize**: Semantic search via embeddings
- Environment variables & secrets

**When to Read**: For integrating new services, understanding payment flows, or debugging auth.

**Size**: ~2.9K tokens

---

### 🚀 **SPEC_DEPLOYMENT.md** — Build, Config, Secrets, CI/CD, Monitoring
**Purpose**: Build pipeline, Cloudflare configuration, secrets management, CI/CD, monitoring.

**Readers**: Architect (Primary) + Cloudflare **Lead** — see doc header in [SPEC_DEPLOYMENT.md](SPEC_DEPLOYMENT.md).

**Key Sections**:
- **Build Process**: Local development (npm run dev), production build (Vite + Wrangler)
- **Wrangler Configuration**: Project metadata, environments (dev/staging/prod), bindings, routes
- **Secret Management**: Setting secrets, .env pattern, accessing in code, Env interface
- **CI/CD Pipelines**:
  - Deploy workflow (tests → build → deploy)
  - Performance monitoring (load tests, latency)
  - Secret scanning
  - i18n validation
  - A11y testing
- **Deployment Environments**: Staging, development, production
- **Rollback Procedure**: Immediate (revert), manual, database rollback
- **Monitoring**: Health checks, logs (JSON format), analytics queries, alert rules
- **Deployment Checklist**: Pre-deploy verification
- **Common Issues**: D1 migrations, auth failures, memory issues

**When to Read**: For deploying changes, debugging production, or setting up CI/CD.

**Size**: ~3.1K tokens

---

## Quick Reference by Task

| Task | Read First | Then Read | Notes |
|------|-----------|-----------|-------|
| **Understand system** | SPEC_CORE | SPEC_DATAMODEL | Mental model of architecture |
| **Build UI component** | SPEC_FRONTEND | SPEC_REALTIME (if live) | Hooks, routing, state mgmt |
| **Apply design system / UI** | [WEBSITE_DESIGN_SPEC.md](../specs/WEBSITE_DESIGN_SPEC.md) | [design-tokens.json](../specs/design-tokens.json) · SPEC_FRONTEND | Colour, typography, spacing, component specs |
| **Add API endpoint** | SPEC_BACKEND | SPEC_CORE | Middleware, validation patterns |
| **Implement real-time feature** | SPEC_REALTIME | SPEC_FRONTEND | WebSocket protocol, DO internals |
| **Integrate new service** | SPEC_INTEGRATIONS | SPEC_DEPLOYMENT | Auth flows, secrets management |
| **Deploy changes** | SPEC_DEPLOYMENT | CI/CD logs | Build process, rollback |
| **Debug production issue** | SPEC_DEPLOYMENT | SPEC_BACKEND | Logs, alerts, error codes |
| **Add payment feature** | SPEC_INTEGRATIONS | SPEC_BACKEND | Stripe webhook, plan enforcement |
| **Enable AI features** | SPEC_INTEGRATIONS | SPEC_BACKEND | Workers AI, rate limits |
| **Rebuild from scratch** | All 7 specs | Source code as reference | Complete blueprint |

---

## Key Architecture Insights

### 1. Stateless DRAFT → Stateful LIVE
- **DRAFT**: REST API only, no DO, configuration in D1/KV
- **LIVE**: WebSocket only, stateful Durable Object, real-time broadcast
- Never mix REST + WebSocket in same state

### 2. Voter Deduplication
- Browser fingerprint + IP hash = unique voterId
- Prevents duplicate voting across devices
- Anonymous mode doesn't require login

### 3. Rate Limiting (Multi-Layer)
- IP-based: 30 req/60s anonymous
- Plan-based: Free 60 req/60s, Pro 300 req/60s
- AI-specific: 10 req/min free, 50 req/min pro
- Enforced in middleware before route handlers

### 4. Secrets Never in Config
- `wrangler.toml` only contains public vars
- Secrets via `wrangler pages secret put`
- Stored in Cloudflare secret vault, not in code

### 5. Idempotent Webhooks
- Stripe events deduplicated by event ID
- Database prevents duplicate processing
- Safe to retry failed webhook handlers

---

## File Organization

```
docs/spec/
├── INDEX.md (this file)
├── includes/
│   └── PREBUILD_AND_DELIVERY.md   ← scope, gates, spike, golden path (canonical)
├── SPEC_CORE.md
├── SPEC_DATAMODEL.md
├── SPEC_FRONTEND.md
├── SPEC_BACKEND.md
├── SPEC_REALTIME.md
├── SPEC_INTEGRATIONS.md
└── SPEC_DEPLOYMENT.md

docs/specs/                        ← Design specs (separate from technical specs)
├── WEBSITE_DESIGN_SPEC.md         ← Visual design, component specs, KPIs (source of truth for UI)
├── design-tokens.json             ← Machine-readable tokens → generates src/ui/tokens.ts
└── design-tokens.README.md        ← How tokens fit the doc set + engineering rules (start here for tokens)
```

---

## Token Cost Comparison

| Metric | Old Docs | New Specs | Reduction |
|--------|----------|-----------|-----------|
| Total Files | 35+ | 8 | -77% |
| Total Tokens | ~45K | ~23.8K | -47% |
| Avg Doc Size | 1.3K | 3K | Consolidation |
| Cross-Refs | Few | Many | Better discoverability |
| Prose vs Tables | 70% prose | 60% tables | Easier parsing |
| Completeness | 80% | 100% | All features covered |

---

## Maintenance & Updates

When navigation or **planning truth hierarchy** changes, update **[`../README.md`](../README.md)** in the same PR so contributors still land on a single map.

### When to Update Specs

1. **New endpoint added**: Update SPEC_BACKEND.md endpoint table
2. **Database schema change**: Update SPEC_DATAMODEL.md schema section
3. **New integration**: Update SPEC_INTEGRATIONS.md
4. **Deployment process changes**: Update SPEC_DEPLOYMENT.md
5. **New hook or component**: Update SPEC_FRONTEND.md
6. **New message type**: Update SPEC_REALTIME.md WebSocket section
7. **Architecture decision**: Update SPEC_CORE.md & reference relevant spec
8. **Role ownership shifts** (e.g. WS-only mutation policy): tweak the **Readers** table in the affected `SPEC_*.md` (Architect row stays Primary unless governance changes)
9. **Pre-build / sequencing policy changes** (v1 slice, spike criteria, prod gates): update [includes/PREBUILD_AND_DELIVERY.md](includes/PREBUILD_AND_DELIVERY.md) and keep **INDEX → Before you start building** links valid
10. **Design token or visual change**: Update [docs/specs/WEBSITE_DESIGN_SPEC.md](../specs/WEBSITE_DESIGN_SPEC.md) and [docs/specs/design-tokens.json](../specs/design-tokens.json) — never hand-edit `src/ui/tokens.ts` directly (see `DESIGN-TOK-01`)

### Update Frequency
- **Endpoints**: Within 1 day of merge
- **Schema**: With migration commit
- **Config**: Same PR as wrangler.toml change
- **Features**: Same PR as feature merge

---

## Using These Specs

### For AI Code Generation
```
"Rebuild the `/ai/suggest-questions` endpoint using these specs: <paste SPEC_BACKEND.md AI Routes + SPEC_INTEGRATIONS.md Workers AI>"
```

### For Code Review
```
"Review if this implementation matches SPEC_REALTIME.md WebSocket message contract"
```

### For Documentation
```
"What's the session state machine? See SPEC_CORE.md Session State Machine"
```

### For Onboarding
```
"New to Qesto? Read SPEC_CORE.md first, then jump to your area (SPEC_FRONTEND.md for UI, SPEC_BACKEND.md for API, etc.)"
```

---

## References Back to Source

Each spec includes links to critical source files:

- `functions/api/[[route]].ts` — Main API entry point
- `functions/api/SessionRoom.ts` — Durable Object implementation
- `src/hooks/useSession.ts` — WebSocket client state
- `functions/api/auth.ts` — Authentication logic
- `wrangler.toml` — Configuration
- `CLAUDE.md` — Project context & rules

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.0** | 2026-04-18 | Initial comprehensive spec set (7 docs, 23.8K tokens) |

---

## Questions?

- **Endpoint details?** → SPEC_BACKEND.md
- **How to build a feature?** → SPEC_CORE.md + relevant spec
- **WebSocket protocol?** → SPEC_REALTIME.md
- **Database schema?** → SPEC_DATAMODEL.md
- **Deploy process?** → SPEC_DEPLOYMENT.md
- **Integrate a service?** → SPEC_INTEGRATIONS.md
- **Build UI?** → SPEC_FRONTEND.md
- **Design system / colours / tokens?** → [WEBSITE_DESIGN_SPEC.md](../specs/WEBSITE_DESIGN_SPEC.md) + [design-tokens.json](../specs/design-tokens.json)

---

**Last Updated**: 2026-04-18
**Total Tokens**: ~23.8K (all specs combined)
**Coverage**: 100% of Qesto features
**Completeness**: AI-reconstruction ready
