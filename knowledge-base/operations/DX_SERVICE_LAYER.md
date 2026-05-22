# DX Service Layer (DX-SERVICE-01)

Internal guide for calling Qesto APIs from scripts and adjacent Workers.

## Base URL

- Production: `https://qesto.cc/api`
- Local: `http://localhost:8787/api`

## Auth

- User flows: magic-link JWT in `Authorization: Bearer` or `qesto_session` cookie.
- Automation: `KB_ADMIN_KEY` for `/api/admin/kb-sync*` only.

## Common routes (v2.4)

| Capability | Method | Path |
|------------|--------|------|
| Join lookup | GET | `/sessions/by-code/:code` |
| GDPR delete | DELETE | `/users/me/gdpr-delete` |
| Engagement CSV | GET | `/admin/engagement/export.csv` |
| Agent grounding | GET | `/agent/grounding?q=` |
| Bracket seed | POST | `/tournaments/sessions/:id/bracket/seed` |
| Facilitator coaching | POST | `/sessions/:id/coaching` |

## Trace IDs

Pass `x-trace-id` on mutating requests; response echoes the same header.
