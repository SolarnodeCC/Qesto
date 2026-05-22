---
id: AI-CONTEXT-SPEC
type: specification
domain: architecture
status: draft
version: 0.1
created: 2026-05-22
updated: 2026-05-22
tags:
  - ai
  - workers-ai
  - session-context
relates_to:
  - ADR-0006-workers-ai-capabilities
  - AI-CONTEXT-01
  - ADR-0011
---

# Session AI Context — Interface Specification (Draft)

**Backlog:** AI-CONTEXT-01 (Sprint 33)  
**Status:** Draft for Sprint 32 RC review — implementation in Sprint 33

## Purpose

Single typed contract for all Workers AI calls (`c.env.AI.run()` only). Sprint 34 features (AI-RECAP-PROV-01, AI-SENTIMENT-01) extend this schema — they do not define parallel context types.

## Types (target: `functions/api/lib/ai/session-context.ts`)

```typescript
import type { Anonymity, PlanTier } from '../types'

export type SessionAIContext = {
  sessionId: string
  teamId: string | null
  plan: PlanTier
  anonymity: Anonymity
  locale: string
  /** Workers AI model id, e.g. @cf/meta/llama-3.3-70b-instruct-fp8-fast */
  model: string
  promptVersion: string
}

export type AIOverride = Partial<Pick<SessionAIContext, 'model' | 'promptVersion' | 'locale'>>

export type AIPipelineResult<T> =
  | { ok: true; data: T; model: string; durationMs: number }
  | { ok: false; code: 'ai_unavailable' | 'ai_timeout' | 'ai_rate_limited'; message: string }
```

## Functions

### `buildSessionAIContext(c, sessionId): Promise<SessionAIContext>`

Loads session + team plan from D1/KV. Selects default model from plan tier (see ADR-0006).

### `aiPipeline<T>(ctx, run): Promise<AIPipelineResult<T>>`

- Wraps `run` with circuit breaker (CB-02) and 25s AbortController.
- Emits `ai.inference` AE event with `teamId`, `plan`, `durationMs`.
- Never logs prompt text or participant content (ADR-0009).

### `aiOverride(ctx, override): SessionAIContext`

Returns shallow merge for one-off calls (e.g. sentiment uses `distilbert-sst-2-int8`).

## Plan → model mapping (initial)

| Plan | Default model | Sentiment model |
|------|---------------|-----------------|
| free | llama-3.3-70b-instruct-fp8-fast | distilbert-sst-2-int8 (if entitled) |
| starter | same | same |
| team | same | same |

Per-plan differentiation deferred to ADR-0014 (AI capability tier ladder).

## Privacy gates

- `anonymity === 'zero_knowledge'`: disable AI-SENTIMENT-01 and any feature storing per-response attribution.
- Aggregate-only outputs for sentiment (k ≥ 5) per ADR-0011.

## Tests (Sprint 33)

- Unit: `aiPipeline` returns `ai_unavailable` when circuit breaker OPEN.
- Unit: `buildSessionAIContext` selects model by plan.
- Integration: wizard generate uses same context builder as insights.

## Non-goals (this spec)

- External AI providers (forbidden).
- Vectorize RAG (ADR-040 / KB-RAG-01, Sprint 39).
