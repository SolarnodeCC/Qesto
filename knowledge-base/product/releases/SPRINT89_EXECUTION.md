---
id: SPRINT89_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
tags:
  - sprint-89
  - v6.0-rc
  - embed
  - pentest-5
  - captions-ga
  - wcag-aaa
  - fedramp
  - sovereign
  - dr-drill
  - soc2
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT81_90_PLAN
  - v6.0.0-rc
  - ADR-0052-fedramp-full-ato-sovereign-data-plane
  - SEC_V60_RC_GATE
  - BACKLOG_MASTER
---

# Sprint 89 — Execution Summary

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S89): **Gov full-ATO path; sovereign tier; AAA GA; v6.0 RC; DR drill.** P0 anchors `RC-V60-RC-01`, `FEDRAMP-ATO-FULL-01`, `COMPLIANCE-SOC2-ANNUAL-01`. Release: **v6.0-rc**._

_Sixth and final sprint of the 9-day-cadence S85–S90 arc toward v6.0 GA (S90). This is a release-candidate / governance sprint: one focused, gate-blocking code change (EMBED read-plane hardening) plus the compliance and release evidence the v6.0 RC requires._

## Outcome

Sprint 89 cut the **v6.0 release candidate**. The single named code blocker carried
from S88 — the **EMBED read-plane rate limit** (Pentest #5 `PEN5-E1`, ADR-0050 §5,
still unmet in shipped code) — is **closed**, together with the two bundled EMBED
carry-forwards (`E3` handshake re-pin, `E4` opaque token reason). With those landed,
**Pentest #5 overall crit/high remains 0 with no open EMBED availability blocker**, and
the [v6.0-rc security gate **CLEARS**](../../security/SEC_V60_RC_GATE.md).

Around that code change, S89 delivered the governance/compliance evidence the RC needs:
**CAPTIONS GA sign-off** (WER bar, REV-10), **WCAG AAA re-attestation** over the
captions + canvas UIs, **ADR-0052** (FedRAMP full-ATO boundary + sovereign data plane)
with the **FedRAMP full-ATO path** document, the **SOC 2 annual evidence refresh**, and
the **DR drill** establishing **RTO ≤ 2h**. The platform version advances to
**v6.0.0-rc.1**.

Work was delivered by the lead (EMBED hardening + release engineering) and the role
agents (architect → ADR-0052 + ATO path; security → Pentest #5 closeout, RC gate, SOC 2
annual; devops → DR drill) against disjoint file ownership.

**Quality gates:** `tsc --noEmit` clean · full Vitest **1774 green** (205 files) · AI eval gate `npm run test:eval` **86 green** (5 suites) · `npm run build` green · Pentest #5 overall crit/high = 0.

## Delivered

| Story | Pri | Status | Evidence |
|-------|-----|--------|----------|
| `PEN5-E1` (EMBED read-plane rate limit) | P0 | ✅ **RC blocker closed** | `functions/api/middleware/widget-token.ts` — per-`wid`+per-`Origin` KV limiter via `lib/rate-limit.ts` (`EMBED_READ_RATE` 120/60s, `EMBED_HANDSHAKE_RATE` 30/60s), `429 + Retry-After`, `X-RateLimit-*` headers, fail-open on KV error (availability control; the token/origin/revocation checks above remain the security boundary). Keyed `${claims.wid}:${normOrigin}` so a flood on one widget token cannot throttle another tenant. Tests: `tests/unit/embed-rate-limit.test.ts` (4 — 429+Retry-After at cap, cross-tenant isolation, handshake separate/tighter bucket, headers under budget). Satisfies pentest regression **RG-1**. |
| `PEN5-E3` (handshake session re-pin) | P1 | ✅ | `repositories/embedWidgetRepository.ts` — new `fetchEmbedSessionById` (canonical-id only, no `id OR code`); `routes/embed-widget-v1.ts` `/handshake` resolves via `fetchEmbedSessionById(claims.sid)` so a join code colliding with another session's id can't re-point the handshake. |
| `PEN5-E4` (opaque token reason) | P1 | ✅ | `middleware/widget-token.ts` — non-expiry token failures collapse to opaque `invalid_token`; the internal reason enum (malformed / bad_signature / wrong_version / wrong_scope) is no longer reflected into the response. `token_expired` stays distinct for deterministic client re-mint. |
| `RC-V60-RC-01` (v6.0 release candidate) | P0 | ✅ | `knowledge-base/product/releases/v6.0.0-rc.md`; platform version → `6.0.0-rc.1` (`routes/platform.ts` `/version` + `/releases` entry, sprint 89, status rc). |
| `CAPTIONS-GA-01` (WER sign-off) | P0 | ✅ | `knowledge-base/quality/captions/CAPTIONS_WER_SIGNOFF_S89.md` — EN→{nl,es,de,fr} signed off against `CAPTION_WER_BAR=0.25`, enforced by `tests/eval/captions-quality.eval.test.ts` (REV-10). KV/D1 runtime pair-toggle explicitly **deferred** post-GA (would weaken the eval gate; wrong risk for an RC sprint) with rationale documented. |
| `FE-AAA-GA-01` (AAA re-attest) | P1 | ✅ | `knowledge-base/quality/accessibility/AAA_CONFORMANCE_S89.md` — AAA re-attested over captions overlay (~12.7:1 scrim over any theme) + canvas themes; bound held to "core flows + captions/canvas AAA, broader app AA". |
| `ADR-0052` (FedRAMP full-ATO + sovereign data plane) | P0 | ✅ Accepted | `knowledge-base/adr/ADR-0052-fedramp-full-ato-sovereign-data-plane.md` — authorization boundary, control inheritance from Cloudflare's authorized edge, the gap/POA&M set, and the region-pinned sovereign tenant data plane (irreversible D1 location hint, no cross-region replication, federation/egress exclusion). Documented as a path/target, not a granted ATO. |
| `FEDRAMP-ATO-FULL-01` (ATO path) | P0 | ✅ | `knowledge-base/security/FEDRAMP_ATO_FULL_PATH.md` — control-family readiness table mapped to existing Qesto evidence; 3PAO prerequisites; POA&M with sprint owners. |
| `COMPLIANCE-SOC2-ANNUAL-01` (SOC 2 annual evidence) | P0 | ✅ | `knowledge-base/security/SOC2_ANNUAL_EVIDENCE_2026.md` — v6.0-cycle control inventory snapshot + refreshed evidence; internal evidence-tracking artifact, not an auditor report. |
| DR drill (RTO ≤ 2h evidence) | P0 | ✅ | `knowledge-base/operations/DR_DRILL_V6_2026.md` — per-asset recovery (D1/KV/DO/R2/Vectorize/secrets), measured/estimated RTO vs the ≤2h target, RPO analysis, gaps with owners. |
| v6.0-rc security gate | P0 | ✅ CLEARS | `knowledge-base/security/SEC_V60_RC_GATE.md` + `SEC_PEN5_01_RESULTS.md` updated — Pentest #5 crit/high = 0 sustained; EMBED E1/E3/E4 closed; residual Lows + `PEN5-E2` (tenancy-model decision) carried to ADR review, none RC-gating; do-not-co-land discipline confirmed held. |

