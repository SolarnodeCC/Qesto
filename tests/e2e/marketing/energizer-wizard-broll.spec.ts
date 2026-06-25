/**
 * Marketing B-roll: wizard + Emoji Poll energizer on launchpad (pre-live).
 * Recording: tests/artifacts/marketing-videos/01a-wizard-energizer-setup.webm
 */
import { test, expect, breathe, settle } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from '../helpers/auth'
import { createMarketingSessionViaWizard } from '../helpers/marketing-wizard'
import { ensureMarketingHostPlan } from '../helpers/marketing'
import { MARKETING_DEMO } from './demo-data'

test.describe('Marketing — energizer wizard B-roll', () => {
  test.setTimeout(300_000)

  test('wizard with emoji poll energizer on launchpad', async ({ page }) => {
    const { host, interactive } = MARKETING_DEMO
    const email = createUniqueEmail('demo-broll')
    await signupWithPassword(page, email, host.password, host.displayName)
    await expectAuthenticatedDashboard(page)
    await ensureMarketingHostPlan(page, email)
    await breathe(page)

    await createMarketingSessionViaWizard(page, {
      title: interactive.title,
      goal: interactive.goal,
      questionPrompt: interactive.question,
      optionA: interactive.optionA,
      optionB: interactive.optionB,
      energizerName: interactive.energizerName,
    })

    await expect(page.getByLabel(/qr code/i)).toBeVisible({ timeout: 15_000 })
    await settle(page)

    await expect(page.getByText(/energizers \(1\)/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /start emoji poll/i })).toBeVisible()
    await settle(page)
  })
})
