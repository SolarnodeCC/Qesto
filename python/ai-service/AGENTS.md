# Python AI service (`python/ai-service/`)

Exception-only advanced-ML/data surface for Qesto. Product runtime stays on Workers AI (`c.env.AI`).

**Owns:** offline evals, embedding experiments, data-pipeline prototypes  
**Forbidden:** direct D1/product truth, production API routes, third-party LLM API keys in repo  
**Proof lane:** `just fast` (contract tests) / `npm test -- --run tests/unit/`

Canonical layout: move scripts from `python/` root here over time.  
Expiry review: 2027-06-01 — migrate or document permanent exception in `agent/owner-map.json`.
