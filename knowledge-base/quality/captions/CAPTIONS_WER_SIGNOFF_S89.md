---
id: CAPTIONS_WER_SIGNOFF_S89
type: report
domain: ai-quality
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
sprint: S89
stories: [CAPTIONS-GA-01]
relates_to:
  - ADR-0051-live-captions-translation-pipeline
  - SPRINT88_EXECUTION
  - AI_EVAL_BASELINE
tags:
  - captions
  - wer
  - eval
  - workers-ai
  - rev-10
  - ga-gate
---

# CAPTIONS-GA-01 — Word-Error-Rate Sign-off (Sprint 89)

_Gate for promoting the S88 live-captions pipeline (ADR-0051) from "behind the WER
bar" to **GA-eligible**. CAPTIONS shipped feature-complete in S88; this document is
the quality sign-off REV-10 requires before the feature is presented as production
(`liveCaptions`, Team+)._

## Summary

The captions pipeline is **AI-first**: the feature *is* model inference (Whisper ASR
+ M2M100 translation on Workers AI). Per ADR-0051 §4 and Hard Rule #6 (REV-10), a
source→target pair is **offered to participants only after it clears the
Word-Error-Rate (WER) bar** in the golden eval fixtures; any unenabled pair degrades
to source-language captions rather than shipping low-quality MT as authoritative.

S89 signs off the **S88 priority pair set** — EN-source → {nl, es, de, fr} — against
`CAPTION_WER_BAR = 0.25` (≤25% token error). The sign-off is mechanically enforced
by the eval suite, not a manual attestation: the suite asserts that
`CAPTION_PAIR_ENABLED` mirrors **exactly** the pairs that clear the bar (and that
unenabled pairs assert disabled), so the config cannot drift from measured quality.

## Evidence

| Artifact | Role |
|---|---|
| `tests/eval/captions-quality.eval.test.ts` (16 cases) | WER scorer over golden fixtures; gates each pair on `CAPTION_WER_BAR` |
| `tests/eval/fixtures/captions-asr-golden.json` | Reference ASR transcripts |
| `tests/eval/fixtures/captions-mt-golden.json` | Reference translations per enabled pair |
| `functions/api/lib/captions-config.ts` | `CAPTION_PAIR_ENABLED`, `wordErrorRate()`, `isPairEnabled()` |
| `npm run test:eval` | **86 green** (5 suites) at S89 — captions suite included |

## Signed-off pair set (S89)

| Source | Target | Enabled | WER vs bar (0.25) |
|---|---|---|---|
| en | en (source, no MT) | ✅ always | n/a |
| en | nl | ✅ | ≤ bar (fixture-asserted) |
| en | es | ✅ | ≤ bar (fixture-asserted) |
| en | de | ✅ | ≤ bar (fixture-asserted) |
| en | fr | ✅ | ≤ bar (fixture-asserted) |
| nl/es/de/fr → * (non-EN source) | — | ⛔ not yet | fixtures not cleared; degrade-to-source |

Non-English **source** pairs remain disabled by config and degrade to source-language
captions — never an error, never an unmeasured MT shipped as authoritative. They are
added in a later sprint as their fixtures clear the bar.

## GA disposition

- **EN-source captions + EN→{nl,es,de,fr} translation: GA-eligible** for the
  `liveCaptions` entitlement (Team+), behind the WER bar enforced in CI.
- The eval gate (`npm run test:eval`) is the standing guard: any regression that
  pushes an enabled pair above 0.25, or any config edit that enables an uncleared
  pair, fails CI before ship (REV-10).

## Operational follow-up (deferred, non-blocking)

The S88 closeout suggested moving `CAPTION_PAIR_ENABLED` from a code constant to a
KV/D1-backed toggle so a pair could be enabled without a deploy. **Deferred as a
post-GA ops enhancement, not a v6.0-rc blocker.** Rationale: pair enablement is
quality-gated config that must move in lockstep with a golden-fixture change and a
green eval run; a runtime toggle that lets a pair be enabled *without* re-running the
eval gate would weaken REV-10, and adding a KV read to the realtime caption hot path
during an RC-hardening sprint is the wrong risk trade-off. If a runtime toggle is
pursued later it must still be fenced behind the eval gate (e.g. the override may only
*disable* a pair at runtime, never enable an uncleared one). Tracked for a post-v6.0
sprint.

## Live-model measurement note

The fixture-based WER scorer is the deterministic CI gate. A production live-model WER
spot-check against the Workers AI endpoints (`@cf/openai/whisper`,
`@cf/meta/m2m100-1.2b`) is part of the S89→S90 DevOps deploy validation
(captions latency budget + ASR-availability monitoring) and is recorded in the sprint
deploy checklist, not gated in unit CI (no external/model calls in CI per Hard Rule).
