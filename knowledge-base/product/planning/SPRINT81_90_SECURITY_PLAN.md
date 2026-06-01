---
id: SPRINT81_90_SECURITY_PLAN
type: planning
domain: security
category: planning
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - security
  - sprints-81-90
  - owasp
  - stride
  - pentest
  - stripe-connect
  - agent-safety
  - verifiable-voting
  - embed-sdk
  - fedramp
relates_to:
  - SPRINT81_90_PLAN
  - SPRINT81_90_ARCH_NOTES
  - QA_COMMITMENT_SPRINTS_81_90
---

# Sprint 81–90 Security Plan — Post-v5.0 Expansion Arc

_Prepared: 2026-06-01 — Security synthesis aligned to [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md). OWASP Top 10 (2021) + STRIDE per new trust surface. Security budget ~12–18 pts/sprint._

---

## Executive summary

S81–S90 opens **seven net-new trust surfaces** at once: native apps, money movement, autonomous AI agents, anonymous moderation at scale, cryptographic ballots, third-party embeds, and a sovereign/gov data plane. The S71–S80 platform was *hardened and certified*; this arc must keep that posture while each new surface ships. Two penetration tests bracket the arc — **Pentest #4** (mobile + marketplace, S81–S83) and **Pentest #5** (governance + embed + agent, S87–S89) — and **no RC ships with open critical/high findings**.

**Highest-severity threat in the arc:** an AI agent (ADR-0046) taking an **unsafe autonomous action** on a live multi-tenant session via prompt injection. Mitigated by a hard tool sandbox + the `SEC-AGENT-EVAL-01` safety suite, which is a hard gate before the agent marketplace goes public (S84).

---

## Per-epic threat model (STRIDE × OWASP)

### E81 Native Mobile (S81–S82)
| Threat | STRIDE | Control |
|--------|--------|---------|
| JWT leak to other apps via deep link | Info disclosure | Universal/App Links with domain verification; no token in URL |
| Insecure local storage of session/token | Tampering / Info | Encrypted storage; short-lived tokens; no PII at rest in shell |
| Rooted/jailbroken device tamper | Tampering | Best-effort attestation; server-side authority for all scoring |
| Push spoofing | Spoofing | Signed push payloads; server-validated topic subscription |

### E82 Marketplace Economy (S82–S83)
| Threat | STRIDE | Control |
|--------|--------|---------|
| Payout redirection / account takeover | Spoofing / Tampering | Stripe Connect KYC; payout account change re-verification |
| Webhook forgery (fake purchase/payout) | Spoofing | Stripe signature verification; idempotent ledger (BILL-03 pattern) |
| Revenue-share manipulation | Tampering | Server-authoritative split; append-only `marketplace_ledger` |
| Money-laundering / fraud | Repudiation | KYC + Stripe Radar; velocity limits; audit trail |

### E83 Agentic Facilitation (S83–S84) — **top risk**
| Threat | STRIDE | Control |
|--------|--------|---------|
| Prompt injection → unsafe autonomous action | Elevation / Tampering | Hard tool sandbox (whitelist: read state, post message, summarize); **no** fetch/payout/role-change tools |
| Agent sandbox escape | Elevation | Workers AI inference isolated; structured tool-call schema + output validation |
| Cross-tenant data exfiltration via agent | Info disclosure | Agent scoped to single session DO; no cross-session reads |
| Agent abuse for spam/manipulation | Repudiation | `SEC-AGENT-EVAL-01` eval suite; rate limits; audit every agent action |

### E84 Town Hall (S84–S85)
| Threat | STRIDE | Control |
|--------|--------|---------|
| De-anonymization of anonymous questioner | Info disclosure | Author ID only in audit log; broadcast path carries no identity |
| Moderation bypass / abuse flooding | DoS / Tampering | AI pre-screen; per-participant rate limit; upvote integrity |

### E85 Continuous Collaboration (S85–S86)
| Threat | STRIDE | Control |
|--------|--------|---------|
| Longitudinal team-health data exposure | Info disclosure | Workspace RBAC; aggregate-only trends; GDPR retention policy |
| Cross-team workspace access | Elevation | Team-scoped workspace isolation (reuse multi-tenant enforcement) |

