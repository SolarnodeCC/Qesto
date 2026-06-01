# Help Assistant Deployment & Operations Guide

## Overview

The Qesto Help Assistant is a RAG-powered Q&A system that uses Cloudflare Workers AI, Vectorize, and D1 to provide users with instant answers about product features, billing, and troubleshooting.

**MVP Status:** Phase 1 complete (Week 5 delivery)
- Stateless question answering with Mistral 7B
- Plan-aware topic gating (free/starter/team)
- Feedback-driven auto-tuning with manual review
- System prompt versioning for iterative improvement

---

## Architecture

### Request Flow

```
User Question (POST /api/help/ask)
         ↓
   Rate Limit Check (10 req/min per user)
         ↓
   Embed Question (bge-m3, 768-dim, 10s timeout)
         ↓
   Vector Search (Vectorize, top-3, score ≥0.70)
         ↓
   Fetch Full Docs (D1, parallel)
         ↓
   Get Active Prompt (topic-specific or global)
         ↓
   Build System Prompt (with RAG context)
         ↓
   Invoke Mistral (retry 3x, 20s timeout)
         ↓
   Return Answer + Sources
         ↓
   Log Metrics (latency, success, embedding count)
```

### Bindings & Infrastructure

| Component | Binding | Specs |
|-----------|---------|-------|
| Vector DB | `HELP_VECTORIZE` | Cloudflare Vectorize, `qesto-help` index, 768d (cosine) |
| SQL DB | `DB` | Cloudflare D1 (SQLite), `qesto_2_db` |
| AI | `AI` | Cloudflare Workers AI (@cf/baai/bge-m3, @cf/mistral/mistral-7b) |
| Auth KV | `ACTIONS_KV` | Rate limiting store (10 req/min per user) |

### Database Schema

**help_documents** (15 seed documents)
- id, title, content, topic, scope, excerpt, embedding_id, created_at, updated_at, published_at

**help_feedback**
- Tracks user feedback (helpful/not helpful) per document
- Auto-aggregates downvotes for 7-day rolling review

**help_documents_review_queue**
- Flagged documents pending admin review
- Trigger: ≥3 downvotes in 7 days
- Resolution actions: prompt_updated, doc_revised, dismissed

**help_prompt_versions**
- System prompt versioning with topic scope
- Topic-specific prompts override global fallback
- Audit trail: trigger_event, triggered_by, version number

---

## Deployment Checklist

### Pre-Deployment (Preview Environment)

- [ ] **Infrastructure Readiness**
  ```bash
  npm run deploy:api:dry-run
  # Verify bindings: HELP_VECTORIZE, DB, AI, ACTIONS_KV
  ```

- [ ] **Seed Knowledge Base**
  ```bash
  # Run once per deployment (idempotent)
  # Populates 15 documents + embeddings into D1 + Vectorize
  node scripts/seed-help-docs.mjs
  ```

- [ ] **Test Endpoints**
  ```bash
  # POST /api/help/ask
  curl -X POST https://preview-qesto.pages.dev/api/help/ask \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"question": "How do I create a session?"}'

  # GET /api/admin/help/review-queue
  curl https://preview-qesto.pages.dev/api/admin/help/review-queue \
    -H "Authorization: Bearer <admin-token>"
  ```

- [ ] **Load Test (Concurrent Requests)**
  - Target: 50 concurrent /api/help/ask requests
  - Expected latency: p50 <2s, p95 <5s
  - Target throughput: ≥20 req/sec
  - See "Load Testing" section below

- [ ] **Monitor Metrics**
  - Embedding success rate: >95%
  - Mistral success rate: >98%
  - Vectorize query latency p95: <500ms
  - Rate limit rejection: <1% of total requests

### Production Deployment

1. **Merge to main** via approved pull request
2. **Deploy Frontend**
   ```bash
   npm run deploy:frontend
   ```
3. **Deploy Backend**
   ```bash
   npm run deploy:api
   ```
4. **Verify Health**
   ```bash
   curl https://qesto.cc/api/admin/health
   ```
5. **Monitor** first 24 hours for errors, latency spikes

---

## Load Testing

### Scenario: 50 Concurrent Questions

```bash
# Simulate with Apache Bench
ab -n 1000 -c 50 \
  -H "Authorization: Bearer <token>" \
  -p payload.json \
  https://preview-qesto.pages.dev/api/help/ask

# payload.json
{"question": "How do I create a session?"}
```

