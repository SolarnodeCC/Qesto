# Qesto Platform Review — Features, Improvement Backlog & Strategic Alignment

**Date:** 2026-06-09
**Scope:** Full website/codebase review — solution features, architecture runway, AI alignment, security
**Sources:** Codebase as of Sprint 82+ (`src/`, `functions/api/`, `worker/`), knowledge base (roadmap, 48 ADRs, BACKLOG_MASTER, tech-debt audit 2026-05, Jankurai security audit 2026-05-21), fresh read-only security and AI reviews performed for this report
**Audience:** Product/technology strategy — informs prioritization decisions for the S81–S90 expansion arc

---

## 1. Overview of Current Qesto Features

Qesto is at **v5.0 GA** (Sprint 80 complete, post-S80 Townhall epic shipped). It is a mature platform, not an early-stage product.

### Core session platform
- **Session lifecycle:** DRAFT → (ENERGIZING) → LIVE → CLOSED → ARCHIVED, with draft configuration over REST and live state in a per-session Durable Object (ADR-0001), protocol-versioned WebSocket messaging (ADR-0005), debounced broadcasting, periodic D1 flush, and R2 snapshots for crash recovery.
- **Question types (9 in code):** poll, ranking, consent, open, multi-select, Likert, upvote, word cloud, slider.
- **Energizers (4 types):** emoji poll, quick finger, team quiz, word cloud — configured in DRAFT, run in ENERGIZING.
- **Session modes (6):** standard polling, townhall (moderated anonymous Q&A with upvoting and host queue), stage (slide-driven events), retro (went-well/improve/actions columns), ideate (idea submission, voting, clustering), event agenda.
- **Anonymity modes:** none / partial / full / zero-knowledge (client-side encryption; AI features structurally excluded at the write boundary).

### Platform & enterprise
- **Auth (5 methods):** magic link, password, Google/Microsoft OAuth, SAML SSO; plus SCIM and LDAP/Salesforce sync. JWT with dual-secret rotation and a server-side revocation list.
- **Teams & RBAC:** owner/admin/member/viewer/guest plus D1-backed custom roles with permission matrices (ADR-0004).
- **Billing:** Stripe (free/starter/team tiers, EUR pricing, checkout + portal + webhooks), plan-gated features as code, marketplace partner billing on Stripe Connect.
- **Integrations:** Slack, Microsoft Teams, Zoom (skeleton), Salesforce, Notion, LinkedIn (WIP) — AES-GCM-encrypted OAuth tokens (ADR-0008), circuit breakers on all external calls (ADR-0007).
- **Compliance:** GDPR export/deletion automation, consent audit trail, EU residency enforcement, SOC 2 Type I framework, DPA/SCC templates, FedRAMP Moderate path documentation, zero-knowledge anonymity (ADR-0010).
- **Multi-region:** reads + writes GA (ADR-0022/0027/0036).
- **Public API:** v1–v3 for partners, federation trust model (ADR-0033), PWA offline + push (ADR-0034).

### AI surface (Workers AI only — no external LLM egress, per ADR-0006)
Twelve distinct capabilities: AI question wizard (SSE streaming, refinement loop, confidence scoring, multilingual), post-session insights/theme extraction (two parallel implementations), RAG help assistant, live facilitator copilot (suggest / multi-turn / draft-poll), sentiment analysis (DistilBERT, k≥5 aggregate-only), three Vectorize indexes (decisions, help, KB — all bge-m3, 1024d), agent grounding and an agent safety sandbox, plus an AI Gateway choke point that is **coded but not wired**.

### Frontend & quality infrastructure
- React + TypeScript (strict mode, `no-any` CI gate), Tailwind v4, dark mode, i18n in 5 languages (EN/NL/ES/DE/FR) with CI validation, accessibility tooling (axe-core suite, skip links, aria-live), admin dashboard with users/analytics/ops tabs, audit log viewer.
- ~29k LoC frontend, ~45k LoC backend, ~27k LoC tests (183 unit test files, Playwright E2E, k6 load, axe a11y), 78 D1 migrations.

---

## 2. Key Strengths and Weaknesses

