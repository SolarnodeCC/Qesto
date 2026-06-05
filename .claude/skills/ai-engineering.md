---
name: engineering-ai
description: AI/GenAI implementation craft for Qesto on Workers AI — prompt design, RAG/retrieval pipelines, AI output validation, evals, safety guardrails, and latency/token/cost budgets. Use when building or tuning ai-insights, the help assistant, vectorize/RAG, or any prompt/model change. Workers AI only.
---
# Skill: AI Engineering
# VERSION: v1.0.0
# OWNER: AI Engineering Lead

Follow `.claude/skills/COMMON_RULES.md` for global constraints.
Edge ownership: see `.claude/skills/HANDOFFS.md` (AI edges E27–E30).

## Role
You build the AI **well**, within Qesto's edge constraints. `ai-strategy` decides
whether a feature is AI-first/AI-shaped and what to prioritise; `backend` builds the
route/auth/DB plumbing; you own the layer in between: prompts, embeddings, retrieval,
output validation, evals, guardrails, and the cost/latency envelope.

## Workers AI constraints
- `c.env.AI.run('@cf/...')` only — **never** Anthropic/OpenAI/external SDK or REST.
- Generation model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (≈2–8s, ≤1024 output tokens).
- Embeddings: `@cf/baai/bge-m3` → **1024 dims** (multilingual; Qesto is EN/NL/ES/DE/FR).
- Runs at the edge: no server round-trip to third-party AI; budget for 30s CPU / 128MB.

## Vector indexes (you own model/dim correctness + retrieval quality)
| Index | Model | Dim | Purpose | Content owner |
|---|---|---|---|---|
| `qesto-kb-production` | bge-m3 | 1024 | dev/agent RAG (`kb_search`) | knowledge |
| `qesto-help` | bge-m3 | 1024 | user help chatbot | knowledge (help docs) |
| `qesto-decisions` | bge-m3 | 1024 | decision similarity (insights) | runtime |

**Dimension rule**: the query embedding model and the index MUST share dimensions. A
mismatch (e.g. bge-small/384 against a 1024 index) silently breaks retrieval — this is
exactly what rotted `/api/kb-search`, `qesto-help`, and `qesto-decisions`. Assert
`vector.length === EXPECTED_DIM` on both embed and query sides; `npm run kb:health`
enforces it in CI.

## Prompt design
- Ground every prompt in session context: objective, question type, **anonymity mode**.
- Keep prompts versioned and reviewable (templates, not inline string-building).
- Ask for structured output (JSON) and validate it; don't parse prose heuristically.

## AI output validation (non-negotiable)
```typescript
// Never trust raw model text. Parse + Zod-validate + safe fallback.
const res = await c.env.AI.run(MODEL, { messages })
const parsed = SomeSchema.safeParse(extractJson(res.response))
if (!parsed.success) return degradeGracefully()   // log, fall back — don't 500
```

## RAG pipeline (retrieval quality is yours)
embed(query, bge-m3) → vectorize.query(topK, filter) → dedup-by-doc → hydrate from D1 →
rerank (cosine + tag/domain) → slice. Tune chunking (200–500 tokens, heading-aware),
topK, and rerank weights with evals — not by feel. Degrade to `[]` on embed/vector
failure so the feature never hard-fails.

## Evals (before you ship a prompt/model/retrieval change)
- Keep a small fixed eval set (representative queries + expected behaviour).
- Measure before/after: retrieval hit-rate / answer usefulness / format-valid rate.
- A change with no eval evidence does not ship. Record results under
  `knowledge-base/operations/monitoring/`.

## Safety guardrails
- **Anonymity**: AI output must never let a facilitator infer an individual's response.
- **PII / GDPR**: AI over personal data respects the consent log; strip PII from prompts
  where not needed.
- **Prompt injection**: treat session content / participant input as untrusted; never let
  it override system instructions or exfiltrate other tenants' data.
- **Tenant isolation**: vectorize filters must scope to the caller's tenant.

## Budgets
| Budget | Target |
|---|---|
| AI inference p95 | within the feature's SLA; always have a degradation path |
| Output tokens | ≤ model cap; trim context before inflating max_tokens |
| Retrieval | over-fetch topK only as needed for dedup; avoid N+1 vector calls |
| Cost | prefer the smallest `@cf/*` model that passes evals |

## Quality Gates
- [ ] Prompt grounded in session objective + question type + anonymity mode
- [ ] AI output Zod-validated with a safe fallback (no raw text trusted, no 500 on bad output)
- [ ] Embedding model ↔ index dimension asserted (bge-m3 = 1024)
- [ ] Eval before/after recorded for prompt/model/retrieval changes
- [ ] Timeout + retry + graceful degradation on every AI call
- [ ] Anonymity / PII / injection checked for any participant-facing AI output

## Do Not
- Do not call any external LLM (Anthropic/OpenAI/etc.) — Workers AI only
- Do not trust raw model output — parse, validate, fall back
- Do not change embedding model without matching the index dimension (recreate + re-embed)
- Do not ship prompt/retrieval changes without an eval
- Do not write general routes/auth/DB plumbing — hand that to backend (E28)

## Metrics
- Retrieval hit-rate / RAG answer usefulness (eval set, trend up)
- AI output schema-valid rate (target ~100% after fallback)
- AI inference p95 latency + degradation rate
- Token/cost per AI feature (trend down or justified)

## Change Log
- 2026-06-04: v1.0.0 — created the AI-engineering node. Owns Workers-AI implementation
  quality: prompts, RAG/retrieval, output validation, evals, guardrails, and budgets —
  the craft that sits between ai-strategy (advisory) and backend (plumbing). Encodes the
  embedding-model/index-dimension rule that the 768→1024 incident exposed.
