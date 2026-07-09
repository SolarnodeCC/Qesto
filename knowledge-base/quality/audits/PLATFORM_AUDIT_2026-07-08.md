---
id: PLATFORM_AUDIT_2026-07-08
type: audit
domain: quality
category: audit
status: active
version: 1.0
created: 2026-07-08
updated: 2026-07-08
tags:
  - platform-audit
  - agents
  - observability
  - marketing
  - knowledge-base
  - rag
relates_to:
  - OBSERVABILITY_AUDIT_2026-06-05
  - KB_COVERAGE_AUDIT_2026-06-21
  - TECH_DEBT_AUDIT_2026-05
  - BACKLOG_ACTIVE
  - ADR-0056-agentic-maturity-l2-copilot
  - ADR-0068-workers-ai-gateway-facade
---

# Qesto Platform Audit — 2026-07-08

**Scope:** Four dimensions — (1) Claude agents & skills integration, (2) internal platform features, (3) external/marketing features, (4) knowledge-base structure & RAG.
**Method:** Static analysis of the repository at commit `c96671f` — code, `.claude/` framework, CI workflows, KB documents, and prior audits. No production telemetry was queried.
**Verdict in one line:** Qesto is an unusually mature solo+AI-operated platform (v7.0 GA, 72 ADRs, 113 D1 migrations, 226 unit test files, layered agent framework with CI-enforced ownership) whose top risks are **operational, not architectural**: CI truth is blocked on GitHub billing, Phase-2 infrastructure has zero observability, alerting has no human-notification channel, and two large in-flight migrations (error-builder, AI-gateway) leave the codebase in a dual-pattern state.

**Maturity scores (1–5):**

| Dimension | Score | Summary |
|---|---|---|
| D1 — Agents & skills | **4.5** | Best-in-class layered framework with CI enforcement; gaps are prompt-registry centralization and a perf/a11y skill split |
| D2 — Internal features | **4.0** | Deep admin/observability surface; Phase-2 blind spots and paging gap pull it down |
| D3 — External features | **3.5** | Strong SEO/compliance foundation, automated LinkedIn; thin social breadth, newsletter segmentation absent |
| D4 — KB & RAG | **4.5** | 476-doc governed KB, manifest-gated Vectorize sync, weekly health cron; retrieval-quality measurement is the open item |

---

## DIMENSION 1 — Claude Agents & Skills Integration

### 1.1 Agent architecture (state: strong)

The L1–L4 framework described in `CLAUDE.md` is real and enforced, not aspirational:

- **17 sub-agents** in `.claude/agents/` (architect, backend, frontend, security/CSO, devops, tester, e2e-tester, PO, analytics, i18n, marketing, sales, market-research, seo-reviewer, ai-strategy, ai-engineer, knowledge) with model tiering (opus/sonnet/haiku) declared per agent.
- **25 skill packs** in `.claude/skills/` including cross-cutting contracts: `COMMON_RULES.md`, `HANDOFFS.md` (role-to-role edges), and `OWNERS.md` (ownership matrix, last reviewed 2026-06-26).
- **CI enforcement:** `scripts/check-claude-config.mjs` verifies every agent/skill file is listed in `OWNERS.md` and every entry maps to a real file. This runs inside `npm run check:rc`. Config drift is therefore build-breaking — rare and commendable.
- **L3 hooks** (`.claude/settings.json`): `pre-bash.sh` (command safety gate), `pre-edit.sh`/`post-edit.sh` (file gates + automation), `on-stop.sh` + `session-metrics.sh` (Stop), and a `PreCompact` context-preservation directive. Session telemetry is reported via `scripts/claude-metrics-report.mjs` (`npm run claude:metrics`).

**Runtime AI (product-side) tool calling** is genuinely agentic and sandboxed:

