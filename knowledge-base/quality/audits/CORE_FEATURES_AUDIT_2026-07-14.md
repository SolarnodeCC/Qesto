# Core Features Audit — Dashboard AI Suite, Energizers, Launchpad, Presenter

**Date:** 2026-07-14
**Scope:** Facilitator coaching (`lib/ai/coaching.ts`, `routes/ai-insights/register-coaching.ts`), AI recap/insights (`lib/ai-insights.ts`, `lib/ai/recap-provenance.ts`), AI-driven session wizard (`lib/ai-wizard.ts`, `routes/sessions/wizard.ts`), facilitator scorecard + top themes (`lib/team-insights*.ts`, `routes/team-insights.ts`), recurring workspaces (`routes/team-workspaces.ts`), templates + dashboard (`src/pages/Dashboard.tsx`, `src/hooks/useInsights.ts`), energizers (REST + DO), Launchpad/Presenter (`src/pages/Launchpad.tsx`, `src/pages/Present.tsx`, `SessionRoom` DO).
**Method:** static code inspection + data-flow tracing on branch `claude/qesto-core-audit-8ao6vl`. No load tests or live inference measurements executed in this pass — runtime latency/error/cost columns in §3 are marked accordingly.
**Predecessor:** [`CORE_FEATURES_AUDIT_2026-07-09.md`](./CORE_FEATURES_AUDIT_2026-07-09.md). §5 verifies the fix status of its critical findings.

---

## 1. Architecture answers (audit questionnaire)