### Strengths
1. **Defensible architecture moats.** Edge-native latency (DO per session), privacy-by-default (Workers AI only, zero-knowledge mode, EU residency), and a genuine data flywheel (cross-session Vectorize similarity + KB RAG grounding) that competitors cannot trivially copy.
2. **Verified security fundamentals.** Parameterized D1 everywhere, constant-time JWT comparison with revocation, server-derived WebSocket identity (no client spoofing of roles), Zod validation on 264+ boundaries, CSRF fail-closed, Stripe signature verification with idempotency, CSV formula-injection mitigation, no `dangerouslySetInnerHTML` in the frontend.
3. **Operational resilience patterns.** Circuit breakers on Stripe/Resend/AI/JWKS, timeouts with bounded retries, deterministic AI fallbacks, structured logging with PII sanitization CI gate (ADR-0009), queues with DLQ.
4. **Strong governance.** 48 ADRs, quantified tech-debt register, archived sprint traceability, compliance-claims CI gate that blocks marketing copy without evidence.
5. **Above-average AI engineering on structured paths.** Wizard, insights, and copilot-suggest all Zod-validate model output with repair logic; embedding inputs are sanitized; AI features are consistently plan-gated and rate-limited; AI transparency metadata is surfaced to users.

### Weaknesses
1. **Revenue-critical billing gap.** Stripe subscription lifecycle webhooks are effectively no-ops (`findUserByCustomerId()` hardcoded to `null`) — cancelled customers retain paid entitlements indefinitely.
2. **SSO is exploitable as built.** SAML assertions are regex-parsed with no XML signature verification — an authentication bypass if SSO is enabled for a tenant.
3. **The highest-risk AI surface is the least protected.** Participant free-text flows into insights prompts unsanitized (prompt-injection), anonymity mode never reaches the insights context (re-identification via verbatim excerpts), and there is no consent re-check at generation time. The sanitization utility exists — it simply isn't applied on this path.
4. **Duplication debt at the core.** Two parallel insights implementations with different caches/audit behavior; three validation modules; SessionRoom remains a ~2,2k-line god object despite partial handler extraction; 35 type-unsafe D1 casts; a migration-sequence gap (0016→0020→0042).
5. **Quality signal gaps.** No AI eval harness (prompt/model changes ship without quality regression evidence), AI Gateway and latency-budget enforcement inert, no SIEM alerting pipeline, ~15 files still pending input-validation remediation from the Jankurai audit, several half-finished features (Zoom skeleton, LinkedIn posting, PWA inbox placeholder, unused `gdpr_audit_log` table).

---

## 3. Improvement Backlog — 50 Actionable Ideas

IDs are `REV-NN` for traceability. Effort: S (≤3 pts), M (5–8 pts), L (≥13 pts). Items were checked against BACKLOG_MASTER, COMPETITIVE_EPICS, and the S81–S90 plan to avoid duplicating committed work; where an item completes a known open finding (Jankurai, TD-register), the source is cited.

### HIGH priority (17) — revenue integrity, exploitable security, AI ship-gates, structural debt