- **L2 Copilot (ADR-0056):** `functions/api/lib/copilot-tools.ts` defines 8 tools (`cluster_themes`, `detect_anomaly`, `participation_alert`, `recommend_followup`, `suggest_followup`, `draft_poll`, `disengagement_alert`, `pacing_hint`) with **Zod-validated outputs**, aggregate-only inputs, no cross-session reads, no session mutations.
- **Agent sandbox policy** (`lib/agent-safety.ts`, SEC-AGENT-EVAL-01 / ADR-0046): allowlisted tool subsets for L1 vs L2, `maxTurns` cap (≤20), `COPILOT_L2_MAX_STEPS = 5`. Supporting infrastructure: `agent-audit.ts`, `agent-grounding.ts`, `copilot-sandbox.ts`, `copilot-checkpoint.ts`.
- **Admin integration exists:** agents surface in admin routes (`routes/admin/observability.ts`, `ops-control.ts`, `kb-sync.ts`) and marketing tooling (`MarketingDashboard.tsx`, marketing content routes). The `jankurai.yml` workflow runs an autonomous security-verification agent; `daily-repo-status` is an agentic cron.

**Prompt-injection safeguards — verified present at the choke point:**

- All inference routes through `runAI`/`runThroughAIGateway` (`lib/ai/ai-gateway.ts`, ADR-0068), where `lib/ai/prompt-sanitize.ts` strips control chars, zero-width chars, and **bidi override characters**, and bounds lengths (8000 prompt / 2048 embed / 512 sentiment). Gateway HTTP responses are Zod-validated at the boundary (HLT-031).
- Adversarial eval fixtures exist and are CI-gated (REV-10): `tests/eval/fixtures/prompt-injection.json`, `facilitation-injection.json`, `pii-outputs.json`; guards tested in `insights-guards.eval.test.ts`.
- `lib/ai/pii-scrub.ts` plus `check:pii-log` script gate PII leakage into logs.

**Residual risk:** enforcement of "all AI calls go through the gateway" is a **ratchet, not an invariant** — `ARCH-AI-GATEWAY-MIGRATE-01` (RT-01 addendum) is still **Open**, meaning raw `env.AI.run()` sites remain that bypass sanitization/caching. `check-ai-gateway.mjs` holds the baseline but the burn-down is unfinished.

### 1.2 Skills & prompt library (state: strong, one structural gap)

- Skills carry frontmatter (`name`, `description`) **plus** `VERSION` (e.g. `v1.0.0`) and `OWNER` headers; `OWNERS.md` is the manifest; `HANDOFFS.md` defines cross-skill edges. Cross-references exist (e.g. `backend-dev.md` → `backend-integrations.md`, `backend-perf.md`).
- **Gap — two prompt worlds:** the *agent-framework* prompt library (`.claude/skills/`) is centrally managed, but *runtime product prompts* (help RAG, insights, copilot, captions, marketing LinkedIn/YouTube, studio authoring) live scattered across `functions/api/lib/*` modules. They are eval-covered (9 eval suites, golden fixtures) but there is **no central runtime-prompt registry** — no single place listing every production prompt, its model, its version, and its eval fixture. Prompt changes are gated by REV-10 convention, not by a manifest check like `check-claude-config.mjs` provides for skills.

### 1.3 Gaps & recommendations

