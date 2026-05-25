---
id: ADR-0026
status: accepted
date: 2026-05-25
---

# ADR-0026 — Repository Layer for D1 Session Access

## Decision

- D1 reads for sessions/questions scoped by owner move to `functions/api/repositories/sessionRepository.ts`.
- New route code must not call `c.env.DB.prepare` for session tables; use repository functions.
- CI: `scripts/check-route-db-gate.sh` warns on new violations (allowlist shrinks per sprint).
