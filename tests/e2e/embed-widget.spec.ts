import { test, expect } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { apiFetch } from './helpers/platform-api'
import { addPollQuestion, createDraftSession, startSession } from './helpers/session'

test.describe('Embed widget trust boundary', () => {
  test.setTimeout(60_000)

  test('free plan cannot mint embed widgets via API', async ({ page }) => {
    const email = createUniqueEmail('embed-free')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Embed ${Date.now()}`)
    await addPollQuestion(page, session.id, 'Embed poll?')
    await startSession(page, session.id)

    const res = await apiFetch(page, '/api/embed/widgets', {
      method: 'POST',
      body: JSON.stringify({
        session_id: session.id,
        allowed_origins: ['https://customer.example.com'],
      }),
    })

    expect(res.status).toBe(403)
    expect(res.error?.details?.feature).toBe('embedWidgets')
  })

  test('embed playground shows upgrade gate for free plan', async ({ page }) => {
    const email = createUniqueEmail('embed-playground')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    await page.goto('/embed/playground')
    await expect(page.getByRole('status', { name: /embed widgets require a chorus plan/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /upgrade to chorus/i })).toBeVisible()
  })
})
