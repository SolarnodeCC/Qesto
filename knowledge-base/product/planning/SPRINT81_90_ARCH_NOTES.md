---
id: SPRINT81_90_ARCH_NOTES
type: planning
domain: architecture
category: planning
status: proposed
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - architecture
  - adr
  - sprints-81-90
  - native-mobile
  - marketplace
  - agent-runtime
  - verifiable-voting
  - embed-sdk
  - fedramp
relates_to:
  - SPRINT81_90_PLAN
  - ADR-0044
  - ADR-0045
  - ADR-0046
  - ADR-0047
  - ADR-0048
  - ADR-0049
  - ADR-0050
  - ADR-0051
  - ADR-0052
  - ADR-0053
---

# Sprint 81–90 Architecture Notes & ADR Brief — Post-v5.0 Expansion Arc

_Prepared: 2026-06-01 — Architect synthesis aligned to [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md). This is a **planning brief**; each ADR document is authored to `/knowledge-base/adr/ADR-00NN-*.md` only when accepted._

_Latest accepted ADR entering this arc: **ADR-0043** (FedRAMP Moderate control mapping, S80). This arc introduces **ADR-0044 → ADR-0053**._

---

## Architectural thesis

v5.0 GA hands S81 a **certified, decomposed, multi-region platform**: SessionRoom is split (Lobby/Live/Results DO per ADR-0035), multi-region writes are GA (ADR-0036), realtime v3 delta broadcasts are live (ADR-0038), the AI agent runtime exists in draft (ADR-0039), CMK envelope is live (ADR-0041), and a FedRAMP control mapping is documented (ADR-0043).

S81–S90 spends that foundation on **reach, economy, and new buyers**. The architectural risk shifts from *scaling the core* to *safely opening new trust boundaries*: app stores, money movement (Stripe Connect), autonomous agents, anonymous moderation at scale, cryptographic ballots, third-party embeds, and a sovereign/gov data plane. Each is a net-new attack and failure surface — hence the deliberate ADR-per-surface cadence and the **"do not co-land"** rules below.

**Invariants preserved across the arc:** Workers AI only (no third-party AI egress); secrets via `wrangler pages secret put`; DRAFT-API vs WebSocket separation; multi-tenant isolation; GDPR-by-default. No ADR in this arc may weaken these.

---

## Per-ADR brief

### ADR-0044 — Native shell store submission + native push (Capacitor GA) · accept S81
- **Context:** ADR-0042 (S73) chose Capacitor *shell only*. Store submission was deferred to S81+.
- **Decision direction:** Wrap the existing PWA in a Capacitor shell; native push via APNs/FCM bridged to the existing push service (PWA-PUSH from S71). No business logic in native code — the shell is a thin container; voter logic stays in the web bundle for single-source maintenance. Offline voter shell uses service-worker cache + IndexedDB queue, flushed on reconnect.
- **Blocks:** E81 GA, native push actions, all "native app" marketing.
- **Risk:** Low-medium. App-store review latency is the schedule risk, not code. Deep-link auth must not leak JWTs to other apps (universal links / app links with domain verification).

### ADR-0045 — Marketplace billing: Stripe Connect payout + revenue share + KYC · accept S82
- **Context:** Marketplace exec sandbox (ADR-0037, S75) runs plugins; this adds *money*.
- **Decision direction:** Stripe Connect (Express accounts) for creator payouts; platform takes a revenue-share fee; KYC delegated to Stripe identity. Webhook-driven ledger in D1 (append-only `marketplace_ledger`); idempotent handlers (reuse BILL-03 idempotency pattern). Payout schedule weekly.
- **Blocks:** Paid listings, partner payout, agent marketplace monetization.
- **Risk:** High — money movement + tax (1099) + fraud. Gated on legal/finance review and Stripe Connect compliance before S83 go-live.

