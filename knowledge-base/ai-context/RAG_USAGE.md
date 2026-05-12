---
id: RAG_USAGE
type: guide
domain: ai-context
status: accepted
version: 1.0
owner: '@Architecture team'
created: 2026-05-12
updated: 2026-05-12
tags:
  - rag
  - knowledge-base
  - workers-ai
  - vectorize
  - prompt-engineering
relates_to:
  - ADR-040-kb-vector-pipeline
  - SPEC_BACKEND
  - SPEC_INTEGRATIONS
---

# RAG Usage Guide

How to ground AI prompts in Qesto's knowledge-base via `getRagContext()`.

This guide is for backend developers and sub-agent authors who want to inject
relevant ADR / spec / runbook passages into a Workers AI prompt so the model
answers from authoritative project context instead of hallucinating.

---

## 1. Why RAG

The Qesto knowledge-base has ~141 markdown documents covering architecture,
ADRs, specs, security, product, and AI-context. Without grounding, a Workers
AI call has to invent the relationships between these documents from scratch.
With grounding, the model gets up-to-date excerpts from the right files and
cites them by path.

Concretely, `getRagContext()` gives you:

- A **markdown context block** ready to splice into a prompt.
- A **structured `sources[]` array** for citation rendering and audit trails.

Both pieces are produced from a single embedding round-trip plus one Vectorize
query plus a small D1 hydration. No external services. No new bindings.

---

## 2. API Contract

```ts
import { getRagContext } from '@/lib/rag/getRagContext'

const { contextBlock, sources } = await getRagContext(env, query, opts)
```

### Parameters

| Name | Type | Default | Notes |
|------|------|---------|-------|
| `env` | `Env` | required | Used for `DB`, `KB_VECTORIZE`, `AI` bindings. |
| `query` | `string` | required | 1..500 chars after trim. Throws `KbSearchError('invalid_query')` otherwise. |
| `opts.maxTokens` | `number` | `1500` | Token budget for the packed block (incl. ~50/section overhead). Effective budget = `maxTokens * 0.9`. |
| `opts.domain` | `string` | — | Restrict matches by `kb_documents.domain` (e.g., `'security'`, `'product'`). |
| `opts.type` | `KbType` | — | Restrict matches by document type (`adr`, `spec`, `guide`, …). |
| `opts.limit` | `number` | `5` | Max upstream hits before packing. Clamped to `[1, 20]`. |

### Return

```ts
type RagContext = {
  contextBlock: string   // markdown — empty when no results
  sources: KbSource[]    // citations aligned with packed sections
}

type KbSource = {
  doc_id: string
  file_path: string
  title: string
  heading_path: string
  similarity: number     // 0..1
}
```

### Errors

| Error | When | Caller should |
|-------|------|---------------|
| `KbSearchError('invalid_query')` | Empty / whitespace / >500 char query | Return HTTP 400 to user. |
| `KbSearchError('embedding_unavailable')` | Workers AI embed timed out | Degrade gracefully (catch + log + run ungrounded). |
| `KbSearchError('embedding_failed')` | Workers AI returned no vector | Same as above. |
| No-results | Search returned `[]` | Not an error. `contextBlock === ''` and `sources === []`. Just run ungrounded. |

---

## 3. Usage Examples

### 3.1 Grounded session insights (live integration)

`functions/api/routes/ai-insights/register-analyze.ts` wires RAG into the
theme-extraction flow. The integration is **best-effort** — analyzer must still
work when KB is unavailable:

```ts
let kbContext = ''
let kbSources: KbSource[] = []
try {
  const ragResult = await getRagContext(c.env, sessionResult.title, {
    maxTokens: RAG_INSIGHTS_MAX_TOKENS, // 800
    domain: 'product',
  })
  kbContext = ragResult.contextBlock
  kbSources = ragResult.sources
} catch (ragErr) {
  console.log(
    JSON.stringify({ event: 'rag.context.skip', reason: (ragErr as Error).message }),
  )
}

// Pass through SessionBundle → InsightsInput → buildUserPrompt
const bundle: SessionBundle = {
  /* … */
  ...(kbContext.length > 0 ? { kbContext } : {}),
}
```

The response payload returns `kb_sources` so the frontend can render
citations next to each generated theme.

### 3.2 Custom AI endpoint

```ts
app.post('/ai/explain', authMiddleware, async (c) => {
  const { question } = await c.req.json<{ question: string }>()

  const { contextBlock, sources } = await getRagContext(c.env, question, {
    maxTokens: 1500,
  })

  const systemPrompt = `You are a Qesto engineering assistant. Answer using ONLY
the knowledge-base context below. If the context does not contain the answer,
say "I don't have enough context to answer that."

${contextBlock}`

  const result = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
  })

  return c.json({ answer: result.response, sources })
})
```

### 3.3 Sub-agent grounding (future)

Sub-agents (qesto-architect, qesto-backend, qesto-security) can pre-load KB
context before composing their response. The current pattern is one
`getRagContext()` call per agent task with the agent's domain as filter:

