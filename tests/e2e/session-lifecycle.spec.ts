import { test, expect } from '@playwright/test'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { addPollQuestion, closeSession, createDraftSession, startSession } from './helpers/session'

test.describe('Session lifecycle coverage', () => {
  test('draft session is visible in launchpad and startable', async ({ page }) => {
    const email = createUniqueEmail('pw-life')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Lifecycle ${Date.now()}`)
    await addPollQuestion(page, session.id, 'How are we doing today?')

    await page.goto(`/sessions/${session.id}/launchpad`)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/launchpad(?:\\?.*)?$`))
    await expect(page.getByText(session.title)).toBeVisible()
    await expect(page.getByRole('button', { name: /open lobby/i })).toBeVisible()
  })

  test('live and closed state routes resolve correctly', async ({ page }) => {
    const email = createUniqueEmail('pw-state')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Route State ${Date.now()}`)
    await addPollQuestion(page, session.id, 'Pick an option')

    await startSession(page, session.id)
    await page.goto(`/sessions/${session.id}/launchpad`)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present(?:\\?.*)?$`))

    await closeSession(page, session.id)
    await page.goto(`/sessions/${session.id}/launchpad`)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/results(?:\\?.*)?$`))

    await page.goto(`/sessions/${session.id}/results`)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/results(?:\\?.*)?$`))
  })
})