### ADR-0046 — AI agent runtime GA (AgentRunDO + Workflows) + agent sandbox · accept S83
- **Context:** ADR-0039 (S77) drafted the agent runtime. This is GA.
- **Decision direction:** `AgentRunDO` per active agent; Cloudflare Workflows for multi-step agent tasks; Workers AI inference only. Hard sandbox: agents may only call a whitelisted tool surface (read session state, post message, summarize) — **no** arbitrary fetch, no payout actions, no role changes. Prompt-injection defense: structured tool-call schema + output validation.
- **Blocks:** Agent marketplace, autonomous facilitation GA.
- **Risk:** **Highest in the arc.** Autonomous action on shared sessions. Gated on `SEC-AGENT-EVAL-01` safety suite (S84) before public.

### ADR-0047 — Town-hall moderation queue DO + upvote scale · accept S84
- **Context:** TOWNHALL needs a ranked, anonymous, abuse-screened question queue at 50k.
- **Decision direction:** Dedicated `ModQueueDO` (sibling to Live DO, not inside SessionRoom) holding the upvote-ranked queue; deterministic ordering (upvotes desc, submission time asc); AI pre-screen via Workers AI; anonymity enforced at broadcast (author ID retained only in audit log for GDPR escalation).
- **Blocks:** TOWNHALL @ 50k, STAGE hybrid-event Q&A.
- **Risk:** Medium-high. De-anonymization is the threat; broadcast path must never carry author identity.

### ADR-0048 — Recurring-workspace data model (RETRO/IDEATE persistence + history) · accept S85
- **Context:** RETRO/IDEATE are *recurring* (sprint-over-sprint), unlike one-shot sessions — needs persistent workspace + history + trend.
- **Decision direction:** New `workspace` entity (team-scoped) in D1 with linked session history; team-health trends computed from historical results (Vectorize for theme clustering). Workspace RBAC reuses team roles.
- **Blocks:** Team-health trends, recurring-buyer GTM (E85).
- **Risk:** Low-medium. Data-retention/GDPR for longitudinal team data; anonymity preserved in trend aggregates.

### ADR-0049 — Verifiable voting: cryptographic receipt + tally integrity · accept S86
- **Context:** DELIBERATE governance buyers need *independently verifiable* ballots.
- **Decision direction:** Per-ballot commitment (SHA-256 over ballot-nonce + choice + session fingerprint) written to an append-only audit ledger; voter receipt carries the nonce + commitment; final tally published as a Merkle root over commitments so any observer can re-tally. **Not blockchain** — no chain, no token, no consensus; just verifiable commitments + Merkle proof. Session-close signature via DO-held HMAC key (CMK-wrapped per ADR-0041).
- **Blocks:** DELIBERATE governance tier GA.
- **Risk:** High — correctness + coercion-resistance. Requires independent cryptography review and Pentest #5 receipt-forgery/replay testing.

### ADR-0050 — Embeddable SDK auth + widget origin sandboxing · accept S87
- **Context:** EMBED exposes Qesto sessions inside third-party sites.
- **Decision direction:** Public widget served from an isolated origin; scoped, short-lived embed tokens (no account JWT in the widget); strict frame-ancestors / origin allowlist per API key; postMessage contract with origin validation. Headless SDK calls go through rate-limited public API v3.
- **Blocks:** EMBED public widget API, partner embeds.
- **Risk:** High — XSS/token-leak/clickjacking via embed. Origin sandboxing is the core control.

### ADR-0051 — Live captions/translation pipeline (Workers AI ASR + MT) · accept S88
- **Context:** CAPTIONS needs live speech→text→translation **without third-party egress**.
- **Decision direction:** Workers AI ASR (e.g. `@cf/openai/whisper` family on Workers AI) + Workers AI MT for target locales; streamed over realtime v3 delta channel; transcripts treated as PII (retention + redaction policy). No audio leaves the Cloudflare edge.
- **Blocks:** CAPTIONS GA.
- **Risk:** Medium. Accuracy (WER bar) and PII-in-transcript handling are the gates.