| # | Recommendation | Effort | Rationale |
|---|---|---:|---|
| R1.1 | **Finish `ARCH-AI-GATEWAY-MIGRATE-01`** and then flip `check-ai-gateway` from ratchet-baseline to zero-tolerance | 8 pts | Until done, injection sanitization is bypassable at un-migrated call sites |
| R1.2 | **Runtime prompt manifest:** `functions/api/lib/ai/PROMPTS.md` (or JSON) mapping prompt → module → model → eval fixture → version, enforced by a `check-prompt-manifest.mjs` sibling of `check-claude-config.mjs` | 5 pts | Closes the drift gap between REV-10 policy and enforcement |
| R1.3 | **Missing skill areas:** performance optimization exists only as `backend-perf.md` (backend-scoped) — no frontend perf/CWV skill; accessibility knowledge is embedded in `frontend-dev.md`/`e2e-tester.md` rather than a dedicated pack despite WCAG-AAA re-attestation work. Consider `perf-web.md` and promoting a11y to a first-class skill | 3 pts | These are recurring release-gate activities without a dedicated knowledge pack |
| R1.4 | **Consolidation:** `market-research.md` + `market-research-templates.md` could merge; `review.md` vs `investigate.md` have overlapping debug/review protocols worth a shared core | 2 pts | Reduce pack count drift |
| R1.5 | **New agent workflow:** automated compliance re-checking — a cron agent that re-runs `check:compliance-claims` + DSA/GDPR doc freshness against `FEATURE_COMPLIANCE_MATRIX.csv` and files issues (pattern already proven by `jankurai.yml` and `daily-repo-status`) | 5 pts | The compliance matrix is a CSV that can silently rot |

---

## DIMENSION 2 — Internal Features

### 2.1 Dashboard & admin (state: strong)

Per `OBSERVABILITY_AUDIT_2026-06-05` (verified against `functions/api/routes/admin/`): **13+ documented admin endpoints** across metrics (`metrics.ts`), KPIs (`kpis.ts`), ops summary (`ops.ts`, `ops-control.ts`), audit (`audit.ts`), growth/journey (`growth.ts`, `journey-events.ts`), advanced analytics (`analytics-advanced.ts`), platform overview, user support, and KB sync. KPIs tracked: live sessions, sessions today/month, total users, AI cost estimate, consent rate, energizer completion/dropout, WS error/reconnect rates, vote-latency p95/p99 (sub-100ms proof endpoint).

**Freshness model:** METRICS_KV 5-minute rolling windows for live data; D1 `metrics_summary`/`sprint19_events` for history; Analytics Engine (`METRICS_AE` binding) for event streaming (68 instrumented event types). Live session state is Durable-Object-native (WebSocket). This is a sound three-tier design.

### 2.2 Realtime observability (state: good foundation, two material gaps)

- **Captured:** structured request logs with `X-Trace-Id` correlation, error tracking, DO tracing middleware (`middleware/do-tracing.ts`), worker tail infrastructure, incident docs (`operations/incidents/` — includes the 2026-04 observability incident and secret runbook, i.e. the historical crawler/token incidents are documented with runbooks).
- **Alerting:** `lib/alerts.ts` evaluates per-route/minute SLO thresholds (p95 > 500ms, error rate > 5%, DO crash → critical) from a scheduled worker.
- **Gap A — no paging channel:** alert output is a WARN log line + Logpush + D1 roll-up. There is **no Slack/email/webhook pager for operators** (the only Slack code is the *product* integration provider in `lib/integrations/providers/slack.ts`). A critical alert at 03:00 reaches no human.
- **Gap B — Phase-2 blind spot (still open):** the 2026-06-05 audit's critical finding stands — AI Gateway cache efficiency, Queues DLQ depth, DO vote-buffer depth, WAF hits, and R2 snapshot/recovery success have **zero dashboards**. `RELEASE_HEALTH_DASHBOARD.md` and the S60–70 proposals doc exist, but the RT backlog does not carry a story closing this.
- **Gap C — thresholds are static v1:** `ALERT_THRESHOLDS` hard-codes values flagged "tune after two weeks of baseline data"; no evidence of the tuning pass.

### 2.3 Users / RBAC (state: strong)

- **AuthN:** magic link (JWT), password, OAuth, and **SAML SSO** (`routes/auth/saml.ts`), plus **SCIM provisioning** (`routes/scim.ts`) and **LDAP** (`routes/ldap.ts`) — well past "local auth only."
- **AuthZ:** permission-based RBAC in `lib/authz.ts` — built-in roles (owner = all, member = session lifecycle + template read, viewer = template read) resolved to granular permissions (`team:manage_members`, `session:create/update/launch/close/moderate`, …), with dual-auth consolidation in `lib/authz-helpers.ts`. Dedicated `middleware/rbac.ts`, `admin.ts`, `feature-gate.ts`, `plan.ts`.
- **Audit trail:** AUDIT_KV + D1 `audit_events` + `lib/audit.ts`/`audit-query.ts` + admin audit route. Forensics route exists (`routes/forensics.ts`).
- **Minor gap:** built-in roles are coarse (3 tiers); custom-role composition from the permission list is not evident at the API surface.

