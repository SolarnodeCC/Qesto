# Core Features Audit — AI Wizard, Energizers, Launchpad, Presenter

**Date:** 2026-07-09
**Scope:** AI question generation (`ai-wizard.ts`, `routes/sessions/wizard.ts`, `ai/ai-gateway.ts`), energizers (REST + DO paths), Launchpad (`src/pages/Launchpad.tsx` + components), Presenter (`src/pages/Present.tsx`, `SessionRoom` DO, `useLiveSession`).
**Method:** static code inspection + data-flow tracing on branch `claude/qesto-core-audit-ty0cbj` (no load tests executed in this pass).

---

## 1. Architecture answers (audit questionnaire)

### AI Wizard & question generation
- **Model:** Cloudflare Workers AI only (no external LLM). Default path runs **two parallel batches** on `@cf/meta/llama-3.1-8b-instruct-fp8` (FAST_MODEL) with per-batch fallback to `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (QUALITY_FALLBACK_MODEL). `functions/api/lib/ai-wizard.ts:213-218`.
- **Endpoints:** `POST /api/sessions/:id/questions/generate` (buffered JSON) and `POST /api/sessions/:id/ai/generate` (SSE, streams questions incrementally as balanced JSON objects are parsed out of the token stream). Both DRAFT-only, owner-only.
- **Prompting:** static system prompt (~1,000 chars) demanding strict JSON (`questions[3..4]`, kinds poll/ranking/consent/open); user prompt interpolates session title/goal/focus plus a per-batch focus. Language selected from `Accept-Language` (EN/NL/ES/DE/FR). No few-shot examples; no temperature/stop-sequences set; `max_tokens: 700`.
- **Output handling:** fence-stripping → `JSON.parse` → lenient repair (`repairAIOutput`: key aliases, option synthesis, kind coercion) → Zod (`AIQuestionsOutputSchema`) → normalise (ULID ids) → heuristic confidence score. Streamed questions go through the identical repair/Zod pipeline per object.
- **Retry/fallback:** 3 attempts per model (backoff 150/300 ms), then secondary model; SSE path additionally falls back stream → buffered. Rate limits: 20 generations/h/user, 10 refines/h/user (KV token bucket).
- **Caching:** only `POST /:id/ai/refine` caches (SHA-256 grounding hash on the session row + KV `draft:ai:<id>`, 24 h TTL). The primary generate endpoints are **never cached app-side**; the AI Gateway (`runAI`, semantic cache 1 h TTL) provides caching *only when* `CLOUDFLARE_AI_GATEWAY_ID`/`TOKEN` secrets are set — otherwise every call bypasses to direct `env.AI.run()`.
- **Injection protection:** gateway choke point strips control/zero-width/bidi characters and caps prompt length (8,000 chars) (`ai/prompt-sanitize.ts`); no instruction-delimiting of user text, but blast radius is bounded by strict output schema validation.

### Energizers
- **Storage:** D1 `energizers` (kind CHECK, `config_json`, `state` draft→active→completed, `UNIQUE(session_id, position)`), plus `energizer_votes` (`UNIQUE(energizer_id, voter_id)`), `team_quiz_responses`, `battle_royale_rounds`, `bracket_matches`. Indexed by `session_id`/`energizer_id` — query shapes are fine at expected cardinalities.
- **Types:** emoji_poll, quick_finger, team_quiz, word_cloud, battle_royale, bracket. Created by hosts via `POST /api/sessions/:id/energizers` (custom prompt + config; wizard offers preset kinds with default prompts). No template library, **no randomisation/selection logic, no repeat-avoidance, no A/B testing, no usage-statistics dashboards** — selection is entirely host-curated.
- **Two disjoint runtime paths exist** (see finding E-2): a REST/D1 polling path (ENERGIZING lobby: `GET .../energizers/active` polled every 2–3 s + `POST .../vote`) and a DO/WebSocket path (LIVE: `energizer_activate`/`energizer_answer` handled in `session-room-energizer-handler.ts`, state in DO storage, 5-min auto-timeout alarm). Results never merge.
- **Monitoring:** Analytics Engine events (`ws.energizer_activated/answered/completed/timeout`, activation-denied) + best-effort audit rows. No per-energizer effectiveness metrics.

### Launchpad
- Session is created (D1, `status='draft'`) before Launchpad opens; Launchpad edits title/questions/energizers via DRAFT REST APIs and launches via `POST /:id/start`. Server-side preflight (`GET /:id/preflight`: ≥1 question, ≥2 options for choice kinds, title set, AI consent recorded) with a local fallback; double-submit guarded via `startingRef`.
- Question reorder = HTML5 drag-and-drop → `PUT /:id/questions/reorder` (exact-set validation, two-phase position rewrite in a D1 batch, idempotent) with optimistic UI + rollback. Good pattern.
- ARIA labelling is broadly present (join panel, preflight strip, live regions). Gaps in E-6/L-2 below.

### Presenter / realtime
- **Sync:** WebSocket to `SessionRoom` DO (hibernation API). Votes are rate-limited per socket (token bucket 10 cap / 1 refill/s), buffered in DO storage, **flushed to D1/KV every 5 s or 1,000 votes**, results broadcast **debounced at 100 ms**, R2 snapshot every 30 s (ADR-042). Inbound frames capped at 64 KiB, protocol-versioned, Zod-validated at the boundary. This core vote loop is well-engineered.
- **Reconnect:** client backoff 1/2/4/8/16 s, 5 attempts per outage, full rehydrate from `init` payload — refresh/disconnect handling is sound.
- **Presenter controls:** advance/back, pause/resume, shuffle options, hide tally, min-response gate, soft timer, captions (plan-gated), reactions, copilot panel, separate `/display/:code` big-screen link. On-the-fly question adding exists (`sendAddQuestion`); energizer launch from live flow is stubbed but not wired (P-2).

---

## 2. Findings

Severity legend: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

### 🔴 E-1 — Energizer answer keys are sent to participants (both paths)
- **Component:** Energizers (REST + DO) · **Effort:** S
- **Evidence:**
  - REST: `GET /api/sessions/:id/energizers/active` returns `config: validConfig` verbatim — for `quick_finger` that includes `correct_index`, for `team_quiz` every question's `correct_index` (`routes/energizers/active.ts:113,133,147`). Participants poll this endpoint from `JoinPage.tsx:220`.
  - WS: `broadcastEnergizer` sends the full `LiveEnergizerState` — including `correctIndex`, `questions[].correctIndex`, and every answer's `correct` flag — to **all** sockets, voters included (`session-room-energizer-handler.ts:74-79`; type at `realtime.ts:96,130`).
  - Compounding it, the REST team-quiz vote response returns `correct: true/false` immediately and the upsert allows re-answering (`vote-next.ts:114-122`), so a participant can brute-force until correct.
- **Impact:** any participant with devtools reads the right answer before answering; quick-finger/team-quiz leaderboards (speed- and correctness-based) are trivially gameable. Integrity of the competitive energizers is broken by design.
- **Recommendation:** strip `correct_index`/`correctIndex` (and per-answer `correct` flags of *other* voters) from participant-facing payloads; project a redacted view per role before send/broadcast. Return `correct` only after the question closes, and reject answer changes on team_quiz (mirror the WS duplicate rule).

### 🔴 E-2 — REST energizer plane 401s for anonymous participants; two divergent result stores
- **Component:** Energizers · **Effort:** M
- **Evidence:** all energizer routes are mounted behind `authMiddleware` (`routes/energizers/index.ts:16`), which hard-requires a JWT (`middleware/auth.ts:90-97`); `/api/sessions/:id/energizers/*` is not in the public-path exemptions (`lib/public-api-paths.ts`). Yet `JoinPage.tsx:219-238` polls `/energizers/active` every 3 s and the participant energizer views POST `/vote` — anonymous joiners (join-code flow, no `qesto_session` cookie) get `401 unauthenticated` on every call, so the energizer never renders and votes fail. Separately, WS-path answers live only in DO storage while REST votes live only in D1 — results from the two planes are never reconciled.
- **Impact:** for the primary audience (anonymous participants), ENERGIZING-lobby energizers silently don't work — polling errors are swallowed (`if (res.ok)` only). Where both planes are used, hosts can see two different result sets for the same energizer.
- **Recommendation:** decide on one plane. Either (a) expose participant read/vote endpoints on a public, join-code-scoped path (with captcha/rate limits like the vote plane), or (b) drop REST polling entirely and deliver ENERGIZING-state energizers over the existing DO WebSocket (the DO is already initialized in ENERGIZING). (b) also removes the n-participants × 0.5 QPS D1 polling load and the dual-store divergence.

### 🟠 E-3 — Second energizer per session always fails: `UNIQUE(session_id, position)` vs hardcoded `position = 0`
- **Component:** Energizers · **Effort:** XS
- **Evidence:** `INSERT INTO energizers ... VALUES (..., 0, 'draft', ...)` — position bound to `0` unconditionally (`routes/energizers/create-list.ts:90-95`); live table keeps `UNIQUE(session_id, position)` (`migrations/0005_team_quiz_word_cloud.sql:31`). The list endpoint orders by `position ASC`, implying multiple were intended.
- **Impact:** the second `POST /energizers` for a session hits the UNIQUE constraint → 500 `internal`. Today the wizard creates at most one (`SessionWizard.tsx:313-326`), which masks the bug — but re-running the wizard on the same session or any future multi-energizer UI breaks immediately, with an unhelpful error.
- **Recommendation:** compute `position = COUNT(*)` for the session (or `MAX(position)+1`) inside the insert; add a Vitest covering two creates on one session.

### 🟠 W-1 — AI transparency metadata reports the wrong model
- **Component:** AI Wizard · **Effort:** XS
- **Evidence:** the SSE `ready` event tells the consent UI `model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'` (`routes/sessions/wizard.ts:245`), but the default generation path runs `@cf/meta/llama-3.1-8b-instruct-fp8` and only falls back to the 70B model on failure (`ai-wizard.ts:213-214,517-540`).
- **Impact:** the GDPR/AI-transparency disclosure (ENTERPRISE-POLISH s3a) shown to users is factually wrong; also misleads anyone debugging quality issues. For a privacy-by-default product this is a trust liability, not just a nit.
- **Recommendation:** emit the actual model per batch (or list both as candidates); source the string from `__internal.FAST_MODEL` so it can't drift again. Per REV-10, ship with eval evidence if the wording change touches consent copy.

### 🟠 E-4 — Full-state energizer broadcast is O(n²) and unbounded
- **Component:** Energizers (DO) · **Effort:** M
- **Evidence:** every `energizer_answer` re-broadcasts the **entire** accumulated state — all answers/submissions plus recomputed leaderboard — to every socket (`session-room-energizer-handler.ts:238-241,278-281,314-317`). No debounce: contrast with the vote flow, which aggregates counts and debounces broadcasts at 100 ms (`session-room-types.ts:10`).
- **Impact:** for n participants answering, total bytes on the wire grow O(n²); a 300-person room answering a quick-finger question within seconds produces ~300 broadcasts × 300 sockets × a payload carrying up to 300 answer records. This is the presenter-lag hotspot for large rooms; it also ships every voter's raw `voterId` and answer to all participants (see E-1).
- **Recommendation:** broadcast a delta/aggregate view (counts + top-10 leaderboard — the leaderboard is already capped at 10) and reuse the existing `scheduleResultsBroadcast` debounce machinery; keep the full answer log DO-side only.

### 🟠 L-1 — Question reorder is drag-and-drop only: no keyboard or touch path
- **Component:** Launchpad · **Effort:** S
- **Evidence:** reorder relies exclusively on HTML5 `draggable` handlers (`Launchpad.tsx:91-121`, `QuestionList.tsx:174-215`); no `onKeyDown` arrow handling, no move-up/down buttons (grep over `src/components/launchpad/` finds no keyboard reorder affordance). HTML5 DnD also does not fire on touch devices without a polyfill.
- **Impact:** WCAG 2.1.1 (keyboard) failure on a core flow, and reordering is impossible on mobile/tablet — contradicting the project's "a11y + mobile-first non-negotiable" bar.
- **Recommendation:** add per-row move-up/move-down buttons (they can reuse the existing reorder API 1:1) and `aria-live` confirmation; that single control fixes keyboard and touch at once.

### 🟡 E-5 — REST vote plane trusts client-supplied `voter_id`
- **Component:** Energizers · **Effort:** S
- **Evidence:** `POST /:id/energizers/:eid/vote` upserts on `(energizer_id, voter_id)` where `voter_id` comes from the request body (`vote-next.ts:17-29,125-131`); any caller can overwrite any other participant's vote or ballot-stuff with generated ids. The WS path instead uses the server-assigned attachment `voterId` — correct.
- **Impact:** result manipulation on ENERGIZING-lobby polls; combined with E-2's plan decision, this argues further for retiring the REST vote plane or binding voter identity server-side (signed participant token).
- **Recommendation:** fold into the E-2 consolidation; if REST voting stays, mint a signed participant id at join and verify it here.

### 🟡 W-2 — No app-side caching or dedup for primary question generation; gateway cache is config-dependent
- **Component:** AI Wizard · **Effort:** S
- **Evidence:** `/questions/generate` and `/ai/generate` always run 2 model calls (parallel batches, `ai-wizard.ts:525-531`); only `/ai/refine` has grounding-hash caching (`wizard.ts:809-857`). When AI Gateway secrets are absent every call bypasses caching entirely (`ai-gateway.ts:106-114`) — and nothing logs which mode production is in.
- **Impact:** repeated identical generations (same title/goal — common while a host iterates) cost 2× inference each time; latency ~seconds per click. Cost is bounded by the 20/h rate limit, so this is efficiency, not runaway spend.
- **Recommendation:** reuse the refine pattern: hash `{title, goal, focus, language}` → KV (24 h TTL) before invoking; emit a metric for gateway-bypass mode so ops can see whether the semantic cache is actually active.

### 🟡 P-1 — Presenter canvas hardcodes "Full anonymity" regardless of session mode
- **Component:** Presenter · **Effort:** XS
- **Evidence:** `t('anonymity') ?? 'Full anonymity'` rendered unconditionally in the header and footer (`Present.tsx:506,628`) — never reads `session.anonymity`, which has multiple modes (`partial`, etc.).
- **Impact:** participants in a non-anonymous session are told on the big screen that they're fully anonymous — a privacy misrepresentation, the exact thing GDPR-consent copy must not do.
- **Recommendation:** map the real `anonymity` value to distinct labels; hide the lock badge when anonymity is off.

### 🟡 P-2 — Live energizer launch is stubbed, and the stub hardcodes wrong answers
- **Component:** Presenter · **Effort:** M
- **Evidence:** `handleStartQuickFinger`/`handleStartTeamQuiz` exist but are referenced only through `void ({...})` "while Sprint C UI wiring is pending" (`Present.tsx:193-205`). The team-quiz stub sets `correctIndex: 0` for a question built from the current poll's options — polls have no correct answer.
- **Impact:** the DO-side energizer machinery (activate/answer/advance/leaderboard/timeout, ~620 lines) is unreachable from the product; when wired as-is, "first option is always correct" would corrupt scoring.
- **Recommendation:** either wire the Sprint C UI (with a real correct-answer picker) or remove the stubs — an unreachable code path that ages alongside a live protocol is drift risk. Track it in BACKLOG_ACTIVE rather than in a `void` expression.

### 🟡 E-6 — ENERGIZING-lobby polling ignores errors and hides host attribution of failure
- **Component:** Energizers / Launchpad · **Effort:** XS
- **Evidence:** `Launchpad.tsx:50-60` and `JoinPage.tsx:219-226` discard `!res.ok` results silently; participants see "Waiting for the host…" forever when the call 401s/500s (this is how E-2 stayed invisible).
- **Impact:** operational blindness — a broken energizer plane looks identical to "host hasn't started yet".
- **Recommendation:** surface a distinct error state after N consecutive failures and emit a client metric.

### 🟡 W-3 — Wizard launch performs N+1 sequential question inserts
- **Component:** AI Wizard / Launchpad · **Effort:** S
- **Evidence:** `SessionWizard.tsx:298-311` POSTs each accepted question one-by-one; each `POST /:id/questions` additionally re-fetches the whole question list before responding (`wizard.ts:352,372`).
- **Impact:** launching with 8 AI questions = 8 round trips × (fetch session + insert + refetch list) — seconds of avoidable latency at the emotional peak of the funnel ("create my session").
- **Recommendation:** add a bulk `POST /:id/questions:batch` (single D1 batch, one list response); the reorder endpoint already demonstrates the batch pattern.

### 🟢 P-3 — Timer input parses unchecked: `NaN` minutes starts a broken timer
- **Component:** Presenter · **Effort:** XS
- **Evidence:** `parseInt(timerInput, 10) * 60` flows through `Math.max/min` (NaN-propagating) into `timer.start()` (`Present.tsx:161-164`).
- **Recommendation:** guard `Number.isFinite` and disable the start button on invalid input.

### 🟢 E-7 — Quick-finger REST rankings derive speed from `updated_at`
- **Component:** Energizers · **Effort:** XS
- **Evidence:** `speed_ms = vote.created_at - energizer.updated_at` (`active.ts:38,79`) — but `updated_at` changes on *any* PATCH (e.g. prompt edit while active), retroactively rewriting everyone's speeds.
- **Recommendation:** persist an explicit `activated_at` column (the DO path already stores one).

### 🟢 P-4 — Leaderboard "names" mode never shows names
- **Component:** Presenter / Energizers · **Effort:** XS
- **Evidence:** `buildLeaderboard` labels entries `Player ${i+1}` when `display === 'names'` (`session-room-energizer.ts:218-222`), so the names/aliases/hidden setting renders identically for the first two modes (aliases at least are deterministic).
- **Recommendation:** resolve display names from the participant registry in `names` mode, or rename the setting.

---

## 3. Efficiency opportunities (mapped to the audit's checklist)

| Checklist item | Status | Note |
|---|---|---|
| Cache frequent generations (24 h KV) | ⚠️ Partial | Refine only — extend to generate (W-2) |
| DO per live session vs D1 polling | ⚠️ Mixed | Votes: yes (exemplary). Energizers: split-brain (E-2) |
| Response batching to presenter | ⚠️ Mixed | Votes debounced 100 ms; energizer broadcasts unbatched (E-4) |
| Workers-AI fallback on rate limit | ✅ | 8B→70B secondary model + stream→buffer fallback |
| Streaming responses | ✅ | SSE with incremental per-question parsing |
| Token counting pre-call | ❌ | Only `approxInputChars` logging; `max_tokens: 700` caps output |
| Prompt library/consistency | ✅ | Single system prompt, versioned `promptVersion: 'v1'` in gateway ctx |
| Dead code removal | ⚠️ | Present.tsx energizer stubs (P-2); export.csv already removed |
| LLM cost tracking per feature | ⚠️ Partial | `ai.inference` AE events with duration/count; no token/cost dimension |
| Energizer effectiveness tracking | ❌ | Activation/answer counts only |
| Real-time lag monitoring | ⚠️ Partial | AE events exist; no client-side latency metric |

## 4. Suggested fix order

1. **E-1 + E-4** (one PR: redacted, aggregated, debounced energizer broadcast/read model) — integrity + biggest perf win.
2. **E-2 + E-5 + E-6** (one decision + PR: single energizer plane with server-bound identity and visible errors) — unbreaks anonymous participants.
3. **E-3, W-1, P-1** — three XS correctness/trust fixes, each independently shippable.
4. **L-1** (keyboard/touch reorder), **W-3** (batch insert), **W-2** (generate cache).
5. **P-2** decision (wire Sprint C or delete stubs), then the 🟢 cleanups.

*No changes to AI prompts/models/output schemas are made by this audit; REV-10 eval gate applies to the fixes for W-1 only if consent copy changes.*
