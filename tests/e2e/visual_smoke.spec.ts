import { test, expect } from '@playwright/test'

test.describe('visual smoke', () => {
  test('public pages render stable layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto('/login')
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page).toHaveScreenshot('login.png', { fullPage: true })

    await page.goto('/marketplace')
    await expect(page.locator('main')).toBeVisible()
    await expect(page).toHaveScreenshot('marketplace.png', { fullPage: true })

    await page.goto('/pricing')
    await expect(page.locator('main')).toBeVisible()
    await expect(page).toHaveScreenshot('pricing.png', { fullPage: true })
  })
})
