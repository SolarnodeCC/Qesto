---
id: SPRINT81_90_AI_PLAN
type: planning
domain: ai
category: planning
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - ai
  - sprints-81-90
  - agent-runtime
  - agent-marketplace
  - captions
  - workers-ai
  - maturity-model
relates_to:
  - SPRINT81_90_PLAN
  - COMPETITIVE_EPICS
  - SPRINT71_80_PLAN
---

# Sprint 81–90 AI Plan — Agentic Facilitation → v6.0 (AI-441–AI-480)

_Prepared: 2026-06-01 — AI strategy synthesis aligned to [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md). Continues the AI-001…AI-440 line (S80 closed AI maturity at L3→L4 transition)._

**Hard rule (non-negotiable):** **Workers AI only** — `c.env.AI.run(...)`. No Anthropic/OpenAI API, no third-party AI egress. This is Qesto's privacy moat and the reason agentic + captions features are defensible vs. competitors who ship data to external LLMs.

---

## AI-first vs AI-shaped assessment (per epic)

| Epic | AI capability | First or Shaped? | Rationale |
|------|---------------|------------------|-----------|
| E83 Agentic Facilitation | Autonomous facilitation agent | **AI-first** | The agent *is* the product surface; without the model there is no feature. Highest strategic value of the arc. |
| E83 Agent marketplace | Curated/installable agents | AI-first | Marketplace exists to distribute AI agents. |
| E85 RETRO summarizer | Theme clustering + retro summary | AI-shaped | Enhances a workflow that works without it; high utility, not existential. |
| E85 IDEATE clustering | Idea de-duplication + grouping | AI-shaped | Accelerates prioritization; manual fallback exists. |
| E88 CAPTIONS | Live ASR + translation | **AI-first** | The captioning/translation *is* model inference; no model = no feature. |
| E88 CANVAS theme intelligence | Adaptive viz suggestions | AI-shaped | Smart default; designer can override. |
| E84 TOWNHALL moderation | AI pre-screen of questions | AI-shaped | Safety accelerator over a human-moderated queue. |

**Verdict:** The two genuinely **AI-first** bets are **agentic facilitation (E83)** and **live captions/translation (E88)** — both are pure inference surfaces and both are only viable on Workers AI without breaking the privacy moat. Everything else is AI-shaped (valuable, but with non-AI fallbacks).

---

## Maturity model (5 competencies) — current → target

| Competency | S80 (current) | S90 (target) | Lever |
|------------|---------------|--------------|-------|
| 1. Model selection & cost | L3 | L4 | Per-feature Workers AI model routing; agent cost metering (ties to TENANT-COST) |
| 2. Prompt & context engineering | L3 | L4 | Agent tool-call schema; structured grounding; multi-turn copilot GA (from S76) |
| 3. Evaluation & safety | L2→L3 | **L4** | `SEC-AGENT-EVAL-01` eval harness; captions WER bar; emotion-safe v2 constraints |
| 4. Autonomy & orchestration | L1→L2 | L4 | AgentRunDO + Workflows GA (ADR-0046); bounded autonomous facilitation |
| 5. Productization & UX | L3 | L4 | Agent marketplace; transparent [AI-Generated] labeling; receipt of agent actions |

**Closeout (AI-471–AI-480, S90):** formal L4 attestation across all five competencies as part of the v6.0 certification bundle.

---

## Story registry AI-441–AI-480 (mapped to sprints)

| Sprint | Stories | Theme |
|--------|---------|-------|
| S81 | AI-441–AI-444 | Agent runtime **schema** (tool-call contract, grounding format, sandbox spec) |
| S82 | AI-445–AI-448 | Agent inference path + Workers AI model routing + cost metering hooks |
| S83 | AI-449–AI-452 | `AGENT-RUNTIME-01` AgentRunDO GA inference + output validation |
| S84 | AI-453–AI-456 | `AGENT-MARKETPLACE-01` curated agents + `AGENT-FACILITATE-01` autonomous loop + TOWNHALL AI pre-screen |
| S85 | AI-457–AI-460 | RETRO summarizer + IDEATE idea clustering (Vectorize-backed) |
| S86 | AI-457b/AI-460 cont. → consolidation | `AGENT-FACILITATE-GA-01`; emotion-safe v2 guardrails on retro/ideate summaries |
| S87 | AI-461–AI-464 | Agent action transparency + audit-of-agent surface; copilot ↔ embed handoff |
| S88 | AI-465–AI-470 | `CAPTIONS-PIPELINE-01` ASR+MT quality; CANVAS theme intelligence |
| S89 | AI-465–AI-470 cont. | `CAPTIONS-GA-01` WER-bar sign-off; sovereign-tier AI isolation review |
| S90 | AI-471–AI-480 | L4 agent-maturity closeout + v6.0 AI certification evidence |

_(S86 and S89 draw from the surrounding bands; the 40 IDs AI-441–AI-480 are allocated contiguously with S86/S89 consuming spillover + GA hardening rather than net-new IDs, matching how S71–S80 handled AI-401–AI-440.)_

---

## Workers AI model choices (per feature)

| Feature | Workers AI model (indicative) | Notes |
|---------|-------------------------------|-------|
| Agent facilitation reasoning | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Default agent brain; structured tool calls |
| Retro summary / idea clustering | Llama 3.3 70B + Vectorize embeddings | Embeddings via existing 768d Vectorize index |
| TOWNHALL moderation pre-screen | Smaller fast model (guardrail classifier) | Latency-sensitive; runs per submitted question |
| CAPTIONS ASR | Workers AI Whisper-family | No audio leaves the edge (ADR-0051) |
| CAPTIONS translation | Workers AI MT model | Target locales gated on WER bar (S88) |

_Final model IDs confirmed against the Workers AI catalog at implementation time; routing abstracted behind `ai.ts` so models can be swapped without touching feature code._

---

## Safety / eval gates

| Gate | Sprint | Blocks |
|------|--------|--------|
| Agent tool sandbox enforced (no fetch/payout/role tools) | S83 | Agent GA |
| `SEC-AGENT-EVAL-01` safety suite green (no unsafe autonomous action) | S84 | Agent marketplace **public** |
| Emotion-safe v2 constraints on summaries | S86 | Retro/ideate summary GA |
| Captions WER ≤ agreed bar (EN + top 4 locales) | S88 | CAPTIONS GA claim |
| L4 maturity attestation | S90 | v6.0 AI certification |

---

## Out of scope (AI)

OpenAI/Anthropic API (hard rule), agents with unrestricted tool access, agents that move money or change roles, fully autonomous sessions with no human host, third-party ASR/MT services. Deferred/forbidden.
