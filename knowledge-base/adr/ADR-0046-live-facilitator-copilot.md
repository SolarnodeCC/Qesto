---
id: ADR-0046
status: accepted
created: 2026-05-30
accepted: 2026-05-30
relates_to: ADR-0001-do-per-session, ADR-0005-do-protocol-versioning, ADR-0009-pii-sanitization, ADR-0010-zero-knowledge-mode, ADR-0011-live-sentiment-inference, ADR-0029-ai-workflows
supersedes: ADR-0039 (referenced by AI-COPILOT-EDGE-01 but never written)
---

# ADR-0046: Live Facilitator Copilot — In-Session Context Flow & Action Protocol

## Context

The COPILOT epic (Competitive epic #2) promises a presenter-side panel that, **during a
LIVE session**, reads the room and acts: suggest the next follow-up, flag
disengagement/confusion, and draft an on-the-fly poll from a one-line intent — without
leaving the run screen.

A 2026-05-30 audit found the shipped copilot (S71/S76/S77) is **not** this. It is a
**post-session, standalone multi-turn chat API**: `GET /api/agent/copilot/sessions/:id`
(context bundle), `POST .../turn` (chat), `GET .../edge/status` (a declarative stub), all
in `functions/api/routes/copilot-context.ts`. The turn endpoint passes **only chat
history** to Workers AI (`copilot-context.ts:116`) — it does not even include the session
context bundle, let alone live room state. Separately, the ADR-0011 **sentiment**
foundation *is* live: `SessionRoom.ts:1094` broadcasts a `sentiment_signal` to
`role:presenter` sockets and `Present.tsx` shows a mood badge — but the copilot never
consumes it.

So the gap is the entire live experience: a room-read, a structured action protocol, poll
drafting, disengagement detection, and the presenter panel. This ADR fixes **where
inference runs**, **how live context reaches it**, **the action contract**, and **the
privacy boundary** — the decisions that the implementation stories (COPILOT-01+) depend on.

Constraints (non-negotiable): Workers AI only (hard rule #1); the single-threaded
`SessionRoom` DO must not take on heavy LLM inference on its hot path; zero-knowledge
sessions (ADR-0010) leak no per-response content; no PII reaches the model (ADR-0009).

## Decision

1. **Inference stays in the stateless Pages Function — not inside the DO.** The epic's
   literal "live inference loop wired into the DO" is **rejected**: a 70B-class LLM call on
   the single-threaded `SessionRoom` event loop (ADR-0001) would block voting/broadcast for
   the call's full duration and couple cost to connection count. Instead:
   - The **DO exposes an aggregate live snapshot** — current question id/kind, per-option
     tallies, response count, participation rate, and the latest `sentiment_signal` mood —
     reusing the state it already holds (`K_COUNTS`/`K_VOTERS`, `K_SENTIMENT_MOOD`).
   - The **copilot route** (`/api/agent/copilot/...`) reads that snapshot and runs Workers
     AI off the hot path. This *is* the "edge-native inference path" that the missing
     ADR-0039 was meant to define; ADR-0046 supersedes that reference.

2. **Presenter-triggered + debounced pull, not continuous push.** The panel requests
   suggestions on open and on a debounced interval / explicit "refresh"; the DO does **not**
   proactively run the copilot on every vote. Controls cost and avoids suggestion spam. The
   sentiment cooldown precedent (`SENTIMENT_COOLDOWN_MS`) is the model.

3. **Structured action protocol.** The copilot returns typed actions, not free text:
   `{ kind: 'followup_question' | 'poll_draft' | 'disengagement_alert' | 'pacing',
   title, body, payload? }`. `poll_draft.payload` is a draft question schema produced by
   **reusing `generateQuestions()`** (`functions/api/lib/ai-wizard.ts:363`) — not a new
   generator. The existing free-text `/turn` chat endpoint stays for the post-session use
   case and is unchanged (back-compat).

4. **Accept → inject via an additive `add_question` WS message.** When a presenter accepts
   a `poll_draft`, the frontend sends an `add_question` `ClientMessage` over the WebSocket;
   the DO appends it to the live question set (best-effort D1 persistence) so the presenter
   can advance to it. *(Implementation note (COPILOT-06): no `add_question` message existed,
   so it was added as an **additive message family on protocol v1** — permitted by ADR-0005
   without a version bump, the same precedent as energizers/townhall — not a reuse of a
   pre-existing path as originally assumed.)*
   **No new DO protocol version** (ADR-0005): the copilot adds an additive HTTP action
   surface, and the only realtime mutation reuses a message that already exists.

5. **Disengagement is derived from existing aggregate signals.** A `disengagement_alert`
   fires from (a) sentiment `concerning` at k≥5 (already computed) and/or (b) a
   response-rate or vote-latency drop computed from the DO snapshot. **No new
   per-participant tracking** is introduced.

6. **Privacy boundary — aggregate-only to the model.** The copilot prompt receives session
   config + the **aggregate** snapshot (tallies, counts, mood) — never raw per-voter
   responses. (Sentiment already samples open text under its own ADR-0011/0009 controls and
   only emits a mood label.) In **zero-knowledge** sessions sentiment is off, so
   `disengagement_alert` falls back to participation metrics only; `followup_question` and
   `poll_draft` still work from session config. `safeLogContext()` covers the route; no PII
   in prompts or AE events (ADR-0009).

7. **Plan gating.** A new `liveCopilot` key in `PlanQuotas.featuresUnlocked`
   (`functions/api/types.ts`), keeping the team/starter parity of the existing `/turn`
   gate; lower tiers get an upsell affordance, no data leak.

## Alternatives considered

- **LLM inference inside the DO (the epic's literal wording)** — rejected: blocks the
  single-threaded `SessionRoom`, makes latency/cost a function of live connections, and
  risks starving vote handling. Aggregate-snapshot + edge-function inference decouples them.
- **Continuous push: DO runs the copilot on every vote and broadcasts suggestions** —
  rejected: cost and suggestion noise; presenter-triggered + debounced pull is sufficient
  and controllable.
- **New WebSocket message family for suggestions** — rejected: suggestions are a
  request/response over HTTP to the panel; only the *accept* action needs realtime, and it
  reuses `add_question`. Avoids an ADR-0005 protocol bump.
- **A new poll generator for one-line intent** — rejected: `generateQuestions()` already
  turns intent + context into question schemas; reuse it.
- **Sending raw open responses to the suggestion model** — rejected on privacy: aggregate
  snapshot + the existing sentiment sample is enough and keeps the ADR-0009/0010 boundary.
- **Replacing the post-session `/turn` chat** — rejected: it serves a real debrief use case;
  the live copilot is additive.

## Consequences

- Reuses the `/api/agent/copilot` surface, `generateQuestions()`, the `sentiment_signal`
  broadcast, the `Present.tsx` mood badge, and the `add_question` WS path — COPILOT is
  mostly a live-context read + an action contract + a panel, not new infrastructure.
- The DO gains a small **aggregate read** but no inference and no new protocol version —
  the 5k-participant performance envelope is unchanged.
- Clean privacy story: aggregate-only prompts, ZK-aware degradation, no PII in AE.
- **Latency**: a 70B suggestion call is seconds, not sub-100ms — acceptable because it is
  presenter-facing and explicitly triggered, not on the vote path. Circuit-breaker the
  Workers AI call (ADR-0007) with a graceful "no suggestion right now" fallback.
- The post-session chat API and all voting/energizer flows are untouched (regression
  baseline).
- A new `liveCopilot` entitlement must be added to every plan tier in `PLAN_QUOTAS`.

## Back-compat / test matrix

- Existing `POST .../turn` chat and `GET .../sessions/:id` context bundle → unchanged.
- LIVE non-ZK session → snapshot carries tallies + mood; copilot emits `followup_question`
  and (when `concerning`/participation-drop) `disengagement_alert`.
- **ZK** session → snapshot carries **no** sentiment mood and **no** per-response content;
  `disengagement_alert` uses participation only; `poll_draft`/`followup_question` still work.
- One-line intent → `draft-poll` returns a valid question schema; **accept** emits exactly
  one `add_question` WS message; the running session gains the question with no protocol bump.
- Workers AI unavailable → circuit-breaker OPEN → panel shows graceful fallback, no 500.
- Lower-tier plan → `403 feature_not_available` with upgrade affordance; no snapshot leak.
- Prompt + AE payloads asserted free of per-voter identifiers / raw responses.
- Inference is never invoked from within `SessionRoom` (assert no `AI.run` on the DO hot
  path for copilot).

## References

- `functions/api/routes/copilot-context.ts` (existing endpoints), `functions/api/lib/copilot-context.ts`, `functions/api/lib/copilot-multturn.ts`
- `functions/api/lib/ai-wizard.ts` (`generateQuestions`, line 363) — poll-draft reuse
- `functions/api/SessionRoom.ts` (`sentiment_signal` broadcast ~1094, `K_COUNTS`/`K_VOTERS`/`K_SENTIMENT_MOOD`), `functions/api/lib/ai/sentiment.ts`
- `src/pages/Present.tsx` (mood badge), `src/hooks/useLiveSession.ts` (`sentiment_signal` parse), LIVE `add_question` `ClientMessage` in `functions/api/types.ts`
- `functions/api/lib/entitlements.ts`, `functions/api/types.ts` (`featuresUnlocked`)
- ADR-0011 (sentiment), ADR-0005 (protocol versioning), ADR-0007 (circuit breaker)
- EPIC-COPILOT in `knowledge-base/product/backlog/BACKLOG_MASTER.md`