### Expected Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **p50 latency** | <2s | Embedding (10s timeout) + Vectorize (5s) + Mistral (20s) |
| **p95 latency** | <5s | Includes retry backoff (200ms, 400ms) |
| **p99 latency** | <10s | Worst case: full retry + slow AI response |
| **Error rate** | <1% | Timeouts, embedding failures, validation errors |
| **Throughput** | ≥10 req/sec | Per edge location |

### Bottleneck Analysis

1. **Embedding (10s timeout)** — Slowest component
   - Mitigation: Batch embeddings in Phase 2
   - Monitor: log `help.ai.embed.*` events

2. **Vectorize Query (5s timeout)** — Variable latency
   - Monitor: Vectorize analytics, query performance
   - Index optimizations: metadata filtering by `scope`

3. **Mistral Response (20s timeout)** — Model inference
   - Retry logic: 3 attempts with backoff
   - Monitor: `help.ai.retry` and `help.ai.error` events

### Load Testing Commands

```bash
# Simple load test (100 sequential requests)
for i in {1..100}; do
  curl -s -X POST https://preview-qesto.pages.dev/api/help/ask \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"question":"How do I'"$i"'?"}' | jq .
done

# Concurrent load test (requires Apache Bench)
ab -n 100 -c 20 -p payload.json https://preview-qesto.pages.dev/api/help/ask

# Stress test with increasing concurrency
for c in 10 20 50 100; do
  ab -n 200 -c $c -p payload.json https://preview-qesto.pages.dev/api/help/ask
done
```

---

## Monitoring & Observability

### Key Metrics

All events logged as JSON to stdout and forwarded to Analytics Engine.

#### Help Question Answering
- **help.ask.ok** — Question answered successfully
  - Fields: user_id, plan, latencyMs, source_count
- **help.ai.ok** — Mistral response generated
  - Fields: model, attempt, latencyMs, outputChars
- **help.ai.retry** — Mistral attempt failed, retrying
  - Fields: model, attempt, latencyMs, error
- **help.ai.error** — Mistral final failure
  - Fields: model, attempt, latencyMs, error

#### Feedback & Auto-Tuning
- **help.feedback.ok** — Feedback submitted
  - Fields: user_id, document_id, helpful, downvote_count
- **help.feedback.auto_tune_flagged** — Document flagged for review
  - Fields: document_id, downvote_count

#### Admin Actions
- **help.prompt.created** — New prompt version created
  - Fields: prompt_id, version, topic, trigger_event, admin_user
- **help.prompt.activated** — Prompt version activated
  - Fields: prompt_id, topic
- **help.feedback.review_resolved** — Review completed
  - Fields: document_id, action, admin_user

### Dashboard Queries

**Analytics Engine query examples** (qesto_metrics dataset):

```sql
-- Help question volume (last 24h)
SELECT
  DATE(timestamp_ms / 1000, 'unixepoch') as day,
  COUNT(*) as question_count,
  COUNT(CASE WHEN outcome = 'success' THEN 1 END) as success_count
FROM events
WHERE name = 'help.ask.ok'
GROUP BY day
ORDER BY day DESC

-- Average latency by hour (last 7 days)
SELECT
  strftime('%Y-%m-%d %H:00', timestamp_ms / 1000, 'unixepoch') as hour,
  AVG(CAST(json_extract(data, '$.latencyMs') AS INTEGER)) as avg_latency_ms,
  percentile_cont(CAST(json_extract(data, '$.latencyMs') AS INTEGER), 0.95) as p95_latency_ms
FROM events
WHERE name = 'help.ai.ok' AND timestamp_ms >= (UNIX_TIMESTAMP() - 7 * 86400) * 1000
GROUP BY hour
ORDER BY hour DESC

-- Downvote distribution (last 30 days)
SELECT
  json_extract(data, '$.document_id') as document_id,
  COUNT(CASE WHEN json_extract(data, '$.helpful') = 'false' THEN 1 END) as downvote_count
FROM events
WHERE name = 'help.feedback.ok' AND timestamp_ms >= (UNIX_TIMESTAMP() - 30 * 86400) * 1000
GROUP BY document_id
HAVING downvote_count >= 3
ORDER BY downvote_count DESC
```

### Health Checks

