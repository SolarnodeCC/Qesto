import { test, expect } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { createDraftSession, addPollQuestion, startSession, openPresenterView } from './helpers/session'
import { createSessionViaWizard } from './helpers/wizard'

test.describe('Session wizard host funnel', () => {
  test.setTimeout(90_000)

  test('wizard creates session and lands on launchpad with title', async ({ page }) => {
    const email = createUniqueEmail('wiz-flow')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const title = `E2E Wizard ${Date.now()}`
    const { sessionId } = await createSessionViaWizard(page, {
      title,
      goal: 'Validate the host wizard funnel end-to-end.',
      questionPrompt: 'How is the team doing?',
    })

    await expect(page.getByRole('button', { name: /open lobby/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(`#session-title-${sessionId}`)).toHaveValue(title)
  })

  test('launchpad can start a wizard-created session', async ({ page }) => {
    const email = createUniqueEmail('wiz-start')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const { sessionId } = await createSessionViaWizard(page, {
      title: `E2E Wizard Start ${Date.now()}`,
      goal: 'Start live session from launchpad after wizard.',
      questionPrompt: 'Ready to begin?',
    })

    await page.getByRole('button', { name: /open lobby/i }).click()
    await page.waitForURL(new RegExp(`/sessions/${sessionId}/present(?:\\?.*)?$`), { timeout: 30_000 })
    await expect(page.getByRole('toolbar', { name: 'Presenter controls' })).toBeVisible()
  })

  test('launchpad still supports API-seeded draft sessions', async ({ page }) => {
    const email = createUniqueEmail('wiz-api-seed')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `API seed ${Date.now()}`)

    await addPollQuestion(page, session.id, 'Seeded poll?')
    await page.goto(`/sessions/${session.id}/launchpad`)
    await expect(page.getByRole('button', { name: /open lobby/i })).toBeVisible({ timeout: 15_000 })

    await startSession(page, session.id)
    await openPresenterView(page, session.id)
    await expect(page.getByRole('toolbar', { name: 'Presenter controls' })).toBeVisible()
  })
})
