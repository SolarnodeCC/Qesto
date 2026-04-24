# Qesto i18n Architecture Contract

_Last updated: 2026-04-24_

This document defines the current i18n architecture and enforceable conventions for app/product surfaces.
Marketing pages are intentionally excluded from this contract's enforcement scope.

## Runtime model (source of truth)

- i18n runtime is custom and implemented in `src/i18n/index.ts`.
- Locale resources are static JSON files in `public/locales/{lang}/{namespace}.json`.
- Startup preloads namespaces through `initI18n()` before first React render (`src/main.tsx`).
- EN is canonical; non-EN locales overlay on EN at runtime.

## Supported languages

- `en`, `nl`, `es`, `de`, `fr`

## Namespace contract

Current namespace set:

- `admin`, `auth`, `common`, `components`, `dashboard`, `errors`, `home`, `insights`, `join`, `launchpad`, `login`, `not-found`, `present`, `results`, `session-config`, `sessions`, `solutions`, `vote`, `wizard`

Rules:

- Each language must provide the same namespace file set.
- EN must remain complete and must not contain `[TODO]` placeholders.
- Non-EN may temporarily contain `[TODO]` placeholders on feature branches, but not for release.

## Key conventions

- Keep keys stable and semantic; never encode full UI sentences into key names.
- Dot-path access is the runtime standard (`t('step2.ai_error')`).
- Nested JSON and dotted leaf keys are both supported by runtime for compatibility.
- New grouped sections should prefer nested object structure.

## Scope split (app vs marketing)

Enforced app scope is defined in `i18n.scope.json`.

- Excluded namespace: `solutions`
- Excluded source paths:
  - `src/pages/use-cases/**`
  - `src/layouts/MainLayout.tsx`
  - `src/pages/Home.tsx`

## Tooling

- `npm run check:i18n` validates translation completeness and non-keyed literals.
- `npm run report:i18n:gaps` generates a markdown + json inventory report for current gaps.

## Change policy

When adding a language or namespace:

1. Update `src/i18n/index.ts`.
2. Update `i18n.scope.json`.
3. Add locale files for all languages.
4. Run `npm run check:i18n` and `npm run report:i18n:gaps`.
