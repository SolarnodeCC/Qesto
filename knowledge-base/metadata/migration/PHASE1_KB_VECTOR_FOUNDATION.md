---
id: PHASE1-KB-VECTOR
type: report
domain: infrastructure
category: migration
status: complete
version: 1.0
created: 2026-05-28
updated: 2026-05-28
tags:
  - vector-pipeline
  - phase-1
  - kb-search
  - migration
  - implementation
relates_to:
  - ADR-040-kb-vector-pipeline
  - YAML_FRONTMATTER_GUIDE
  - PHASE1_ADR_YAML_REPORT
---

# Phase 1: Knowledge-Base Vector Pipeline Foundation

**Completion Date**: 2026-05-28  
**Phase**: Phase 1 of 4 (Foundation & Bulk Embedding)  
**Owner**: Backend Developer + Architecture  
**Status**: Code complete, ready for bulk embedding execution

---

## Summary

✅ **Foundation layer complete** — D1 schema, markdown chunker, and bulk embedding script all implemented per ADR-040.

All files are ready for bulk vectorization of 141 knowledge-base documents.

---

## Deliverables

### 1. D1 Migration (`migrations/0042_kb_vectors.sql`)

**Tables Created:**
- `kb_documents` — document metadata (doc_id, type, domain, status, tags, relates_to, doc_hash, chunk_count)
- `kb_chunks` — chunk text + embedding metadata (chunk_id, chunk_hash, text, token_estimate, embedded_at)

**Indexes:**
- `idx_kb_documents_domain` — fast filtering by domain
- `idx_kb_documents_type` — fast filtering by type
- `idx_kb_documents_status` — fast filtering by status (e.g., 'accepted' only)
- `idx_kb_chunks_doc` — chunk lookup by document
- `idx_kb_chunks_hash` — hash-based dedup for idempotent embedding

**Constraints:**
- Foreign key: `kb_chunks.doc_id` → `kb_documents.doc_id` (CASCADE DELETE)
- Unique: `(doc_id, chunk_index)` ensures no duplicate chunks per document

**Idempotent:** Uses `IF NOT EXISTS` so migration can be re-applied safely.

---

### 2. Markdown Chunker (`functions/api/lib/markdown/mdChunker.ts`)

**Core Functions:**

1. **`parseFrontmatter(markdown: string)`**
   - Regex-based YAML extraction (lines between `---` markers)
   - Simple YAML parser for our schema (id, type, domain, status, tags, relates_to)
   - Returns: `{ frontmatter: FrontmatterMeta, body: string }`

2. **`chunkMarkdown(docId, body, frontmatter)`**
   - Parses markdown sections by H1/H2/H3 headers
   - Packs paragraphs into chunks targeting 200–500 tokens (~800–2000 chars)
   - Merges tiny sections (<80 tokens) with adjacent sections
   - Returns: `Chunk[]` with text, heading_path, line numbers, and sha256 hash

3. **`getEmbeddingInput(chunk, frontmatter)`**
   - Formats chunk for semantic embedding:
     ```
     [type=adr | domain=security]
     [tags: jwt, auth, owasp]
     # Document Title › Section Heading
     {chunk_text}
     ```
   - Packs categorical signals into embedding without bloating vector metadata

4. **`estimateTokens(text), sha256(text)`**
   - Token count heuristic: `chars / 4`
   - SHA256 hash for chunk deduplication

**Quality Characteristics:**
- No external markdown library (worker bundle stays lean)
- Regex-based parser handles well-formed YAML frontmatter
- Heading preservation maintains document structure in embeddings
- Hash consistency enables idempotent re-runs

---

### 3. Bulk Embedding Script (`scripts/embed-kb.ts`)

**Execution Model:**
- Node.js script (runs locally or in CI via Wrangler)
- Uses Cloudflare REST API directly (no secrets needed; uses `CLOUDFLARE_API_TOKEN` env var)
- Walks `knowledge-base/**/*.md`, chunks, embeds via Workers AI, upserts to D1 + Vectorize

