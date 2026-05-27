---
id: I18N_SPRINT_71_80_PLAN
type: planning
domain: i18n
status: active
version: 1.0
created: 2026-05-27
updated: 2026-05-27
relates_to:
  - SPRINT71_80_PLAN
  - I18N_SPRINT_60_70_PLAN
---

# i18n Sprint 71–80 Plan

**Capacity:** 8–13 pts/sprint (parallel track).  
**Locales:** EN, NL, DE, FR, ES (unchanged).

## New namespaces

| Namespace | First sprint | Complete all locales |
|-----------|--------------|----------------------|
| `marketplace.json` | S71 extract / S77 ship | S80 |
| `a11y.json` | S73 extract / S79 ship | S80 |

## Sprint commitments

| Sprint | ID | Pts | Focus |
|--------|-----|-----|-------|
| S71 | I18N-SPRINT71-01 | 10 | Extract `marketplace` keys (EN); settings appearance keys |
| S72 | I18N-SPRINT72-01 | 8 | DE/FR plural rules for new UI strings |
| S73 | I18N-SPRINT73-01 | 12 | `a11y` namespace extraction (ARIA, alt text) |
| S74 | I18N-SPRINT74-01 | 9 | NL/ES draft review (Workers AI + human) |
| S75 | I18N-SPRINT75-01 | 11 | DE layout QA (+40% length) — marketplace + present |
| S76 | I18N-SPRINT76-01 | 8 | FR gender/number agreement; federation settings |
| S77 | I18N-SPRINT77-01 | 13 | Marketplace + federation strings complete EN→5 |
| S78 | I18N-SPRINT78-01 | 9 | Multi-region admin UI keys |
| S79 | I18N-SPRINT79-01 | 10 | Final validation `npm run check:i18n` |
| S80 | I18N-SPRINT80-01 | 12 | AAA statement + help page; backlog groom S81+ |

**Gate:** No FE story marked done until EN keys exist and NL/DE/FR/ES stubs pass CI.
