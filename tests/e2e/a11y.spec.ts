/**
 * Requirement: knowledge-base/quality/accessibility/A11Y_FULL.md §3 — axe audit of the real, served pages.
 *
 * The Vitest a11y lane audits rendered markup in jsdom; this lane is the same
 * requirement proved against the shipped SPA in a browser.
 */
import { test, expect } from './fixtures'
import { expectNoSeriousA11yViolations } from './helpers/a11y'

const publicPages = [
  { path: '/', name: 'Home' },
  { path: '/login', name: 'Login' },
  { path: '/pricing', name: 'Pricing' },
]

test.describe('Real page accessibility smoke coverage', () => {
  for (const pageCase of publicPages) {
    test(`${pageCase.name} has no serious axe violations`, async ({ page }) => {
      await page.goto(pageCase.path)
      await expect(page.locator('main').first()).toBeVisible()
      await expectNoSeriousA11yViolations(page, pageCase.name)
    })
  }
})
