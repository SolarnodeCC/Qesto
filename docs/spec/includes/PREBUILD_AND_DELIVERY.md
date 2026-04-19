# PREBUILD_AND_DELIVERY — Scope, gates, sequencing (canonical include)

_Repository hub: [Documentation map](../../README.md)._

**Purpose:** Single place for “before and while you scale building” rules. Other specs **link here**; avoid copying long tables into multiple files.

## Doc contract

| Rule | Text |
|------|------|
| Authority | This file is **product + process intent**. **Code, migrations, and CI config** win on exact flags, hostnames, and limits until this include is updated in the same PR. |
| Drift | If behavior changes, update **this include** and the **one** domain spec that owns the detail (e.g. routes → [[SPEC_BACKEND.md]], D1 TTL → [[SPEC_DATAMODEL.md]]). |

---

## Pre-build and delivery principles

| # | Principle | Detail |
|---|-----------|--------|
| P1 | **Vertical slice first** | Ship one end-to-end path before breadth: auth → draft session → questions → go live → vote → close → results. Everything else is explicitly later. |
| P2 | **Prove LIVE early** | WebSocket + Durable Object + roles + broadcast is the highest technical risk; validate in a **spike** before large UI investment (see [LIVE spike acceptance](#live-spike-acceptance)). |
| P3 | **Environments day one** | Dev / staging / prod: separate D1, KV bindings, `APP_URL`, Stripe mode, domains. Document in [[SPEC_DEPLOYMENT.md]]. |
| P4 | **Secrets never in git** | Pages secrets, CI secrets, `.dev.vars` local only — [[SPEC_DEPLOYMENT.md]], [[SPEC_CORE.md#critical-constraints-hard-rules]]. |
| P5 | **Migrations as habit** | Every schema change has a migration and a rollback story — [[SPEC_DATAMODEL.md#migration-pattern]]. |
| P6 | **Public surfaces explicit** | Anonymous or low-trust routes need documented controls — [§ Abuse and public endpoints](#abuse-and-public-endpoints) + [[SPEC_BACKEND.md]] (`A` / `A*` rows). |
| P7 | **Observability early** | Trace/request ID, structured errors, health checks before scale — [[SPEC_DEPLOYMENT.md]], [[SPEC_BACKEND.md]]. |
| P8 | **CI matches release bar** | At minimum tests + `tsc`; expand i18n / a11y / e2e as the product grows — [[SPEC_DEPLOYMENT.md]]. |
| P9 | **One golden path** | Single documented local run + migrate + deploy path — [§ Golden path (local)](#golden-path-local). |
| P10 | **ADRs for big forks** | Record “why DO per session”, “why KV for X”, etc. — [§ ADR index](#adr-index). |

---

## Vertical slice v1 scope

| In scope (v1) | Out of scope (defer) |
|---------------|----------------------|
| One auth path you commit to (e.g. magic link + JWT) | Full enterprise matrix on day one |
| One question type end-to-end in LIVE | All energizers / all modes |
| Start → vote → close → read results | Full admin analytics |
| Stripe **test** in staging | Complex billing edge cases before core LIVE works |

Adjust rows to match your actual v1; keep the **table** so scope stays visible in PR review.

---

## LIVE spike acceptance

Before building broad product UI, a spike **passes** when all of the following are demonstrable in **staging** (or local DO):

| # | Criterion |
|---|-----------|
| S1 | Presenter opens **`GET` Upgrade** WebSocket with **subprotocol** JWT where required — [[SPEC_REALTIME.md#wire-format-normative]], [[SPEC_BACKEND.md]] §2 `/ws`. |
| S2 | At least **N** concurrent voter connections receive **question** + **results** broadcasts. |
| S3 | **Reconnect** does not corrupt state (presenter and at least one voter). |
| S4 | **Close** path freezes or completes cleanly; no silent DO leak (verify in logs / metrics). |
| S5 | **Rate limit** or backpressure behavior is defined for at least one hot path (emoji, votes, or connect storm) — even if “verify in code”, document the target. |

---

## Pre-production gates

| Gate | Owner doc | Minimum |
|------|-----------|---------|
| Environments matrix | [[SPEC_DEPLOYMENT.md]] | Named D1 DB + KV per env; `APP_URL` consistent with WS `wss://` host. |
| Stripe webhooks | [[SPEC_INTEGRATIONS.md]], [[SPEC_DATAMODEL.md]] | Signature verification + **idempotent** D1 row (`stripe_webhook_events`). |
| CI | [[SPEC_DEPLOYMENT.md]] | `npm test` + `tsc --noEmit` on every merge; expand as agreed. |
| Health | [[SPEC_DEPLOYMENT.md]] | `/api/admin/health` or equivalent reachable in staging. |
| Logs | [[SPEC_DEPLOYMENT.md]], [[SPEC_BACKEND.md]] | Request/trace ID on API errors — [[SPEC_CORE.md#error-handling-strategy]]. |

---

## Abuse and public endpoints

**Canonical route AuthZ** lives in [[SPEC_BACKEND.md]] (legend + tables). This table is the **pre-build reminder** to design controls before exposing URLs.

| Pattern | Risk | Controls (design-time) |
|---------|------|-------------------------|
| `A` / `A*` write routes | Spam, forged payloads | Session binding, capability tokens, strict rate limits — see [[SPEC_BACKEND.md]] **Public write contract** rows. |
| Join / by-code read | Enumeration | Rate limit, optional CAPTCHA TBD — verify in handler. |
| WebSocket connect | Connection storms | Per-IP / per-session limits — [[SPEC_REALTIME.md]]. |
| AI routes | Cost / abuse | Plan gate + per-user limits — [[SPEC_CORE.md#critical-constraints-hard-rules]], [[SPEC_INTEGRATIONS.md]]. |

---

## Retention and deletion (intent)

| Store | Examples | Intent |
|-------|----------|--------|
| D1 | `sessions`, `audit_log`, `one_time_tokens` | Define **retention** (e.g. archived session purge) in migrations or jobs — schema: [[SPEC_DATAMODEL.md]]. |
| KV | `meta:`, `async-vote:` | Respect **TTL** in key design; document PII in values — [[SPEC_DATAMODEL.md]]. |
| R2 | request logs | Lifecycle / compaction policy per [[SPEC_DEPLOYMENT.md]]. |

---

## Golden path (local)

Single sequence the team agrees on (adjust commands to match `package.json` in repo):

1. Clone repo, `npm ci` (or `npm install`).  
2. Copy `.dev.vars` / env template; **never** commit secrets.  
3. `npm run dev` (or documented Vite + Pages dev combo — [[SPEC_DEPLOYMENT.md]]).  
4. Apply **D1 migrations** to local or remote preview DB — [[SPEC_DATAMODEL.md#migration-pattern]].  
5. Smoke: open app, sign in (or dev bypass if any), create draft, **optional** LIVE spike on local DO.  

---

## ADR index

| ADR | Title | Status | Link |
|-----|-------|--------|------|
| — | *(add first ADR when you lock DO-per-session, auth vendor, etc.)* | Proposed | `docs/adr/0001-…md` or PR link |

Replace placeholder when the first architecture decision is recorded.

---

## AI usage recipe (copy)

1. “What do we build first?” → [Vertical slice](#vertical-slice-v1-scope) + [Pre-build principles](#pre-build-and-delivery-principles).  
2. “Are we safe to ship LIVE?” → [LIVE spike acceptance](#live-spike-acceptance) + [[SPEC_REALTIME.md]].  
3. “What blocks prod?” → [Pre-production gates](#pre-production-gates) + [[SPEC_DEPLOYMENT.md]].  

**Checklist:** Staging Stripe webhook tested • `APP_URL` / `wss` host aligned • one golden path doc run end-to-end • ADR row added for first irreversible decision.
