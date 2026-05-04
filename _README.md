# Qesto

Real-time interactive session platform: live voting, presenter controls, teams, billing, and Workers AI–backed flows on Cloudflare (see [`CLAUDE.md`](CLAUDE.md) for stack and invariants).

## Documentation

**Start with the [documentation map](docs/README.md)** — how `docs/` fits together, which file wins when narratives differ, and curated reading order for engineering, product, security, design, and i18n.

- [`CLAUDE.md`](CLAUDE.md) — project context, architecture sketch, and hard rules for AI-assisted work.
- [`AGENTS.md`](AGENTS.md) — Codex/Cursor conventions, local development, and checks.

Technical specifications live under [`docs/spec/`](docs/spec/) (hub: [`docs/spec/INDEX.md`](docs/spec/INDEX.md)). Design tokens and visual system: [`docs/spec/design-tokens.README.md`](docs/spec/design-tokens.README.md).

## Golden path (local)

```bash
npm install
cp .dev.vars.example .dev.vars                # fill JWT_SECRET + RESEND_API_KEY
npm run tokens:build                          # generate src/ui/tokens.ts from docs/spec/design-tokens.json
npm run typecheck                             # tsc --noEmit (hard rule 4)
npm test                                      # vitest (hard rule 3)
npm run build                                 # vite build → dist/
npm run dev                                   # vite dev server on :5173
# separate terminal:
npm run dev:worker                            # wrangler pages dev → functions/ on :8788
```

Verify `curl http://localhost:8788/api/admin/health` → `{"ok":true,...}`.

## Build plan

v1 vertical slice per [`docs/spec/includes/PREBUILD_AND_DELIVERY.md`](docs/spec/includes/PREBUILD_AND_DELIVERY.md). Phase 0 (foundation) is in; Phase 1 (magic-link auth) is next. See [`docs/adr/ADR-0001-do-per-session.md`](docs/adr/ADR-0001-do-per-session.md) for the LIVE-state decision.
