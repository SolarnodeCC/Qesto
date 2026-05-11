---
id: AI-CONTEXT
type: reference
domain: ai
category: agents
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - ai
  - agents
  - skills
  - research
relates_to:
  - AGENT_SYSTEM_OVERVIEW
---

# Qesto Agents Visual Overview

_Hub: [Documentation map](../README.md)._

This overview separates two things that are easy to blur:

- **Development agents**: Claude/Codex role prompts and skill packs in `.claude/`.
- **Runtime agentic services**: product code that coordinates realtime state or calls Workers AI.

Qesto does **not** use external AI APIs for runtime inference. Product AI runs through Cloudflare Workers AI via `c.env.AI.run()`.

## 1. Agent System Map

```mermaid
flowchart TB
  L1["L1 Project Context\nCLAUDE.md + AGENTS.md"]
  Rules["Shared Rules\n.claude/skills/COMMON_RULES.md"]
  Governance["Governance\nAGENT_SKILL_GOVERNANCE.md\nScorecards + Templates"]

  L1 --> Rules
  Rules --> Governance

  subgraph L2["L2 Skill Packs (.claude/skills)"]
    SArchitect["architect"]
    SBackend["backend-dev\nbackend-integrations\nbackend-perf"]
    SFrontend["frontend-dev"]
    STester["tester\nreview\ninvestigate"]
    SSecurity["cso"]
    SDevops["devops"]
    SAnalytics["analytics"]
    SAI["ai-strategy"]
    SPO["product-owner"]
    SI18n["i18n"]
    SMarketing["marketing"]
  end

  subgraph L4["L4 Sub-Agents (.claude/agents)"]
    Architect["qesto-architect\nmodel: opus"]
    Backend["qesto-backend\nmodel: opus"]
    Security["qesto-security\nmodel: opus"]
    AIStrategy["qesto-ai-strategy\nmodel: opus"]
    Frontend["qesto-frontend\nmodel: sonnet"]
    DevOps["qesto-devops\nmodel: sonnet"]
    Analytics["qesto-analytics\nmodel: sonnet"]
    Tester["qesto-tester\nmodel: haiku"]
    PO["qesto-product-owner\nmodel: haiku"]
    I18n["qesto-i18n\nmodel: haiku"]
    Marketing["qesto-marketing\nmodel: haiku"]
  end

  Rules --> L2
  Rules --> L4

  Architect --> SArchitect
  Backend --> SBackend
  Security --> SSecurity
  AIStrategy --> SAI
  Frontend --> SFrontend
  DevOps --> SDevops
  Analytics --> SAnalytics
  Tester --> STester
  PO --> SPO
  I18n --> SI18n
  Marketing --> SMarketing

  Architect -. "contracts / ADRs" .-> Backend
  Architect -. "contracts / ADRs" .-> Frontend
  PO -. "scope / AC" .-> Architect
  PO -. "scope / AC" .-> Frontend
  Frontend -. "API contract requests" .-> Backend
  Backend -. "security-sensitive changes" .-> Security
  DevOps -. "infra / deploy risk" .-> Security
  Tester -. "coverage + CI feedback" .-> Backend
  Tester -. "coverage + CI feedback" .-> Frontend
  Analytics -. "metric requirements" .-> Backend
  AIStrategy -. "AI feature maturity" .-> Architect
  I18n -. "string extraction" .-> Frontend
  Marketing -. "copy only" .-> Frontend
```

## 2. Development Agent Inventory

| Agent | Tier | Owns | Escalates to |
|---|---:|---|---|
| `qesto-architect` | Opus | ADRs, API contracts, data model, cross-layer design | Product Owner for scope; Review for code review |
| `qesto-backend` | Opus | `functions/api/`, `worker/`, D1/KV/DO, backend integrations | Architect for contracts; Security for sensitive flows |
| `qesto-security` | Opus | OWASP/STRIDE audits, vulnerability triage, release blockers | Architect/Backend/DevOps by affected domain |
| `qesto-ai-strategy` | Opus | AI feature strategy, maturity scoring, action plans | Architect for implementation architecture |
| `qesto-frontend` | Sonnet | `src/`, React UI, WebSocket UI state, Tailwind | Backend for API contracts; i18n for translations |
| `qesto-devops` | Sonnet | Wrangler config, CI/CD, secrets, Cloudflare operations | Security for secret/risk issues |
| `qesto-analytics` | Sonnet | Analytics Engine queries, dashboards, metrics reports | Backend for instrumentation changes |
| `qesto-tester` | Haiku | Vitest/integration tests, coverage, acceptance verification | Backend/Frontend for implementation defects |
| `qesto-product-owner` | Haiku | Stories, acceptance criteria, prioritization | Architect for technical decisions |
| `qesto-i18n` | Haiku | Translation infrastructure, key extraction, language quality | Frontend for UI integration |
| `qesto-marketing` | Haiku | Copy, CRO, ICP, email/sales materials | Frontend for page implementation |

