---
id: BACKLOG_ACTIVE
type: planning
domain: product
category: backlog
status: active
version: 1.1
created: 2026-06-19
updated: 2026-07-14
tags:
  - backlog
  - release-train
  - active-work
relates_to:
  - BACKLOG_MASTER
  - RELEASE_TRAIN_MASTER
  - AGENT_PREDICTABILITY_SCORECARD
  - ROADMAP_FULL
  - ADR-0064-demand-evidence-adversarial-validation-gates
  - SPRINT99_EXECUTION
---

# Qesto — Active Backlog (Release Trains)

_Hub: [Documentation map](../../README.md)._

**Planning truth for agents:** Read **this file** for committed work. Cadence contract and horizon map: [`RELEASE_TRAIN_MASTER.md`](../planning/RELEASE_TRAIN_MASTER.md). [`BACKLOG_MASTER.md`](./BACKLOG_MASTER.md) is the historical archive + regression contract; do not treat its sprint registries as open work.

**Cadence:** 2-week **release trains** (`RT-YYYY-MM`; solo operator + AI agents). Target **40–60 product pts** per train. Closeout date = merge date on `main`. One merge = one story ID where possible ([`CLAUDE.md`](../../../CLAUDE.md) hooks + quality gates).

**Current GA:** `7.0.0` (S99). Horizon: v7.1 after RT-01 + RT-02.

---

## RT-01 — Stabilize (`RT-2026-06`) — **CLOSED 2026-07-14**

**Goal:** Close S99 operational gaps, restore CI truth, and clear security/process debt before new features.

**Closeout (2026-07-14, per [`BACKLOG_AUDIT_2026-07-14.md`](../../quality/audits/BACKLOG_AUDIT_2026-07-14.md)):** target close was 2026-07-03; closed 11 days late at the last merge on `main`. **P0 exit exception recorded:** the "CI green rate 100%" criterion remains blocked on GitHub billing (external, not engineering) — PO accepted closure with `OPS-CI-RUNNER-01` carried into RT-02. Remaining operator actions (S99 AE table row, DR prod first-run) are tracked as carry-over, not train blockers. Open/in-progress stories below are carried into RT-02 (see "Carry-over from RT-01").

**Train capacity:** ~45 pts (product + ops).

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `OPS-CI-RUNNER-01` | 5 | P0 | devops | **Blocked (billing) → carried to RT-02** | GitHub billing fix required; local gates green + connect-scale flake fixed — [`CI_RUNNER_STATUS_2026_06_19.md`](../../operations/CI_RUNNER_STATUS_2026_06_19.md) |
| `OPS-GIT-HOOKS-01` | 3 | P0 | devops | **Done** | `just hooks` installs `core.hooksPath`; pre-push lanes verified (`scripts/test-pre-push-hook.sh`) |
| `SEC-JANURAI-REVERIFY-01` | 8 | P0 | security + tester | **Done** | [`JANURAI_REVERIFY_2026_06_19.md`](../../security/JANURAI_REVERIFY_2026_06_19.md) — CRITICAL-5 re-tested; 4 closed, SAML dual-gate |
| `VALID-ADR-0064-ACCEPT` | 3 | P0 | PO + architect | **Done** | ADR-0064 accepted 2026-06-19; EPIC-VALID eligible for train commit |
| `OPS-DR-GAP-01` | 8 | P1 | devops + backend | **Done (code)** | [`DR_KV_EXPORT_BACKUP.md`](../../operations/DR_KV_EXPORT_BACKUP.md) + weekly Worker cron; prod first-run pending |
| `OPS-DR-GAP-02` | 8 | P1 | devops + backend | **Done** | [`DR_SNAPSHOT_CADENCE.md`](../../operations/DR_SNAPSHOT_CADENCE.md) — 30s DO alarm → R2 |
| `OPS-S99-CLOSEOUT-01` | 5 | P0 | devops + PO | **Done (automation)** | [`OPS_S99_CLOSEOUT_EVIDENCE.md`](../../operations/OPS_S99_CLOSEOUT_EVIDENCE.md) + `scripts/smoke-platform-v7.mjs` in CI; AE table pending operator |
| `MKTG-V70-GA-COPY-01` | 3 | P1 | marketing | **Draft → carried to RT-02** | [`MKTG_V70_GA_ANNOUNCEMENT.md`](../../marketing/MKTG_V70_GA_ANNOUNCEMENT.md) — PO sign-off before publish |