### LLM model selection & integration
- **Provider:** Cloudflare Workers AI exclusively — no Anthropic/OpenAI calls anywhere in `functions/` (Hard Rule 1 holds). All inference routes through the AI Gateway facade `runAI()` (`lib/ai/ai-gateway.ts`), which adds semantic caching (1 h TTL), prompt sanitisation, and a direct `env.AI.run()` fallback when the gateway secrets are absent or the gateway 5xxes.
- **Models per feature:**
  | Feature | Model | max_tokens | Retry | Rate limit |
  |---|---|---|---|---|
  | Wizard question generation | `@cf/meta/llama-3.1-8b-instruct-fp8` (fast) → `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (quality fallback) | 700 | 3× per model, 150/300 ms backoff | 20/h/user |
  | Wizard refine | same as generation | 700 | same | 10/h/user |
  | Insights / recap themes | `@cf/mistral/mistral-7b-instruct-v0.2` (`INSIGHTS_MODEL`, #536) | 768 | 3×, 200/400 ms + circuit breaker (CB-02) + 25 s timeout | 10/h/user (`AI_RATE_LIMIT`) |
  | Facilitator coaching | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **none set** | none | **none** (finding H-2) |
  | Team insights embedding | `DECISIONS_EMBED_MODEL` (bge-m3, 1024d) | n/a | 10 s timeout | none (finding H-3) |
- **Temperature/stop sequences:** not set anywhere (provider defaults). Structured output is enforced post-hoc via Zod schemas, not via constrained decoding.
- **Prompt-injection posture:** two tiers. (a) Gateway choke point strips control/zero-width/bidi chars and caps length (8,000 chars) for *every* call. (b) `ai-insights.ts` additionally fences participant free-text in `<<<UNTRUSTED_PARTICIPANT_DATA>>>` markers, strips marker-escape attempts, instructs the model to treat fenced content as data, and runs a post-generation PII scrub (email/handle/phone regexes) on theme examples for anonymous sessions. The insights pipeline is the reference implementation; the wizard and coaching prompts interpolate user text without fencing (bounded blast radius via strict output schemas, but not uniform — see M-6).

### AI wizard & question generation
- Two endpoints, both DRAFT-only + owner-only: buffered `POST /:id/questions/generate` and SSE `POST /:id/ai/generate` (streams each question as soon as its JSON object closes in the token stream, with a full-buffer fallback parse). Two parallel batches with distinct focus hints, prompt-level dedup on merge, cap 8 questions.
- **Caching:** per-user KV cache keyed on SHA-256 of `{title, goal, focus, language}` with 24 h TTL (WIZ-CACHE-01) on both endpoints, plus the refine cache (`draft:ai:<id>` + grounding hash on the session row). Cache hits skip inference entirely and are flagged `cached: true`.
- **Transparency:** the SSE `ready` event carries model ids, provider, retention, and inference region for the consent UI; preflight blocks launch of AI-generated sessions without a recorded consent timestamp.

### Latest AI recap / insights
- Themes are extracted at session close (`extractThemes`) and materialised into `insights_daily` (idempotent upsert, UNIQUE(session_id, day), sticky `embedding_ref`). The dashboard sparkline endpoint (`GET /:id/insights/themes`) is read-only over `insights_daily` — no AI call on the hot path. Provenance (`buildAiRecapProvenance`) reports model id, generation time, host-edited flag, and consent timestamp on exports.

### Facilitator coaching
- `POST /sessions/:sessionId/coaching` (owner-only, `insightsAI` feature-gated): builds a prompt from question summaries, vote totals, coaching profile (style/vertical), prior accept/dismiss stats, RAG chunks from DECISIONS_VECTORIZE, and a 20-turn KV-persisted history. Zero-knowledge sessions are refused (returns null → 422). Multi-turn follow-ups are length-capped (500) and sanitised.
- Supporting routes: history, action recording (accepted/dismissed/saved_template → AE metrics), similar-session RAG lookup, markdown export, email export, profile CRUD.

### Facilitator scorecard, top themes, engagement trend
- `insights_daily` rows roll up into `team_insight_rollup` (UNIQUE(team_id, kind, window)) for kinds `recurring_themes`, `engagement_trend`, `facilitator_scorecard`, windows 30/90/180 d. Scorecard: sessions run, avg participation, response rate, theme diversity, mood trend per facilitator; ZK sessions excluded both structurally and defensively in the query. Recurring themes enforce a k-anonymity floor of ≥3 distinct sessions (ADR-0045 §4) in both the Vectorize path and the label-frequency fallback. Scorecard staleness window 24 h; trends KV-cached (`INSIGHTS_SHARED_CACHE_TTL_SECONDS`).
- All team-insights reads are membership-checked against the TEAMS_KV document. Note: *every* team member can read the per-facilitator scorecard of colleagues; this is a product decision worth an explicit ADR note, not a defect per se.

### Recurring workspaces (ADR-0048)
- D1 `workspaces` table (RETRO/IDEATE/EVENT kinds, cadence, retention), instances spawn linked sessions with carried-over open action items (retro), template seeds via KV. RBAC split read/write/admin; plan-gated via `recurringWorkspaces`. Trend recompute has a 60 s debounce on `/refresh` — a good pattern the team-insights refresh lacks (H-3).

### Energizers
- Storage/typing unchanged from the 2026-07-09 audit (6 kinds, D1 tables, indexed). Creation now appends `position = COALESCE(MAX(position)+1, 0)` (fixes prior E-3). Participant plane is the DO WebSocket with per-viewer redaction (`redactEnergizerForViewer`): answer keys stripped while active, other voters' raw answers blanked, own-rows-only submissions/scores/badges, aggregate-only leaderboard (top 10, alias/hidden modes). Host monitor reads DO state first, D1 legacy votes as fallback. Still no randomisation, repeat-avoidance, A/B testing, or effectiveness dashboards — selection is host-curated (unchanged product gap, tracked in the predecessor audit).

### Launchpad & presenter
- Launchpad: server-side preflight with local fallback, optimistic reorder with rollback, keyboard alternative to drag-and-drop (WCAG 2.1.1), double-submit guard, energizer load errors surfaced instead of swallowed. Solid.
- Presenter: `SessionRoom` DO with hibernation, 64 KiB frame cap, Zod-validated ingress, token-bucket vote rate limiting, 100 ms debounced result broadcast, 5 s/1000-vote D1 flush, R2 snapshots, client reconnect backoff (1–16 s, 5 attempts) with full `init` rehydrate. Presenter controls: advance/back, pause, shuffle, tally hide, min-response gate, soft timer, captions (plan-gated), reactions, copilot. The core realtime loop remains well-engineered.

---

## 2. Findings

Severity legend: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

No CRITICAL findings in this pass. The three criticals from 2026-07-09 are fixed (§5).

### 🟠 H-1 — Energizer REST vote endpoint has no session-scope authorization
- **Component:** Energizers · **Effort:** S
- **Description:** `POST /sessions/:sessionId/energizers/:energizerId/vote` is mounted behind `authMiddleware` only (`routes/energizers/index.ts:18`). Unlike `/active`, `/leaderboard`, and `/next` — which were locked to `requireSessionAccess(..., { requireOwner: true })` in the #537/E-1 hardening — the vote handler never checks that the caller owns, belongs to, or has joined the session (`routes/energizers/vote-next.ts:11-148`). It also skips value validation for `battle_royale`/`bracket` kinds: any 1–200-char string falls through the kind-specific checks into the generic `energizer_votes` upsert.
- **Impact:** any authenticated Qesto user who learns a `sessionId`+`energizerId` pair (both ULIDs/UUIDs, but they appear in shared URLs, exports, and audit logs) can stuff votes into another tenant's active energizer, skewing emoji polls, word clouds, and quick-finger rankings; for bracket/battle-royale kinds they can inject arbitrary strings that surface on the host's result views. The DO WS plane is unaffected (it has its own admission), but the D1 fallback path that the host monitor reads (`active.ts:98-107`) renders the polluted data.
- **Recommendation:** require the caller to be either the session owner or a registered participant of that session (join-record check), verify session `status IN ('energizing','live')`, and validate bracket/battle-royale values against the current matchup from `config_json`. Mirror the WS plane's admission rules.

### 🟠 H-2 — Facilitator coaching endpoint is unmetered 70B inference
- **Component:** Facilitator coaching · **Effort:** XS
- **Description:** `POST /sessions/:sessionId/coaching` runs `@cf/meta/llama-3.3-70b-instruct-fp8-fast` plus a Vectorize RAG query on every call with no rate limit and no `max_tokens` (`register-coaching.ts:56-135`, `lib/ai/coaching.ts:73-75`). Sibling AI endpoints are metered: insights-analyze 10/h (`ai-insights/constants.ts:5`), wizard 20/h, refine 10/h. `/coaching/similar` (Vectorize) and `/coaching/email-export` (Resend send) are likewise unthrottled.
- **Impact:** a single owner account (or a leaked token) can loop the most expensive model in the fleet at full speed — direct cost exposure and Workers AI quota exhaustion that degrades the wizard/insights for everyone. Unbounded output tokens compound per-call cost.
- **Recommendation:** apply the existing `rateLimit(c.env.ACTIONS_KV, user.sub, {...})` helper (e.g. 10/h like insights), set `max_tokens` (~600 fits the JSON contract), and put a modest limit (e.g. 5/day) on email-export.

### 🟠 H-3 — Team-insights refresh recomputes everything, per call, for any member
- **Component:** Scorecard / top themes · **Effort:** S
- **Description:** `POST /api/teams/:id/insights/refresh` loops all three windows and, per window, runs `recomputeTeamInsightRollups` (embedding call + Vectorize query + full `insights_daily` scans) plus `recomputeFacilitatorScorecard`, then busts the KV cache (`routes/team-insights.ts:238-262`). Any team member can call it; there is no debounce. The workspaces equivalent solved exactly this with a 60 s debounce (`team-workspaces.ts:483-490`).
- **Impact:** 6 D1 scans + 3 embedding inferences + 3 Vectorize queries per click; trivially repeatable. Also `GET /insights/trends` recomputes synchronously on any cache miss, so a cold cache on a large team makes a dashboard read pay the full pipeline.
- **Recommendation:** copy the workspace debounce (skip if `computed_at` fresher than 60 s), or restrict `/refresh` to owner role; consider serving stale-while-revalidate from `team_insight_rollup` on `/trends` misses instead of computing inline.

### 🟠 H-4 — Dashboard top-themes fan-out: one API call per closed session, every mount
- **Component:** Dashboard (Topthema's) · **Effort:** M
- **Description:** `useInsights.fetchAll` issues `GET /api/sessions/:id/insights` for **every** closed session in a single unbounded `Promise.all` whenever the dashboard mounts (`src/hooks/useInsights.ts:96-130`). The cache is a `useRef` — it evaporates on navigation, so each return to the dashboard replays the storm. Aggregation (theme grouping, trend buckets) is then done client-side.
- **Impact:** a user with 200 closed sessions fires 200 parallel authenticated requests (plus D1 reads) to render five theme cards; mobile and free-tier users pay the same. This is the single biggest self-inflicted load source on the sessions API.
- **Recommendation:** add a batch endpoint (`GET /api/insights/summary` returning pre-aggregated themes for the caller, or reuse `team_insight_rollup` for personal teams), cap the client to the most recent N sessions in the interim, and persist the per-session cache in `sessionStorage`.

### 🟡 M-1 — Scorecard "mood trend" is model confidence, not mood
- **Component:** Facilitator scorecard · **Effort:** S
- **Description:** `moodFromConfidence` buckets `insights_daily.confidence` — the AI's *theme-extraction confidence score* — into positive/neutral/concerning (`team-insights-scorecard.ts:76-80`), and `engagement_trend.avgConfidence` similarly presents it as an engagement signal.
- **Impact:** a facilitator whose sessions produce short or ambiguous free-text gets a "concerning" mood trend regardless of actual sentiment; teams may act on a metric that measures parser certainty. This is a data-integrity issue in a feature named "scorecard".
- **Recommendation:** wire the existing sentiment pipeline (`lib/ai/sentiment.ts`, distilbert) into `insights_daily` (add a `sentiment` column at close time) and derive mood from it; until then, relabel the UI/API field to "insight confidence" so it isn't read as team mood.

### 🟡 M-2 — Coaching email export interpolates unescaped content into HTML
- **Component:** Facilitator coaching · **Effort:** XS
- **Description:** `POST /coaching/email-export` builds the HTML body with template literals around `session.title` and raw coaching-history turns (user follow-ups + model output), only replacing newlines (`register-coaching.ts:225-227`). None of it is HTML-escaped.
- **Impact:** a session title or follow-up like `<img src=x onerror=...>` / crafted anchor markup lands verbatim in the recipient's inbox. Email clients constrain script execution, but markup injection enables phishing-style content in a Qesto-branded mail. Recipient is the owner themself, which limits (but does not eliminate — think shared/team inboxes and forwarding) the blast radius.
- **Recommendation:** HTML-escape all interpolated strings (a 5-line `escapeHtml` or the existing email template helpers in `lib/email.ts`).

### 🟡 M-3 — Energizer create schema accepts unbounded arrays and strings
- **Component:** Energizers · **Effort:** XS
- **Description:** `CreateEnergizerSchema` caps `prompt` (400) but not `participants: z.array(z.string())`, `emojis`, or `options` — no array max, no per-item length (`routes/energizers/create-list.ts:33-41`).
- **Impact:** a host can persist a multi-megabyte `config_json` (thousands of 100 KB "participants"), which then flows into DO broadcasts and the host monitor — memory/bandwidth amplification bounded only by request-size limits.
- **Recommendation:** `z.array(z.string().min(1).max(80)).max(64)` for participants/options, `.max(12)` for emojis (validate they are single grapheme clusters while at it).

### 🟡 M-4 — Workspace actions PATCH destroys provenance and races
- **Component:** Recurring workspaces · **Effort:** S
- **Description:** `PATCH /:id/workspaces/:wsId/actions` replaces the whole KV blob, rebuilding every item with `createdAt: now` and `sourceSessionId: null` — including items that already existed with real values (`team-workspaces.ts:417-426`). Two concurrent editors last-writer-wins silently.
- **Impact:** the "carried over from session X" lineage that `carryOpenActionsToNewInstance` creates is erased by the first manual edit; action ageing metrics become meaningless; concurrent edits drop items.
- **Recommendation:** merge by id (preserve `createdAt`/`sourceSessionId` for existing ids), and add a `version`/`updatedAt` precondition returning 409 on mismatch.

### 🟡 M-5 — Dashboard metrics: "Response rate" isn't one; "Consent opt-in" is a stub
- **Component:** Dashboard · **Effort:** XS
- **Description:** the "Response rate" MetricCard computes `completedSessions / nonDraftSessions` (`src/pages/Dashboard.tsx:208-216`) — a session-completion ratio, not any measure of participant responses. "Consent opt-in" renders a hardcoded `—` (`Dashboard.tsx:349-354`).
- **Impact:** hosts read a fabricated KPI; the permanent em-dash card erodes trust in the metric strip.
- **Recommendation:** either compute a real response rate (votes ÷ participants, available from session summaries) or relabel to "Completion rate"; hide the consent card until it has a data source.

### 🟡 M-6 — Coaching parse failure ships raw model text as advice; prompt not fenced
- **Component:** Facilitator coaching · **Effort:** S
- **Description:** when the coaching JSON parse fails, the catch block returns the first 500 chars of raw model output as a bullet under a generic headline (`lib/ai/coaching.ts:105-111`). Unlike the insights pipeline, the coaching prompt interpolates question prompts and RAG chunks without untrusted-data fencing.
- **Impact:** malformed/refusal outputs (or content steered via a prompt-injection payload inside a question prompt) reach the UI unvalidated, presented as coaching. Given REV-10, this is also the path most likely to drift without eval coverage.
- **Recommendation:** on parse failure, retry once then return `coaching_unavailable` instead of raw text; adopt the `<<<UNTRUSTED_PARTICIPANT_DATA>>>` fencing from `ai-insights.ts` for question summaries and RAG chunks; add golden fixtures under `tests/eval/fixtures/` for the coaching contract.

### 🟡 M-7 — Recurring-theme clustering labels themes with session titles
- **Component:** Top themes · **Effort:** M
- **Description:** the Vectorize path embeds a single centroid string ("Team recurring themes: label1; …top-5"), queries topK 40, then groups matches by the `title` metadata field — i.e. *session titles* become the "theme" labels (`team-insights-recurring.ts:134-172`). Any failure silently falls back to label frequency (`catch { vectorThemes = [] }`), unobserved.
- **Impact:** dashboard "Topthema's" can show session names instead of semantic themes; a single centroid can't separate distinct clusters, so the expensive vector path rarely beats the frequency fallback it merges with. Silent catch means nobody knows which path produced what.
- **Recommendation:** cluster per-theme (embed each candidate label, group by cosine similarity) or store theme labels in vector metadata at upsert time; log the fallback event; consider dropping the vector path until it demonstrably improves on frequency counting (it currently adds an embedding + query per dashboard cache miss).

### 🟢 L-1 — `'DEL' + 'ETE'` method obfuscation in Dashboard
- **Component:** Dashboard · **Effort:** XS
- **Evidence:** `method: 'DEL' + 'ETE'` (`src/pages/Dashboard.tsx:256`), presumably to dodge a lint/hook gate. It also bypasses the shared `api()` client (raw `fetch`), losing its error normalisation. Use `api()` with `method: 'DELETE'`; if a hook blocks it, fix the hook.

### 🟢 L-2 — Presenter soft timer accepts NaN
- **Component:** Presenter · **Effort:** XS
- **Evidence:** `parseInt(timerInput, 10) * 60` with non-numeric input → `Math.max(10, Math.min(600, NaN))` = `NaN` → `timer.start(NaN)` (`src/pages/Present.tsx:161-164`). Guard with `Number.isFinite`.

### 🟢 L-3 — AI gateway nits
- **Component:** AI gateway · **Effort:** XS
- **Evidence:** hardcoded `DEFAULT_ACCOUNT_ID` in source (`ai-gateway.ts:65`) — works, but belongs in config; the `AbortError` branch duplicates the generic fallback (dead branch, `ai-gateway.ts:163-167`); `extractCacheKey` is exported but unused. Cosmetic cleanup.

### 🟢 L-4 — Recap provenance hardcodes a default model id
- **Component:** AI recap · **Effort:** XS
- **Evidence:** `session.ai_recap_model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast'` (`recap-provenance.ts:18`) — but the insights pipeline runs `INSIGHTS_MODEL` (mistral-7b). Provenance for legacy rows misreports the model. Default to `INSIGHTS_MODEL` or `null` ("unknown") instead.

