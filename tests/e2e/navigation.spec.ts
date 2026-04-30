import { test, expect } from '@playwright/test'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'

test.describe('Navigation and CTA coverage', () => {
  test('home CTAs route to login/pricing when anonymous', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /launch your next session/i }).click()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)

    await page.goto('/')
    await page.getByRole('link', { name: /see the anonymity modes/i }).first().click()
    await expect(page).toHaveURL(/\/pricing(?:\?.*)?$/)
  })

  test('authenticated home CTA routes to dashboard', async ({ page }) => {
    const email = createUniqueEmail('pw-nav')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    await page.goto('/')
    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/)
  })

  test('pricing primary ctas route to login', async ({ page }) => {
    await page.goto('/pricing')
    await page.getByRole('link', { name: /start free/i }).click()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)

    await page.goto('/pricing')
    await page.getByRole('link', { name: /start 14-day trial/i }).click()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })
})
