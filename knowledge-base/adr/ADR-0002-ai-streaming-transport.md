---
id: ADR-0002
title: AI Streaming Transport for Wizard Question Generation
domain: architecture
status: accepted
version: 1.0
created: 2026-04-30
updated: 2026-05-11
tags:
  - ai
  - streaming
  - workers-ai
  - sse
  - wizard
relates_to:
  - SPEC_FRONTEND
  - SPEC_BACKEND
  - ADR-0006-workers-ai-capabilities
---

# ADR-0002: AI Streaming Transport for Wizard Question Generation

**Date**: 2026-04-30
**Status**: Accepted
**Deciders**: Architecture (Sprint 19 planning, 2026-04-30)
**Implements**: [Sprint 19 WIZ-AI-01](../product/planning/SPRINT_PLAN_MASTER.md) — AI wizard sub-flow with streaming skeleton

---

## Context

Qesto's AI wizard (`WIZ-AI-01`) calls Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) to generate 3–5 session questions from a host's topic prompt. End-to-end AI latency is 2–8 seconds.

**Problem**: Without streaming, the wizard UI blocks for up to 8 seconds before showing any output. This creates a perceived "freeze" that reduces wizard completion rates and AI acceptance rates — two of the Sprint 19 north-star KPIs.

**Constraints**:
- Must work in Cloudflare Pages Functions (Hono on Workers runtime)
- Client is a React 19 SPA — no native SSE library dependency required
- Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` supports `stream: true`, returning a `ReadableStream` of JSON-serialised token chunks
- Workers CPU limit is 30s — streaming must complete well within this
- The `POST /sessions/:id/questions/generate` non-streaming endpoint must remain for backward compatibility and for the `/ai/refine` idempotency shortcut

### Options Considered

| Option | Transport | Client API | TTFB | Complexity |
|--------|-----------|------------|------|------------|
| **A — Server-Sent Events (SSE)** | `text/event-stream` | `EventSource` | ≤1s | Low — browser-native, no library |
| **B — Chunked JSON** | `Transfer-Encoding: chunked` | `fetch` + `ReadableStream` | ≤1s | Medium — manual chunk parsing |
| **C — WebSocket** | WS upgrade | `WebSocket` | ≤1s | High — overkill for unidirectional stream; ties up WS upgrade |
| **D — Long poll** | HTTP | `fetch` with timeout | 2–8s | None — defeats the purpose; same UX as blocking |

---

## Decision

**Option A: Server-Sent Events (SSE)** via Hono's `streamSSE` helper (or a manual `ReadableStream` with `content-type: text/event-stream`).

---

## Rationale

1. **Browser-native**: `EventSource` is available in all modern browsers with zero extra dependencies. React 19 can `useEffect` + `EventSource` or use the Fetch `ReadableStream` API.
2. **Works in Workers**: Cloudflare Workers support streaming responses via `ReadableStream`; Hono wraps this cleanly. Pages Functions inherit this support.
3. **Unidirectional**: AI generation is one-way (server → client). SSE is the correct primitive; WebSocket bidirectionality is unnecessary overhead.
4. **TTFB ≤ 1s**: First token from Llama 3.3 arrives within ~800ms; SSE flushes immediately, so the skeleton animation starts before the model has produced all questions.
5. **Graceful degradation**: If a client doesn't support SSE (edge case), the non-streaming `POST /questions/generate` endpoint remains available.
6. **Simpler than chunked**: SSE provides explicit event boundaries (`data:`, `event:`, `id:` fields). Chunked JSON requires the client to stitch partial JSON — fragile with network splits.

---

## Implementation Contract

### Endpoint

`POST /api/sessions/:id/ai/generate` (new, distinct from `/questions/generate`)

> Note: The existing `POST /questions/generate` endpoint stays as-is (JSON, non-streaming) for `/ai/refine` cache hits and backward compatibility.

### Event format

```
event: token
data: {"text":"What is"}

event: token
data: {"text":" your team's"}

event: done
data: {"questions":[...],"confidence":0.87}

event: error
data: {"code":"ai_output_invalid","message":"..."}
```

- `token` events carry partial text (raw token, not validated JSON yet)
- `done` event carries the final validated `QuestionDraft[]` array — client commits state here
- `error` event closes the stream with a typed error code

### Client skeleton contract

While `token` events arrive, the frontend renders a shimmering skeleton of 3–5 question cards. The skeleton count is seeded from the `count` param in the request body. On `done`, skeleton cards are replaced with real `QuestionCard` components.

### Rate limiting

Shared with the existing `POST /questions/generate` bucket: 20 requests / hour / user (`ai-wizard` prefix in `ACTIONS_KV`).

---

## Consequences

- **Positive**: Perceived generation time drops from 2–8s to ≤1s TTFB; measurable improvement in wizard completion rate.
- **Positive**: `EventSource` auto-reconnects on network drop; partial generation is discarded and restarted cleanly.
- **Negative**: SSE connections hold a Worker open for the full generation duration (~2–8s). At high concurrency, this consumes Worker CPU time. Mitigated by the 20/hr per-user rate limit.
- **Negative**: `EventSource` uses GET by default; Hono SSE is triggered by POST — client must use `fetch` with a `ReadableStream` body reader rather than the `EventSource` constructor. Document this in the frontend skill pack.
- **Follow-up**: If streaming latency exceeds 6s p99 in production (monitored via Analytics Engine), consider switching the Workers AI model to a faster fp8 variant or adding a streaming timeout with a fallback to non-streaming.

---

## References

- [Cloudflare Workers Streaming](https://developers.cloudflare.com/workers/runtime-apis/streams/)
- [Hono Streaming Response](https://hono.dev/docs/api/context#streamsseresponse)
- [Workers AI Streaming](https://developers.cloudflare.com/workers-ai/models/llama-3/)
- [Sprint 19 WIZ-AI-01 exit criteria](../product/planning/SPRINT_PLAN_MASTER.md)
