# Playwright Local E2E (Chrome)

This project includes Playwright E2E tests for auth flow, targeting local full-stack dev on `http://localhost:8788`.

## Prerequisites

- Google Chrome installed locally.
- Dependencies installed: `npm install`.
- Full-stack local server running on `http://localhost:8788`.

Recommended local server command:

```bash
npx wrangler pages dev dist --port 8788 --binding JWT_SECRET=dev-secret --binding ENVIRONMENT=development --binding APP_URL=http://localhost:8788 --no-show-interactive-dev-session
```

If needed, set up local D1 schema before running auth tests:

```bash
npx wrangler d1 execute qesto-db --local --file=functions/api/schema.sql
npx wrangler d1 execute qesto-db --local --file=migrations/005_user_badges.sql
```

## Install browser for Playwright

Run once if Playwright asks for browser installation:

```bash
npx playwright install chrome
```

## Run tests

- All E2E tests: `npm run test:e2e`
- Chrome project only: `npm run test:e2e:chrome`
- Headed mode: `npm run test:e2e:headed`

## Notes

- Default base URL is `http://localhost:8788`.
- You can override with: `PLAYWRIGHT_BASE_URL=http://localhost:8788 npm run test:e2e:chrome`.
- Auth tests use password signup/login flow for local reliability.
