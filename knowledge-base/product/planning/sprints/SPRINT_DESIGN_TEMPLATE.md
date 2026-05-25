# Sprint Design Template (S51–S60)

Use this structure in each `SPRINT##_IMPLEMENTATION_SPEC.md`.

## Design

### Architecture

- **Scope:** What ships this sprint (API, DO, UI, KB only).
- **Dependencies:** Prior sprint branches, ADRs, KV bindings.
- **Data flow:** Request → middleware → route → storage.

### API / Protocol

| Method | Path | Auth | Purpose |
|--------|------|------|---------|

### Storage

| Store | Key pattern | TTL |

### Observability

| AE event | When |

### Security

- Plan gates, PII rules, rate limits.

### Tests

| Suite | Covers |

## Build checklist

- [ ] Implementation merged on `feat/sprint-##-*`
- [ ] `npm test` green
- [ ] Release notes in `knowledge-base/product/releases/`
