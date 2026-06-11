# AI Eval Baseline — Golden-Set Harness (REV-10)

**Established:** 2026-06-10
**Suite:** `tests/eval/` (run with `npm run test:eval`; also part of `npm test`, `check:rc`, and `ops/ci/quality-gates.sh`)
**Origin:** Platform review 2026-06-09 §4 (REV-10) — eval evidence as definition-of-done for AI changes.

## What this harness asserts

CI cannot reach Workers AI, so the golden set evaluates the deterministic AI
*pipeline contract* — prompt construction, output validation, safety scrubbing,
and governance gating — not live model quality. Live model quality changes must
additionally be smoke-checked manually against Workers AI before merge.

| Suite | Fixtures | Asserts |
|---|---|---|
| `insights-prompt.eval.test.ts` | `fixtures/prompt-injection.json` (15 attacks) | Every attack string is sanitized (control/zero-width stripped, length-capped) and confined inside the `<<<UNTRUSTED_PARTICIPANT_DATA>>>` fence exactly once; embedded fence markers cannot escape; system prompt carries the untrusted-data rule; anonymity rule present unless `anonymity='none'`. |
| `insights-output.eval.test.ts` | `fixtures/golden-outputs.json` (5 accept / 8 reject), `fixtures/pii-outputs.json` (6 cases) | 100% schema acceptance of the valid corpus; 100% `InsightsValidationError` rejection of the invalid corpus (no raw pass-through); PII-bearing theme examples (emails, voter-ids, phones, @handles) dropped when `anonymity != 'none'`, retained when `'none'`. |
| `insights-guards.eval.test.ts` | inline matrix | `checkInsightsAllowed`: zero-knowledge always blocked (`zk_not_supported`); AI-generated without `ai_consent_at` blocked (`consent_required`); plain/consented sessions allowed. |
| `facilitation-prompt.eval.test.ts` | `fixtures/facilitation-injection.json` (10 attacks) | AGENT-FACILITATE-GA-01: the live facilitation prompt (`copilot-suggest.buildSuggestMessages`) confines the host-authored current-question text inside the `<<<UNTRUSTED_SESSION_DATA>>>` fence exactly once; embedded fence markers cannot escape; no control/zero-width chars survive; fenced field length-capped; system prompt carries the untrusted-data rule; no fence emitted when no question is active. |

## Pass criteria (hard gate)

- Valid-output corpus: **100% accepted**.
- Invalid-output corpus: **100% rejected** with `InsightsValidationError`.
- Injection corpus: **0 fence escapes**, 0 surviving control/zero-width characters.
- PII corpus: **0 leaked identifiers** in anonymous-mode examples.

## Baseline result (2026-06-10)

All suites green: 15/15 injection confinement, 5/5 accept, 8/8 reject,
6/6 PII scrub cases (both anonymity modes), 6/6 guard matrix.

## Update (2026-06-11) — AGENT-FACILITATE-GA-01

Added `facilitation-prompt.eval.test.ts` (+1 suite, +13 cases) covering the live
facilitation prompt fence. Suite total: **51 → 64 green (4 suites)**. The live
facilitation surface (`copilot-suggest.ts`) is now inside the REV-10 gate; its
host-authored current-question text is fenced + sanitized like participant data.

## How to extend (required with every AI change)

1. Add representative cases to the relevant fixture **before** changing the
   prompt/model/schema — the new case should fail on the old behaviour or
   document the new contract.
2. Run `npm run test:eval`; record notable shifts in this file (date + delta).
3. New AI features get their own `*.eval.test.ts` + fixture pair in
   `tests/eval/` and a row in the table above.

See CLAUDE.md hard rule 6 and `.claude/skills/ai-engineering.md` § Evals.