```ts
const { contextBlock, sources } = await getRagContext(env, taskDescription, {
  domain: 'security', // agent-scoped
  type: 'adr',        // optional — narrow to architecture decisions
  maxTokens: 1500,
})
```

Phase 3.5 will package this as a `withGroundedContext(agent, task)` decorator.

---

## 4. Token Budget Best Practices

The packer uses `chars / 4` as a token heuristic plus `~50` tokens of overhead
per packed section (heading + citation line). The effective budget is
`maxTokens * 0.9` to leave headroom for the prompt the caller stitches around
the context block.

| Use case | Recommended `maxTokens` |
|----------|------------------------|
| Short Q&A endpoint, model has 4K window | 1000–1500 |
| Insights / summarisation with large user payload | 600–900 |
| Agent reasoning loop with multiple sub-prompts | 1500–2000 |
| Long-form writing with citation requirements | 2500–3000 |

**Hard ceiling**: never exceed `model_context_window / 4`. For Llama 3.3 70B
(8K window), keep `maxTokens` at ≤ 2000 so the user payload + response have
room.

**First-hit guarantee**: the packer always admits the first (highest-rerank)
hit even if it would individually exceed the budget. The chunk body is then
char-clamped (default 400 chars) so an oversize section can't blow the
entire prompt.

---

## 5. Citation Format

Each packed section renders as:

```markdown
### {title} › {heading_path}
{chunk_preview_or_truncated_text}

_Source: {file_path} (confidence: {rerank_score_as_pct}%)_
```

The `sources[]` array carries the same metadata in structured form so the
frontend can render a citation list, link to the source file in the KB
viewer, or attach the citations to an audit log entry.

**Recommended rendering**:

- Inline footnote: `[1]`, `[2]`, … linked to a "Sources" panel.
- Confidence badge: render `similarity * 100 | 0` as a small chip.
- Open-in-KB link: `{file_path}` → KB viewer route (when implemented).

---

## 6. Performance Notes

| Metric | Typical |
|--------|---------|
| Total latency (p50) | ~70 ms |
| Total latency (p95) | ≤ 200 ms |
| Embed (Workers AI bge-m3) | 25–40 ms |
| Vectorize query (`topK = limit * 3`) | 20–30 ms |
| D1 hydration (batch `IN(...)`) | 10–20 ms |
| Cost (per call) | ~1500 tokens × $0.011/M ≈ **$0.000017** |

`KbSearchService` already wraps the embed call with a 3 s `withTimeout`. If
the embed times out you get `KbSearchError('embedding_unavailable')` — catch
it and run ungrounded rather than failing the user-facing request.

---

## 7. Troubleshooting

### "No results — context block is empty"

- Verify the doc you expect exists in `kb_documents` with `status='accepted'`.
- Check the bulk index ran on the latest commit (`scripts/embed-kb.ts`).
- Run the upstream search directly (`POST /api/knowledge-base/search`) with the
  same query to see what Vectorize returns.
- Loosen filters — `domain` and `type` constrain Vectorize on the index side.

### "Context block looks truncated"

- A single oversize chunk gets char-clamped to 400 chars (signalled by `…`).
- If you need the full chunk, fetch it via the document endpoint:
  `GET /api/knowledge-base/documents/:doc_id/chunks`.

### "`embedding_unavailable` thrown unexpectedly"

- Workers AI bge-m3 had a transient outage or your worker hit the
  `KB_EMBED_TIMEOUT_MS` (3 s) ceiling.
- Catch and degrade — the analyzer flow does this; copy the pattern in
  `register-analyze.ts`.
- For sustained outages, the Vectorize fallback path returns `[]` rather than
  throwing.

### "Confidence percentages look low"

- The composite rerank score is `0.7 * cosine + 0.15 * tag_overlap + 0.15 * domain_match`.
- A 50–60% score on a generic query is normal. A 20% score means the match is
  weak — consider re-querying with a domain filter or a more specific query.

### "Sources don't match the visible sections"

- Should not happen — the packer keeps `sources` and `sections` in lockstep
  by appending to both arrays under the same `if/break` guard.
- If you see drift, file a bug with the query and the packed block; the
  invariant is covered by `tests/unit/rag-context.test.ts`.

---

## 8. When NOT to Use RAG

- **Trivial queries** that have no KB grounding (e.g., math, formatting). The
  embed round-trip is wasted latency.
- **High-fanout loops** where you'd call `getRagContext` per item in a list.
  Pre-fetch once for the parent query, share the context across items.
- **PII-sensitive analyses** — KB content is non-tenant, so it can't leak
  user data, but check whether the caller's prompt itself contains PII before
  shipping it to AI.

---

## 9. Related

- ADR-040 — Knowledge-Base Vector Embedding & Semantic Search Pipeline
- `functions/api/lib/rag/getRagContext.ts` — implementation
- `functions/api/services/kbSearchService.ts` — upstream search
- `tests/unit/rag-context.test.ts` — invariants the helper guarantees
- `functions/api/routes/ai-insights/register-analyze.ts` — live integration
