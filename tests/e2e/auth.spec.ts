import { test, expect } from './fixtures'
import {
  createUniqueEmail,
  expectAuthenticatedDashboard,
  loginWithPassword,
  openLoginTab,
  signOutFromDashboard,
  signupWithPassword,
} from './helpers/auth'

// jankurai:allow HLT-010-SECRET-SPRAWL reason="static E2E login fixture, not a real credential" expires=2026-12-31
const password = 'PlaywrightPass123!'

test.describe('Local auth flow in Chrome', () => {
  test('can open login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
    await expect(page.locator('#login-title')).toBeVisible()
  })

  test('password signup redirects to dashboard and supports logout', async ({ page }) => {
    const email = createUniqueEmail('pw-signup')
    await signupWithPassword(page, email, password)
    await expectAuthenticatedDashboard(page)

    await signOutFromDashboard(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })

  test('existing user can login with password', async ({ page }) => {
    const email = createUniqueEmail('pw-login')
    await signupWithPassword(page, email, password)
    await expectAuthenticatedDashboard(page)

    await signOutFromDashboard(page)
    await loginWithPassword(page, email, password)
    await expectAuthenticatedDashboard(page)
  })

  test('invalid credentials show an error message', async ({ page }) => {
    const email = createUniqueEmail('pw-invalid')
    await openLoginTab(page, 'login')
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill('wrong-password')
    await page.getByRole('button', { name: /^(login|log in)/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })
})
