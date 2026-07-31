# Qesto — Codex Project Guide

Read [`agent/JANKURAI_STANDARD.md`](./agent/JANKURAI_STANDARD.md) first. Proof lanes: `just setup`, `just check`, `just fast`, `just score`. Agent docs: [`docs/architecture.md`](./docs/architecture.md), [`docs/boundaries.md`](./docs/boundaries.md), [`docs/testing.md`](./docs/testing.md).

**Documentation map:** [`/knowledge-base/README.md`](./knowledge-base/README.md) — navigation by role (PO, backend, frontend, devops, security, AI). Internal docs use the **Obsidian** vault in `knowledge-base/` only (not Notion); see [`OBSIDIAN_KB_STANDARD.md`](./knowledge-base/governance/OBSIDIAN_KB_STANDARD.md).

**AI Agent & Skill Governance:** See [`/knowledge-base/ai-context/`](./knowledge-base/ai-context/) for agent system overview, skill templates, and research decisions.

## Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS v4
- **Backend**: Cloudflare Pages Functions (Hono framework) in `functions/api/[[route]].ts`
- **Worker**: Separate Cloudflare Worker in `worker/` met eigen `wrangler.toml`
- **Database**: Cloudflare D1 (`DB` binding, database `qesto-db`)
- **KV**: USERS_KV, SESSIONS_KV, TEAMS_KV, TEMPLATES_KV, DECISIONS_KV, AUDIT_KV, ACTIONS_KV
- **Durable Objects**: SESSION_ROOM (class `SessionRoom`) voor realtime sessie state
- **Vectorize**: DECISIONS_VECTORIZE (qesto-decisions, 768 dimensies, cosine)
- **AI**: Workers AI via `c.env.AI.run()` — gebruik NOOIT externe Anthropic API calls
- **Email**: Resend via `RESEND_API_KEY` secret, zie `functions/api/auth.ts:sendEmail()`
- **Payments**: Stripe, price IDs in `wrangler.toml [vars]`, secrets via `wrangler pages secret`
- **Auth**: Magic link (JWT) + SAML SSO, zie `functions/api/auth.ts`

## API Docs (Context Hub)

Gebruik `chub` om actuele API-documentatie op te halen vóór je een integratie schrijft.
`chub` bevat Qesto-specifieke annotaties die de generieke docs aanvullen.

```bash
chub get cloudflare/workers --lang js   # Workers, KV, Durable Objects, D1
chub get stripe/api --lang js            # Stripe betalingen
chub get stripe/payments --lang js       # Stripe checkout/webhooks
chub get anthropic/Codex-api --lang js  # Codex API (referentie)
chub annotate --list                     # Bekijk alle Qesto annotaties
```

Voeg een annotatie toe als je iets projectspecifieks ontdekt:
```bash
chub annotate cloudflare/workers "nieuwe bevinding over hoe Qesto X doet"
```

## Conventies

- Alle routes in `functions/api/[[route]].ts` volgen het patroon `app.get/post/patch/delete`
- Context type: `Context<{ Bindings: Env }>` — Env definitie in `functions/api/types.ts`
- Tests in `tests/unit/` met Vitest — draai altijd `npm test` voor commit
- Geen `ANTHROPIC_API_KEY` — vervangen door `c.env.AI` (Workers AI)
- Secrets nooit in `wrangler.toml` — gebruik `wrangler pages secret put`

## Deployment

```bash
npm run build          # Frontend bouwen
wrangler pages deploy  # Deployen naar Cloudflare Pages (qesto project)
```

## Cursor Cloud specific instructions

### Frontend dev server
- `npm run dev` starts Vite at `http://localhost:5173/` with HMR. This serves the React SPA only — **API routes (`/api/*`) return 404** because the Vite config proxies `/api` to `http://localhost:8787` (only works when wrangler dev is also running).
- The frontend is fully testable in this mode: i18n, navigation, UI components.

### Full-stack local dev (backend API)
- The simplest approach: create `.dev.vars` with `JWT_SECRET`, `ENVIRONMENT`, and `APP_URL`, then run `npx wrangler dev --port 8787 --local`. The `worker/index.ts` entry point delegates to the Hono app in `functions/api/app.ts`.
- Without `--local`, wrangler tries remote proxy for the `[ai]` binding and requires `CLOUDFLARE_API_TOKEN`. With `--local`, AI and Vectorize show as "not supported" but the server starts and all REST API endpoints work.
- **D1 schema**: Apply migrations to the local D1 database on first run: `npm run e2e:db:local` (runs `wrangler d1 migrations apply qesto_3_db --local`). The database name in `wrangler.toml` is `qesto_3_db`; migrations live in `migrations/` (the root `schema.sql` is the consolidated reference, not the apply path).
- **Durable Objects**: `SESSION_ROOM` runs locally. WebSocket/realtime features work in local mode.
- **Magic links in dev**: Without `RESEND_API_KEY`, the dev server logs the magic link as `[email:dev] to=<email> subject=...` followed by the full URL (with `PAGES_URL`/`API_URL` base). GOTCHA: in Cursor Cloud, the 64-hex token is scrubbed by secret-redaction in captured terminal/log output, so you cannot copy the logged link to finish auth. Instead seed a row directly in local D1 and call the callback: pick a 64-hex `RAW` token, insert `magic_links(token_hash=SHA-256(RAW), email, created_at, expires_at=now+900000, consumed_at=NULL)` via `wrangler d1 execute qesto_3_db --local`, then `GET /api/auth/callback?token=<RAW>` (saves the `qesto_session` cookie). Setting `PAGES_URL`/`API_URL` in `.dev.vars` to `http://localhost:5173`/`http://localhost:8787` keeps the post-callback redirect and CSRF origin local for browser flows.

### Testing
- `npm test` — Vitest unit tests (currently 2580 tests across 302 files).
- `npm run typecheck` — TypeScript check (`tsc --noEmit`).
- `npm run check:i18n` — i18n key validation. NOTE: currently fails on pre-existing missing NL/ES/DE/FR translation keys (a repo content gap, not an environment problem). There is no top-level `npm run check` script; the heavy full local gate is `npm run check:rc` (includes build + eval + a11y).
- `npm run build` — Production build to `dist/`.

### Gotchas
- `.npmrc` must have `legacy-peer-deps=true` — npm install requires this for dependency resolution. Create `.npmrc` if it doesn't exist.
- `.dev.vars` is gitignored and should be used for local secrets (JWT_SECRET, ENVIRONMENT, APP_URL, RESEND_API_KEY, etc.).
- Only `wrangler.toml` exists (no `wrangler.jsonc`).
- `npm run build` is just `vite build` (there is no separate `tokens:build` step in the build pipeline).
- Free-plan users get `403 feature_not_available` on plan-gated endpoints (e.g. team insights/trends/scorecard, AI question generation) — this is expected entitlement gating, not a bug.