### 🟢 L-5 — Wizard cache keyed on the raw Accept-Language header
- **Component:** AI wizard · **Effort:** XS
- **Evidence:** `const language = c.req.header('accept-language') ?? 'en'` feeds the cache-key hash verbatim (`routes/sessions/wizard.ts:109-110,178-186`) while the prompt only uses the first two chars. `en-US,en;q=0.9` vs `en-GB,en;q=0.8` → cache miss for identical output. Normalise to the 2-letter code before hashing.

### 🟢 L-6 — Session duplicate copies questions with N sequential INSERTs
- **Component:** Launchpad/dashboard · **Effort:** XS
- **Evidence:** `POST /:id/duplicate` loops `await INSERT` per question (`routes/sessions/wizard.ts:607-616`) although `insertQuestionsBatch` exists and is used by the batch add route. Swap to the batch helper (one D1 round trip, atomic).

### 🟢 L-7 — Leaderboard aliases have 100 combinations
- **Component:** Energizers · **Effort:** XS
- **Evidence:** `deterministicAlias` draws from 10×10 adjective/noun pools (`session-room-energizer.ts:263-273`) — birthday-paradox collision passes ~50 % at ≈12 participants, so two players can share "Swift Falcon" on the podium. Append a 2-digit hash suffix or widen the pools.

