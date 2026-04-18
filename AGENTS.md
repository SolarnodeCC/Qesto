# Qesto — Codex Project Guide

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
- `npm run dev` starts Vite at `http://localhost:5173/` with HMR. This serves the React SPA only — **API routes (`/api/*`) return 404** because the `@cloudflare/vite-plugin` does not support Pages Functions file-based routing (`functions/` directory). It only supports Workers with a `main` entry point.
- The frontend is fully testable in this mode: i18n, navigation, UI components.

### Full-stack local dev (backend API)
- Full-stack requires `npm run build` then `npx wrangler pages dev dist --port 8788 --binding JWT_SECRET=<value> --binding ENVIRONMENT=development --binding APP_URL=http://localhost:8788 --no-show-interactive-dev-session`.
- `CLOUDFLARE_API_TOKEN` env var **must be set** — the `[ai]` binding in `wrangler.toml` forces wrangler to authenticate with Cloudflare. Without it, wrangler fails after an auth timeout (~60s).
- **D1 schema**: Apply the schema to the local D1 database on first run: `npx wrangler d1 execute qesto-db --local --file=functions/api/schema.sql` and `npx wrangler d1 execute qesto-db --local --file=migrations/005_user_badges.sql`.
- **Durable Objects**: `SESSION_ROOM` is defined with `script_name = "qesto"` (an external worker). It shows as `local [not connected]` and WebSocket/realtime features return 503 locally. REST API endpoints (auth, sessions CRUD, templates, billing) work fine.
- **Magic links in dev**: The email send fails (no `RESEND_API_KEY`), but the dev server logs `DEV magic link: <url>` to the console. Use that URL to complete auth.

### Testing
- `npm test` — Vitest unit tests (880 tests). Pre-commit hook also runs this.
- `npm run type-check` — TypeScript check (`tsc --noEmit`).
- `npm run check` — Runs `check:wrangler`, `check:api`, and `check:i18n`. The `check:wrangler` script requires Cloudflare authentication and will fail without it.
- `npm run build` — Production build to `dist/`.
- 2 test suites (`sessionLifecycle.test.ts`, `sessionOrchestration.test.ts`) fail to import missing source files — pre-existing, not related to environment setup.

### Gotchas
- `.npmrc` has `legacy-peer-deps=true` — npm install requires this for dependency resolution.
- `simple-git-hooks` runs `npm test` as a pre-commit hook (configured in `package.json`). Use `--no-verify` if the hook blocks on pre-existing test failures.
- The `wrangler.jsonc` and `wrangler.toml` both exist — wrangler prefers `.jsonc` by default.
- `.dev.vars` is gitignored and can be used for local secrets (JWT_SECRET, RESEND_API_KEY, etc.).
