---
id: PLAN
type: planning
status: active
version: 1.0
created: 2026-05-22
---

# Sprints 36–39 Implementation Spec — v2.4 Horizon

**Branch:** `feat/sprint-36-39-v24`

## Sprint 36 — White-label + rate limits

| ID | Shipped |
|----|---------|
| BRAND-01/02/03 | Team `branding` PATCH, join `by-code`, export HTML colors |
| ADR-0016 | `ADR-0016-white-label-scoping.md` |
| SEC-RATELIMIT-01 | `RATE_LIMIT_FAIL_CLOSED` on middleware + lib option |
| DX-SERVICE-01 | `knowledge-base/operations/DX_SERVICE_LAYER.md` |

## Sprint 37 — Mobile + Salesforce

| ID | Shipped |
|----|---------|
| MOBILE-01 | `manifest.webmanifest`, `sw.js`, join localStorage cache |
| MOBILE-02/03 | Touch CSS + Team Settings / Present min heights |
| SF-01/02 | Salesforce OAuth skeleton routes |
| ADR-0015 | Mobile client ADR |
| SEC-WS-CAP-01 | `WS_CONNECT_PER_IP_PER_MIN` env |

## Sprint 38 — LDAP + templates

| ID | Shipped |
|----|---------|
| LDAP-01/02 | `/api/ldap/status`, `/sync` skeleton |
| NOTION-01 | Notion OAuth skeleton |
| INT-WEBHOOK-02 | `GET /api/webhooks/templates` |
| ADR-0019 | LDAP/Salesforce ADR |
| COMPLIANCE-04 | Pen-test readiness doc |

## Sprint 39 — Tournaments + coaching + RC

| ID | Shipped |
|----|---------|
| GAM-05 / GAM-05-QA | Bracket seed REST + unit tests |
| AI-COACHING-01/02 | `POST /sessions/:id/coaching` |
| KB-RAG-01 | `GET /api/agent/grounding` |
| ADR-0017/0018 | Tournament + RAG ADRs |
| RC-V24-01 | `v2.4.0-RC.md` |
| EXPORT-PDF-01 | `export.pdf` route |

## Deferred

- ARCH-HONO-02 (auth mount refactor)
- Full Zoom/SF/LDAP OAuth completion