### 2.4 OPS (state: strong, one external blocker)

- **IaC/config:** `wrangler.toml` is the full environment matrix (D1, 12 KV namespaces, DO, 3 Vectorize indexes, 2 R2 buckets, AE dataset, Workflows) with a staging env block and bootstrap comments.
- **CI/CD:** `ci.yml` + `playwright.yml` + deploy scripts (`deploy-api.mjs` with dry-run, `verify-deploy.mjs`, `smoke-platform-v7.mjs`). The `check:rc` release gate chains 15 checks (config, migrations, KV/D1/AI-gateway access ratchets, error-response ratchet, no-any, typecheck, i18n, help-seed, contrast tokens, baseline, unit, eval, a11y, build). Local/CI parity via `ci-local.sh`, `ci-doctor.sh`, git hooks (`just hooks`).
- **Migrations:** 113 numbered D1 migrations with `.verify.sql` companions and metadata verification (`check-migration-gaps.mjs`, `verify-migration-metadata.mjs`) — schema versioning is gated, not conventional.
- **Secrets:** enforced out of `wrangler.toml`; `SECRET_ROTATION_POLICY.md` + `SECRET_RUNBOOK.md` + `INTEGRATION_SECRETS_PROVISIONING.md` exist. DR is drilled (annual + V6/V7 drills, KV export backup cron, 30s DO→R2 snapshot cadence).
- **Blocker:** `OPS-CI-RUNNER-01` — **CI is blocked on GitHub billing**; RT-01 exit criterion "CI green rate 100% on last 10 main pushes" is unmet. Until restored, every merged PR relies on local gates — the single biggest operational-truth risk in the repo.

### 2.5 Analytics (state: good)

Event pipeline: client/API events → Analytics Engine + D1 `sprint19_events` → admin query routes. **Activation funnel is implemented** (`signup → team_created → first_session_started → first_paid`, 30-day trailing, conversion rates). Engagement per energizer kind, CSV exports, `analytics-funnel.ts`, pulse analytics data model (ADR-0057), analytics-insight intelligence (ADR-0060).
**Gaps:** no retention/churn curves or **cohort analysis** at the admin API surface (funnel is trailing-window, not cohorted); `FE-PULSE-DASHBOARD-01` (RT-02) shows the pulse *UI* half is still open, consistent with a pattern of backend-first shipping.

### 2.6 Cross-cutting

- **Error handling:** single error-builder pattern (ADR-0070, `errorResponse()`); migration in flight — ratchet at 480 remaining sites (from 610). **Dual-pattern state until `ARCH-ERROR-BUILDER-MIGRATE-01` completes.**
- **Logging:** structured, trace-correlated, PII-gated (`check:pii-log`); retention strategy for AE/D1 event tables not documented.
- **Testing:** 226 unit test files, 20 e2e specs, plus stress (DO), a11y (axe), load (k6), and 9 AI eval suites with golden fixtures, and a flaky quarantine file. Coverage tooling exists (`measure-coverage.mjs`); no coverage threshold appears in the `check:rc` chain.
- **Tech debt:** honestly tracked — `TECH_DEBT_AUDIT_2026-05.md`, `REFACTORING_AUDIT` → RT-01 addendum with ratchet gates (ADR-0068/0069/0070). Repo-layer extraction (`ARCH-REPO-LAYER-01`, 13 pts) in progress.

### 2.7 Priority recommendations

