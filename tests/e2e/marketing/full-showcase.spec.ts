/**
 * Marketing video: full product showcase (live poll + town hall Q&A).
 * Recording: tests/artifacts/marketing-videos/00-full-product-showcase.webm
 */
import { test, expect, breathe, settle, MARKETING_PAYOFF_MS } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from '../helpers/auth'
import { newParticipantContext } from '../helpers/context'
import { createMarketingSessionViaWizard } from '../helpers/marketing-wizard'
import {
  approveTownhallQuestion,
  createTownhallFromDashboard,
  readSessionCode,
  renameSessionTitle,
  ensureMarketingHostPlan,
  seedPollVotesStaggered,
  submitTownhallQuestion,
  waitForTownhallConsoleReady,
} from '../helpers/marketing'
import { expectPresenterViewHealthy } from '../helpers/session'
import { MARKETING_DEMO } from './demo-data'

test.describe('Marketing — full showcase', () => {
  test.setTimeout(540_000)

  test('live interactive poll and town hall Q&A', async ({ page, browser, baseURL }) => {
    const { host, interactive, townhall } = MARKETING_DEMO
    const email = createUniqueEmail('demo-showcase')
    await signupWithPassword(page, email, host.password, host.displayName)
    await expectAuthenticatedDashboard(page)
    await ensureMarketingHostPlan(page, email)

    const { sessionId } = await createMarketingSessionViaWizard(page, {
      title: interactive.title,
      goal: interactive.goal,
      questionPrompt: interactive.question,
      optionA: interactive.optionA,
      optionB: interactive.optionB,
    })
    await page.getByRole('button', { name: /open lobby/i }).click()
    await page.waitForURL(new RegExp(`/sessions/${sessionId}/present`), { timeout: 45_000 })
    await settle(page)

    const pollCode = await readSessionCode(page, sessionId)
    await seedPollVotesStaggered(browser, baseURL!, page, pollCode, interactive.question, [
      interactive.optionA,
      interactive.optionB,
    ])
    await expectPresenterViewHealthy(page, interactive.question)
    await breathe(page)

    await page.goto('/dashboard')
    await expectAuthenticatedDashboard(page)
    await settle(page)

    const townhallId = await createTownhallFromDashboard(page)
    await renameSessionTitle(page, townhallId, townhall.title)
    await page.reload()
    await page.getByRole('button', { name: /start q&a/i }).click()
    await waitForTownhallConsoleReady(page)
    await settle(page)

    const thCode = await readSessionCode(page, townhallId)
    const thParticipant = await newParticipantContext(browser, baseURL)
    const thPage = await thParticipant.newPage()
    try {
      await thPage.goto(`/th/${thCode}`)
      await submitTownhallQuestion(thPage, townhall.audienceQuestion)
      await expect(page.getByText(townhall.audienceQuestion)).toBeVisible({ timeout: 60_000 })
      await approveTownhallQuestion(page, townhall.audienceQuestion)
      await page.getByRole('tab', { name: /approved/i }).click()
      await expect(page.getByText(townhall.audienceQuestion)).toBeVisible({ timeout: 15_000 })
      await settle(page, MARKETING_PAYOFF_MS)
    } finally {
      await thParticipant.close()
    }
  })
})
