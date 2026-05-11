---
id: AI-CONTEXT
type: reference
domain: ai
category: agents
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - ai
  - agents
  - skills
  - research
relates_to:
  - AGENT_SYSTEM_OVERVIEW
---

# Agent Improvement Priorities From Audits

_Hub: [Documentation map](../README.md)._

This document maps the audit outcomes in `audits/` to concrete agent and skill improvements. It is a maintenance checklist for prompt assets, not a runtime remediation plan.

## Priority Order

| Priority | Agents / skills | Audit pressure | Implemented prompt upgrades |
|---:|---|---|---|
| 1 | `qesto-backend`; `backend-dev`, `backend-integrations`, `backend-perf` | God route modules, duplicated KV/response helpers, unsafe request parsing, missing external-service resilience | Thin-route gate, service/repository ownership, shared helper preference, safe parse/sanitized 500s, timeout/retry/degradation checklist |
| 2 | `qesto-architect`; `architect` | Missing service/repository boundaries, implicit lifecycle/state patterns, peer-route coupling, migration placement | Architecture gates for thin routes, repositories, explicit state/strategy patterns, no peer-route coupling, resilience posture |
| 3 | `qesto-security`; `cso`, `review` | Raw production errors, malformed JSON as 500, silent auth/RBAC/OAuth failures, uncontained DO/WS exceptions | Release blockers for raw errors, safe JSON parsing, structured logging, DO/WS containment, external-call degradation |
| 4 | `qesto-tester`; `tester`, `investigate` | Audit remediation depends on regression evidence around error handling, DO storage, WS handlers, AI/external failures | Audit regression test priorities, example test patterns, DO/WS investigation checks |
| 5 | `qesto-frontend`; `frontend-dev` | Duplicated polling hooks, frontend DTO drift, large live-session hooks, plan/pricing parity | Shared hook/type gates, WebSocket separation, async UX gates, plan catalog/static-copy guidance |
| 6 | `qesto-devops`; `devops` | Remaining production config and operational readiness follow-ups | Stripe/pricing configuration checklist, health/degradation checks, rollback/forward-fix requirements |

## Audit Families Covered

| Audit family | Representative findings | Primary owner | Secondary owner |
|---|---|---|---|
| Route/module architecture | `SA-01`, `SA-02`, `SA-03`, `C-01`, `C-02`, `L-01`, `DM-02`, `DM-05` | Architect | Backend |
| Backend duplication | `SA-04`, `F-02`, `F-03`, `F-05`, `F-07`, `F-10` | Backend | Review |
| Error handling and information disclosure | `EH-01`, `EH-02`, `EH-04`, `EH-07`, `EH-13` | Security | Backend, Tester |
| Realtime / Durable Object resilience | `EH-03`, `C-04`, `C-05`, `RES-12`, `RES-13`, `BH-01` | Backend | Tester, Architect |
| External dependency resilience | `RES-01`, `RES-05`, `RES-06`, `RES-08`, `RES-15`, `BH-05` | Backend | DevOps, Security |
| Frontend dedupe and type drift | `SA-05`, `F-01`, `F-06`, `F-08` | Frontend | Tester |
| Production config / product validation | `workstream-outstanding.md` Stripe and pricing follow-ups | DevOps | Product Owner |

## When To Revisit

Reopen this file when:

- A new audit adds a recurring failure mode.
- A prompt asset change closes or weakens one of these gates.
- A production incident shows an agent or skill missed a listed risk.
- A runtime remediation makes a gate obsolete or changes the correct owner.
