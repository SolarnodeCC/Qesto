---
id: ADR-0056
status: accepted
created: 2026-06-19
accepted: 2026-06-19
deciders: architect, security, product-owner
relates_to: ADR-0046, ADR-0054, SPRINT91_99_STORIES
---

# ADR-0056: Agentic Maturity L2 — Supervised Multi-Step Copilot Plans

## Status

Accepted (S92). Governs `COPILOT-RUNTIME-01` and `COPILOT-TOOLS-01`.

## Context

ADR-0046 shipped L1 live copilot: single-shot Workers AI suggestions from an aggregate
DO snapshot. Sprint 92 requires **bounded multi-step autonomy** with facilitator approval
gates before any suggestion is acted on — without moving LLM inference onto the SessionRoom
hot path and without introducing `AgentRunDO` for live facilitation.

Planning docs referenced `AgentRunDO`; code audit confirms it was never shipped. L2 extends
the **stateless Pages Function orchestrator** in `copilot-context` routes.

## Decision

1. **Orchestration stays stateless (Pages Function + KV).** Plan state is stored in
   `SESSIONS_KV` under `copilot:plan:{sessionId}` with 1h TTL. The DO is read-only for
   context (`/copilot/snapshot`).

2. **Three-step supervised plan (default).** Each plan has ordered steps:
   - `cluster_themes` — aggregate option-label clustering from live tallies
   - `detect_anomaly` — participation/mood anomaly from snapshot
   - `recommend_followup` — next-question recommendation from prior step outputs

   Each step status: `pending` | `approved` | `dismissed`. **No step output is surfaced
   to participants until the facilitator approves** (full checkpoint UI in S93).

3. **Tool whitelist (sandbox).** Expanded tools callable only through `copilot-tools.ts`:
   `cluster_themes`, `detect_anomaly`, `participation_alert`, plus L1 action kinds.
   Validated via `agent-safety.ts` + Zod output schemas.

4. **Autonomy ceiling.** Max 3 steps per plan; max 1 active plan per session; no session
   mutation tools; `requirePresenterConfirm: true` always for L2.

5. **Eval gate.** `SEC-AGENT-EVAL-02` in `tests/unit/agent-safety-eval-02.test.ts` must pass
   before v6.1 GA promotion.

## Consequences

- S93 adds facilitator approval UI (`COPILOT-CHECKPOINT-01`) and sandbox hardening.
- ADR-0056 must **not** co-land at GA with ADR-0057 aggregation escalations (already sequenced).

## References

- `functions/api/lib/copilot-plan.ts`
- `functions/api/lib/copilot-tools.ts`
- `functions/api/routes/copilot-context.ts` — `POST /sessions/:id/plan`