---

## 3. Model & API integration matrix (template §5)

Static-pass values; runtime columns require the AE dashboards (`ai.wizard.ok/error`, `ai.insights.*` events already emit latency + char counts — the instrumentation exists, the reporting rollup does not; see Monitoring gaps).

| Call site | Model | Caching | Structured output | Injection defence | max_tokens | Rate limit |
|---|---|---|---|---|---|---|
| Wizard generate/refine | llama-3.1-8b → llama-3.3-70b | KV 24 h + gateway semantic 1 h | Zod + repair pipeline | gateway sanitize | 700 | 20/h, 10/h |
| Insights themes | mistral-7b-instruct-v0.2 | insights_daily materialisation | Zod + PII scrub | gateway + untrusted fencing | 768 | 10/h |
| Coaching | llama-3.3-70b | none | manual parse, raw-text fallback (M-6) | gateway + followUp cap | **unset** (H-2) | **none** (H-2) |
| Team-insights embed | bge-m3 | rollup tables + KV | n/a | sanitizeEmbedText | n/a | **none** (H-3) |

Latency/error-rate/cost columns: **not measured** in this pass — no load generation was run. p50/p95 for the wizard can be read from `ai.wizard.ok.latencyMs` in AE; recommend a weekly AQL rollup (analytics node).

