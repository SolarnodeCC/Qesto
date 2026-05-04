# Qesto — Codex Project Guide

**Documentation map:** [`docs/README.md`](docs/README.md) — how `docs/`, `docs/spec/`, and planning files connect (truth hierarchy, reading order).

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
- **D1 schema**: Apply the schema to the local D1 database on first run: `npx wrangler d1 execute qesto_2_db --local --file=schema.sql`. The database name in `wrangler.toml` is `qesto_2_db` and the schema file is at the repo root (`schema.sql`).
- **Durable Objects**: `SESSION_ROOM` runs locally. WebSocket/realtime features work in local mode.
- **Magic links in dev**: Without `RESEND_API_KEY`, the dev server logs the magic link to the console as `[email:dev] to=<email> subject=...` followed by the full URL. Use that URL (replacing `https://qesto.cc` with `http://localhost:8787`) to complete auth.

### Testing
- `npm test` — Vitest unit tests (485 tests across 54 suites).
- `npm run typecheck` — TypeScript check (`tsc --noEmit`).
- `npm run check` — Runs `check:wrangler`, `check:api`, and `check:i18n`. The `check:wrangler` script requires Cloudflare authentication and will fail without it.
- `npm run build` — Production build to `dist/`.

### Gotchas
- `.npmrc` must have `legacy-peer-deps=true` — npm install requires this for dependency resolution. Create `.npmrc` if it doesn't exist.
- `.dev.vars` is gitignored and should be used for local secrets (JWT_SECRET, ENVIRONMENT, APP_URL, RESEND_API_KEY, etc.).
- Only `wrangler.toml` exists (no `wrangler.jsonc`).
- The `npm run build` step includes `npm run tokens:build` which generates `src/ui/tokens.ts` and `src/ui/tailwind-theme.ts` — these are committed but regenerated on every build.
