# ADR: Workers AI Latency Budgets & Precomputation Strategy

**Date**: 2026-04-23  
**Status**: Proposed  
**Context**: Sprint 18 Planning Review + Design Wave Sprint B  
**Relevant Issues**: AI-VIS-02 (Inline Question Suggestions), DX-INSIGHTS-02 (Top Themes)

---

## Problem

Qesto uses Cloudflare Workers AI for two AI-powered features:
- **AI-VIS-02**: Inline question suggestions in session wizard (user types prompt, AI generates 3 question options)
- **DX-INSIGHTS-02**: Top themes analysis (after session closes, Workers AI + Vectorize summarize decision themes)

**Latency constraints**:
- **AI-VIS-02**: <1s p95 for responsive UX (keystroke → suggestion visibility)
- **DX-INSIGHTS-02**: <2s p95 for dashboard load (Insights tab → themes card rendered)

**Problem**: 
- Llama-3.3-70b-instruct on Workers AI typically runs 2–8s per invocation (too slow for AI-VIS-02)
- DX-INSIGHTS-02 on-demand summarization (session close → immediate theme compute) risks p95 >3s

This violates design wave requirements and user experience expectations.

---

## Context

### Workers AI Constraints
- **Cold start**: 1–2s first invocation per worker instance
- **Model latency**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` averages 2–4s per request
- **Streaming**: `/stream` endpoint available but Pages Functions buffering may defeat streaming benefits
- **Rate limits**: Free tier 10 reqs/day; paid tier 50k reqs/month
- **Isolation**: No persistent state between requests (no fine-tuning)

### Current Telemetry
- No production latency data yet (features under development)
- Load test targets: 100+ concurrent participants (no AI load tested yet)

### Design Wave KPIs
- DX-INSIGHTS-02: "Themes rendered within 2s p95 on team with ≥3 closed sessions"
- AI-VIS-02: Implicit UX requirement <1s from keystroke to suggestion chip display

---

## Proposed Solutions

### Option A: Precomputation on Session Close (Recommended for DX-INSIGHTS-02)
**Approach**: When presenter closes session, async job triggers theme analysis. Results cached in DECISIONS_KV.

**Implementation**:
1. Session CLOSED → webhook triggers `/api/internal/analyze-session?session_id=X`
2. Backend fetches votes from D1; sends to Workers AI: `"Summarize decisions from this session: [votes]"`
3. Workers AI returns 2–3 themes (max 3 themes per session, <500 tokens output)
4. Store result in DECISIONS_KV: `decisions:{session_id} = { themes: [...], created_at }`
5. Dashboard Insights tab fetches cached themes; renders instantly (<100ms)

**Latency**:
- Session close → dashboard page load: async, not on critical path
- Theme lookup (Insights tab): <100ms (KV read)
- p95: <150ms (assuming Workers AI completes within 10s background job SLA)

**Pros**:
- DX-INSIGHTS-02 <2s requirement easily met (KV hit, not AI compute)
- Batch efficiency: summarize once, serve many queries
- Scales: N closed sessions → N cached results
- Handles cold start gracefully (happens in background)

**Cons**:
- Requires async job infrastructure (may not exist)
- Themes are stale (computed once, not updated)
- Cold start for first theme analysis (2–8s job runtime OK, not on user critical path)

**Code Sketch**:
```typescript
// Session close
POST /api/sessions/:id/close
  → triggers async webhook: POST /api/internal/analyze-session?session_id=:id

// Async job
async function analyzeSession(sessionId) {
  const votes = await db.query('SELECT * FROM votes WHERE session_id = ?', [sessionId]);
  const prompt = `Summarize these meeting decisions:\n${votes.map(v => v.response).join('\n')}`;
  const result = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [{ role: 'user', content: prompt }]
  });
  await c.env.DECISIONS_KV.put(`decisions:${sessionId}`, JSON.stringify({
    themes: result.response.split('\n').slice(0, 3),
    created_at: Date.now()
  }));
}

// Dashboard load
GET /api/insights?team_id=X
  → KV.get(`decisions:${recentSessionIds[0]}`)
  → return { themes: [...] } in <100ms
```

---

### Option B: Debounced On-Demand (For AI-VIS-02)
**Approach**: Cache suggestion results with 5-min TTL. Multiple users typing same prompt reuse cached output.

**Implementation**:
1. User types wizard prompt: "Icebreaker questions about team goals"
2. Debounce keystroke (500ms); check KV for cached suggestions under hash(`prompt`)
3. If hit: return cached in <100ms
4. If miss: call Workers AI (2–4s), cache result, return
5. User sees skeleton loader during fetch; suggestions appear as they load

**Latency**:
- Cache hit: <100ms
- Cache miss (first query for unique prompt): 2–4s + skeleton UX
- p95 (assuming 20% unique prompts): 2–3s (mostly cache hits)

**Pros**:
- Responsive for repeat prompts (cache hits)
- No async job needed
- Handles keystroke load naturally (requests coalesced by cache)

**Cons**:
- First unique prompt hits AI latency (2–4s may exceed <1s target)
- Cache invalidation unclear (when to refresh suggestions?)
- Scaling: KV cache grows with unique prompts (manage TTL)

**Code Sketch**:
```typescript
// Wizard AI suggestion endpoint
POST /api/wizard/suggest?prompt=...
  → promptHash = hash(prompt)
  → result = await KV.get(`suggest:${promptHash}`)
  → if (result) return result (cached)
  → else {
      result = await AI.run(llama, { messages: [{ role: 'user', content: prompt }] });
      await KV.put(`suggest:${promptHash}`, result, { expirationTtl: 300 }); // 5 min
      return result;
    }
