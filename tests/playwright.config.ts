import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Resolved relative to this config file (`tests/` → `tests/e2e/`)
  testDir: './e2e',
  outputDir: 'tests/artifacts/output',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/artifacts/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'fullstack-chrome',
      testIgnore: /a11y\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    {
      name: 'spa-chrome',
      testMatch: [
        /public-routes\.spec\.ts/,
        /protected-routes\.spec\.ts/,
        /visual_smoke\.spec\.ts/,
      ],
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
      },
    },
    {
      name: 'a11y-chrome',
      testMatch: /a11y\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
})
