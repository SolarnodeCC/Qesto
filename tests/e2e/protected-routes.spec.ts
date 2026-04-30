import { test, expect } from '@playwright/test'

const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/sessions/placeholder',
  '/sessions/placeholder/launchpad',
  '/sessions/placeholder/present',
  '/sessions/placeholder/results',
  '/teams/placeholder/settings',
]

test.describe('Protected route redirects when anonymous', () => {
  for (const route of protectedRoutes) {
    test(`redirects ${route} to login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
    })
  }
})