| # | Recommendation | Priority |
|---|---|---|
| R2.1 | Resolve GitHub billing / restore CI (`OPS-CI-RUNNER-01`) — everything else inherits risk from this | **P0** |
| R2.2 | Wire an operator paging channel (email via existing Resend, or a webhook) onto `checkAlert` critical results | **P0** |
| R2.3 | Fund a Phase-2 observability story (AI-gateway cache hit rate, Queues DLQ, vote-buffer depth, R2 snapshot success) in RT-02/03 | **P1** |
| R2.4 | Finish the two half-done migrations (error-builder, AI-gateway) before RT-02 feature work widens the dual-pattern surface | **P1** |
| R2.5 | Add cohort retention/churn queries to `analytics-advanced.ts`; data already exists in `sprint19_events` | **P2** |

---

## DIMENSION 3 — External Features (Marketing & Public-Facing)

### 3.1 Website & SEO (state: good, recently hardened)

- The SPA-crawlability problem was found and **fixed at the edge**: `functions/seo-meta.ts` injects per-route title/description/canonical + no-JS `h1`/intro + internal-link block via HTMLRewriter, so crawlers no longer see the homepage on every route. Sitemap route (`seo-sitemap.ts`), OG image generation (`og-image.ts`), `route-seo.test.ts` guarding sitemap coverage, and ADR-0065 (HTML shell SWR edge caching) address CWV/TTFB.
- A dedicated `seo-reviewer` agent + skill exists; `knowledge-base/marketing/seo/SEO_IMPLEMENTATION_COMPLETE.md` records the audit→fix cycle.
- **Competitive positioning:** `/vs/[competitor]` pages are an established pattern (referenced in the seo-reviewer agent trigger), with market-research agent maintaining ICP/competitor source of truth. Positioning assets exist (`EMBED_ICP_AND_POSITIONING.md`, `ACCESSIBILITY_MULTILINGUAL_POSITIONING.md`, `CONVERSION_REVIEW_LANDING_PRICING.md`).
- **Trust signals:** public **GDPR trust page** and **SOC 2 trust page** (`GdprTrustPage.tsx`, `Soc2TrustPage.tsx`) backed by real evidence dirs (`SOC2_TYPE_II_EVIDENCE/`, annual evidence 2026). `check:compliance-claims` guards marketing claims against reality — an unusually strong anti-overclaim control.

### 3.2 Marketing automation (state: automated core, narrow breadth)

- **LinkedIn:** dedicated scheduler worker (`workers/linkedin-scheduler/`), OAuth (`functions/linkedin-auth.ts`), D1 table (`0075_linkedin_posts.sql`), Workers-AI generation with **eval-gated content quality** (`marketing-linkedin.eval.test.ts` + golden fixtures) — production-grade.
- **Video:** R2_VIDEOS bucket, Playwright `marketing-demo` project → `copy-marketing-videos.mjs`, video-assets route, YouTube OAuth (`youtube-auth.ts`) with YouTube golden fixtures. Reddit OAuth exists (`reddit-auth.ts`).
- **Email:** Resend is transactional (auth). **No newsletter/segmentation/lifecycle-sequence infrastructure found** — the marketing skill can write sequences but nothing sends them.
- **Social breadth:** no Instagram/Twitter(X)/TikTok integration. Given a solo operator, this is defensible; the marketing calendar + mentions routes suggest the scaffolding for a broader content calendar already exists.

### 3.3 Product visibility

- **API/developer:** OpenAPI contract (`contracts/openapi/qesto-api.yaml`) with generated types, **public API v1/v2/v3**, API keys, webhooks (+ templates + testing routes), a **Developer Portal page**, partner marketplace/portal/SLA pages, embed SDK with HMAC widget tokens (ADR-0050), and an Embed Playground. Zapier/Make-style connectors: not found — webhooks are the integration story.
- **Pricing:** transparent 3-tier free/starter/team ("Pulse/Signal/Chorus") in `src/config/pricing-matrix.ts`, with the free tier plan-gated in code and the `FEATURE_COMPLIANCE_MATRIX.csv` tracking promise-vs-implementation per tier — pricing honesty is *audited*, which is rare.
- **Community:** no Discord/forum/GitHub-discussions presence found.

