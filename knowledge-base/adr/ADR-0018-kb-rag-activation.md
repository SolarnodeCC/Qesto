---
id: ADR-0018
status: accepted
created: 2026-05-22
---

# ADR-0018: KB RAG Activation (Decision Memory)

## Decision

1. **Index** — `DECISIONS_VECTORIZE` (768d, cosine) for closed-session embeddings.
2. **API** — `GET /api/agent/grounding?q=` returns top-k chunks for agent prompts (KB-RAG-01).
3. **Embedding** — `@cf/baai/bge-m3` same as insights pipeline.
4. **Privacy** — queries are facilitator-authenticated; no voter PII in vectors.

## Consequences

- Help KB remains on `KB_VECTORIZE` (separate index).
- Coaching (AI-COACHING-01) may consume grounding in a follow-up without duplicating indexes.