### RT-01 exit criteria (as closed, 2026-07-14)

- [ ] CI green rate 100% on last 10 `main` pushes — **waived at closeout** _(blocked: GitHub billing, external; criterion transfers to `OPS-CI-RUNNER-01` in RT-02 — [`CI_RUNNER_STATUS_2026_06_19.md`](../../operations/CI_RUNNER_STATUS_2026_06_19.md))_
- [x] Janurai CRITICAL exploitable = 0 on default prod — [`JANURAI_REVERIFY_2026_06_19.md`](../../security/JANURAI_REVERIFY_2026_06_19.md)
- [x] ADR-0064 accepted
- [x] S99 DoD ops items (#18–22): engineering scope closed in [`SPRINT99_EXECUTION.md`](../releases/SPRINT99_EXECUTION.md) — automation + docs shipped (`OPS-S99-CLOSEOUT-01` Done). _Residual: AE table row is a manual operator action, XR device lab optional — both tracked as RT-02 carry-over notes, not engineering work._

---

### RT-01 addendum — Architecture hardening (REFACTORING_AUDIT)

**Goal:** Convert the audit's High findings into CI ratchets so debt can only shrink. Rails + first
fix land in RT-01; burn-down is funded across RT-02→RT-03. Refs:
[`REFACTORING_AUDIT_2026-07-08.md`](../../quality/audits/REFACTORING_AUDIT_2026-07-08.md), [`REMEDIATION_PLAN.md`](../../quality/audits/REMEDIATION_PLAN.md),
ADR-0068/0069/0070.

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `ARCH-RATCHET-01` | 5 | P0 | architect + backend | **Done** | 3 ratchet gates (`check-ai-gateway`/`check-d1-access`/`check-error-response`) wired into `quality-gates.sh` + `check:rc`; `errorResponse()` + `runAI()` added; `sovereign.ts` migrated (error baseline 610→603); ADR-0068/0069/0070 accepted |
| `ARCH-ERROR-BUILDER-MIGRATE-01` | 8 | P1 | backend | In progress → carried to RT-02 | `check-error-response` baseline now **324** (610→480→324; latest batch 2026-07-14 incl. audit-fix returns). Tricky sites (variable msg, `denyFeature()`, `details`) remain |
| `ARCH-MEDIUM-CLEANUP-01` | 5 | P1 | backend | **Done** | Vectorize dedup (`lib/ai/embed-query.ts`), Env-narrowing (integrations/billing → `Pick<Env,…>`), dual-auth consolidation (`lib/authz-helpers.ts`), `lib/stripe-client.ts` extracted from billing |
| `ARCH-AI-GATEWAY-MIGRATE-01` | 8 | P1 | ai-engineer | **Done (2026-07-14)** | All inference routes through the `runAI()` gateway facade — verified by [`CORE_FEATURES_AUDIT_2026-07-14.md`](../../quality/audits/CORE_FEATURES_AUDIT_2026-07-14.md) §1; `check-ai-gateway` baseline down to **3** (facade internals only); eval suite green |
| `ARCH-REPO-LAYER-01` | 13 | P1 | backend + architect | In progress → carried to RT-02 | Slices done: `lifecycle.ts` → `sessionLifecycleRepository`/`sessionLifecycleService`; gallery D1 queries → repository (2026-07-12, ADR-0069 ratchet). `check-d1-access` baseline **313**. Remaining: `billing.ts`, `integrations.ts` |

---

## RT-02 — P1 UX debt / dashboards (`RT-2026-07`; target close 2026-07-31) — **ACTIVE**

**Goal:** Ship the user-facing half of v7 backends deferred from S93–S95. **No new trust boundaries.**

**Precondition:** RT-01 closed 2026-07-14 with recorded P0 exception (CI blocked on GitHub billing — external). Original target close 2026-07-17 is not reachable with all P0 stories still Open; reset to **2026-07-31** (within the 2–3-week train rule, counted from actual RT-01 closeout).

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `FE-PULSE-DASHBOARD-01` | 13 | P0 | frontend | Open | HR dashboard consumes `GET /api/teams/:id/pulse/summary` + trends; k-anon masking visible |
| `FE-COPILOT-PANEL-01` | 13 | P0 | frontend | Open | Live session co-pilot side panel; plan approve/dismiss wired to existing API |
| `FE-LEARN-INSTRUCTOR-UI-01` | 13 | P0 | frontend | Open | Instructor screen for `POST /api/learn/instructor/analytics` (backend shipped S95) |
| `PULSE-AI-NARRATION-01` | 8 | P1 | ai-engineer | Conditional | Workers-AI trend narration; `npm run test:eval` green (REV-10) |
| `I18N-PULSE-COPILOT-01` | 3 | P1 | i18n | Open | New dashboard/panel strings in 5 locales; `check:i18n` green |

### Carry-over from RT-01 (accepted at RT-01 closeout, 2026-07-14)

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `OPS-CI-RUNNER-01` | 5 | P0 | devops | **Blocked (billing)** | GitHub billing fix (external); then CI green rate 100% on last 10 `main` pushes — inherits the waived RT-01 exit criterion |
| `MKTG-V70-GA-COPY-01` | 3 | P1 | marketing | Draft | [`MKTG_V70_GA_ANNOUNCEMENT.md`](../../marketing/MKTG_V70_GA_ANNOUNCEMENT.md) — PO sign-off before publish |
| `ARCH-ERROR-BUILDER-MIGRATE-01` | 8 | P1 | backend | In progress | `check-error-response` baseline ≤ 324 and falling; tricky sites (variable msg, `denyFeature()`, `details`) migrated or documented as exceptions |
| `ARCH-REPO-LAYER-01` | 13 | P1 | backend + architect | In progress | `billing.ts` + `integrations.ts` D1 access behind repositories; `check-d1-access` baseline < 313 |

_Operator (non-engineering) residuals from RT-01: AE table row for S99 closeout; DR KV-export prod first-run. Owner: operator; no story points._

### RT-02 addendum — Committed criticals from audit reconciliation (2026-07-14)

Promoted by PO decision 2026-07-14 (commit criticals only; the rest goes to [Audit triage](#audit-triage--pending-po-promotion-2026-07-14)). Source: [`BACKLOG_AUDIT_2026-07-14.md`](../../quality/audits/BACKLOG_AUDIT_2026-07-14.md).

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `KB-BILLING-COPY-01` | 3 | P0 | knowledge + marketing | Open | Residual fabricated "5-day downgrade" claim removed everywhere: `help/billing.md` FAQ (§"What happens to my sessions if payment fails?") + 4 seed entries in `functions/api/seed/help-documents.json`; copy states the real Stripe dunning flow (as the rewritten §Failed Payments already does); `HELP_VECTORIZE` re-seeded — [`KB_COVERAGE_AUDIT_2026-06-21.md`](../../quality/audits/KB_COVERAGE_AUDIT_2026-06-21.md) CRITICAL #1 |
| `GDPR-RETENTION-CLAIM-01` | 5 | P0 | PO + backend | Open (needs PO decision) | Consent copy in all 5 locales promises a 30-day purge with no enforcing cron (verified again 2026-07-14: no purge job in `worker/`). Either (a) build the auto-redaction cron matching promised windows, or (b) reword consent copy + pricing-matrix framing. Promoted from [`BACKLOG_MASTER.md`](./BACKLOG_MASTER.md) (raised 2026-06-20) |
| `MKTG-TEMPLATE-PIPELINE-FIX-01` | 8 | P0 | backend + ai-engineer | **Done (2026-07-12)** | Retroactive row for shipped work: MKTP-001..016/018/019 from [`MARKETING_TEMPLATE_PIPELINE_AUDIT_2026-07-12.md`](../../quality/audits/MARKETING_TEMPLATE_PIPELINE_AUDIT_2026-07-12.md) fixed in commit `6335af3` — real question text in generation, working email-capture "use template" flow, fail-closed anonymisation gates, draft-first publish, D1 template registry (migration 0079). Open residue: MKTP-017/020 (LOW → triage) |

### RT-02 exit criteria

- [ ] P0 UI stories demo-able end-to-end on staging
- [ ] No new ADR required (consumes existing PULSE/COPILOT/LEARN APIs)
- [ ] `just check` green before merge to `main`
- [ ] Predictability ≥ 65 per [`AGENT_PREDICTABILITY_SCORECARD.md`](../../ai-context/research/AGENT_PREDICTABILITY_SCORECARD.md)

---

### RT-02 addendum — Platform audit findings (PLATFORM_AUDIT_2026-07-08)

**Goal:** Backlog items from the four-dimension platform audit. These are foundational (ops, quality, marketing, KB) and unblock RT-03. Refs: [`PLATFORM_AUDIT_2026-07-08.md`](../../quality/audits/PLATFORM_AUDIT_2026-07-08.md).

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `OPS-ALERTS-PAGING-01` | 5 | P0 | devops | Open | Operator paging channel wired: critical alerts from `checkAlert` → Resend email or webhook; runbook acknowledges pager receipt |
| `OPS-PHASE2-OBS-01` | 8 | P1 | devops | Open | Phase-2 infrastructure dashboards: AI-gateway cache hit %, Queues DLQ depth, DO vote-buffer depth, R2 snapshot success rates; integrated into `RELEASE_HEALTH_DASHBOARD.md` |
| `KB-RETRIEVAL-EVAL-01` | 5 | P1 | knowledge | Open | Retrieval-quality eval for `HELP_VECTORIZE` and `KB_VECTORIZE`: golden question→chunk fixture set; recall@k scoring in `tests/eval/`; gated by REV-10 |
| `MKTG-LIFECYCLE-EMAIL-01` | 8 | P1 | marketing | Open | Lifecycle email campaigns on Resend: onboarding sequence + monthly digest; reuse eval-gated content pipeline from LinkedIn; segmentation by plan/engagement |
| `ARCH-PROMPT-MANIFEST-01` | 5 | P1 | architect + backend | Open | Runtime prompt manifest (`functions/api/lib/ai/PROMPTS.md`): map prompt → module → model → eval fixture → version; enforce with `check-prompt-manifest.mjs` in `check:rc` |
| `MKTG-DEMO-WIDGET-01` | 8 | P1 | frontend + marketing | Open | No-signup interactive demo from embed widget + templates library; packaged as landing-page CTA; reuse existing R2 embed assets |
| `ANALYTICS-COHORT-01` | 5 | P1 | analytics | Open | Cohort retention/churn analytics on `sprint19_events`: query endpoints in `analytics-advanced.ts`; cohort-by-signup-date curves; weekly trend chart |
| `KB-STALENESS-CRON-01` | 3 | P2 | knowledge | Open | Agent cron: flag docs with `updated:` >2 release trains old and `status: active`; auto-file for review or archive; removes from KB embed corpus |
## Energizer security boundary — consolidated (audit E-1/E-2, closed)

**Source:** [`CORE_FEATURES_AUDIT_2026-07-09.md`](../../quality/audits/CORE_FEATURES_AUDIT_2026-07-09.md) — 2 CRITICAL findings. Consolidation approved by PO 2026-07-10 ("fix these issues now"); implemented in PR #715.

| ID | Pri | Finding | Resolution | Status |
|----|----|---------|------------|--------|
| `ARCH-ENERGIZER-E1-REST` | CRIT | `GET /energizers/active` returned raw `correct_index` to any authenticated user (no access check); team-quiz REST vote echoed `correct` immediately with re-answer allowed | `GET /active` is now **host-only** (`requireSessionAccess requireOwner`); team-quiz vote stores correctness but never echoes it and rejects re-answers (409, mirrors the WS duplicate rule) | **Done (PR #715)** |
| `ARCH-ENERGIZER-E2-ISOLATION` | CRIT | REST energizer plane 401'd for anonymous participants; REST/D1 vs WS/DO results never reconciled | **DO WebSocket is the single participant-facing plane.** Host REST lifecycle (PATCH activate, `/next`) syncs into the DO (`/energizer-sync`); DO gained emoji_poll/word_cloud answers with an aggregate `optionCounts` read model; JoinPage dropped REST polling for WS-only panels (all 4 lobby kinds); host monitoring reads live results from the DO (`/energizer-state`) with D1 fallback; DO completions mirror back to D1 | **Done (PR #715)** |

**Architecture note:** the host lobby (Launchpad) stays on the authenticated REST plane for draft/edit/activate/monitor; participants — anonymous included — are WS-only. D1 remains config/lifecycle truth; the DO is the live-answer store.

---

## Audit triage — pending PO promotion (2026-07-14)

Open findings from all current audits that are **not** committed to a train. Nothing here is scheduled work until the PO promotes it into a train table with points and an owner. Full reconciliation: [`BACKLOG_AUDIT_2026-07-14.md`](../../quality/audits/BACKLOG_AUDIT_2026-07-14.md).

| Finding(s) | Severity | Source audit | Summary |
|------------|----------|--------------|---------|
| LAYOUT-006..011 | MEDIUM/LOW | [`LAYOUT_RESPONSIVENESS_AUDIT_2026-07-10.md`](../../quality/audits/LAYOUT_RESPONSIVENESS_AUDIT_2026-07-10.md) | Explicitly out of scope of the 07-10 remediation pass (LAYOUT-001..005 fixed) |
| L-1..L-7 | LOW | [`CORE_FEATURES_AUDIT_2026-07-14.md`](../../quality/audits/CORE_FEATURES_AUDIT_2026-07-14.md) | Batched cleanup: `'DEL'+'ETE'` obfuscation, presenter NaN timer, AI-gateway nits, hardcoded model id, Accept-Language cache key, N-insert duplication, alias space |
| MKTP-017, MKTP-020 | LOW | [`MARKETING_TEMPLATE_PIPELINE_AUDIT_2026-07-12.md`](../../quality/audits/MARKETING_TEMPLATE_PIPELINE_AUDIT_2026-07-12.md) | Route-doc mismatch + formulaic template names; no card preview imagery (all higher findings fixed in `6335af3`) |
| Design-system findings | HIGH (UX) | [`DESIGN_SYSTEM_AUDIT_2026-07-01.md`](../../quality/audits/DESIGN_SYSTEM_AUDIT_2026-07-01.md) | Audit-only, nothing remediated: broken type-scale classes render unstyled, 29+ files violate Hard Rule #9 (inline SVG), ~20/59 routes without shared chrome. Partially overtaken by ADR-0071 work — needs re-scoping pass before promotion |
| Jankurai P0/P1 | P0 (tooling) | [`JANKURAI_AUDIT_2026_07_02.md`](../../quality/audits/JANKURAI_AUDIT_2026_07_02.md) | Committed `justfile` is a corrupt symlink breaking every proof lane; owner-map/test-map gaps; tool version skew (policy 1.6.10 vs CI 1.5.1). Advisory, not applied |
| KB coverage MEDIUMs | MEDIUM | [`KB_COVERAGE_AUDIT_2026-06-21.md`](../../quality/audits/KB_COVERAGE_AUDIT_2026-06-21.md) | Help provenance dates, retention stated three ways, frozen CHANGELOG. (Criticals: promoted → `KB-BILLING-COPY-01`; missing RAG topics + README count: verified resolved by the 07-07 seed/README refresh) |
| SEO residuals | MEDIUM | [`SEO_IMPLEMENTATION_COMPLETE.md`](../../marketing/seo/SEO_IMPLEMENTATION_COMPLETE.md) | IndexNow key provisioning (partial), Google Search Console setup (manual, pending) |
| Eval-baseline extension | LOW | [`AI_EVAL_BASELINE.md`](../../operations/monitoring/AI_EVAL_BASELINE.md) | Baseline doc ~5 weeks old; coaching-prompt fixtures added 07-14 (M-6) but the baseline doc itself needs a refresh to the current suite count |
| SECURITY_AUDIT_FINDINGS closure sweep | VERIFY | [`SECURITY_AUDIT_FINDINGS.md`](../../security/reviews/SECURITY_AUDIT_FINDINGS.md) | 2026-05-21 doc still says "In Progress" (~50 High / ~40 Medium queued). Later audits (2026-06 review, 2026-07-08 audit: 0 critical, all H/M fixed) suggest these were superseded — needs a one-pass closure verification + doc status update, not new fixes |
| PEN5-E2 tenancy decision | ARCH | [`SEC_PEN5_01_RESULTS.md`](../../security/SEC_PEN5_01_RESULTS.md) | Unresolved tenancy-model architecture decision from Pentest #5 (2026-06-13); crit/high = 0 otherwise |

_Already committed elsewhere (do not re-add):_ Phase-2 observability gap → `OPS-PHASE2-OBS-01` (RT-02 platform-audit addendum); SAML XML-DSig → `SEC-SAML-VERIFY-01` (Security Follow-ups, P1 SAML-GA blocker); RAG retrieval-quality measurement → `KB-RETRIEVAL-EVAL-01`; KB staleness automation → `KB-STALENESS-CRON-01`.

---

## RT-03 — v7.1 or XR GA (`RT-2026-08`) — **conditional**

**Goal:** One net-new epic slice — **Path A (v7.1 platform)** or **Path B (XR GA)**. Does not open until RT-02 exits and EPIC-VALID gates pass.

**Precondition:** RT-02 P0 green **and** Gates A + D + H from ADR-0064.

### Path decision (PO signs at RT-02 closeout)

Evaluate **all** criteria at RT-03 kickoff. Path B requires **every** B-row to pass; otherwise **Path A only**.

| Criterion | Path A (v7.1 default) | Path B (XR GA) |
|-----------|----------------------|----------------|
| **Live design-partner usage** | N/A | ≥3 partners with **completed beta sessions** (not LOI alone) per [`XR_00_DEMAND_VALIDATION.md`](../planning/XR_00_DEMAND_VALIDATION.md) |
| **Sean Ellis / demand proxy (Gate D)** | Documented for CONNECT/STUDIO polish scope | ≥40% "very disappointed" proxy from partner interviews |
| **Adversarial memo (Gate A)** | `VALID-ADVERSARY-01` answered for v7.1 slice | Separate memo: strongest case XR fails / competitor wins immersive |
| **Engineering risk** | No new trust boundary | XR stays feature-flagged; no new DO protocol changes |
| **Capacity** | ~50 pts fits CONNECT/STUDIO polish + `7.1.0` bump | ~39 pts XR hardening only |

**Decision rule:** If any Path B row fails → commit Path A stories and tag `RT-2026-08-A`. If all pass → Path B and tag `RT-2026-08-B`. PO records decision + date in changelog.

### Path A — v7.1 platform slice (default)

| ID | Pts | Pri | Owner | Acceptance signal |
|----|----:|-----|-------|-------------------|
| `CONNECT-EXPAND-01` | 13 | P1 | frontend | Federation admin flows polish on shipped CONNECT GA APIs |
| `STUDIO-POLISH-01` | 13 | P1 | frontend | Library/suggestion UX edge cases on shipped STUDIO APIs |
| `PLATFORM-v71-RELEASE-01` | 5 | P0 | devops + PO | `7.1.0` release notes + certification delta |

### Path B — XR GA (demand-gated)

| ID | Pts | Pri | Owner | Acceptance signal |
|----|----:|-----|-------|-------------------|
| `XR-SPATIAL-GA-01` | 13 | P1 | frontend | Spatial rendering meets GA perf thresholds |
| `XR-AVATAR-GA-01` | 8 | P1 | frontend | Avatar scale + perf at GA thresholds |
| `FE-XR-LAUNCHER-GA-01` | 8 | P1 | frontend | `beta-xr` default-on for entitled plans |
| `PLATFORM-XR-GA-01` | 5 | P0 | PO + marketing | GA copy; XR no longer labeled beta-only |

### RT-03 exit criteria

- [ ] Path A or B chosen with PO sign-off in changelog
- [ ] Gate A adversarial memo on file and answered
- [ ] ≤1 version bump (`7.1.0` Path A)
- [ ] Predictability ≥ 65 maintained

**Status:** Not committed — promote rows when RT-02 closes.

---

## Security Follow-ups (Audit 2026-07-08)

From the comprehensive security audit conducted 2026-07-08, all HIGH and MEDIUM findings were remediated and shipped. The following LOW/INFO items are documented for future prioritization. See [`knowledge-base/security/SECURITY_AUDIT_2026-07-08.md`](../../security/SECURITY_AUDIT_2026-07-08.md) for evidence and remediation details.

| ID | Severity | Description | Remediation | Priority | Notes |
|----|----|---|---|---|---|
| `SEC-SAML-VERIFY-01` | LOW | SAML assertions are parsed by regex with no XML-DSig verification (currently feature-gated fail-closed) | Implement XML-DSig verification before SAML GA; currently disabled via `SAML_SIGNATURE_VERIFY_ENABLED` flag (both `SAML_SSO_ENABLED` and signature-verify default false in `wrangler.toml`) | P1 (SAML GA blocker) | Location: `functions/api/lib/saml.ts:19–29`; referenced in backlog as BACKLOG-SEC-SAML-01 / #529 |
| `SEC-APIKEY-LIMITER-ATOMIC-01` | LOW | Per-key rate limiter (120 req/min) is a non-atomic read-then-write (TOCTOU); concurrent requests can bypass under burst | Acceptable as soft quota; if tighter enforcement needed, back with DO or CF's native rate-limiting binding | P2 | Location: `functions/api/middleware/public-api-auth.ts:52–67`; impact bounded to modest quota overage; not a security boundary |
| `SEC-DISPLAY-FRAMING-01` | LOW | `/display/*` pages intentionally embeddable (CSP `frame-ancestors *`) but have mixed signals with `X-Frame-Options: SAMEORIGIN` | If interactive controls ever added to display pages, scope `frame-ancestors` to specific embedding origins rather than `*` | P2 (monitoring only) | Location: `public/_headers` (`/display/*` rule); currently safe (no state-changing controls on display pages) |
| `CSRF-INFO-01` | INFO | CSRF validation is permissive when both Origin and Referer headers are absent (deliberate decision documented in code) | No action required; documented follow-up if server-to-server cookie callers are ever added | Monitoring | Location: `functions/api/middleware/csrf.ts:74–99`; residual risk (cookie-bearing non-browser client) is acceptable and documented |

---

## Explicitly not in active scope

| Item | Reason | Promote when |
|------|--------|--------------|
| XR GA (`FE-XR-LAUNCHER` polish, WebGL engine) | Beta only; Path B in RT-03 | RT-02 close + Path B decision table green |
| CONNECT expansion | RT-03 Path A default | RT-02 complete + VALID-ADVERSARY-01 |
| v7.1 epic net-new | Conditional RT-03 | PO path decision at RT-02 closeout |
| Full `BACKLOG_MASTER` historical registries | Delivered / archive | Never auto-promote without PO |

---

## Agent routing (per train)

| Step | Agent | Handoff artifact |
|------|-------|------------------|
| 1 | product-owner | Story ID + AC in this file |
| 2 | architect | ADR only if trust boundary touched (none in RT-02) |
| 3 | frontend / backend / ai-engineer | PR + tests |
| 4 | tester | `npm test` + AC map |
| 5 | security | If auth/AI/federation path touched |
| 6 | knowledge | Update execution doc + this file status |

See [`.claude/skills/HANDOFFS.md`](../../../.claude/skills/HANDOFFS.md) edges E3–E9.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-14 | **Backlog audit & reconciliation** ([`BACKLOG_AUDIT_2026-07-14.md`](../../quality/audits/BACKLOG_AUDIT_2026-07-14.md)): RT-01 closed with P0 exception (CI blocked on GitHub billing); carry-overs moved to RT-02 (`OPS-CI-RUNNER-01`, `MKTG-V70-GA-COPY-01`, `ARCH-ERROR-BUILDER-MIGRATE-01` @324, `ARCH-REPO-LAYER-01` @313); `ARCH-AI-GATEWAY-MIGRATE-01` marked Done (gateway baseline 3, verified by core-features audit); RT-02 target reset to 2026-07-31 and marked Active; criticals committed (`KB-BILLING-COPY-01`, `GDPR-RETENTION-CLAIM-01`); retroactive Done row `MKTG-TEMPLATE-PIPELINE-FIX-01` (commit `6335af3`); new Audit-triage section for all remaining open findings |
| 2026-07-12 | Marketing template pipeline: audit published and criticals/highs/mediums fixed same-day (MKTP-001..016/018/019, commit `6335af3`) — recorded retroactively in the 07-14 reconciliation |
| 2026-07-10 | Energizer security boundary consolidated (audit E-1/E-2, PR #715): `GET /energizers/active` host-only; DO WebSocket is the single participant-facing plane — recorded retroactively in the 07-14 reconciliation |
| 2026-07-08 | RT-02 addendum: added 8 items from [`PLATFORM_AUDIT_2026-07-08.md`](../../quality/audits/PLATFORM_AUDIT_2026-07-08.md) — P0 operator paging, Phase-2 observability dashboards, KB retrieval eval, lifecycle email, prompt manifest CI check, no-signup demo widget, cohort analytics, KB staleness automation |
| 2026-06-19 | Created RT-01 (stabilize) + RT-02 (UX value loop) post S99 audit; `OPS-GIT-HOOKS-01` marked done |
| 2026-06-19 | OPS-S99 closeout: platform smoke in CI, AE runbook, deploy rollback, marketing draft; connect-scale test de-flaked |
| 2026-06-19 | Agent-system aligned to release-train cadence — PO agent/skill, HANDOFFS (E3/E20), architect/cso/release-notes/ai-strategy/marketing/i18n skills, `.claude` hooks + settings + context-preservation now reference trains and point at this file (not the deprecated `SPRINT_PLAN_MASTER.md`) |
