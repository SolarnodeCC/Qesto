# Playwright Local E2E

_Hub: [`../README.md`](../README.md) (testing folder map)._

This project includes Playwright E2E tests for public route smoke checks, auth, session lifecycle, participant voting, and a small real-page axe accessibility pass.

## Modes

- `spa-chrome`: Vite-only route smoke tests at `http://localhost:5173`.
- `fullstack-chrome`: Cloudflare Pages Functions tests at `http://localhost:8788`.
- `a11y-chrome`: real rendered public pages with axe injected by Playwright.

## Prerequisites

- Google Chrome installed locally, or run `npx playwright install chrome`.
- Dependencies installed with `npm install`.
- For full-stack tests, `CLOUDFLARE_API_TOKEN` must be available because Wrangler authenticates when the AI binding is present.

## Vite-only smoke tests

In one terminal:

```bash
npm run dev
```

In another terminal:

```bash
npm run test:e2e:spa
```

This validates public/protected SPA routing only. API-backed tests require full-stack mode.

## Full-stack local tests

Build the frontend first:

```bash
npm run build
```

Apply the local D1 migrations:

```bash
npm run e2e:db:local
```

Start the Pages dev server:

```bash
npm run e2e:serve:fullstack
```

Then run the full-stack suite from a second terminal:

```bash
npm run test:e2e:fullstack
```

## Accessibility pass

With the full-stack server running:

```bash
npm run test:e2e:a11y
```

## Useful commands

- Default full-stack suite: `npm run test:e2e`
- Full-stack suite explicitly: `npm run test:e2e:fullstack`
- SPA smoke subset: `npm run test:e2e:spa`
- Real-page axe smoke subset: `npm run test:e2e:a11y`
- Headed mode: `npm run test:e2e:headed`
- List discovered tests: `npx playwright test --list`

## Notes

- Full-stack default base URL is `http://localhost:8788`.
- SPA project default base URL is `http://localhost:5173`.
- Override either with `PLAYWRIGHT_BASE_URL`.
- Auth tests use password signup/login flow for local reliability.
- Durable Object realtime/WebSocket behavior is not covered by local E2E while `SESSION_ROOM` is configured as an external worker and shows as local `[not connected]`.