**Endpoint Health**
```bash
# API health
curl https://qesto.cc/api/admin/health
# Expected: 200 OK with { env, ts, region, commit }

# Authenticated endpoint
curl -H "Authorization: Bearer <token>" https://qesto.cc/api/help/ask \
  -X POST -d '{"question":"test"}'
# Expected: 200 OK with { ok: true, data: { answer, sources } }

# Admin endpoint
curl -H "Authorization: Bearer <admin-token>" https://qesto.cc/api/admin/help/review-queue
# Expected: 200 OK with { ok: true, data: { flagged_documents } }
```

**Binding Connectivity**
- D1: `SELECT COUNT(*) FROM help_documents` (should return 15)
- Vectorize: Query index `qesto-help` with test vector (should return results)
- AI: Test embedding & Mistral inference
- ACTIONS_KV: Test rate limit store (put/get)

---

## Troubleshooting

### Common Issues

#### "Embedding timeout" error
- **Symptom:** help.ai.embed error after 10s
- **Cause:** Workers AI bge-m3 overloaded or slow inference
- **Fix:** Retry (automatic), or reduce batch size in Phase 2

#### "Vectorize query timeout" error
- **Symptom:** help.vectorize.query error after 5s
- **Cause:** Index query too slow (large index, complex filters)
- **Fix:** Check Vectorize analytics, rebuild index if needed

#### "Mistral response timeout" error
- **Symptom:** help.ai error after 20s and 3 retries
- **Cause:** Model overloaded or very slow response
- **Fix:** Check Workers AI dashboard, may be regional capacity issue

#### "Rate limit exceeded" (429)
- **Symptom:** "Too many questions; please wait"
- **Cause:** User hit 10 req/min limit
- **Fix:** Inform user to retry after `retry_after_seconds`

#### "Document not found" or empty sources
- **Symptom:** Answer provided but `sources: []`
- **Cause:** Vectorize found matches but D1 fetch failed
- **Fix:** Check D1 database connection, verify document exists

### Debug Mode

Enable verbose logging:
```bash
# Set DEBUG env var (edge runtime)
wrangler pages deploy --env production --debug

# Check logs via Cloudflare dashboard
# > Pages > qesto > Functions > Logs
```

---

## Operations Runbook

### Weekly Tasks
- [ ] **Monitor Downvote Trends**
  ```bash
  # Get documents with 3+ downvotes in past 7 days
  curl https://qesto.cc/api/admin/help/review-queue
  ```
- [ ] **Review Flagged Documents**
  - Click through review queue
  - Decide: prompt_updated, doc_revised, or dismissed

### Monthly Tasks
- [ ] **Create New Prompt Version** (if needed)
  ```bash
  curl -X POST https://qesto.cc/api/admin/help/prompt-versions \
    -H "Authorization: Bearer <admin-token>" \
    -H "Content-Type: application/json" \
    -d '{
      "content": "Updated system prompt...",
      "topic": "billing",
      "trigger_event": "manual_admin"
    }'
  ```
- [ ] **Activate New Prompt**
  ```bash
  curl -X POST https://qesto.cc/api/admin/help/prompt-versions/<id>/activate \
    -H "Authorization: Bearer <admin-token>"
  ```
- [ ] **Review Performance Metrics**
  - Embedding success rate
  - Mistral success rate
  - Average latency
  - User question volume

### Escalation Procedures

| Issue | Owner | Response Time |
|-------|-------|---|
| Embedding failures (>5%) | Infra | 15 min |
| Mistral timeouts (>10%) | AI/Infra | 15 min |
| Down for >1 hour | Engineering | On-call |
| Data loss (missing docs) | Database | Critical |

---

## Roadmap: Phase 2 & Beyond

### Phase 2 (Week 6-8)
- [ ] Multi-language support (EN/NL/ES/DE/FR)
- [ ] Streaming responses (chunked JSON)
- [ ] Admin dashboard UI for review queue + prompt versioning
- [ ] Auto-activate prompts based on feedback metrics
- [ ] Conversation memory (optional, gated by plan)

### Phase 3 (Month 2)
- [ ] Custom knowledge base management (admin UI)
- [ ] A/B testing system prompts
- [ ] Integration with help articles (CMS)
- [ ] Analytics dashboard (user-facing)

### Long-term
- [ ] Fine-tuned model for Qesto domain
- [ ] Multi-modal support (screenshots, videos)
- [ ] Offline mode (edge-cached embeddings)

---

## Support & Questions

- **Documentation:** docs/
- **API Spec:** functions/api/routes/help/
- **Feedback:** team@qesto.cc