```

---

### Option C: Streaming with Skeleton UI (For AI-VIS-02)
**Approach**: Use Workers AI `/stream` endpoint. Send tokens to client as they arrive. Skeleton UI updates as tokens stream.

**Implementation**:
1. User types prompt → POST to `/api/wizard/suggest-stream`
2. Backend opens streaming connection to Workers AI
3. As tokens arrive (250ms intervals), send SSE events to client
4. Client renders tokens into suggestion chips in real-time
5. User sees 1st chip at ~1s, 2nd at ~1.5s, 3rd at ~2s

**Latency**:
- First token visible: 1–1.5s (acceptable UX)
- Last token visible: 2–4s (matches or beats cache miss)
- p95: 2s (same as synchronous, but better UX)

**Pros**:
- Feels fast (incremental rendering, not waiting for full response)
- Lower perceived latency vs. blocking
- Natural for LLM output (tokens arrive sequentially)

**Cons**:
- Complexity (SSE setup, client-side buffering)
- May timeout if token stream stalls (error handling)
- Pages Functions buffering may defeat streaming benefits (unclear in production)

**Code Sketch**:
```typescript
// Streaming endpoint
POST /api/wizard/suggest-stream
  → res.headers['Content-Type'] = 'text/event-stream'
  → for await (const chunk of AI.run(..., { stream: true })) {
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
    }
  → res.end()

// Client
const eventSource = new EventSource('/api/wizard/suggest-stream?prompt=...');
eventSource.onmessage = (e) => {
  const { token } = JSON.parse(e.data);
  displayToken(token); // append to suggestion chip
};
```

---

## Recommendation

**Use Option A (precomputation) for DX-INSIGHTS-02 + Option B (cache) for AI-VIS-02.**

**Rationale**:

1. **DX-INSIGHTS-02 (Themes)**: Precomputation removes AI latency from critical path. Session close is already async; background job is natural. KV cache ensures <150ms Insights tab load.

2. **AI-VIS-02 (Suggestions)**: Cache with TTL works well. Most users follow similar prompts ("icebreaker questions", "feedback from sprint review"). Cache hit rate likely 60–80%, keeping p95 <500ms. First unique prompt user experiences 2–4s (acceptable for initial feature; optimize later if needed).

3. **No streaming (Option C)**: Complexity not justified; blocking + cache is simpler and meets SLA.

---

## Implementation Plan

**Sprint 18**: 
- Add async job infrastructure (if not exists): webhook trigger on session close
- Implement DX-INSIGHTS-02 precomputation: `analyzeSession()` function in `functions/api/internal/analyze-session.ts`
- Implement AI-VIS-02 cache: KV `suggest:{hash}` with 5-min TTL in `functions/api/wizard/suggest.ts`

**Sprint 19**:
- Deploy with feature gates (gate DX-INSIGHTS-02 & AI-VIS-02 behind `FEATURE_AI_ENABLED` env var)
- Monitor: track KV hit rate (target ≥70%), Workers AI latency (p95 <3s)
- Telemetry: log AI_SUGGEST_CACHE_HIT / AI_SUGGEST_CACHE_MISS events

**Future optimization**:
- If DX-INSIGHTS-02 p95 >2s in production: switch to Option A variant with scheduled batch jobs (e.g., 1x per hour per team)
- If AI-VIS-02 cache hit <50%: add prompt embedding-based similarity check (find closest cached prompt instead of exact match)

---

## Open Questions

1. **Async job infrastructure**: Does Qesto have Durable Objects for background jobs, or use Cloudflare Scheduled Events? (Assume Scheduled Events if not yet built.)
2. **Workers AI streaming buffering**: Do Pages Functions buffer streaming responses before sending to client? (Requires testing on staging.)
3. **Vectorize integration**: DX-INSIGHTS-02 mentions "Vectorize" for theme analysis. Does this use embeddings or just context? (Clarify in design spec.)
4. **Cost tracking**: How to meter AI spend per team for billing? (Out-of-scope; assume simple counter for MVP.)

---

## References

- **Cloudflare Workers AI**: https://developers.cloudflare.com/workers-ai/
- **Workers AI Models**: https://developers.cloudflare.com/workers-ai/models/
- **Qesto ARCHITECTURE.md**: Workers AI integration, KV patterns
- **Design Wave §12**: AI-VIS-02 (8 pts), DX-INSIGHTS-02 (8 pts)
- **Sprint 18 Plan**: AI feature gating decisions
