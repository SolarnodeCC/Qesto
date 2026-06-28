---
id: ADR-0068
status: accepted
created: 2026-06-28
accepted: 2026-06-28
deciders: architect, ai-engineer
relates_to: ADR-042, REFACTORING_AUDIT, AI_EVAL_BASELINE
---

# ADR-0068: All Workers AI Inference Through the Gateway Facade (`runAI`)

## Status

Accepted (2026-06-28). Establishes `functions/api/lib/ai/ai-gateway.ts` as the single entry point
for Workers AI inference and adds a CI ratchet (`scripts/check-ai-gateway.mjs`) to enforce it.
Implements the High finding "Workers AI calls bypass the gateway wrapper" from
[`REFACTORING_AUDIT.md`](../../REFACTORING_AUDIT.md). Extends [`ADR-042`](./ADR-042-cloudflare-capability-expansion.md)
(AI Gateway, Phase 1.1).

## Context

`runThroughAIGateway()` (ADR-042) gives every AI call semantic caching, rate limiting, prompt
sanitisation, cost analytics and a direct-`env.AI.run` fallback. Yet the audit found **32 raw
`env.AI.run(...)` / `ai.run(...)` call sites** across ~20 files, while only **2 files** used the
wrapper. The adoption barrier was structural: `runThroughAIGateway(env, ctx, model, input)` requires
a full `SessionAIContext`, which most lib/route helpers do not have. As a result, retry/timeout logic
was copy-pasted (`help-rag.ts`, `ai-insights.ts`) or omitted (`copilot-context.ts`), and most
inference ran without caching or rate limiting — divergent latency/cost and no single tuning point.

## Decision

1. Add a thin facade `runAI(env, model, input, opts?)` to `ai-gateway.ts` that makes the
   `SessionAIContext` **optional** (synthesising a minimal system context when absent) and returns
   the bare model result — a drop-in for `env.AI.run(model, input)`.
2. All Workers AI inference MUST go through `runAI` or `runThroughAIGateway`. Direct `env.AI.run` is
   permitted only inside `ai-gateway.ts` (the fallback path).
3. Enforce with `scripts/check-ai-gateway.mjs` (ratchet, baseline 32, DOWN only), wired into
   `ops/ci/quality-gates.sh` and `npm run check:rc`.

## Consequences

- **Positive:** one place to tune model/timeout/retry/caching; uniform cost + rate-limit behaviour;
  call sites become trivial; the ratchet blocks new raw calls.
- **Cost:** the existing 32 sites migrate incrementally over release trains; each migration touches
  the AI path and therefore requires the **REV-10 eval gate** (`npm run test:eval` green with updated
  golden fixtures — see [`AI_EVAL_BASELINE.md`](../operations/monitoring/AI_EVAL_BASELINE.md)).
- **Neutral:** no runtime behaviour change from adding the facade alone (no call sites migrated in the
  introducing change).
