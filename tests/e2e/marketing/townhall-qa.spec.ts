/**
 * Marketing video: Town hall Q&A — create → start → audience question → approve.
 * Recording: tests/artifacts/marketing-videos/02-townhall-live-qa.webm
 */
import { test, expect, breathe, settle, MARKETING_PAYOFF_MS } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from '../helpers/auth'
import { newParticipantContext } from '../helpers/context'
import {
  approveTownhallQuestion,
  createTownhallFromDashboard,
  readSessionCode,
  renameSessionTitle,
  ensureMarketingHostPlan,
  submitTownhallQuestion,
  waitForTownhallConsoleReady,
} from '../helpers/marketing'
import { stagger } from '../helpers/marketing-pacing'
import { MARKETING_DEMO } from './demo-data'

test.describe('Marketing — town hall Q&A', () => {
  test.setTimeout(480_000)

  test('town hall from dashboard to moderated live Q&A', async ({ page, browser, baseURL }) => {
    const { host, townhall } = MARKETING_DEMO
    const email = createUniqueEmail('demo-townhall')
    await signupWithPassword(page, email, host.password, host.displayName)
    await expectAuthenticatedDashboard(page)
    await ensureMarketingHostPlan(page, email)
    await breathe(page)

    const sessionId = await createTownhallFromDashboard(page)
    await renameSessionTitle(page, sessionId, townhall.title)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(townhall.title)
    await settle(page)

    await page.getByRole('button', { name: /start q&a/i }).click()
    await waitForTownhallConsoleReady(page)
    await settle(page)

    const code = await readSessionCode(page, sessionId)
    const participantA = await newParticipantContext(browser, baseURL)
    const participantB = await newParticipantContext(browser, baseURL)
    const pageA = await participantA.newPage()
    const pageB = await participantB.newPage()

    try {
      await pageA.goto(`/th/${code}`)
      await expect(pageA.getByRole('heading', { level: 1 })).toContainText(townhall.title, { timeout: 30_000 })
      await submitTownhallQuestion(pageA, townhall.audienceQuestion)

      await expect(page.getByText(townhall.audienceQuestion)).toBeVisible({ timeout: 60_000 })
      await stagger(page)

      await pageB.goto(`/th/${code}`)
      await submitTownhallQuestion(pageB, townhall.secondQuestion)
      await expect(page.getByText(townhall.secondQuestion)).toBeVisible({ timeout: 60_000 })
      await settle(page)

      await approveTownhallQuestion(page, townhall.audienceQuestion)
      await page.getByRole('tab', { name: /approved/i }).click()
      await expect(page.getByText(townhall.audienceQuestion)).toBeVisible({ timeout: 15_000 })
      await settle(page, MARKETING_PAYOFF_MS)
    } finally {
      await participantA.close()
      await participantB.close()
    }
  })
})
