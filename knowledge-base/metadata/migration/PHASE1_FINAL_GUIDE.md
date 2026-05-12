---
id: PHASE1-FINAL-GUIDE
type: guide
domain: infrastructure
status: accepted
version: 1.0
created: 2026-05-12
updated: 2026-05-12
tags:
  - deployment
  - vector-pipeline
  - knowledge-base
  - phase-1
relates_to:
  - ADR-040-kb-vector-pipeline
  - PHASE_SUMMARY_DEPLOYMENT
---

# Phase 1 Completion Guide: Knowledge-Base Vector Sync

**Status**: ✅ Code-complete, vectors generated and ready for sync  
**Branch**: `claude/migrate-knowledge-base-I0PpQ`  
**Date**: 2026-05-12

---

## What's Done

### Embeddings Generated ✅
- **2,166 vectors** from 136 KB files
- **1024 dimensions** each (@cf/baai/bge-m3)
- **56 MB JSON** file: `.kb-vectors-pending.json`
- **Hash-gated** for idempotency

### Worker Deployed ✅
- **Endpoint**: `POST /api/admin/kb-sync`
- **Authentication**: `x-admin-key` header
- **Admin Key**: `phase1-vectorize-sync-test-key-2026`
- **Version**: d58b73ca-9241-490f-8488-1148d2212899
- **Binding**: Uses `env.KB_VECTORIZE.upsert()` (Worker binding)

### Code Complete ✅
- Phase 2 Query API (semantic search)
- Phase 3 RAG Context injection
- 68 new tests, 339 total passing
- All TypeScript types validated

---

## Final Sync: Two Paths

### Path A: Update Cloudflare Access (Recommended)

**The Issue**: Cloudflare Access enforces session validation globally, blocking the `/api/admin/kb-sync` endpoint.

**Solution**: Exempt this endpoint from Access in the Cloudflare Dashboard.

**Steps**:
1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Access** → **Applications** → **qesto** (or your app name)
3. Click **Edit policy**
4. Add a new rule:
   - **Name**: "KB Sync Admin"
   - **Action**: "Bypass"
   - **Selector**: 
     - Rule 1: `Path` → `matches` → `/api/admin/kb-sync`
     - Rule 2: `Headers` → `x-admin-key` → `equals` → `phase1-vectorize-sync-test-key-2026`
5. Save and deploy

**Then sync vectors**:
```bash
curl -X POST "https://qesto.cc/api/admin/kb-sync" \
  -H "x-admin-key: phase1-vectorize-sync-test-key-2026" \
  -H "Content-Type: application/json" \
  -d @.kb-vectors-pending.json
```

**Expected response**:
```json
{
  "ok": true,
  "data": {
    "message": "Vectorize upsert complete",
    "vectors_upserted": 2166,
    "batches": 22
  },
  "trace_id": "..."
}
```

### Path B: Upload via Cloudflare Dashboard

**Alternative**: Use the Cloudflare UI directly.

**Steps**:
1. Log into Cloudflare Dashboard
2. Go to **Vectorize** → **qesto-kb-production**
3. Click **Upload vectors**
4. Select `.kb-vectors-pending.json`
5. Submit
6. Wait ~30 seconds for upsert to complete

---

## Verify Sync Completed

Once vectors are synced, test semantic search:

```bash
# Get user JWT token (log in to qesto.cc)
# Extract 'auth' cookie value

curl -X POST "https://qesto.cc/api/knowledge-base/search" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "architecture deployment"
  }'
```

**Expected response**:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "doc_id": "ADR-040",
        "chunk_id": "ADR-040#2",
        "file_path": "knowledge-base/adr/ADR-040-kb-vector-pipeline.md",
        "title": "Knowledge-Base Vector Embedding & Semantic Search",
        "similarity": 0.8234,
        "rerank_score": 0.7891,
        "chunk_preview": "Architecture decision: adopt bge-m3 embeddings..."
      }
    ],
    "query_id": "...",
    "latency_ms": 85
  }
}
```

---

## After Sync: Next Steps

### Immediate (5 min)
- [ ] Verify 2,166 vectors in Vectorize index
- [ ] Test semantic search (query endpoint works)
- [ ] Check insights sessions use KB context

### Phase 3 Verification (15 min)
- [ ] Session insights response includes `kb_sources` field
- [ ] RAG context is grounded and relevant
- [ ] Token budgeting respects configured limits

### Monitoring (ongoing)
- Monitor KB search latency (target <100ms p50)
- Track zero-result queries (improve re-ranking if >5%)
- Monitor embedding timeouts (<0.1% target)

---

## Troubleshooting

### "Missing session cookie" Error
**Cause**: Cloudflare Access is blocking the request.  
**Fix**: Update Access policy to bypass `/api/admin/kb-sync` (Path A above).

### "Vectorize upsert failed" Error
**Cause**: Worker binding error or dimension mismatch.  
**Check**:
```bash
# Verify vector dimensions
jq '.[0].values | length' .kb-vectors-pending.json
# Should output: 1024
```

### Search returns no results
**Cause**: Vectors not synced or Vectorize index is empty.  
**Fix**: Verify vectors are synced (check Vectorize dashboard).

---

## Git Branch Status

**Branch**: `claude/migrate-knowledge-base-I0PpQ`
- **Commits**: 13
- **Ready to merge to main**: Yes
- **All tests passing**: Yes (339 tests)
- **TypeScript compilation**: ✅ No errors

---

## Success Criteria Checklist

Once vectors are synced, confirm:

- [ ] `POST /api/knowledge-base/search` returns results
- [ ] Latency is <150ms p95
- [ ] Results are relevant (at least 3/5 top results on-topic)
- [ ] `kb_sources` appears in insights response
- [ ] No critical errors in logs
- [ ] Rate limit (60/min) is enforced

---

## Timeline

- **2026-05-12 07:00**: Embeddings generated (220s)
- **2026-05-12 07:30**: Worker deployed with kb-sync endpoint
- **2026-05-12 08:00**: This guide created
- **TBD**: Access policy updated (your action)
- **TBD**: Vectors synced to Vectorize
- **TBD**: Semantic search goes live

---

## Questions?

Refer to:
- **Architecture**: `knowledge-base/adr/ADR-040-kb-vector-pipeline.md`
- **API Contract**: `knowledge-base/api/API_FULL.md` (Section 8)
- **RAG Usage**: `knowledge-base/ai-context/RAG_USAGE.md`
- **Deployment**: `knowledge-base/metadata/migration/PHASE_SUMMARY_DEPLOYMENT.md`