## 4. Efficiency opportunities (mapped to the template checklist)

| Checklist item | Status |
|---|---|
| Cache frequent generations (24 h KV) | ✅ done (WIZ-CACHE-01) |
| Question templates i.p.v. altijd genereren | ✅ template library + save-session-as-template exist |
| Response batching to presenter | ✅ 100 ms debounced DO broadcast |
| Lazy-load participant data | ❌ dashboard insights fan-out is the inverse (H-4) |
| DO per live session vs D1 polling | ✅ DO is the participant plane; REST is host/legacy |
| Vectorize semantic dedup of questions | ❌ dedup is string-normalised prompt matching only |
| Workers-AI fallback on rate limit | ✅ two-model fallback chain (wizard); circuit breaker (insights) |
| Analytics batching | ✅ AE events throughout |
| Token counting pre-call | ❌ only `approxInputChars` logging |
| Streaming where applicable | ✅ SSE wizard endpoint |
| Dead code removal | `extractCacheKey`, gateway AbortError branch (L-3) |
| LLM cost per feature | ❌ no rollup; events exist (§3) |
| Energizer effectiveness tracking | ❌ unchanged gap (predecessor audit) |
| Real-time lag monitoring | ✅ ws.* AE events + gatewayLatencyMs |

## 5. Verification of 2026-07-09 critical findings

