---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Page Quality Checklist

Use this checklist before merging any update to solution, feature, use-case, pricing, privacy, or terms pages.

## 1) Voice and messaging

- Follows `docs/BRAND_VOICE.md` (practical, evidence-first, no hype words).
- Uses page-specific language for audience and context.
- Avoids filler claims like "best-in-class", "revolutionary", "seamless".
- Any AI claim focuses on business value and privacy (analysis stays private, responses never shared with third parties).

## 2) Content structure

- Fits existing template slots only (no ad-hoc slot additions).
- Hero has one clear promise and one differentiator.
- Pain points describe consequences, not vague feelings.
- Features / how-it-works bullets are action-led and specific.
- Bottom CTA is verb-first and page-specific.

## 3) Proof quality

- Metrics are defensible and procurement-safe.
- Any non-validated metric is clearly labeled as illustrative or removed.
- Testimonials are specific enough to be useful (role/context/result).

## 4) Navigation and route consistency

- Page is reachable from top navigation and footer where applicable.
- Route slug is canonical and consistent with nav labels.
- Canonical alias routes (if any) resolve to the same page.
- Dropdown items are keyboard-selectable and mouse-selectable.

## 5) SEO and discoverability

- Meta title <= 60 characters.
- Meta description <= 155 characters.
- H1 reflects target search intent.
- Primary keyword appears naturally in hero copy.
- Internal links to related pages are valid.

## 6) Accessibility and UX

- Landmark structure is intact (`header`, `nav`, `main`, `footer`).
- Focus states are visible and keyboard traversal works.
- Dropdowns and interactive controls can be operated without a mouse.
- No text overflow in hero, cards, or CTA blocks at mobile widths.

## 7) i18n and localization

- EN source updates are made in `public/locales/en/solutions.json`.
- Key names remain stable unless there is an approved schema change.
- `nl/de/fr/es` updates happen only after EN approval.
- No missing keys or fallback artifacts in navigation labels.

## 8) Final release checks

- JSON validity check:
  - `node -e "JSON.parse(require('fs').readFileSync('public/locales/en/solutions.json','utf8'))"`
- Local visual smoke test across all changed pages.
- Brand and AI-claim review completed.
- Accessibility smoke test completed.

