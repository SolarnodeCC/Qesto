# Testing assets

All automated tests and Playwright configuration live under **`tests/`**.

| Path | Purpose |
|------|---------|
| `unit/` | Vitest unit tests (`npm test`) |
| `integration/` | Miniflare / API integration suites |
| `functional/` | UI contract tests (Vitest) |
| `a11y/` | Accessibility-focused Vitest suites (`npm run test:a11y`) |
| `stress/` | Stress suites (`npm run test:stress`) |
| `e2e/` | Playwright specs (`npm run test:e2e*`) |
| `helpers/` | Shared mocks and factories |
| `playwright.config.ts` | Playwright entrypoint (`--config tests/playwright.config.ts`) |
| `docs/playwright-local.md` | Local full-stack / SPA Playwright workflow |
| `flaky.quarantine.txt` | Quarantine list for flaky cases |
| `artifacts/` | Generated traces, HTML report, screenshots (gitignored) |

Vitest is configured in root **`vite.config.ts`** (`test.include`: `tests/**/*.test.{ts,tsx}`). Coverage thresholds live there too; HTML/JSON land under repo **`coverage/`** when you opt into **`vitest run --coverage`** with the Vitest coverage provider installed.
