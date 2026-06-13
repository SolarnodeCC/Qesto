---
id: SEC_V60_RC_GATE
type: security
domain: security
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
tags:
  - v6.0-rc
  - security-gate
  - pentest-5
  - s89
relates_to:
  - SEC_PEN5_01_RESULTS
  - SPRINT85_99_PLAN
  - ADR-0050
  - ADR-0049
  - BACKLOG_MASTER
---

# SEC-V6.0-RC — Release-Candidate Security Sign-off

**Release:** v6.0-rc · **Sprint:** 89 (v6.0-rc) · **Reviewer:** security
**Date:** 2026-06-13 · **Basis:** Pentest #5 (`SEC_PEN5_01_RESULTS.md`), code-verified at the cited file:line.
**Scope:** DOCUMENTATION / SIGN-OFF ONLY — no code modified by this review. The remediation code referenced
below was shipped by the lead in S89 and verified by reading.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · ✅ closed / structurally clean.

---

## Gate decision

> **The v6.0-rc security gate CLEARS.** Pentest #5 overall **crit/high = 0 (sustained)**. There is **no open
> EMBED availability blocker** — the single RC-gating carry-forward (PEN5-E1, read-plane rate limit) is closed
> in shipped code with regression coverage. No finding at any severity blocks the v6.0 release candidate.

The gate condition was defined in `SEC_PEN5_01_RESULTS.md` and `SPRINT85_99_PLAN.md`: *crit/high = 0 by S89,
blocks v6.0 RC; S88 runs the test, S89 must close it.* That condition is met.

| Gate criterion | Required | Actual | Verdict |
|---|---|---|---|
| Pentest #5 overall Critical | 0 | 0 | ✅ |
| Pentest #5 overall High | 0 | 0 | ✅ |
| EMBED availability blocker (PEN5-E1) | closed | closed in shipped code | ✅ |
| EMBED carry-forwards E1/E3/E4 | closed | all 3 closed, code-verified | ✅ |
| Do-not-co-land discipline (ADR-0049 / ADR-0050) | held | held | ✅ |
| Residual Lows | enumerated + dispositioned, none RC-gating | 4 Low + 1 architecture decision, none RC-gating | ✅ |

**Result: CLEARS v6.0-rc.**

---

## EMBED carry-forwards — closed in shipped code

All three EMBED carry-forwards from Pentest #5 are closed and verified by reading the shipped code.

| ID | Sev | What | Shipped evidence (file:line) | Status |
|---|---|---|---|---|
| **PEN5-E1** | 🟡 (availability) | Read-plane per-`wid`+per-origin rate limit (ADR-0050 §5) | `functions/api/middleware/widget-token.ts:90-118` — `rateLimit(c.env.ACTIONS_KV, \`${claims.wid}:${normOrigin}\`, …)`; `EMBED_READ_RATE` 120/60s and tighter `EMBED_HANDSHAKE_RATE` 30/60s (`:28-29`); over budget returns `429` with `Retry-After` + `X-RateLimit-*` headers (`:104-117`); runs AFTER token+origin+revocation so the key components are trusted; fail-open on KV error (documented availability control, `:90-96`). Tests: `tests/unit/embed-rate-limit.test.ts` | ✅ CLOSED (S89) |
| **PEN5-E3** | ⚪ | Handshake re-pin: resolve by canonical id, not the `id OR code` handle | `functions/api/repositories/embedWidgetRepository.ts:153-162` — new `fetchEmbedSessionById(db, id)` (`WHERE id = ?1`, primary-key unique); `functions/api/routes/embed-widget-v1.ts:81` — `/handshake` now resolves via `fetchEmbedSessionById(claims.sid)`. A join code colliding with another session's id can no longer re-point the handshake | ✅ CLOSED (S89) |
| **PEN5-E4** | ⚪ | Collapse non-expiry token failure reasons to opaque `invalid_token` (no oracle) | `functions/api/middleware/widget-token.ts:62-69` — only `expired` stays distinct (`token_expired`) so clients can re-mint deterministically; malformed / bad_signature / wrong_version / wrong_scope all collapse to `invalid_token` | ✅ CLOSED (S89) |

**Build / suite evidence (per S89 lead handoff):** full unit suite 1774 green, `tsc` clean, AI eval 86 green, build green.

---

## Residual findings — enumerated with disposition (none RC-gating)

