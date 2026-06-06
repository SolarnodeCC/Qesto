import { test, expect } from '@playwright/test'

/** apps/web visual review — geometry-stable public routes (CLS budget < 0.05). */
test.describe('apps/web visual review', () => {
  test('public pages render stable layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto('/login')
    await expect(page.locator('main')).toBeVisible()
    await expect(page).toHaveScreenshot('apps-web-login.png', { fullPage: true })

    await page.goto('/pricing')
    await expect(page.locator('main')).toBeVisible()
    await expect(page).toHaveScreenshot('apps-web-pricing.png', { fullPage: true })
  })
})
