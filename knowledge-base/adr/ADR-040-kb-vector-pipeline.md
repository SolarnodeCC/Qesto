---
id: ADR-040
type: adr
domain: infrastructure
status: proposed
version: 1.0
owner: @Architecture team
created: 2026-05-28
updated: 2026-05-28
tags:
  - vectorize
  - semantic-search
  - knowledge-base
  - rag
  - workers-ai
relates_to:
  - ADR-0007-circuit-breaker
  - SPEC_BACKEND
  - SPEC_INTEGRATIONS
  - SPEC_DATAMODEL
  - lib/insights-vectorize.ts
---

# ADR-040: Knowledge-Base Vector Embedding & Semantic Search Pipeline

**Status**: Proposed  
**Date**: 2026-05-28  
**Owner**: Architecture team  
**Domain**: infrastructure, ai-context  
**Relates to**: ADR-0007 (Vectorize Decisions), SPEC_BACKEND.md, SPEC_INTEGRATIONS.md, SPEC_DATAMODEL.md

---

## 1. Context

### 1.1 Problem
The Qesto knowledge-base contains 141 markdown documents (~500 KB) across architecture, ADRs, specs, security, product, and AI-context domains. Sub-agents (qesto-architect, qesto-backend, qesto-security, etc.) and AI feature endpoints currently rely on either:
- Human-curated `relates_to` frontmatter (static, lossy, drift-prone), or
- Full-file reads (token-wasteful, slow, miss cross-domain links).

We need a semantic retrieval layer so that:
- Agents fetch the *most relevant* KB chunks for any question (RAG).
- Product/analytics endpoints can surface related specs/ADRs.
- New or modified docs are re-indexed without manual intervention.

