import { test, expect } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'

test.describe('Edge route behavior', () => {
  test('unknown route renders 404 page', async ({ page }) => {
    await page.goto('/definitely-not-a-real-route')
    await expect(page).toHaveURL(/\/definitely-not-a-real-route(?:\?.*)?$/)
    await expect(page.getByText('404')).toBeVisible()
  })

  test('invalid join code shows not-found state', async ({ page }) => {
    await page.goto('/j/ZZZZZZ')
    await expect(page).toHaveURL(/\/j\/ZZZZZZ(?:\?.*)?$/)
    await expect(page.getByRole('main')).toContainText(/not found|session/i)
  })

  test('authenticated dashboard tabs are switchable', async ({ page }) => {
    const email = createUniqueEmail('pw-tabs')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    await page.getByRole('button', { name: /insights/i }).click()
    await expect(page.locator('#section-insights')).toBeVisible()

    await page.getByRole('button', { name: /teams/i }).click()
    await expect(page.locator('#section-teams')).toBeVisible()

    await page.getByRole('button', { name: /templates/i }).click()
    await expect(page.locator('#section-templates')).toBeVisible()
  })
})
