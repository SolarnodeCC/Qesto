# Public API v1

## Authentication

```http
Authorization: Bearer qesto_<secret>
```

Create keys: `POST /api/api-keys` (Team plan, JWT required).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/sessions` | List sessions for key's team |
| GET | `/api/v1/sessions/:id/results` | Questions + vote counts |

See ADR-0021.
