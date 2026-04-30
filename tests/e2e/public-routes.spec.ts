import { test, expect } from '@playwright/test'

const publicRoutes = [
  '/',
  '/login',
  '/pricing',
  '/privacy',
  '/terms',
  '/events',
  '/hr',
  '/nonprofit',
  '/consulting',
  '/features/ai-insights',
  '/features/live-polling',
  '/features/privacy',
  '/use-cases/team-meetings',
  '/use-cases/workshops',
  '/use-cases/training',
]

test.describe('Public route smoke coverage', () => {
  for (const route of publicRoutes) {
    test(`loads ${route}`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(new RegExp(`${route === '/' ? '/' : route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?.*)?$`))
      await expect(page.locator('main').first()).toBeVisible()
    })
  }
})
