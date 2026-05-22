---
id: ADR-0011
type: adr
status: accepted
created: 2026-05-22
tags:
  - ai
  - privacy
  - sentiment
relates_to:
  - AI-SENTIMENT-01
  - AI_CONTEXT_SPEC
---

# ADR-0011: Live Sentiment Inference (Workers AI)

## Status

**Accepted** — 2026-05-22. Required before Sprint 34 `AI-SENTIMENT-01` implementation.

## Context

Sprint 34 adds aggregate session mood signals for presenters. Mentimeter and Vevox surface “room energy” without per-participant attribution; Qesto must match that bar under GDPR and zero-knowledge constraints.

## Decision

1. **Model:** `@cf/meta/distilbert-sst-2-int8` via `c.env.AI.run()` only (no external APIs).
2. **Language gate:** English open-question text only in v1; other locales return no signal until a validated multilingual model ships.
3. **Aggregate-only:** Emit presenter signal only when **k ≥ 5** distinct open responses exist in the current aggregation window.
4. **Zero-knowledge:** When `session.anonymity === 'zero_knowledge'`, sentiment inference is **disabled** (no batching, no AE events with content).
5. **No per-participant output:** Presenter UI shows `positive | neutral | concerning` for the room — never a score tied to `voterId`.
6. **Context:** All calls use `SessionAIContext` + `aiOverride({ model: SENTIMENT_MODEL })` from `functions/api/lib/ai/session-context.ts`.
7. **Observability:** `ai.sentiment_analysis` AE event with `teamId`, `plan`, `durationMs`, `count` = batch size; **no** prompt or response text in blobs.

## DPIA scope (summary)

| Risk | Mitigation |
|------|------------|
| Re-identification from rare open answers | k≥5 gate; aggregate label only |
| ZK sessions | Feature hard-off |
| Model drift / false “concerning” | Host copy: indicative not diagnostic; English-only gate |
| Sub-processor (Cloudflare Workers AI) | Listed in SOC2 sub-processor registry |

Full DPIA evidence pack: Sprint 34 `GDPR-BADGE-01` + `COMPLIANCE-01`.

## Consequences

- Sprint 34 implements `AI-SENTIMENT-01` against this ADR only.
- Marketing may not claim “real-time emotion AI” until Sprint 34 QA + security sign-off.

## Alternatives considered

- **Llama for sentiment:** Rejected — higher cost/latency; distilbert purpose-built.
- **Per-response scores:** Rejected — conflicts with anonymity posture.