**CLI Flags:**
- `npm run kb:embed` — Full bulk embedding (hash-gated, skips unchanged chunks)
- `npm run kb:embed -- --dry-run` — Parse & chunk, no embedding or upserting (preview mode)
- `npm run kb:embed -- --limit 5` — Test on first 5 files (for development)
- `npm run kb:embed -- --verify` — Hash-check only (future: verify index freshness)

**Main Flow:**
1. Walk `/knowledge-base/**/*.md`
2. For each file:
   - Parse YAML frontmatter
   - Chunk markdown body
   - For each chunk:
     - Compute sha256(embedding input)
     - Query D1: is this hash already embedded? If yes, skip. If no, proceed.
     - Embed text via `POST /accounts/{id}/ai/run/@cf/baai/bge-m3` (Workers AI REST API)
     - Prepare Vectorize upsert payload: `{ id, values: vector, metadata: {...} }`
3. Batch upsert (500/request) to `KB_VECTORIZE` index
4. Print summary: files, chunks, embeddings, errors, elapsed time

**Error Handling:**
- Per-chunk embedding timeout (10s) → log + skip (don't block entire job)
- Vectorize upsert failure → log + continue (partial success acceptable)
- File parse error → log + increment error counter, continue to next file

**Idempotency:**
- Hash-based deduplication: if `chunk_hash` exists in D1, skip embedding
- Garbage collection: delete vectors for removed documents
- Safe to re-run after failures; only new/changed chunks get re-embedded

---

### 4. Wrangler Configuration Update

**File: `wrangler.toml`**
```toml
[[vectorize]]
binding = "KB_VECTORIZE"
index_name = "qesto-kb-production"
```

**File: `functions/api/types.ts`**
```ts
export type Env = {
  // ...existing bindings...
  KB_VECTORIZE: VectorizeIndex  // ← Added
}
```

---

## Implementation Quality Checklist

- [x] D1 migration created and tested for idempotency
- [x] Markdown chunker handles YAML frontmatter parsing
- [x] Chunker respects 200-500 token target (validated manually)
- [x] Chunker preserves heading structure in `headingPath`
- [x] Bulk script walks KB directory correctly
- [x] Bulk script embeds via Workers AI REST API
- [x] Hash-based deduplication implemented
- [x] Vectorize upsert batching (500/request) implemented
- [x] CLI flags (--dry-run, --limit, --verify) wired up
- [x] Error handling per-chunk with logging
- [x] Wrangler config updated with KB_VECTORIZE binding
- [x] Env types updated for KB_VECTORIZE
- [x] All code committed to branch

---

## Next Steps: Bulk Embedding Execution

### Prerequisites
Before running bulk embedding, ensure:
1. D1 migration `0042_kb_vectors.sql` is applied (run `npm run migrate`)
2. KB_VECTORIZE index is provisioned in Cloudflare account
3. Environment variables set:
   - `CLOUDFLARE_API_TOKEN` — API token with AI + Vectorize permissions
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
   - `CLOUDFLARE_D1_DATABASE_ID` — qesto_2_db database ID

### Testing (Dry-Run)
```bash
npm run kb:embed -- --dry-run --limit 5
```
**Expected output:**
- 5 files processed
- Chunks parsed successfully
- Sample heading_path and token counts displayed
- No errors

### Full Bulk Embedding
```bash
npm run kb:embed
```
**Expected results:**
- ~141 files processed
- ~420 total chunks created (avg 3 chunks/file)
- ~420 embeddings (assuming fresh run; fewer on re-run due to hash dedup)
- 0 errors
- ~5-10 min runtime (API latency + batching)

### Spot-Check Quality (Manual)
After bulk embedding completes:
1. Query D1: `SELECT COUNT(*) FROM kb_chunks` — expect ~420
2. Query D1: `SELECT * FROM kb_chunks LIMIT 5` — verify text, heading_path, hash
3. Query Vectorize: `KB_VECTORIZE.query(...)` with sample query — verify vector retrieval works
4. Sample 20 random docs for accuracy:
   - Check heading_path preservation
   - Check token estimates are within 10% of actual
   - Verify no truncation in chunk_text

---

## Architecture Summary

```
┌─────────────────────────┐
│  Knowledge-Base (141 .md files)
│  - YAML frontmatter
│  - Markdown body
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  mdChunker.ts
│  - Parse YAML
│  - Split headers/paragraphs
│  - Format embedding input
│  - Compute hash
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  embed-kb.ts
│  - Walk files
│  - Chunk markdown
│  - Hash-check (skip if exists)
│  - Embed via Workers AI
│  - Batch upsert
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌──────────────┐  ┌─────────────────┐
│ D1 Database  │  │ KB_VECTORIZE
│ (metadata)   │  │ (vectors+metadata)
│              │  │
│ kb_documents │  │ 420 vectors
│ kb_chunks    │  │ 768d, cosine
└──────────────┘  └─────────────────┘
```

**Data Flow:**
1. Script chunks markdown
2. Computes hash of embedding input
3. Checks D1: does hash exist? (idempotency gate)
4. If not: embeds via Workers AI REST API
5. Upserts vector to KB_VECTORIZE
6. Upserts metadata + chunk text to D1

**Success Criteria:**
- ✅ All 141 files processed
- ✅ ~420 chunks created
- ✅ 0 chunk_hash duplicates within single document
- ✅ All vectors in KB_VECTORIZE queryable
- ✅ All metadata in D1 consistent and complete

---

## Risk Flags & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Vectorize index not provisioned | High | Pre-check: create KB_VECTORIZE before running script |
| API token missing/invalid | High | Script validates env vars at startup; fails with clear error |
| Embedding timeout on large chunks | Medium | Per-chunk timeout 10s (reusable from insights-vectorize.ts pattern) |
| D1 transaction rollback on error | Medium | Retry with exponential backoff; log partial success |
| Hash collision | Low | sha256 collision negligible for 420 items |
| Out-of-order upserts (chunking drifts) | Low | Hash consistency + line-number tracking in chunk metadata |

---

## Files Modified / Created

```
✅ migrations/0042_kb_vectors.sql              — 46 lines
✅ functions/api/lib/markdown/mdChunker.ts     — 402 lines
✅ scripts/embed-kb.ts                         — 371 lines
✅ wrangler.toml                               — +3 lines (KB_VECTORIZE binding)
✅ functions/api/types.ts                      — +1 line (KB_VECTORIZE type)
```

**Total new code: ~820 lines (excluding comments + blank lines)**

---

## Git Commit

```
commit bf55627...
Author: Backend Developer
Date:   2026-05-28

    feat(kb-vector): Phase 1 foundation - chunker, migration, bulk script
    
    ADR-040 Phase 1 implementation:
    1. D1 Migration: kb_documents + kb_chunks tables with indexes
    2. Markdown Chunker: YAML parsing, header-based chunking, token estimation
    3. Bulk Script: Workers AI embedding, batch Vectorize upsert, hash-gated idempotency
    4. Wrangler: KB_VECTORIZE binding + types.ts update
    
    Ready for bulk embedding execution on all 141 KB files.
```

---

## Deliverables Checklist for Phase 1

- [x] Migration `0042_kb_vectors.sql` created
- [x] Chunker `mdChunker.ts` handles YAML + markdown splitting
- [x] Bulk script `embed-kb.ts` with CLI flags
- [x] Wrangler + types.ts updated for KB_VECTORIZE
- [x] Hash-based idempotency implemented
- [x] Error handling + logging per-chunk
- [x] All code committed to branch
- [ ] **Pending**: Bulk embedding execution (awaiting user trigger)
- [ ] **Pending**: Spot-check quality validation (20 random docs)

---

## What's Next

**Phase 1 is COMPLETE.** All code is ready.

**To execute bulk embedding:**
```bash
# Ensure env vars set
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_D1_DATABASE_ID="..."

# Dry-run first (safe preview)
npm run kb:embed -- --dry-run

# Then full embedding
npm run kb:embed
```

**After bulk embedding completes:**
1. Review script output (chunk count, embeddings created, errors)
2. Spot-check 20 random documents for quality
3. Query Vectorize to verify retrieval works
4. Move to Phase 2 (Query API endpoint)

---

**End of Phase 1 Report**
