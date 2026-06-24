import { test, expect } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { newParticipantContext } from './helpers/context'
import { addPollQuestion, createDraftSession, openPresenterView, startSession } from './helpers/session'

test.describe('Participant voting flow', () => {
  test.setTimeout(90_000)

  test('participant can join by code and vote is reflected in results', async ({ page, browser, baseURL }) => {
    const email = createUniqueEmail('pw-vote')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Voting ${Date.now()}`)
    await addPollQuestion(page, session.id, 'What should we prioritize?')
    await startSession(page, session.id)
    await openPresenterView(page, session.id)

    const participantContext = await newParticipantContext(browser, baseURL)
    try {
      const participantPage = await participantContext.newPage()
      await participantPage.goto(`/j/${session.code}`)
      await expect(participantPage.locator('#question-heading')).toContainText('What should we prioritize?', { timeout: 30_000 })
      await participantPage.getByRole('button', { name: /option a/i }).click()
      await expect(participantPage.getByRole('status')).toContainText(/recorded|response/i, { timeout: 10_000 })

      await expect(page.getByLabel(/Option A: 100% of votes/i)).toBeVisible({ timeout: 15_000 })
    } finally {
      await participantContext.close()
    }
  })
})
