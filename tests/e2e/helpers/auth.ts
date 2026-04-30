import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export function createUniqueEmail(prefix = 'pw-auth'): string {
  const stamp = Date.now()
  const nonce = Math.floor(Math.random() * 10_000)
  return `${prefix}-${stamp}-${nonce}@example.com`
}

export async function openLoginTab(page: Page, tab: 'login' | 'signup'): Promise<void> {
  await page.goto('/login')
  const targetField = tab === 'login' ? '#login-email' : '#signup-email'
  if (await page.locator(targetField).isVisible()) return

  const tabLabel = tab === 'login' ? /^(login|log in)$/i : /^(signup|sign up)$/i
  await page.getByRole('tab', { name: tabLabel }).first().click()
  await expect(page.locator(targetField)).toBeVisible()
}

export async function signupWithPassword(page: Page, email: string, password: string, name = 'Playwright User'): Promise<void> {
  await openLoginTab(page, 'signup')
  await page.locator('#signup-email').fill(email)
  await page.locator('#signup-name').fill(name)
  await page.locator('#signup-password').fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
}

export async function loginWithPassword(page: Page, email: string, password: string): Promise<void> {
  await openLoginTab(page, 'login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: /^(login|log in)/i }).click()
}

export async function expectAuthenticatedDashboard(page: Page): Promise<void> {
  await page.waitForURL(/\/dashboard(?:\?.*)?$/)
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
}