| ID | Idea | Detail | Effort |
|---|---|---|---|
| REV-01 | Fix Stripe customer→user reverse index | `functions/api/routes/billing.ts:693-707` — implement D1 `stripe_customer_id` lookup so `customer.subscription.created/updated/deleted` webhooks actually apply plan changes. Today cancelled customers keep paid entitlements forever. | M |
| REV-02 | Add Stripe webhook replay window | `billing.ts:493-507` parses the `t=` timestamp but never checks it. Reject events where `abs(now − t) > 300s` before accepting the signature. | S |
| REV-03 | Verify SAML assertion signatures (block SSO GA) | `functions/api/lib/saml.ts:79-112` — regex parsing, no XML-DSig check. Verify against the per-tenant IdP certificate before trusting NameID/email; keep SSO gated until done. | L |
| REV-04 | Sanitize participant text before insights prompts | `lib/ai-insights.ts:79-112` interpolates raw `openResponses` into the prompt. Apply the existing `lib/ai/prompt-sanitize.ts` to every response and wrap them in an untrusted-data delimiter block. Closes the top prompt-injection hole. | S |
| REV-05 | Make insights anonymity-aware + PII-scan theme examples | Thread the session's `anonymityMode` into `InsightsInput`; when full/zero-knowledge, instruct abstraction and run the `agent-safety` PII regex over `themes[].examples[]`, dropping re-identifying excerpts. | M |
| REV-06 | Re-check GDPR consent at insight generation time | Insights run hours after close over participant text with no consent re-validation (known "consent drift" risk). Verify consent state in `register-analyze.ts` before inference. | S |
| REV-07 | Consolidate the two insights implementations | Retire the AI call in `routes/insights.ts`; standardize on `routes/ai-insights/register-analyze.ts` (audit + RAG + Vectorize). One cache store, one TTL, one place to apply REV-04/05/06. | M |
| REV-08 | Validate help-assistant output with groundedness refusal | `lib/help-rag.ts:208` returns raw model text. Add a Zod envelope and force the canned "contact support@qesto.cc" answer when no sources were retrieved — removes the only AI path shipping unvalidated text under the Qesto brand. | S |
| REV-09 | Wire the AI Gateway | `lib/ai/ai-gateway.ts` has `gatewayId: null` — semantic caching (−40–70% latency, −30–50% cost per ADR-042) and per-account rate limiting are coded but inert. Provision the gateway ID via secret. | S |
| REV-10 | Stand up an AI eval harness with a golden set | ~20–30 fixed cases in `tests/eval/`: wizard schema pass-rate, theme relevance, help groundedness, injection-resistance (REV-04 attack strings). Gate all prompt/model/rerank changes on it. Required by the AI plan's L3 evaluation competency. | M |
| REV-11 | Harden anonymous voter identity | `lib/voter.ts:33-50` falls back to client-controlled `x-forwarded-for` and includes a spoofable fingerprint header — enables vote-dedup bypass and join floods. Trust only `cf-connecting-ip`. | S |
| REV-12 | Shorten session credential lifetime | 14-day JWT/cookie with `SameSite=None` (`routes/auth/cookie.ts`) — reduce to 24–72h with refresh/idle timeout; the revocation list already supports this. | M |
| REV-13 | Finish Jankurai Phase 2 input-validation remediation | 15 files with unchecked boundary casts remain open (admin.ts, integrations.ts, ai-insights routes, JoinPage.tsx, useLiveSession.ts, …). Replace `as any` with `validateData(input, Schema)`. | M |
| REV-14 | Complete SessionRoom decomposition (TD-01) | Handlers are partially extracted but the DO remains a ~2,2k-line god object. Extract `EnergizerManager`, `VoteProcessor`, `RateLimiter` as collaborator classes per the tech-debt audit. | L |
| REV-15 | Type-safe D1 query layer (TD-02) | Replace the 35 `as any` D1 casts with a generated typed query layer (drizzle-orm or d1-orm) — eliminates a recurring class of runtime shape bugs. | L |
| REV-16 | Reconcile the migration sequence (TD-03) | Gaps at 0016→0020→0042. Write reconciliation migrations and a CI check that asserts a contiguous, replayable migration chain. | M |
| REV-17 | Wire a SIEM alerting pipeline | No alerting today (open audit gap). Cloudflare Logpush → SIEM with alerts on auth anomalies, circuit-breaker opens, webhook failures, and `agent.safety.block` events. | M |

### MEDIUM priority (18) — hardening, consistency, product polish with clear payback

