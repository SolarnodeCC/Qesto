# Python policy

Qesto does **not** ship Python product runtime code in this repository.

Advanced ML beyond Workers AI requires a dated exception recorded in `knowledge-base/adr/` before adding code under `python/ai-service/` only.

Until then: use TypeScript (`functions/api/`), SQL (`migrations/`), and generated contracts (`contracts/`).
