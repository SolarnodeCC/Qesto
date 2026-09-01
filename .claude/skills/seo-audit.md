---
name: seo-audit-qesto
description: Cursor orchestrator for claude-seo on Qesto. Runs /seo audit, /seo page, /seo technical, /seo schema, /seo sitemap, /seo geo, /seo competitor-pages, and related commands against https://qesto.cc (or a given URL). Delegates to vendored claude-seo sub-agents in parallel and merges with Qesto codebase SEO signals. Invoke for full-site audits, single-page analysis, schema/sitemap checks, GEO/AEO, and competitor-page planning.
model: sonnet
version: "1.0.0"
owner: Growth Lead
---
# Skill: SEO Audit Orchestrator (Cursor + claude-seo)

# SCOPE: orchestrate claude-seo commands in Cursor / Cloud Agents — parallel specialist audits, Qesto codebase overlay, actionable plan
# LOAD: when the user invokes `/seo …`, asks to run claude-seo agents, or requests a full organic-visibility audit on qesto.cc
# VERSION: v1.0.0
# OWNER: Growth Lead

Follow `.claude/skills/COMMON_RULES.md` for global constraints.
Edge ownership: see `.claude/skills/HANDOFFS.md` (E33, E34, E35).

## Prerequisites

1. **Vendor tree:** `vendor/claude-seo/` must exist. If missing, run:
   ```bash
   npm run seo:setup
   ```
2. **Runtime check (before audits that fetch live pages):**
   ```bash
   npm run seo:doctor
   ```
3. **Pinned version:** `vendor/claude-seo.lock.json` (currently v2.2.5).

## Cursor tool mapping (claude-seo → Cursor)

| claude-seo skill says | Use in Cursor |
|---|---|
| `Read` | `Read` tool |
| `Write` / `Edit` | `Write` / `StrReplace` |
| `Bash` | `Shell` |
| `Glob` / `Grep` | `Glob` / `Grep` |
| `WebFetch` | `WebFetch` (may fail on Cloudflare challenge — fall back to codebase + `seo-cli run render_page.py`) |
| `./bin/claude-seo run …` | `npm run seo:run -- …` or `bash scripts/seo-cli.sh run …` |
| Spawn subagent | `Task` tool (see dispatch table below) |
| `maxTurns` in agent frontmatter | Ignore — Cursor manages turns |

**Never** call user-supplied URLs with bare `curl`/`fetch` bypassing claude-seo SSRF guards. Use:
```bash
bash scripts/seo-cli.sh run render_page.py https://qesto.cc/ --mode auto --json
```

## Default audit target

- **Production site:** `https://qesto.cc`
- **Codebase SEO sources:** `functions/seo-meta.ts`, `src/components/PageSeo.tsx`, `public/robots.txt`, `public/sitemap.xml`, `functions/api/routes/seo-sitemap.ts`, `index.html`, `tests/unit/route-seo.test.ts`

When Cloudflare challenge blocks live fetch, **always** audit the codebase layer and state that live HTML was not verified.

## Command router

Parse the user's message as `/seo <command> [args]`:

| Command | Action |
|---|---|
| `audit <url>` | Full parallel audit (table below) + Qesto `seo-reviewer` codebase pass |
| `page <url>` | Single-page deep dive → load `vendor/claude-seo/skills/seo-page/SKILL.md` |
| `technical <url>` | → `qesto-seo-technical` Task |
| `content <url>` | → `qesto-seo-content` Task |
| `schema <url>` | → `qesto-seo-schema` Task |
| `sitemap <url\|generate>` | → `qesto-seo-sitemap` Task + read `public/sitemap.xml` |
| `geo <url>` | → `qesto-seo-geo` Task |
| `competitor-pages [url]` | → `qesto-seo-competitor-pages` Task + `knowledge-base/product/research/MARKET_VALIDATION_S*.md` |
| `hreflang <url>` | → load `vendor/claude-seo/skills/seo-hreflang/SKILL.md` (Qesto: 5 UI locales, no hreflang yet) |
| `drift baseline\|compare\|history <url>` | `bash scripts/seo-cli.sh run drift_baseline.py …` etc. |
| `setup` / `doctor` | `npm run seo:setup` / `npm run seo:doctor` |

For commands not listed, load the matching sub-skill from `vendor/claude-seo/skills/seo-<name>/SKILL.md`.

## Full audit dispatch (`/seo audit`)

**Step 1 — Detect business type:** SaaS (Qesto). Skip local/ecommerce agents unless URL indicates otherwise.

**Step 2 — Launch parallel Tasks** (all in one message). Prefer dedicated subagent types when available; otherwise use `generalPurpose` with the agent file body as the task prompt:

| Task subagent_type | Agent instructions file | Focus |
|---|---|---|
| `qesto-seo-technical` | `vendor/claude-seo/agents/seo-technical.md` | Crawl, index, CWV, JS rendering |
| `qesto-seo-content` | `vendor/claude-seo/agents/seo-content.md` | E-E-A-T, intent, thin content |
| `qesto-seo-schema` | `vendor/claude-seo/agents/seo-schema.md` | JSON-LD detect/validate |
| `qesto-seo-sitemap` | `vendor/claude-seo/agents/seo-sitemap.md` | Sitemap/robots |
| `qesto-seo-geo` | `vendor/claude-seo/agents/seo-geo.md` | AI Overviews / citability |
| `qesto-seo-competitor-pages` | `.claude/agents/seo-competitor-pages-agent.md` | `/vs/*` gaps vs market validation |
| `qesto-seo-reviewer` | `.claude/skills/seo-reviewer.md` | Qesto-specific codebase + handoffs |

Each Task prompt must include:
- Target URL (default `https://qesto.cc`)
- Instruction to run `bash scripts/seo-cli.sh run render_page.py <url> --mode auto --json` for live HTML when needed
- Instruction to read Qesto SEO files listed above when live fetch fails
- Output: severity-classified findings in the format from `seo-reviewer.md`

**Step 3 — Synthesize** using claude-seo 10-principle framework (PERCEIVE → ANALYZE → VALIDATE → ACT):
- SEO Health Score 0–100 (weighted: Critical = -15, High = -8, Medium = -3, Low = -1, floor 0)
- Unified action plan with dependencies
- Each recommendation: observation, fix, falsifiability check ("how would we know this failed?"), leading indicator

**Step 4 — Handoffs**
- Copy/content → marketing (E33)
- Markup/meta/SSR → frontend (E34)
- robots/sitemap/IndexNow/GSC → devops (E35)
- `/vs/*` page builds → marketing + frontend

## Output contract

1. **Scope audited** — URLs, codebase paths, tools run, data not available (GSC, backlinks, etc.)
2. **Findings** — severity format from `seo-reviewer.md`
3. **SEO Health Score** — 0–100 with category breakdown
4. **Prioritized action plan** — phased, with owners
5. **Handoffs** — E33/E34/E35 with finding IDs
6. **What already works** — preserve list

## Boundaries

- **Own:** orchestration, synthesis, audit reports, running vendored claude-seo scripts
- **Read:** vendored `vendor/claude-seo/**`, Qesto marketing/SEO paths, live site via seo-cli
- **Never touch product code** unless the user explicitly asks to implement fixes — default is audit-only (same as `seo-reviewer`)
- **Never propose black-hat tactics**

## Docs to Update

After a full audit that changes SEO strategy:
- `knowledge-base/marketing/seo/README.md` — link to latest audit summary if persisted
- `knowledge-base/product/backlog/BACKLOG_ACTIVE.md` — new SEO work items only when user confirms