### E86 Verifiable Governance (S86–S87)
| Threat | STRIDE | Control |
|--------|--------|---------|
| Vote receipt forgery | Spoofing | Commitment over ballot-nonce+choice+session fingerprint; DO-held HMAC |
| Vote replay / double-vote | Tampering | One commitment per voter; append-only ledger |
| Tally manipulation | Tampering | Merkle-root publication; independent re-tally |
| Coercion / vote-buying | Info disclosure | Receipt reveals only own vote; no proof-of-other-votes |

### E87 Embeddable Platform (S87–S88)
| Threat | STRIDE | Control |
|--------|--------|---------|
| XSS via embed widget | Tampering | Isolated origin; CSP; sanitized postMessage contract |
| Embed token leakage / reuse | Info disclosure | Scoped short-lived embed tokens; per-key origin allowlist |
| Clickjacking | Tampering | frame-ancestors allowlist; X-Frame-Options per key |

### E88 Adaptive/Captions (S88–S89)
| Threat | STRIDE | Control |
|--------|--------|---------|
| PII in live transcripts | Info disclosure | Transcript retention/redaction policy; no third-party egress (Workers AI) |

### E89 Gov Cloud (S89)
| Threat | STRIDE | Control |
|--------|--------|---------|
| Sovereign-tenant isolation breach | Elevation / Info | Dedicated authorization boundary; CMK; restricted integrations; excludes shared agent/marketplace by default |

---

## Penetration test cadence

| Pentest | Window | Scope | Gate |
|---------|--------|-------|------|
| **#4** | S81–S83 | Native apps + Stripe Connect marketplace + agent runtime foundation | Critical/high = 0 before v5.1 RC (S83) |
| **#5** | S87–S89 | Verifiable voting + embed SDK + agent marketplace (public) | Critical/high = 0 before v6.0 RC (S89) |

---

## Security story registry (SEC-* — pts in master plan)

| ID | Item | Pts | Sprint |
|----|------|-----|--------|
| `SEC-PEN4-01` | Pentest #4 engagement (mobile + marketplace) | 13 | S81–S83 |
| `SEC-PEN4-PREP-02` | Pentest #4 scoping + threat-model prep | (incl) | S81 |
| `SEC-PEN4-02` | Pentest #4 execution checkpoint | — | S82 |
| `SEC-MKTPL-KYC-01` | Stripe Connect KYC + payout-fraud controls | 8 | S82 |
| `SEC-PEN4-REM-01` | Pentest #4 remediation | — | S83 |
| `SEC-AGENT-SANDBOX-01` | Agent tool sandbox + injection defense | 8 | S83 |
| `SEC-AGENT-EVAL-01` | Agent safety evaluation suite (gate) | 13 | S84 |
| `SEC-WORKSPACE-RBAC-01` | Recurring-workspace RBAC isolation | 8 | S85 |
| `SEC-VOTE-INTEGRITY-01` | Ballot integrity + coercion-resistance review | 13 | S86 |
| `SEC-EMBED-ORIGIN-01` | Embed origin sandbox + token scoping | 8 | S87 |
| `SEC-PEN5-PREP-01` | Pentest #5 scoping | — | S87 |
| `SEC-PEN5-01` | Pentest #5 execution (gov + embed + agent) | 13 | S88 |
| `SEC-PEN5-REM-01` | Pentest #5 remediation | — | S89 |
| `API-PLAT-V6-AUDIT-01` | Public API v6 surface audit | 13 | S89 |

---

## Compliance gates

| Gate | By | Blocks |
|------|----|--------|
| Stripe Connect KYC + 1099/tax compliance review | S83 | Paid listings go-live |
| Agent safety eval green | S84 | Agent marketplace public |
| Verifiable-vote independent crypto review | S87 | DELIBERATE governance GTM |
| FedRAMP 3PAO readiness assessment | S89 | Gov-cloud / sovereign-tier claim |
| SOC 2 Type II annual refresh | S89 | v6.0 certification bundle |
| `check:compliance-claims` green | every sprint | All public copy |

---

## Release-blocking criteria (every RC)

1. Zero open **critical/high** findings (pentest, SAST, dependency scan).
2. No new secret in `wrangler.toml` (secret-scan CI).
3. Workers-AI-only confirmed for agent + captions (no third-party AI egress).
4. Multi-tenant + sovereign isolation tests green.
5. GDPR: anonymity preserved (TOWNHALL), retention policy applied (captions, workspaces).
