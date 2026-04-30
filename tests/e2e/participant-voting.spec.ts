import { test, expect } from '@playwright/test'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { addPollQuestion, createDraftSession, getSessionResults, startSession } from './helpers/session'

test.describe('Participant voting flow', () => {
  test('participant can join by code and vote is reflected in results', async ({ page, browser, baseURL }) => {
    const email = createUniqueEmail('pw-vote')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Voting ${Date.now()}`)
    await addPollQuestion(page, session.id, 'What should we prioritize?')
    await startSession(page, session.id)

    const participantContext = await browser.newContext(baseURL ? { baseURL } : {})
    try {
      const participantPage = await participantContext.newPage()
      await participantPage.goto(`/j/${session.code}`)
      await expect(participantPage.getByRole('heading', { name: /what should we prioritize\\?/i })).toBeVisible()
      await participantPage.getByRole('button', { name: /option a/i }).click()
      await expect(participantPage.getByRole('status')).toContainText(/recorded|response/i)

      await expect
        .poll(async () => {
          const data = await getSessionResults(page, session.id)
          return data.results.total
        }, { timeout: 15_000 })
        .toBeGreaterThan(0)
    } finally {
      await participantContext.close()
    }
  })
})