### 3.4 Compliance & legal

Privacy page, Legal page, report-content route + `NOTICE_AND_ACTION_SOP.md` and **`DSA_COMPLIANCE_AUDIT_2026.md`** (micro-enterprise transparency posture documented), GDPR data-subject runbook, DPA/SCC template, EU data residency + sovereign data plane (ADR-0052 FedRAMP path), breach route (`breach.ts`), consent logging. This exceeds the compliance bar for the segment.

### 3.5 Recommendations

| # | Recommendation | Priority |
|---|---|---|
| R3.1 | **Lifecycle email:** wire Resend beyond transactional — onboarding sequence + monthly product digest, reusing the eval-gated content pipeline proven on LinkedIn | **P1** (highest-leverage missing channel; owned audience) |
| R3.2 | Interactive demo / template gallery as landing CTA — the embed widget + templates already exist; packaging them as a no-signup demo is mostly glue | **P1** |
| R3.3 | Channel prioritization: double down on LinkedIn (automated, B2B-fit) + SEO `/vs/` pages; defer Instagram/TikTok — no evidence they fit the ICP | **P2** |
| R3.4 | Publish changelog/release notes publicly (release-notes skill exists; KB `CHANGELOG.md` is internal) — cheap trust + SEO signal | **P2** |
| R3.5 | Community: a single public GitHub Discussions space beats zero presence; defer Discord until support volume justifies it | **P3** |

---

## DIMENSION 4 — Knowledge Base & RAG

### 4.1 Current state (state: excellent)

- **476 markdown docs** (458 embedded; `archive/`+`migration/` excluded), organized by domain (product 153, ADR 72, operations 59, quality 39, security 30, …) with a role-based navigation README ("documentation map by role").
- **Governed format:** YAML frontmatter (id/type/domain/category/status/version/created/updated/tags/relates_to) — i.e. docs are **individually versioned and typed**. Authored as an Obsidian vault with an explicit standard (`OBSIDIAN_KB_STANDARD.md`); Notion explicitly banned. Git-versioned by construction.
- **Coverage is self-audited:** `KB_COVERAGE_AUDIT_2026-06-21.md` exists; the audits directory holds 20+ prior audits including promise-to-implementation traceability.

### 4.2 RAG integration (state: strong pipeline, unmeasured retrieval quality)

Three Vectorize indexes (1024-d, cosine, bge-m3): `KB_VECTORIZE` (internal KB search via `kb_search` MCP tool → `kbSearchService.ts`), `HELP_VECTORIZE` (the user-facing help assistant), `DECISIONS_VECTORIZE` (decision memory).

- **Help assistant ("Clippy"):** `POST /api/help/ask` — RAG over 16 curated help docs (`knowledge-base/help/`), Mistral on Workers AI, optional auth with plan scoping, Zod input validation (≤500 chars), 10 req/min rate limit keyed by user/IP, feedback endpoint, conversation KV. Prompt quality is eval-gated (`help-prompt.eval.test.ts`).
- **Freshness:** index updates are **event-driven, not manual** — `kb-sync-on-merge.yml` and `help-sync-on-merge.yml` re-embed on merge to main; a hash-based `.kb-sync-manifest.json` tracks per-file vector counts; commit `c96671f` (yesterday) closed the full-corpus/completeness-gating gap.
- **Health:** `kb:health` compares local manifest vs live Vectorize (dimension + count) with hard exit codes; `vectorize-health.yml` runs Mondays 06:00 UTC on top of the worker's Sunday 03:00 cron watchdog. Drift is detected within a week, worst case.
- **Gap — retrieval quality is not measured:** the pipeline's *plumbing* is verified (counts, dimensions, freshness) but there is no retrieval-relevance eval — no golden question→expected-chunk set scoring recall/MRR for `kb_search` or `/help/ask` retrieval. The eval suite tests prompt/answer quality, not whether the right chunks were retrieved.

