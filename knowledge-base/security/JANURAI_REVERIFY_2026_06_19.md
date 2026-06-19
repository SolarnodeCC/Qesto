---
id: JANURAI_REVERIFY_2026_06_19
type: security
domain: security
category: audit
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - jankurai
  - sec-janurai-reverify-01
  - rt-01
relates_to:
  - JANURAI_AUDIT_2026_06_15
  - PLATFORM_CERTIFICATION_V7
  - SEC-SAML-01
  - BACKLOG_ACTIVE
---

# Jankurai CRITICAL Re-Verification — 2026-06-19

_`SEC-JANURAI-REVERIFY-01` (RT-01). Security + Tester quality-lead re-test of the five
CRITICAL items from [`JANURAI_AUDIT_2026_06_15.md`](../../../JANURAI_AUDIT_2026_06_15.md)._

## Verdict

| RT-01 criterion | Result |
|-----------------|--------|
| June CRITICAL-5 re-tested | **4 closed · 1 mitigated** |
| Exploitable CRITICAL on default prod config | **0** |
| Engineering proof lanes | **Green** (2224+ Vitest, tsc, build, i18n, secret-scan) |

**Sign-off:** RT-01 `SEC-JANURAI-REVERIFY-01` may close for **release posture** with the SAML
dual-gate documented below. XML-DSig implementation remains backlog `SEC-SAML-01` (#529).

## CRITICAL matrix (June 15 → 2026-06-19)

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | SAML assertion signature never verified (#529) | **Mitigated** | Dual flag gate: `SAML_SSO_ENABLED` + `SAML_SIGNATURE_VERIFY_ENABLED` both required; both `false` in `wrangler.toml`; `tests/unit/saml-killswitch.test.ts` |
| 2 | Vote count corruption on presenter advance (#538) | **Closed** | `tests/unit/session-room-vote-flow-advance.test.ts` |
| 3 | Energizer cross-tenant IDOR (#537) | **Closed** | `requireSessionAccess` on energizer routes; `tests/integration/energizers.test.ts` |
| 4 | Duplicate migration numbers (#530) | **Closed** | `ops/ci/check-migration-numbers.sh` |
| 5 | Missing deploy health check (#531) | **Closed** | `.github/workflows/ci.yml` staging + prod `/api/admin/health` |

## Remediation shipped this cycle

### SEC-SAML-01 — dual kill-switch (P0)

- Added `SAML_SIGNATURE_VERIFY_ENABLED` (`FlagName`, `Env`, `wrangler.toml`).
- SAML routes serve traffic only when **both** flags are `'true'`.
- `scripts/ci-doctor.sh` fails if either SAML flag is `true` in `wrangler.toml`.

### DO energizing phase alignment (P1)

- `POST /init` accepts `initialStatus: 'energizing' | 'live'` from session lifecycle.
- DO stores `K_STATUS = energizing`; questions queued but `K_QUESTION` unset.
- WS `init` snapshot: `session.status = energizing`, `question = null`.
- Votes and presenter navigation rejected with `energizing` error code during warm-up.
- `POST /transition-to-live` on DO: `energizing → live`, broadcasts `session_energizing_complete` + first `question`.
- Tests: `tests/unit/session-room-energizing-phase.test.ts`.

### Jankurai CI parity (P1)

- `ops/ci/jankurai.sh` aligned with `.github/workflows/jankurai.yml` (ratchet, proofbind, security, migrate).

### Supply chain (P2)

- `wrangler` bumped to `^4.102.0` (undici/miniflare advisory chain).

## Residual (non-blocking)

| Item | Severity | Owner |
|------|----------|-------|
| XML-DSig implementation for SAML | High (code) / none (prod default) | backend + security |
| Marketing promise gaps (SOC 2 copy, etc.) | Compliance | marketing (`PROMISE_AUDIT_QUICK_REFERENCE.md`) |
| DR Gap 1/2 (KV export, R2 cadence) | Ops | devops (`OPS-DR-GAP-*`) |

## Proof commands

```bash
npm run typecheck
npm test -- --run
npm run build
npm run check:i18n
bash ops/ci/secret-scan.sh
bash ops/ci/check-migration-numbers.sh
npm test -- --run tests/unit/saml-killswitch.test.ts
npm test -- --run tests/unit/session-room-energizing-phase.test.ts
bash scripts/ci-doctor.sh
```

## Sign-off

| Role | Outcome | Date |
|------|---------|------|
| Security | CRITICAL exploitable count = 0 on default config; SAML dual-gate enforced | 2026-06-19 |
| Tester | Regression tests added for SAML gate + DO energizing phase | 2026-06-19 |
