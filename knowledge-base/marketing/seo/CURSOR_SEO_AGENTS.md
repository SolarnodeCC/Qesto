# claude-seo in Cursor — Qesto integration

**Upstream:** [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT), pinned in `vendor/claude-seo.lock.json`.

## Setup

```bash
npm run seo:setup    # clone vendor + isolated Python/Chromium
npm run seo:doctor   # verify runtime
```

The vendor tree (`vendor/claude-seo/`) is gitignored; only the lock file is committed.

## How to run audits in Cursor

Ask the agent in natural language or use claude-seo command syntax:

| User message | Orchestrator |
|---|---|
| `/seo audit https://qesto.cc` | `qesto-seo-audit` → parallel specialists |
| `/seo technical https://qesto.cc` | `qesto-seo-technical` |
| `/seo competitor-pages` | `qesto-seo-competitor-pages` |
| Pre-publish marketing page review | `qesto-seo-reviewer` only |

**Skill routing:** `.claude/skills/seo-audit.md`  
**Agent definitions:** `.claude/agents/seo-*-agent.md`

## Parallel full audit (what runs)

On `/seo audit`, the orchestrator dispatches:

1. `qesto-seo-technical` — crawl, index, CWV, JS rendering
2. `qesto-seo-content` — E-E-A-T, intent, internal links
3. `qesto-seo-schema` — JSON-LD
4. `qesto-seo-sitemap` — robots + sitemaps + IndexNow
5. `qesto-seo-geo` — AI Overviews / citability
6. `qesto-seo-competitor-pages` — `/vs/*` gap analysis
7. `qesto-seo-reviewer` — Qesto codebase overlay + handoffs

Results merge into an SEO Health Score (0–100) and phased action plan.

## Handoffs

| Edge | Owner | Examples |
|---|---|---|
| E33 | marketing | Copy, `/vs/*` content, hub pages |
| E34 | frontend | PageSeo, routes, client schema |
| E35 | devops | GSC, IndexNow, robots/sitemap deploy |

## Direct script usage

```bash
npm run seo:run -- run render_page.py https://qesto.cc --mode auto --json
npm run seo:run -- run sitemap_discovery.py https://qesto.cc --json
npm run seo:run -- run drift_baseline.py https://qesto.cc
```

## Updating claude-seo

1. Bump `tag` and `commit` in `vendor/claude-seo.lock.json`
2. Run `npm run seo:setup`
3. Smoke-test `/seo audit https://qesto.cc`
4. Note version in PR description