| ID | Idea | Detail | Effort |
|---|---|---|---|
| REV-18 | Nonce-based CSP | `public/_headers` allows `script-src 'unsafe-inline'` everywhere. Move to nonce/hash-based CSP; scope `frame-ancestors *` strictly to public `/display/*` pages. | M |
| REV-19 | Validate tenant-configured `idpSsoUrl` | `routes/auth/saml.ts:53-60` redirects to an admin-controlled URL with no scheme/host check (open redirect). Enforce `https://` + host allowlist at config time. | S |
| REV-20 | POST-based magic-link exchange | Token currently travels in a GET query string (`auth/magic-link.ts:100-103`) — leak risk via referrer/logs. Exchange via POST, or guarantee a zero-subresource callback page. | S |
| REV-21 | Add HSTS to API responses | `middleware/security-headers.ts` omits `Strict-Transport-Security` on the API origin. One-line fix. | S |
| REV-22 | Team-scoped export permission | Exports are owner-only (`sessions/exports.ts`) even though RBAC defines `session:export` — members with the permission can't export team sessions. Align with `hasTeamPermission`. | S |
| REV-23 | Pre-parse WebSocket frame size cap | `protocol-schemas/helpers.ts:30-40` runs `JSON.parse` before any size bound. Reject frames >16KB first. | S |
| REV-24 | Fix webhook event-record failure handling | `billing.ts:251-271` swallows the idempotency-record insert failure and returns 200 — a latent double-processing risk once REV-01 lands. Return non-200 so Stripe retries. | S |
| REV-25 | Validate copilot `/turn` output | `copilot-context.ts:193` stores raw model text (2000-char slice) with no schema, unlike sibling `/suggest`. Add the same Zod envelope. | S |
| REV-26 | Enforce AI latency budgets | ADR-AI-Latency sets p95 targets (<1s wizard, <2s insights) but nothing asserts them. Add p95 alerts on `ai.inference` Analytics Engine events with a documented degradation path. | M |
| REV-27 | Surface the similar-sessions flywheel in the UI | `register-analyze.ts` already computes `similarSessionTitles`/`kb_sources` then discards them into the prompt. Ship a "this echoes 3 past sessions" panel on Results, gated to Team tier — the cheapest visible differentiation win. | M |
| REV-28 | Insights feedback loop | Add dismiss / thumbs-down(reason) on themes, written to AUDIT_KV and fed into the REV-10 golden set. Moves Team-AI Facilitation from L2 toward L3. | M |
| REV-29 | Backend length bounds on user content | No server-side max length on session titles, question prompts, or poll option labels. Add Zod `max()` bounds (e.g., 200/500/100 chars) in domain schemas. | S |
| REV-30 | Consolidate validation modules (TD-04) | Merge `validate.ts`, `validation.ts`, `validators.ts` into one module with a single error-shape contract. | S |
| REV-31 | Coverage hardening for high-risk files (TD-05) | ~30 untested high-risk files (gdpr-delete-user, cmk, webhook-dlq, api-abuse, multi-region-mutation). Prioritize the GDPR-deletion and billing paths. | L |
| REV-32 | Decompose the 900–1,000 LoC route modules | `integrations.ts` (1,021), `teams.ts` (939), `sessions/wizard.ts` (933) — split per provider / per concern following the established one-operation-per-file pattern. | M |
| REV-33 | Supply-chain gates in CI | Add `npm audit --audit-level=high` to CI and enable Dependabot (open audit gap; currently no automated dependency-vulnerability signal). | S |
| REV-34 | Wire the `gdpr_audit_log` consumer | Table exists with no writer. Log AI consent grants, deletion requests, and export events to it, and expose it in the AuditLogViewer. | S |
| REV-35 | CAPTCHA rollout for public-link events | `JOIN_CAPTCHA_ENABLED` exists but is dormant; the audit flags voter spoofing as acceptable only "before public-link events." Define the trigger (e.g., sessions >500 expected participants) and ship the rollout. | M |

### LOW priority (15) — cleanup, dead code, incremental product value