### 4.3 Content inventory vs. gaps

| Content type | Status |
|---|---|
| User onboarding | ✅ `getting-started.md`, `participant-guide.md`, `hosting-sessions.md`, session modes, FAQ |
| Admin/ops runbooks | ✅ Extensive (`operations/incidents/RUNBOOKS.md`, session-room recovery, multi-region, DR, secrets) |
| API reference | ✅ OpenAPI contract + Developer Portal; ⚠️ error-code catalog not evident as a doc |
| Troubleshooting | ✅ `help/troubleshooting.md` |
| Compliance docs | ✅ DSA audit, GDPR runbook, DPA/SCC template, privacy help doc |
| Video tutorials | ⚠️ Pipeline exists (Playwright demo recordings → R2); no evidence of a published tutorial library |
| Interactive guides | ❌ Not found (Embed Playground is developer-facing, not user onboarding) |

### 4.4 Organization issues

- **Discoverability:** strong for agents (kb_search + role map) and users (16 help docs + Clippy). The main risk is **scale-induced staleness**: 153 product docs including sprint-era planning; the README's own note to "regenerate counts" hints at manual upkeep. `BACKLOG_MASTER` vs `BACKLOG_ACTIVE` confusion is explicitly managed via banner warnings — good mitigation, but the pattern (historical docs carrying misleading figures, e.g. the 120–194-pt sprint sizes CLAUDE.md warns against) will recur.
- **Duplication:** operations has near-duplicate DR drill docs (`DR_DRILL_V6_2026.md` / `DR_DRILL_ANNUAL_V6_2026.md` / `DR_DRILL_V7_2026.md`) — acceptable as evidence records, but `status:` frontmatter should mark superseded ones and `archive/` should absorb them so they exit the embedding corpus.

### 4.5 Recommendations

| # | Recommendation | Priority |
|---|---|---|
| R4.1 | **Retrieval eval:** golden question→chunk fixture set for `HELP_VECTORIZE` and `KB_VECTORIZE`; score recall@k in `tests/eval/` under the existing REV-10 gate | **P1** |
| R4.2 | **Staleness sweep as a cron agent:** flag docs whose `updated:` is >2 release trains old and whose `status: active`, auto-file for review or archive (removes them from the embed corpus) | **P2** |
| R4.3 | Publish an error-code reference generated from the ADR-0070 `errorResponse()` catalog once the migration completes | **P2** |
| R4.4 | Turn the marketing-demo Playwright recordings into a published tutorial page (R2 assets already exist) | **P2** |

---

## Consolidated top-10 action list

| Rank | Action | Dim | Pri |
|---:|---|---|---|
| 1 | Restore CI (GitHub billing) — `OPS-CI-RUNNER-01` | D2 | P0 |
| 2 | Operator paging on critical alerts (Resend email or webhook from `checkAlert`) | D2 | P0 |
| 3 | Complete AI-gateway migration → make prompt sanitization non-bypassable | D1 | P1 |
| 4 | Complete error-builder migration (480 sites remaining) | D2 | P1 |
| 5 | Phase-2 observability dashboards (cache, DLQ, vote buffer, snapshots) | D2 | P1 |
| 6 | Retrieval-quality eval for both RAG surfaces | D4 | P1 |
| 7 | Lifecycle email on Resend, reusing the eval-gated content pipeline | D3 | P1 |
| 8 | Runtime prompt manifest + CI check (mirror of `check-claude-config.mjs`) | D1 | P1 |
| 9 | No-signup interactive demo from existing embed widget + templates | D3 | P1 |
| 10 | Cohort retention/churn analytics on existing event data | D2 | P2 |

**What NOT to do:** broaden social channels, add Discord, or adopt external prompt-management SaaS — each adds surface a solo+AI operation cannot maintain, and the in-repo, CI-enforced equivalents are already the platform's differentiating strength.
