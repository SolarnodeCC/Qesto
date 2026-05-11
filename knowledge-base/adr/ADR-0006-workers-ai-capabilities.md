---
id: ADR-0006
title: Workers AI Capabilities
domain: architecture
status: accepted
version: 1.0
created: 2026-04-20
updated: 2026-05-11
tags:
  - ai
  - workers-ai
  - llm
  - cloudflare
relates_to:
  - SPEC_BACKEND
  - ADR-0002-ai-streaming-transport
---

# ADR — Workers AI Capabilities for Qesto

_Hub: [Documentation map](./README.md)._

_Status: Active reference (updated 2026-04-05)_

## Decision summary
Qesto standardizes on **Cloudflare Workers AI via `c.env.AI.run()`** for inference use cases.
External Anthropic API calls remain out of scope for runtime integration.

## Current implementation context
- AI routing and helpers exist under `functions/api/ai.ts`, `ai-constants.ts`, `insights.ts`, `vectorize.ts`, and `routes/ai.routes.ts`.
- Model selection is centralized and should remain configurable via constants/env.

## Approved direction
1. Keep structured output handling robust (schema-first parsing and fallbacks).
2. Continue timeout, retry, and observability wrapping around AI calls.
3. Evaluate model upgrades only with benchmark evidence (quality + latency + cost).
4. Keep embedding model migration as explicit re-index project, not silent switch.

## Deferred until evidence
- Any broad model migration without benchmark suite.
- New multimodal features without clear user value and capacity.