### ADR-0052 — FedRAMP Moderate full ATO boundary + sovereign data plane · accept S89
- **Context:** ADR-0043 (S80) mapped controls (path only). This defines the *boundary* for a real ATO and a sovereign tenant tier.
- **Decision direction:** Dedicated authorization boundary for gov tenants; sovereign data-plane pinning (region + CMK + restricted integrations); 3PAO-ready evidence pipeline (OTel v2 from ADR-0040). Sovereign tier is opt-in and isolated from the shared marketplace/agent surfaces unless individually authorized.
- **Blocks:** Gov GTM, sovereign tenant tier.
- **Risk:** High (compliance), low (novel code). Gated on 3PAO readiness assessment.

### ADR-0053 — v6.0 platform certification + v5.x deprecation policy · accept S90
- **Context:** First major version since v5.0; formalizes the certification bundle and v5.x sunset.
- **Decision direction:** Certification bundle (SOC 2 Type II annual, Pentest #4/#5 evidence, DR drill, AAA conformance); v5.x deprecation headers + 12-month sunset timeline mirroring the v4.x policy.
- **Blocks:** v6.0 GA ship.
- **Risk:** Low — process/governance.

---

## ADR dependency graph (text)

```
ADR-0044 (native shell GA) ──► E81 GA, native push
ADR-0045 (marketplace billing) ──► paid listings ──► ADR-0046 agent marketplace monetization
ADR-0046 (agent runtime GA) ──► agent marketplace (gated: SEC-AGENT-EVAL-01)
ADR-0047 (modqueue DO) ──► TOWNHALL 50k ──► STAGE Q&A
ADR-0048 (workspace model) ──► RETRO/IDEATE recurring + team-health trends
ADR-0049 (verifiable voting) ──► DELIBERATE GA (needs CMK key from ADR-0041)
ADR-0050 (embed sandbox) ──► EMBED public widget (needs public API v3 from ADR-0032)
ADR-0051 (captions) ──► CAPTIONS GA (rides realtime v3 / ADR-0038)
ADR-0052 (ATO boundary) ──► sovereign tier (needs OTel v2 / ADR-0040, CMK / ADR-0041)
ADR-0053 (v6 certification) ──► v6.0 GA (consumes all evidence above)
```

---

## Do-not-co-land rules (and why)

| Must not co-land | Reason |
|------------------|--------|
| **ADR-0046 (agent runtime GA) + ADR-0049 (verifiable-vote crypto)** | Two highest-risk net-new trust surfaces; both demand dedicated pentest focus. Co-landing splits Pentest #4/#5 attention and couples two unrelated correctness failures. (Same discipline as S71–S80's ADR-0035/0036 rule.) |
| **ADR-0045 (money movement) + ADR-0050 (third-party embed)** | Payout fraud surface and embed token-leak surface should not debut in the same RC; isolate financial-trust changes from origin-trust changes. |
| **ADR-0052 (sovereign/ATO boundary) + any marketplace/agent GA in the same sprint** | Sovereign tenants must be provably isolated from shared marketplace/agent execution; landing them together muddies the authorization boundary evidence. |

---

## Cross-sprint gate rationale (architecture view)

- **App-store review accepted by S82** — store latency is external; pulling it to S82 protects the v5.1 RC (S83).
- **Marketplace KYC/payout compliance by S83** — money cannot move before legal/finance + Stripe Connect compliance sign-off.
- **Agent safety eval green by S84** — autonomous action is the arc's top risk; no public marketplace agent without the eval suite.
- **Verifiable-vote independent re-tally by S87** — the *entire value* of DELIBERATE is third-party verifiability; if an observer can't re-tally, the feature is unsellable.
- **FedRAMP 3PAO readiness by S89** — gov-cloud claims are compliance-gated, not code-gated.

---

## Open architecture questions for PO/Architect review

1. Does the sovereign tier (ADR-0052) **exclude** the agent runtime and marketplace by default, or allow per-tenant authorization? (Recommend: exclude by default.)
2. Captions ASR model selection (ADR-0051) — confirm a Workers AI ASR model meets the WER bar for NL/DE/FR before committing CAPTIONS GA marketing.
3. Verifiable-vote receipts (ADR-0049) — PDF + JSON both, or JSON canonical with PDF as convenience? (Recommend: JSON canonical, PDF convenience.)
