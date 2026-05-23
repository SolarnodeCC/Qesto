---
id: ADR-0016
status: accepted
created: 2026-05-22
---

# ADR-0016: White-Label Scoping

## Decision

1. **Storage** — `Team.branding` on TEAMS_KV document: `logoUrl`, `primaryColor`, `secondaryColor` (hex).
2. **Gating** — `customBranding` plan feature (Team tier).
3. **Surfaces** — join lookup (`by-code`), signed HTML/PDF export, CSS variables on join page.
4. **No custom domains** in v2.4 (deferred).

## Consequences

- Logo URLs are host-provided HTTPS links (no R2 upload in this sprint).
- Email template branding (BRAND-03) uses same colors in export HTML footer only.
