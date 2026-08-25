---
id: SPEC-I18N
type: specification
domain: frontend
category: localization
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
audience:
  - Frontend engineer
  - i18n specialist
tags:
  - i18n
  - localization
  - translation
  - languages
  - english
  - dutch
  - spanish
  - german
  - french
relates_to:
  - SPEC_FRONTEND
  - SPEC_PRODUCT
---

# Qesto i18n Architecture Contract

_Last updated: 2026-04-24_

This document defines the current i18n architecture and enforceable conventions for app/product surfaces.
Marketing pages are intentionally excluded from this contract's enforcement scope.

## Release status — GA, and what it does and does not cover (issue #527)

**Participant- and host-facing UI translation is GA** in five languages: English (canonical),
Dutch, German, French and Spanish. It is not a beta. The gate backing that claim is
`npm run check:i18n`, which fails the build when any locale is missing a key that English
has; all five locales are complete as of 2026-08-25.

What GA covers:

- Every app/product surface string routed through `src/i18n/index.ts` and the
  `public/locales/{lang}/{namespace}.json` resources.
- Runtime language selection (`src/components/LanguageSwitcher.tsx`) with EN overlay fallback,
  so an untranslated key degrades to English rather than to a blank.

What GA explicitly does **not** cover — say "multilingual UI", never "multilingual sessions":

- **Session content is not translated.** Questions, options and open responses are stored and
  displayed in whatever language the host authored them. There is no machine translation of
  participant-authored text, and none is planned behind this status.
- **AI insights are English-biased.** Sentiment analysis filters to mostly-English responses
  (`isMostlyEnglish` in `functions/api/lib/ai/sentiment.ts`) and skips the rest, so a
  non-English room yields no aggregate mood.
- **Marketing pages are out of contract scope** by the exclusion stated below.

The only public claim of this capability is
`nonprofit.features.languages.desc` in `public/locales/en/solutions.json`, which correctly
scopes itself to "member-facing UI". Keep any new copy scoped the same way.

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