| ID | Idea | Detail | Effort |
|---|---|---|---|
| REV-36 | Tune KB rerank weights with eval telemetry | `kbSearchService.ts` hardcodes 0.7/0.15/0.15 with a "tune once telemetry exists" comment. Depends on REV-10. | S |
| REV-37 | Shared Vectorize query helper | Three indexes duplicate ~50 LoC of query/threshold logic across `insights-vectorize.ts`, `help-vectorize.ts`, `kbSearchService.ts`. | S |
| REV-38 | Consolidate OAuth state signing | HMAC state-token logic duplicated between `integrations.ts` and `auth/oauth.ts`. | S |
| REV-39 | Base handler for DO mode handlers | townhall/retro/ideate handlers (~392 LoC each) share structure — extract a base class as part of REV-14. | M |
| REV-40 | Finish or remove the Zoom integration | OAuth skeleton only since Sprint 35; no session embed. Decide: complete to parity with Slack/Teams or remove the dead surface. | M |
| REV-41 | Finish or remove LinkedIn auto-posting | Encrypted token storage shipped; posting logic incomplete. Same decision as REV-40. | S |
| REV-42 | Resolve the PWA inbox placeholder | `PwaInboxPanel.tsx` is a non-functional stub. Implement background-sync inbox (PWA3-INBOX-01) or remove it from the UI. | M |
| REV-43 | Wire or delete `ideate-cluster.ts` | Idea-clustering algorithm with no apparent caller in the ideate handler. | S |
| REV-44 | Subresource Integrity on static assets | Low risk for an edge-deployed SPA, but cheap defense-in-depth for the marketing/trust pages. | S |
| REV-45 | Public API token format validation | v1/v2 accept bearer tokens without schema/format checks before lookup — add a strict format gate to cut KV lookups on garbage input. | S |
| REV-46 | Profanity pre-screen for projector surfaces | Reuse the TOWNHALL-12 Workers AI screening for word clouds and open responses on `/display/*` — participant text is shown on shared screens with no filter today. | M |
| REV-47 | Help-assistant answer ratings | Thumbs up/down on help answers, fed to the knowledge steward as a KB-coverage gap report. | S |
| REV-48 | Per-tenant AI cost attribution dashboard | `ai.inference` AE events exist; aggregate per team/feature to operationalize ADR-0032 quota attribution and inform plan pricing. | M |
| REV-49 | Recap export to PDF/PowerPoint | Results currently export JSON/CSV only; facilitators present recaps in decks. Server-side PDF render of the Results view is a frequent-request, low-risk add. | M |
| REV-50 | First-session onboarding checklist + template analytics | Guided checklist (create → add questions → test join → go live) plus instrumentation on which templates convert to live sessions — feeds the activation north-star metric. | M |

> **Addendum 2026-06-10 — low-priority verification & disposition.** Each LOW item was re-verified against the code before execution. Outcomes:
> - **Done in this pass:** REV-37 (shared `lib/embedding.ts:firstEmbeddingVector` replaces three per-file copies; the KB variant gained Zod envelope validation it previously lacked), REV-42 (`PwaInboxPanel.tsx` deleted — it was entirely unreferenced, not just a placeholder), REV-45 (`qesto_[0-9a-f]{32}` format gate added to `middleware/public-api-auth.ts` before hash + KV lookups).
> - **Review corrections — no action needed:** REV-40 (Zoom is NOT a skeleton: ZOOM-COMPLETE-01 shipped OAuth, token refresh, and session-close chat posts in Sprint 40; only `verifyWebhook` is unimplemented and unused), REV-41 (LinkedIn auto-posting IS complete: `lib/linkedin.ts` + `functions/linkedin-auth.ts` + `workers/linkedin-scheduler/` cron worker), REV-43 (`ideate-cluster.ts` IS used — imported and called by `session-room-ideate-handler.ts:372`, with tests), REV-38 (no real duplication: `signState`/`verifyState` exist once in `routes/integrations.ts`; login OAuth uses a different KV-nonce mechanism by design).
> - **Blocked:** REV-36 (rerank tuning) waits on the REV-10 eval harness.
> - **Groomed into stories:** REV-39, REV-44, REV-46–REV-50 — see `knowledge-base/product/backlog/REV_LOW_STORIES.md`.

**Suggested sequencing:** REV-01/02/03/04 are sprint-now items (revenue and exploitable-auth class). REV-05–REV-13 fit the next sprint alongside Jankurai Phase 2 closure. The structural items (REV-14/15/16) should be scheduled as the S81–S85 arc's engineering-capacity allocation (~20% per sprint) rather than a dedicated stop-the-world refactor.

---

## 4. Aligning AI Features with Organizational Objectives