| Finding | Status | Evidence |
|---|---|---|
| E-1 answer keys sent to participants | **Fixed** | `redactEnergizerForViewer` strips `correctIndex`/others' answers for voters (`session-room-energizer.ts:208-243`); `/active` is now owner-only (`active.ts:43`); team-quiz REST vote is insert-only (`DO NOTHING` + 409 on repeat) and never echoes `correct` (`vote-next.ts:126-137`) |
| E-2 REST/DO plane divergence | **Fixed (by design)** | DO is the sole participant plane; REST advance/activate now posts `/energizer-sync` to the DO (`vote-next.ts:231-242`); host monitor reads DO first, D1 fallback (`active.ts:16-29`) |
| E-3 hardcoded position 0 | **Fixed** | insert uses `COALESCE(MAX(position)+1, 0)` (`create-list.ts:93-97`) |

## 6. Suggested fix order

1. **H-1** vote authorization (cross-tenant integrity, small diff)
2. **H-2** coaching rate limit + max_tokens (one-line-ish, direct cost)
3. **M-2** email HTML escaping (small, security-adjacent)
4. **H-3** insights refresh debounce (copy the workspace pattern)
5. **H-4** dashboard insights batch endpoint (M effort, biggest load win)
6. **M-1** scorecard mood relabel now, sentiment wiring next train
7. **M-3/M-4/M-6** schema caps, actions merge-by-id, coaching fencing
8. L-1…L-7 as batched cleanup

*Static analysis only; findings H-1/H-2/H-3 should be re-verified against staging before fixes ship. Per REV-10, M-6's fencing change touches AI prompts and requires `npm run test:eval` with updated golden fixtures.*
