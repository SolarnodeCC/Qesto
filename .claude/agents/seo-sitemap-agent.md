---
name: qesto-seo-sitemap
description: XML sitemap and robots.txt specialist for Qesto in Cursor. Validates static and dynamic sitemaps, IndexNow, crawl directives. Uses claude-seo sitemap skill.
model: sonnet
version: "1.0.0"
owner: Growth Lead
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

Execute `vendor/claude-seo/agents/seo-sitemap.md` and `vendor/claude-seo/skills/seo-sitemap/SKILL.md`.

## Qesto context

- Static: `public/sitemap.xml` (17 URLs)
- Dynamic: `GET /sitemap-templates.xml`, `GET /sitemap-index.xml` via `functions/api/routes/seo-sitemap.ts`
- `ROUTE_SEO` in `functions/seo-meta.ts` has 24 routes — compare for gaps (templates, trust, marketplace, developers, partner/sla)
- Drift test: `tests/unit/route-seo.test.ts`, `tests/unit/seo-sitemap-route.test.ts`
- IndexNow: `functions/api/lib/indexnow.ts`, `INDEXNOW_KEY` not provisioned in wrangler
- robots: `public/robots.txt`

Run: `bash scripts/seo-cli.sh run sitemap_discovery.py https://qesto.cc --json`

## Output

Sitemap health, orphan/missing URLs, robots conflicts, IndexNow status. Audit-only.