## Exit-criteria status

- [x] `PEN5-E1` EMBED read-plane rate limit closed in shipped code (per-`wid`+per-origin, `429 + Retry-After`, tenant-isolated), with regression test (RG-1).
- [x] `PEN5-E3` handshake re-pinned to canonical session id; `PEN5-E4` token reason opaque.
- [x] Pentest #5 overall crit/high = 0 sustained; no open EMBED availability blocker; v6.0-rc security gate CLEARS.
- [x] CAPTIONS GA sign-off on EN→{nl,es,de,fr} behind the WER bar (REV-10); eval gate green.
- [x] WCAG AAA re-attested on captions + canvas; bounded claim held.
- [x] ADR-0052 accepted; FedRAMP full-ATO path + sovereign data plane documented (path/target, not granted).
- [x] SOC 2 annual evidence refresh; DR drill RTO ≤ 2h evidence.
- [x] Platform version → `6.0.0-rc.1`; v6.0-rc release notes published.
- [x] `npm test` green (1774); `tsc --noEmit` clean; `npm run build` green; `npm run test:eval` green (86).
- [ ] **v6.0.0 GA** at S90 — certification bundle, DR drill at GA cadence, v5.x sunset notice, PO + security RC sign-off.

## S88 carry-forwards resolved

- **EMBED M-1 (`PEN5-E1`) read-plane rate limit:** ✅ closed — the named v6.0-rc availability blocker is gone.
- **`CAPTIONS-GA-01` WER sign-off:** ✅ delivered (EN→{nl,es,de,fr} behind the bar).
- **AAA re-attestation on new captions/canvas UIs:** ✅ delivered.
- **`RC-V60-RC-01`, `FEDRAMP-ATO-FULL-01`, `COMPLIANCE-SOC2-ANNUAL-01`, DR drill:** ✅ delivered.

## S89 carry-forwards → S90 (v6.0 GA)

- **`PEN5-E2`** — `tid` / `team_id` tenancy *model* decision on the embed plane: a fail-safe divergence (not a leak), carried to ADR review; resolve or amend ADR-0050 at S90. Not RC-gating.
- **Residual Pentest #5 Lows** (`PEN5-D1` devops secret provisioning, `D3`, `D4`, `A2`): backlog/ops, none RC-gating.
- **CAPTIONS runtime pair-toggle** (KV/D1, eval-gate-fenced): post-v6.0 ops enhancement.
- **v6.0 GA (S90):** certification bundle (`PLATFORM-CERTIFICATION-V6-01`), annual DR drill at GA cadence (`DR-DRILL-ANNUAL-V6-01`), v5.x sunset notice, FedRAMP 3PAO engagement prerequisites, and PO + security sign-off on this RC.

## Quality gates line

`tsc --noEmit` clean · Vitest **1774 green** (205 files) · AI eval **86 green** (5 suites) · `npm run build` green · Pentest #5 overall crit/high = 0 (EMBED carry-forwards closed) · compliance claims flagged for `check:compliance-claims`.

---

## DevOps Prerequisites (Deploy S89→S90)

- [ ] `ACTIONS_KV` confirmed bound in production (the embed read-plane limiter degrades open without it — acceptable, but the limiter is only effective when bound).
- [ ] Live-model captions WER spot-check + latency budget (< ~2s) validated against Workers AI before GA (`CAPTIONS-GA-01` §live-model note).
- [ ] EMBED read-plane 429 rate + `embedWidgets` adoption monitored post-deploy (tune `EMBED_READ_RATE` / `EMBED_HANDSHAKE_RATE` against real polling cadence if needed).
- [ ] Sovereign-tier D1 location-hint provisioning runbook reviewed before any sovereign tenant onboard (irreversible — ADR-0052 / ADR-0036).
