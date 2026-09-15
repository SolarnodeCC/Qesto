/**
 * Requirement: knowledge-base/specifications/domain/SPEC_CORE.md §Session State Machine — DRAFT → ENERGIZING → LIVE → CLOSED.
 */
import { test, expect } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { addPollQuestion, closeSession, createDraftSession, startSession } from './helpers/session'

test.describe('Session lifecycle coverage', () => {
  // Six navigations plus Durable Object init and a presenter WebSocket. The
  // 30s default is too tight: the lighter sibling spec already burns ~27s of
  // it. Same budget participant-voting.spec.ts uses for the same reason.
  test.setTimeout(90_000)

  test('draft session is visible in launchpad and startable', async ({ page }) => {
    const email = createUniqueEmail('pw-life')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Lifecycle ${Date.now()}`)
    await addPollQuestion(page, session.id, 'How are we doing today?')

    await page.goto(`/sessions/${session.id}/launchpad`)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/launchpad(?:\\?.*)?$`))
    await expect(page.getByRole('button', { name: /open lobby/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(`#session-title-${session.id}`)).toHaveValue(session.title)
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