### 1.2 Existing Constraints
- **Workers AI only** (`@cf/baai/bge-m3`, 768d, cosine). No external embedding providers (CLAUDE.md hard rule #1).
- **Existing Vectorize index**: `DECISIONS_VECTORIZE` — 768d / cosine — already wired with `withTimeout` and fallback. Currently stores session decision vectors.
- **Edge runtime**: 30s CPU per request, 128MB RAM. Cannot read 141 files synchronously in one request.
- **No file-system access at runtime**: Workers cannot read `/knowledge-base/` directly. Files must be embedded at build/script time and shipped to Vectorize.
- **One write/sec/key KV ceiling**, eventual consistency. Not suitable as primary vector store.
- **Budget**: ~420 chunks one-time embedding, low ongoing churn.

### 1.3 Audit Gates Applied
| Gate | Treatment |
|---|---|
| Thin route layer | `routes/knowledge-base.ts` only validates + delegates to `services/kbSearchService`. |
| Service/repository boundary | `KbSearchService` orchestrates; `KbVectorRepository` (D1) and `KbVectorClient` (Vectorize) own IO. |
| State pattern | N/A (stateless retrieval); however indexing job uses explicit `pending → embedding → upserted → failed` per chunk. |
| No peer-route coupling | RAG helper lives in `lib/rag/`, not under any route. |
| Migration placement | New tables added via numbered migration in `migrations/`. |
| Resilience posture | `withTimeout` reused; per-chunk failure isolated; index queries fall back to tag/domain filter on D1. |
| Shared primitives | Reuse `aiJson`, `embeddingClient`, `kvJson`; new `mdChunker` lives in `lib/markdown/`. |

---

## 2. Decision

### 2.1 Index Design — **Separate `KB_VECTORIZE` index**
Create a new Vectorize index `KB_VECTORIZE` (768d, cosine) rather than reusing `DECISIONS_VECTORIZE`.

**Rationale**:
- **Isolation of failure & cost**: KB queries (agent RAG, ~high QPS) should not throttle session-insight queries (low QPS, latency-critical for live sessions).
- **Different metadata schema**: decisions carry `session_id, team_id`; KB carries `doc_id, file_path, section, domain`. Mixing schemas requires defensive filtering on every query.
- **Different lifecycle**: KB is rebuilt from git; decisions are append-only per session. Reindexing one must not affect the other.
- **Negligible cost**: Vectorize bills per query + per stored vector; two indexes of ~420 + ~N vectors cost effectively the same as one.

### 2.2 Storage Topology — **Vectorize-primary, D1-mirror, no KV cache**
```
KB_VECTORIZE  (vector + minimal metadata: doc_id, chunk_id, type, domain, tags[])
      ▲
      │  upsert / query
      │
services/kbSearchService ──► D1: kb_documents, kb_chunks (authoritative metadata + chunk text)
                                                │
                                                └── source of truth for re-embedding
```
- **D1 owns chunk text & hashes** — Vectorize metadata is capped (~10KB/vector); we must not stuff chunk previews in there. D1 stores the rendered chunk text used for prompt injection.
- **No KV cache** — D1 read latency (~10–20ms) is already below human-perceptible threshold; KV adds eventual-consistency risk without payoff.
- **Vector hash in D1** — enables idempotent re-runs; skip embedding when `sha256(chunk_text)` unchanged.

### 2.3 Chunking — **Header-bounded, paragraph-packed, 200–500 token target**
Algorithm (in `lib/markdown/mdChunker.ts`):
1. Strip YAML frontmatter; retain `id, type, domain, tags, relates_to` separately.
2. Split on H1/H2/H3 headers. Each section becomes a candidate chunk.
3. If a section exceeds ~500 tokens (~2000 chars), split at paragraph boundaries (`\n\n`), packing paragraphs into sub-chunks until threshold.
4. If a section is <80 tokens, merge with the next adjacent section under the same H2.
5. Emit `Chunk { docId, chunkIndex, headingPath, text, startLine, endLine, hash }`.

**Embedding input** per chunk (semantic-rich):
```
[type=adr | domain=security]
[tags: jwt, auth, owasp]
# {doc_title} › {section_heading}
{chunk_text}
```
This packs categorical signal into the embedding without bloating the index.

**No external library** — markdown-it adds ~120KB to the worker bundle. A 60-line regex chunker handles our well-formed frontmatter docs. (Build-time script can use markdown-it freely; runtime worker keeps the lean parser only for query re-chunking, if ever needed.)

### 2.4 Embedding Pipeline — **Build-time bulk + git-driven delta**
- **Bulk job** (`scripts/embed-kb.ts`, Node script using Wrangler bindings):
  1. Walk `knowledge-base/**/*.md`.
  2. Parse frontmatter + chunk.
  3. For each chunk: compute `sha256(text)`; look up in `kb_chunks`. If hash matches → skip. Else embed via Workers AI REST.
  4. Batch upsert (Vectorize accepts up to 1000/req) → `KB_VECTORIZE`.
  5. Upsert `kb_documents` + `kb_chunks` in D1 within a single batched transaction.
  6. Garbage-collect: delete vectors whose `doc_id` no longer exists in git.

  > **Implementation note (2026-06):** steps 4–5 are a single server-side operation.
  > `embed-kb.ts` emits self-contained `KbSyncRecord`s (vector **+** the
  > `kb_documents`/`kb_chunks` fields) and `POST /api/admin/kb-sync` upserts both
  > stores together; `/api/admin/kb-sync-delete` mirrors the GC for both (step 6).
  > Earlier the endpoint wrote Vectorize only, which left D1 empty and made search
  > return `items: []` (hydration finds no chunk rows) — the dual write is required,
  > not optional. See `functions/api/routes/admin/kb-sync.ts`.
- **Delta detection**: GitHub Action on push to `main` paths `knowledge-base/**` runs the bulk job — idempotent, hash-gated, typical cost ~0–5 embeddings per commit.
- **No git hook / polling** — CI is the authoritative trigger. Local pre-commit can run `npm run kb:embed:dry` for preview.

### 2.5 Query Pipeline
```
POST /api/knowledge-base/search { query, domain?, type?, tags?, limit=5 }
  → authMiddleware (any authenticated user)
  → KbSearchService.search()
       1. embed(query)        // Workers AI, withTimeout 3s
       2. KB_VECTORIZE.query(vec, { topK: limit*3, filter: { domain?, type? } })
       3. Dedup by doc_id (keep best chunk per doc)
       4. Hydrate from D1: kb_chunks JOIN kb_documents
       5. Re-rank: score = 0.7*cosine + 0.15*tag_overlap + 0.15*domain_match
       6. Slice top `limit`
  → JSON envelope { items: [...], query_id }
```
Filters use Vectorize native metadata filtering (`filter: { domain: { $eq: 'security' } }`) — far cheaper than fetching and post-filtering.

### 2.6 RAG Context Injection Helper
New module `lib/rag/getRagContext.ts`:
```ts
export async function getRagContext(
  env: Env,
  query: string,
  opts: { maxTokens?: number; domain?: Domain; type?: KbType } = {}
): Promise<{ contextBlock: string; sources: KbSource[] }>
```
- Calls `KbSearchService.search({ query, limit: 5, ...opts })`.
- Greedily packs chunks (~roughly `chars/4` tokens) until `maxTokens` (default 1500).
- Returns a fenced context block + structured `sources[]` for citation.
- Used by `qesto-architect`, `qesto-backend`, `qesto-security` sub-agents and any `c.env.AI.run()` call that benefits from KB grounding.

---

## 3. Data Model

### 3.1 D1 Migration (`migrations/0042_kb_vectors.sql`)
```sql
CREATE TABLE IF NOT EXISTS kb_documents (
  doc_id        TEXT PRIMARY KEY,           -- frontmatter `id`
  file_path     TEXT NOT NULL UNIQUE,       -- /knowledge-base/adr/ADR-040-...md
  type          TEXT NOT NULL,              -- adr | spec | guide | runbook
  domain        TEXT NOT NULL,              -- security | ai-context | ...
  category      TEXT,
  status        TEXT NOT NULL,              -- draft | accepted | deprecated
  version       TEXT,
  owner         TEXT,
  title         TEXT NOT NULL,
  tags_json     TEXT NOT NULL DEFAULT '[]',
  relates_to_json TEXT NOT NULL DEFAULT '[]',
  size_bytes    INTEGER NOT NULL,
  doc_hash      TEXT NOT NULL,              -- sha256 of full file
  chunk_count   INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_kb_documents_domain ON kb_documents(domain);
CREATE INDEX idx_kb_documents_type   ON kb_documents(type);
CREATE INDEX idx_kb_documents_status ON kb_documents(status);

CREATE TABLE IF NOT EXISTS kb_chunks (
  chunk_id      TEXT PRIMARY KEY,           -- {doc_id}#{chunk_index}
  doc_id        TEXT NOT NULL REFERENCES kb_documents(doc_id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  heading_path  TEXT,                       -- "Architecture > Runtime > KV"
  start_line    INTEGER,
  end_line      INTEGER,
  text          TEXT NOT NULL,              -- rendered chunk (used for prompt injection)
  token_estimate INTEGER NOT NULL,
  chunk_hash    TEXT NOT NULL,              -- sha256 of embedding input
  vector_id     TEXT NOT NULL,              -- Vectorize record id == chunk_id
  embedded_at   INTEGER NOT NULL,
  UNIQUE(doc_id, chunk_index)
);
CREATE INDEX idx_kb_chunks_doc ON kb_chunks(doc_id);
CREATE INDEX idx_kb_chunks_hash ON kb_chunks(chunk_hash);
```

### 3.2 Vectorize Metadata Schema (per vector in `KB_VECTORIZE`)
```ts
type KbVectorMetadata = {
  doc_id: string;
  chunk_id: string;
  type: 'adr' | 'spec' | 'guide' | 'runbook' | 'experiment';
  domain: string;
  status: 'draft' | 'accepted' | 'deprecated';
  tags: string[];          // capped to 8
  heading_path: string;    // truncated to 120 chars
};
```
Keep metadata <1KB per vector. Chunk text lives in D1 only.

### 3.3 TypeScript Contracts
```ts
// types/knowledge-base.ts
export interface KbSearchRequest {
  query: string;          // 1..500 chars
  domain?: string;
  type?: KbType;
  tags?: string[];        // OR-match
  status?: KbStatus;      // default: 'accepted'
  limit?: number;         // 1..20, default 5
}

export interface KbSearchHit {
  doc_id: string;
  chunk_id: string;
  file_path: string;
  title: string;
  heading_path: string;
  type: KbType;
  domain: string;
  tags: string[];
  similarity: number;       // cosine, 0..1
  rerank_score: number;     // composite, 0..1
  chunk_preview: string;    // first 240 chars
}

export interface KbSource {
  doc_id: string;
  file_path: string;
  title: string;
  heading_path: string;
  similarity: number;
}
```

### 3.4 API Contract
```yaml
POST /api/knowledge-base/search
  auth: required (any role)
  rate_limit: 60/min per user
  body: KbSearchRequest
  responses:
    200: { items: KbSearchHit[], query_id: string, latency_ms: number }
    400: { error: 'invalid_query', detail }
    429: { error: 'rate_limited' }
    503: { error: 'embedding_unavailable' }   # withTimeout fallback

GET /api/knowledge-base/documents/:doc_id        # metadata only
GET /api/knowledge-base/documents/:doc_id/chunks # full chunked text (admin only)
```

---

## 4. Consequences

### 4.1 Positive
- Agents become *grounded* — they cite specific ADR/spec sections, reducing hallucinated patterns.
- Onboarding speedup: new contributors query semantically (`"how does auth handle SAML?"`) instead of grep.
- Drift detection: when a doc is updated, related-doc retrieval naturally surfaces stale neighbors.
- Reuses existing Workers AI + Vectorize stack — no new vendor.

### 4.2 Negative / Risks
- **Index drift if CI fails silently** → mitigate with weekly cron `kb:embed --verify` that diffs git hashes vs `kb_documents.doc_hash` and pages on mismatch.
- **Embedding quality on tiny chunks** (≤80 tok) — mitigated by merge rule.
- **Domain filter only as good as frontmatter discipline** — covered by existing frontmatter validation in `metadata/`.
- **Bundle size**: chunker adds ~3KB gzipped to worker; acceptable.
- **Cold-path cost** if bulk job re-embeds all 420 chunks: 420 × bge-m3 ≈ 420 × $0.011/M tokens × ~400 tok ≈ negligible (<$0.01).

### 4.3 Cost & Performance Envelope
| Metric | Estimate |
|---|---|
| One-time bulk embedding | ~420 chunks, ~170K tokens, <$0.01 |
| Storage | 420 × 768 × 4B = 1.3 MB (Vectorize) + ~600KB D1 |
| Search latency (p50) | embed 30ms + query 25ms + D1 hydrate 15ms ≈ **70ms** |
| Search latency (p95) | ≤ 200ms (withTimeout 3s on embed) |
| Re-embed on commit | 0–5 chunks typical → <500ms in CI |

---

## 5. Alternatives Considered

| Alternative | Rejected because |
|---|---|
| **Reuse `DECISIONS_VECTORIZE`** with `kind` discriminator | Failure/throttling coupling; mixed metadata schema; reindex of KB would risk decision queries. |
| **D1 FTS5 only (no vectors)** | No semantic matching; fails for paraphrased queries like "how do we keep sessions private" → GDPR docs. |
| **KV-cached vectors, query in-worker** | KV 512MB limit + eventual consistency + no ANN index → would require O(n) scan. Non-starter. |
| **External provider (Pinecone/OpenAI emb.)** | Violates CLAUDE.md hard rule #1 (Workers AI only) and adds vendor. |
| **Embed full files (no chunking)** | bge-m3 input cap 8192 tokens; some specs exceed. Also poor retrieval granularity for prompt budget. |
| **Hybrid BM25 + vector at query time** | Adds complexity; defer to Phase 5 if recall measurements warrant. Composite re-rank (tag/domain) covers 80% of the benefit. |
| **Git pre-commit hook for embedding** | Couples local dev to Workers AI keys; CI on push is cleaner and idempotent. |

---

## 6. Implementation Timeline

| Phase | Week | Deliverables | Owner |
|---|---|---|---|
| **1. Foundation** | W1 | Migration `0042_kb_vectors.sql`; `KB_VECTORIZE` index provisioned; `lib/markdown/mdChunker.ts`; `scripts/embed-kb.ts`; bulk run on all 141 files; chunk-quality spot-check (sample 20 docs). | backend-dev |
| **2. Query API** | W2 | `services/kbSearchService.ts`; `repositories/kbVectorRepository.ts`; route `routes/knowledge-base.ts`; Vitest unit + integration; rate-limit wiring. | backend-dev, tester |
| **3. RAG Helper** | W3 | `lib/rag/getRagContext.ts`; integrate into `ai.ts` insights flow and one sub-agent (`qesto-architect`); A/B compare grounded vs ungrounded responses on a 10-question eval set. | architect, backend-dev |
| **4. Auto-update** | W4 | GitHub Action `.github/workflows/kb-embed.yml` triggers on `knowledge-base/**` push; weekly `kb:embed --verify` cron; observability via Analytics Engine event `kb_search`. | devops |

---

## 7. Success Metrics

| Metric | Target |
|---|---|
| Retrieval precision@3 (manual eval, 20 queries) | ≥ 0.80 |
| Search p95 latency | ≤ 200 ms |
| Agent prompt token reduction (vs full-file injection) | ≥ 60 % |
| KB index freshness (max lag after merge) | ≤ 5 min |
| Re-embed efficiency (chunks re-embedded / chunks changed) | ≤ 1.1× |
| Embedding failure rate (per chunk, weekly) | < 0.5 % |

---

## 8. Answers to Open Questions

1. **New Vectorize index?** **Yes — `KB_VECTORIZE`**, separate from `DECISIONS_VECTORIZE`. Isolation outweighs ops simplicity given the cost is flat.
2. **Vector storage?** **Vectorize-primary** (vectors + minimal metadata), **D1-mirror** (authoritative metadata + chunk text). No KV.
3. **Chunking library?** **Build a 60-line markdown chunker** in `lib/markdown/`. markdown-it usable only in `scripts/` (Node), not in the worker bundle.
4. **Update cadence?** **GitHub Action on push** to `knowledge-base/**`, hash-gated so re-runs are idempotent. Weekly verify cron as safety net.
5. **Search filters?** **Vectorize metadata filters** (`domain`, `type`, `status`) + composite **re-rank** with tag overlap. Defer BM25 hybrid until precision@3 measured.

---

## 9. Risk Flags for Implementation

- **R1**: `Vectorize` metadata size limit — never store chunk text there. Enforced by repository layer.
- **R2**: `withTimeout` on embedding must wrap both bulk script (per-chunk) and query path. Reuse existing helper in `lib/timeout.ts`.
- **R3**: Frontmatter parser must reject docs missing `id` or `domain` — fail loud at script time, not at query time.
- **R4**: Deletion path: when a doc is removed from git, the bulk job must call `VECTORIZE.deleteByIds` for all its `chunk_id`s and `DELETE FROM kb_chunks WHERE doc_id=?`. Test this explicitly.
- **R5**: Re-rank weights (0.7/0.15/0.15) are first-pass; expose as constants in `services/kbSearchService.ts` for tuning.
- **R6**: Multi-tenant safety — KB content is non-tenant; ensure no team-scoped data ever lands in `kb_documents`. Add CI lint: forbid `team_id` or `session_id` in `knowledge-base/**`.

---

## 10. Docs to Update

| File | Change |
|---|---|
| `/knowledge-base/architecture/ARCHITECTURE.md` | Add "KB Vector Pipeline" section under AI Infrastructure. |
| `/knowledge-base/specifications/domain/SPEC_INTEGRATIONS.md` | Document `KB_VECTORIZE` binding + Workers AI usage for KB. |
| `/knowledge-base/specifications/domain/SPEC_DATAMODEL.md` | Append `kb_documents` and `kb_chunks` schema. |
| `/knowledge-base/specifications/domain/SPEC_BACKEND.md` | Document `/api/knowledge-base/search` contract. |
| `/knowledge-base/ai-context/RAG_USAGE.md` (new) | How sub-agents call `getRagContext`. |
| `/knowledge-base/operations/RUNBOOK_KB_INDEX.md` (new) | Bulk re-embed, verify, delete procedures. |
| `wrangler.toml` | New `[[vectorize]] binding = "KB_VECTORIZE"`. |

---

## Relevant File Paths (absolute, target locations)

- `/home/user/Qesto/knowledge-base/adr/ADR-040-kb-vector-pipeline.md` — this ADR
- `/home/user/Qesto/migrations/0042_kb_vectors.sql` — D1 schema
- `/home/user/Qesto/functions/api/routes/knowledge-base.ts` — thin route
- `/home/user/Qesto/functions/api/services/kbSearchService.ts` — orchestration
- `/home/user/Qesto/functions/api/repositories/kbVectorRepository.ts` — D1 + Vectorize IO
- `/home/user/Qesto/functions/api/lib/markdown/mdChunker.ts` — chunking
- `/home/user/Qesto/functions/api/lib/rag/getRagContext.ts` — agent helper
- `/home/user/Qesto/scripts/embed-kb.ts` — bulk + delta job
- `/home/user/Qesto/.github/workflows/kb-embed.yml` — CI trigger
- `/home/user/Qesto/types/knowledge-base.ts` — shared TS contracts
- `/home/user/Qesto/wrangler.toml` — new Vectorize binding