| ID | Sev | Surface | Disposition | RC-gating? |
|---|---|---|---|---|
| **PEN5-E2** | 🟡 | EMBED | **OPEN — architecture decision, carried to ADR review.** The `tid` token claim is set to the owning user id (`embed.ts:57-59`, `callerTeamId() = user.sub`) while the repository tenant key is `team_id`. Isolation is *enforced* fail-safe on `team_id` (`embedWidgetRepository.ts:89,116`), so this is a model **divergence, not a leak**. No code resolved it this sprint. Owner: qesto-architect + PO — decide the tenancy model OR amend ADR-0050's `tid` definition. | No — divergence not leak |
| **PEN5-D1** | ⚪ | DELIBERATE | Code folds the optional `DELIBERATE_VOTER_SALT` (`deliberate-crypto.ts:81-89`); only the Pages-secret provisioning remains (devops ops, fail-safe byte-identical when absent). | No |
| **PEN5-D3** | ⚪ | DELIBERATE | `verify` returns the live `merkleRoot` pre-close (`deliberate-sessions.ts:257`); root reveals no individual choice. Backlog note. | No |
| **PEN5-D4** | ⚪ | DELIBERATE | `leaf_index` is count-then-insert, non-atomic (`deliberate-ledger.ts:120-124`); display-only — neither tally nor root depends on it. Backlog note. | No |
| **PEN5-A2** | ⚪ | Agent | `auditAgentAction` is fail-safe (never throws) by design (`agent-audit.ts:108-118`); add dead-letter/retry only if durable audit-of-agent becomes a compliance requirement. Backlog note. | No |

**Honest summary:** 0 Critical, 0 High. One Medium (PEN5-E2) remains **open as an architecture decision** — not closed,
not a leak, not RC-gating. Four Lows remain on the backlog/ops track. None block v6.0-rc.

---

## Do-not-co-land discipline — HELD ✅

Per ADR-0049 §"do-not-co-land" (governance / DELIBERATE crypto) and ADR-0050 §"Do-not-co-land discipline" (embed),
the three Pentest #5 surfaces must not bundle into one release. Verified held against shipped code
(detail in `SEC_PEN5_01_RESULTS.md` §"Do-not-co-land discipline"):

- **EMBED** is gated behind the `embedWidgets` entitlement at the mint plane (`embed.ts:67-72`); the read plane mounts
  **no write route** and `scp:'read'` is the only minted scope (`embed-token.ts:71`). There is no widget write scope in v1.
- **Governance GA (DELIBERATE WS board)** and the **agent/copilot** surface are independent code paths. The only
  cross-surface coupling this sprint is the **AI-462 one-way boolean KV flag** (copilot → embed refresh hint,
  `copilot-live-context.ts:51-86`): it carries no data, writes only `'1'`, and is read-and-cleared per session — it does
  not co-land governance and agent state and creates no shared mutable surface.
- The shared anonymity/origin-trust boundary holds across all three: no per-participant identifier crosses any of the
  three read planes (embed aggregate-only, deliberate ledger identity-free, copilot context aggregate-only).

A regression in one surface does not structurally contaminate the others. Discipline confirmed held for v6.0-rc.

---

## Regression-test mapping — RG-1 satisfied

| # | Regression | Expected | Status |
|---|---|---|---|
| **RG-1** | **EMBED flood → 429 + isolation** — flood the read plane with one valid token | `429 + Retry-After` over budget; one token's flood does not throttle another tenant's token | ✅ **SATISFIED by `tests/unit/embed-rate-limit.test.ts`** — 4 tests: (1) 429 + `Retry-After` at the read cap, (2) cross-tenant isolation (flooding `wid_a` leaves `wid_b` at 200), (3) handshake on a separate, tighter bucket from the read GETs, (4) standard `X-RateLimit-*` headers under budget |

The remaining Pentest #5 regression asks (RG-2…RG-12, `SEC_PEN5_01_RESULTS.md` §"Regression-test asks for QA") are tracked
with QA; none are RC-gating and none cover a crit/high finding.

---

## Sign-off

| Field | Value |
|---|---|
| Gate | v6.0-rc security |
| Decision | **CLEAR** (crit/high = 0; no open EMBED availability blocker) |
| Open Medium | PEN5-E2 (architecture decision, carried to ADR review — not a leak, not RC-gating) |
| Open Low | PEN5-D1 (ops), PEN5-D3, PEN5-D4, PEN5-A2 (backlog) |
| Reviewer | security |
| Date | 2026-06-13 |

No code was modified in this sign-off (documentation-only scope).