The locked strategy (ADR-0006, SPRINT81_90_AI_PLAN) — Workers AI only, privacy moat, L4 maturity by v6.0 — is sound and should not change. The gap is execution consistency, not direction.

1. **Close the ship-gate violations before adding AI surface area.** The portfolio scores ~L2.2 against the 5-competency model, and the strategy's own rule ("cannot ship below L3 Context Design") is currently violated by the unsanitized, anonymity-blind insights path (REV-04/05/06). The S83 agentic-facilitation bet (E83) inherits whatever context-design discipline exists today — fix the foundation first; it is cheap (three S/M items).
2. **Make evaluation a precondition for the S81–S90 AI stories.** AI-441–AI-480 plan substantial new inference paths (agent runtime, captions, retro summarizer). Without REV-10's eval harness, every one ships on "tests pass" with no quality-regression signal — directly contradicting the plan's L3 evaluation-competency target for S83. The harness should be a gate in the definition of done for every AI story from S82 onward.
3. **Monetize the flywheel you already compute.** Cross-session similarity and KB grounding are Qesto's hardest-to-copy AI assets, yet the signal is consumed internally and discarded (REV-27). Surfacing it as a Team-tier feature converts architecture differentiation into visible product differentiation and supports the INSIGHTS+ epic (ADR-0045) with near-zero new model work.
4. **Activate the cost/latency infrastructure before agent-runtime scale.** The AI Gateway (REV-09) and latency-budget enforcement (REV-26) are prerequisites for the agent cost metering the plan assigns to TENANT-COST and for keeping the captions latency bar (<300ms) honest. Wiring them now, before E83/E88 multiply inference volume, avoids retrofitting under load.
5. **Build the feedback loops the maturity model rewards.** Acceptance is tracked on copilot suggestions but nothing on themes or help answers (REV-28/47). These loops are what move Team-AI Facilitation from L2 to L3 and they feed the eval set — a compounding investment.

---

## 5. Enhancing Security Protocols

The fundamentals are strong (see §2 strengths); the recommendations below are protocol/process changes layered on the specific findings already itemized in §3.

1. **Treat entitlement integrity as a security domain.** The Stripe webhook no-op (REV-01) is a revenue-integrity failure that escaped both testing and audit because billing sits outside the security review perimeter. Add billing-entitlement assertions to the release checklist and a synthetic "cancel → verify downgrade" test in CI.
2. **Gate SSO GA on cryptographic verification.** REV-03 (SAML signature verification) plus REV-19 (IdP URL validation) should be release-blocking criteria, formalized as an ADR amendment with a security sign-off step — the qesto-security agent already has block authority; use it here.
3. **Finish the Jankurai remediation as planned phases, with CI enforcement.** Phase 2 (REV-13) and Phase 3 (CI/CD hardening: REV-33, GitHub Actions audit) are in flight; convert each completed phase into a permanent CI gate (the `check:no-any` and PII-grep gates are the proven template).
4. **Reduce standing credential exposure.** Shorter session lifetimes (REV-12), POST-based magic-link exchange (REV-20), HSTS on the API origin (REV-21), and nonce-based CSP (REV-18) collectively shrink the stolen-credential and XSS-pivot windows — all are conventional hardening with no UX cost beyond re-login cadence.
5. **Close the detection gap.** There is currently no alerting pipeline (REV-17). Pair Logpush→SIEM with explicit alert rules on: failed SAML assertions, webhook signature failures, circuit-breaker opens, rate-limit saturation, and `agent.safety.block` events. Schedule pentest #4 (already open for S81) *after* REV-01–REV-04 land so it validates the fixes.
6. **Defend the anonymity promise end-to-end.** Anonymity is a sales moat (Vevox segment, 60+ monthly market mentions). It currently holds at the write boundary but leaks at the AI boundary (REV-05) and the identity boundary (REV-11). Add an "anonymity invariant" test suite asserting that no participant-identifying data can reach AI prompts, theme examples, exports, or logs in full/zero-knowledge sessions — and run it in CI as a hard gate.

---

*Compiled from four parallel review streams (codebase inventory, knowledge-base/roadmap audit, OWASP+STRIDE security review, AI engineering review). File references are current as of this commit.*
