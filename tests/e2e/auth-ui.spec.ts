import { test, expect } from '@playwright/test'
import { createUniqueEmail, openLoginTab } from './helpers/auth'

test.describe('Auth UI and validation flows', () => {
  test('signup enforces minimum password length', async ({ page }) => {
    const email = createUniqueEmail('pw-short')
    await openLoginTab(page, 'signup')
    await page.locator('#signup-email').fill(email)
    await page.locator('#signup-password').fill('short')
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByRole('alert')).toContainText(/8/i)
  })

  test('magic link form validates bad email', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#magic-email').fill('not-an-email')
    await page.getByRole('button', { name: /send login link/i }).click()
    await expect(page.locator('#magic-email')).toBeVisible()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })

  test('password reset request accepts valid email', async ({ page }) => {
    const email = createUniqueEmail('pw-reset')
    await openLoginTab(page, 'login')
    await page.locator('#login-email').fill(email)
    await page.getByRole('button', { name: /forgot password/i }).click()
    await page.locator('#reset-email').fill(email)
    await page.locator('form:has(#reset-email) button[type="submit"]').click()
    await expect(page.locator('form')).toContainText(/reset your password/i)
  })
})
