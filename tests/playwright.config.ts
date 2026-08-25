import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const marketingVideoDir = path.join(testsDir, 'artifacts', 'marketing-videos')

// The full-stack server (scripts/e2e-serve-fullstack.sh) serves both the SPA and
// /api on :8788, so every project shares one origin. Overridable for runs against
// a deployed preview.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8788'

export default defineConfig({
  // Resolved relative to this config file (`tests/` → `tests/e2e/`)
  testDir: './e2e',
  outputDir: 'artifacts/output',
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
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // Owning startup here (rather than in the workflow) is what lets the declared
  // proof lane in agent/test-map.json — a bare `npx playwright test` — actually
  // pass, and keeps CI and local runs on one code path (issues #692, #688).
  webServer: {
    command: 'bash scripts/e2e-webserver.sh',
    url: BASE_URL,
    // Cold start includes a Vite build + D1 migrations.
    timeout: 300_000,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'fullstack-chrome',
      // a11y and visual-regression specs have dedicated projects. The visual
      // snapshots are keyed to `spa-chrome` (no *-fullstack-chrome-linux.png
      // baselines exist), so running them here fails on CI.
      testIgnore: [/a11y\.spec\.ts/, /visual_smoke\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
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
        baseURL: BASE_URL,
      },
    },
    {
      name: 'a11y-chrome',
      testMatch: /a11y\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'marketing-demo',
      testMatch: /marketing\/.*\.spec\.ts/,
      testIgnore: /a11y\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      outputDir: marketingVideoDir,
      use: {
        ...devices['Desktop Chrome'],
        video: 'on',
        viewport: { width: 1280, height: 720 },
        launchOptions: { slowMo: 350 },
      },
    },
  ],
})