## 3. Runtime Agentic Services

```mermaid
flowchart LR
  User["Host / participant\nBrowser UI"]
  SPA["React SPA\nsrc/"]
  API["Hono API\nfunctions/api"]
  DO["SessionRoom Durable Object\nLIVE session coordinator"]
  D1["D1\nsessions, questions, votes"]
  KV["KV\ncached sessions, insights, actions, audit"]
  AI["Cloudflare Workers AI\nc.env.AI.run()"]
  Vec["Vectorize\nDECISIONS_VECTORIZE"]
  AE["Analytics Engine\nMETRICS_AE"]

  User --> SPA
  SPA -- "DRAFT REST CRUD" --> API
  SPA -- "LIVE WebSocket" --> DO
  API -- "DRAFT data + closed results" --> D1
  API -- "cache, rate limit, audit" --> KV
  DO -- "init / close / state" --> API
  DO -- "votes, pause, advance, timers" --> DO

  subgraph RuntimeServices["Runtime agentic services"]
    Wizard["Question Wizard\nlib/ai-wizard.ts"]
    Insight["Insights Analyst\nlib/ai-insights.ts"]
    Vector["Similarity Enricher\nlib/insights-vectorize.ts"]
    Precompute["Background Precompute\nsessions.ts waitUntil"]
    Realtime["Realtime Coordinator\nSessionRoom.ts"]
  end

  API -- "/sessions/:id/questions/generate" --> Wizard
  Wizard -- "fast model + fallback\nstrict JSON validation" --> AI
  Wizard -- "draft suggestions\nnot auto-persisted" --> SPA

  API -- "/sessions/:id/insights/analyze" --> Vector
  Vector -- "embed session text" --> AI
  Vector -- "query/upsert similar sessions" --> Vec
  Vector --> Insight
  API -- "closed session bundle" --> Insight
  Insight -- "theme extraction\nstrict JSON validation" --> AI
  Insight -- "cache payload" --> KV
  Insight -- "audit + metrics" --> AE

  API -- "session close" --> Precompute
  Precompute -- "best-effort cached themes" --> Insight

  SPA -- "vote / advance / pause / resume" --> Realtime
  Realtime -- "hibernating WS + alarm timers" --> DO
  Realtime -- "final counts on close" --> D1
```

## 4. Runtime Service Responsibilities

| Service | Code | Trigger | Output | Guardrails |
|---|---|---|---|---|
| Question Wizard | `functions/api/lib/ai-wizard.ts` | `POST /api/sessions/:id/questions/generate` | 3-8 draft questions plus confidence | DRAFT only, rate-limited, strict JSON/Zod validation, suggestions are not auto-saved |
| Insights Analyst | `functions/api/lib/ai-insights.ts` | Manual analyze or close precompute | Theme labels, counts, example excerpts | Closed/archived sessions, plan-gated, no PII, strict JSON/Zod validation |
| Similarity Enricher | `functions/api/lib/insights-vectorize.ts` | Insights analyze | Similar past session titles and stored embedding | Workers AI embeddings, 768-dimensional Vectorize index, best-effort fallback |
| Background Precompute | `functions/api/routes/sessions.ts` | `waitUntil()` after session close | Cached `insights:{sessionId}` payload | Does not delay close response, skips empty input and existing cache |
| Realtime Coordinator | `functions/api/SessionRoom.ts` | LIVE WebSocket and DO internal calls | Live vote state, broadcasts, final counts | Durable Object per session, DRAFT/LIVE split, voter rate limits, alarm-driven debounced broadcasts |

## 5. Source Files

- Development framework: [`CLAUDE.md`](../../../../Qesto/CLAUDE.md), [`.claude/agents/`](../.claude/agents/), [`.claude/skills/`](../.claude/skills/)
- Governance: [`docs/AGENT_SKILL_GOVERNANCE.md`](../AGENT_SKILL_GOVERNANCE.md), [`docs/AGENT_SKILL_SCORECARD.md`](../research/AGENT_SKILL_SCORECARD.md), [`docs/AGENT_SKILL_TEMPLATE.md`](./AGENT_SKILL_TEMPLATE.md)
- Runtime AI: [`functions/api/lib/ai-wizard.ts`](../functions/api/lib/ai-wizard.ts), [`functions/api/lib/ai-insights.ts`](../functions/api/lib/ai-insights.ts), [`functions/api/lib/insights-vectorize.ts`](../functions/api/lib/insights-vectorize.ts)
- Runtime orchestration: [`functions/api/routes/sessions.ts`](../functions/api/routes/sessions.ts), [`functions/api/routes/ai-insights/`](../functions/api/routes/ai-insights/), [`functions/api/SessionRoom.ts`](../functions/api/SessionRoom.ts), [`worker/index.ts`](../worker/index.ts)
