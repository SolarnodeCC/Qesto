/**
 * Marketing video: interactive session — wizard → live poll (participant + presenter).
 * Recording: tests/artifacts/marketing-videos/01b-interactive-live-session.webm
 *
 * Energizer warm-up B-roll is recorded separately (01a) because local DO start
 * with draft energizers can be flaky; splice 01a + 01b in post for a full story.
 */
import { test, expect, breathe, settle, MARKETING_PAYOFF_MS } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from '../helpers/auth'
import { createMarketingSessionViaWizard } from '../helpers/marketing-wizard'
import { ensureMarketingHostPlan, readSessionCode, seedPollVotesStaggered } from '../helpers/marketing'
import { expectPresenterViewHealthy } from '../helpers/session'
import { MARKETING_DEMO } from './demo-data'

test.describe('Marketing — interactive live session', () => {
  test.setTimeout(420_000)

  test('wizard to live poll with audience participation', async ({ page, browser, baseURL }) => {
    const { host, interactive } = MARKETING_DEMO
    const email = createUniqueEmail('demo-live')
    await signupWithPassword(page, email, host.password, host.displayName)
    await expectAuthenticatedDashboard(page)
    await ensureMarketingHostPlan(page, email)
    await breathe(page)

    const { sessionId } = await createMarketingSessionViaWizard(page, {
      title: interactive.title,
      goal: interactive.goal,
      questionPrompt: interactive.question,
      optionA: interactive.optionA,
      optionB: interactive.optionB,
    })

    await expect(page.getByLabel(/qr code/i)).toBeVisible({ timeout: 15_000 })
    await settle(page)

    await expect(page.getByRole('button', { name: /open lobby/i })).toBeEnabled({ timeout: 30_000 })
    await page.getByRole('button', { name: /open lobby/i }).click()
    await page.waitForURL(new RegExp(`/sessions/${sessionId}/present`), { timeout: 45_000 })
    await expect(page.getByText(/waiting|participants|join/i).first()).toBeVisible({ timeout: 30_000 })
    await settle(page)

    const code = await readSessionCode(page, sessionId)
    await seedPollVotesStaggered(browser, baseURL!, page, code, interactive.question, [
      interactive.optionA,
      interactive.optionA,
      interactive.optionB,
    ])

    await expectPresenterViewHealthy(page, interactive.question)
    await settle(page, MARKETING_PAYOFF_MS)
  })
})
