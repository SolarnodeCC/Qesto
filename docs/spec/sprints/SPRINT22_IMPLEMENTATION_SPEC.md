# Sprint 22 Implementation Spec — Template Catalogue + Session Creation Polish

_Built: 2026-05-04._

## Scope

Sprint 22 turns templates into a production-grade session-starting path instead of a passive dashboard list. The build follows the Sprint 22 gate in `SPRINT_PLAN.md`: a template card never creates a session directly; hosts must inspect the overview and then continue through editable wizard state.

## Delivered

| Item | Status | Evidence |
|---|---|---|
| TPL-CATALOG-01 Customer vs Qesto template groups | Built | Dashboard Templates tab separates customer templates from curated Qesto topic groups. |
| TPL-CATALOG-02 Template overview confirmation flow | Built | Template cards open an overview dialog with description, preview art, question list, and explicit `Use template` CTA. |
| TPL-CATALOG-03 Qesto starter-template coverage | Built | Curated seed catalogue now has 3+ templates for `team`, `product`, and `learning` topics. |
| TPL-WIZARD-01 Template-seeded wizard customize step | Built | `SessionWizard` accepts a selected template, preloads title/goal/questions, and keeps every question editable before Launchpad. |
| TPL-QA-01 Functional UI coverage | Built | `tests/functional/ui/template-catalogue.test.ts` guards overview confirmation, topic-copy alignment, and preview dimensions. |

## Route/Data Contract

`GET /api/templates` still returns public Qesto templates, now enriched with:

- `type: "qesto"`
- `topic`
- `previewAlt`
- `questions[]`

`GET /api/templates/mine` returns authenticated customer templates with:

- `type: "customer"`
- `topic: "customer"`
- `previewAlt`

The frontend combines `/api/templates/mine` and `/api/templates` into grouped catalogue sections.

## UX Contract

- Template cards are previews only.
- The overview dialog is the first confirmation point.
- `Use template` opens the wizard.
- Step 2 is seeded in template mode and remains editable.
- Launch still uses the existing wizard persistence flow, so session creation, question creation, preflight, and Launchpad behavior remain centralized.

## Verification

- `npm run typecheck`
- `npm run check:i18n`
- `npx vitest run tests/integration/templates-crud.test.ts tests/functional/ui/template-catalogue.test.ts`

Full-suite gates are expected before deploy.
