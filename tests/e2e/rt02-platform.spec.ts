import { test, expect } from './fixtures'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { apiFetch, createTeam } from './helpers/platform-api'
import {
  addPollQuestion,
  createDraftSession,
  expectPresenterViewHealthy,
  openPresenterView,
  startSession,
} from './helpers/session'

test.describe('RT-02 platform surfaces', () => {
  test.setTimeout(90_000)

  test('copilot panel opens on live presenter view (free plan gated message)', async ({ page }) => {
    const email = createUniqueEmail('copilot-ui')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Copilot ${Date.now()}`)
    await addPollQuestion(page, session.id, 'Copilot live check?')
    await startSession(page, session.id)
    await openPresenterView(page, session.id)
    await expectPresenterViewHealthy(page, 'Copilot live check?')

    await page.getByRole('button', { name: /open ai copilot/i }).click()
    const panel = page.getByRole('complementary', { name: 'AI Copilot' })
    await expect(panel).toBeVisible()
    await expect(panel.getByText(/available on paid plans/i)).toBeVisible()
  })

  test('learn instructor analytics API returns cohort summary', async ({ page }) => {
    const email = createUniqueEmail('learn-api')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const res = await apiFetch<{
      analytics: { summary: { participants: number; averagePercent: number; passRate: number } }
    }>(page, '/api/learn/instructor/analytics', {
      method: 'POST',
      body: JSON.stringify({
        configs: [{ questionId: 'q1', weight: 1, partialCredit: 'all_or_nothing' }],
        cohort: [
          {
            participantId: 'p1',
            responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }],
          },
          {
            participantId: 'p2',
            responses: [{ questionId: 'q1', correct: 0, incorrect: 1, required: 1 }],
          },
        ],
        passThreshold: 60,
      }),
    })

    expect(res.status).toBe(200)
    expect(res.data?.analytics.summary.participants).toBe(2)
    expect(res.data?.analytics.summary.averagePercent).toBeGreaterThan(0)
  })

  test('pulse summary API is plan-gated for free users', async ({ page }) => {
    const email = createUniqueEmail('pulse-gate')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const teamId = await createTeam(page, `Pulse Team ${Date.now()}`)
    const res = await apiFetch(page, `/api/teams/${encodeURIComponent(teamId)}/pulse/summary?window=30d`)

    expect(res.status).toBe(403)
    expect(res.error?.details?.feature).toBe('pulseAnalytics')
  })
})
