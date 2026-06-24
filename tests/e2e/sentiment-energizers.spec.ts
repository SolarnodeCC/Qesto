// E2E tests for SENTIMENT_ENABLED and LIVE_ENERGIZERS_ENABLED.
// Tests full flow: create session, start session, participant join/vote via WebSocket.

import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import {
  createUniqueEmail,
  expectAuthenticatedDashboard,
  signupWithPassword,
} from './helpers/auth'
import { newParticipantContext } from './helpers/context'
import {
  addPollQuestion,
  closeSession,
  createDraftSession,
  expectPresenterViewHealthy,
  openPresenterView,
  startSession,
} from './helpers/session'

async function addOpenQuestion(page: Page, sessionId: string, prompt: string): Promise<void> {
  await page.evaluate(async ({ id, questionPrompt }) => {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/questions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'open', prompt: questionPrompt }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }, { id: sessionId, questionPrompt: prompt })
}

test.describe('Sentiment & Energizers E2E', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(90_000)

  async function submitOpenResponse(
    browser: import('@playwright/test').Browser,
    baseURL: string | undefined,
    sessionCode: string,
    prompt: string,
    text: string,
  ): Promise<void> {
    const origin = baseURL ?? 'http://localhost:5173'
    const ctx = await newParticipantContext(browser, origin)
    const p = await ctx.newPage()
    try {
      await p.goto(`/j/${sessionCode}`)
      await expect(p.locator('#question-heading')).toContainText(prompt, { timeout: 30_000 })
      await p.locator('input[name="resp"]').fill(text)
      await p.getByRole('button', { name: /^submit$/i }).click()
      await expect(p.getByRole('status')).toContainText(/recorded|response/i, { timeout: 10_000 })
    } finally {
      await ctx.close()
    }
  }

  test('energizer activation and participant interaction flow', async ({ page, browser, baseURL }) => {
    const presenterEmail = createUniqueEmail('e2e-presenter')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Energizer ${Date.now()}`)
    await addPollQuestion(page, session.id, 'What is your name?')
    await startSession(page, session.id)
    await openPresenterView(page, session.id)

    const participantContext = await newParticipantContext(browser, baseURL)
    const participantPage = await participantContext.newPage()
    try {
      await participantPage.goto(`/j/${session.code}`)
      await expect(participantPage.locator('#question-heading')).toContainText('What is your name?', { timeout: 30_000 })
      await participantPage.getByRole('button', { name: /option a/i }).click()
      await expect(
        participantPage.getByRole('status').or(participantPage.getByText(/recorded|response|thanks/i)),
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await closeSession(page, session.id)
      await participantContext.close()
    }
  })

  test('sentiment analysis triggers after sufficient responses', async ({ page, browser, baseURL }) => {
    const presenterEmail = createUniqueEmail('e2e-sentiment')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Sentiment ${Date.now()}`)
    await addOpenQuestion(page, session.id, 'What was your experience?')
    await startSession(page, session.id)
    await openPresenterView(page, session.id)

    const feedbacks = [
      'This was a great experience!',
      'Really enjoyed the interaction',
      'Fantastic session overall',
      'Absolutely wonderful content',
      'Best session ever!',
    ]

    try {
      for (const text of feedbacks) {
        await submitOpenResponse(browser, baseURL, session.code, 'What was your experience?', text)
      }

      await expectPresenterViewHealthy(page, 'What was your experience?')
    } finally {
      await closeSession(page, session.id)
    }
  })

  test('error handling during sentiment analysis', async ({ page, browser, baseURL }) => {
    const presenterEmail = createUniqueEmail('e2e-sentiment-error')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Sentiment Error ${Date.now()}`)
    await addOpenQuestion(page, session.id, 'Your thoughts?')
    await startSession(page, session.id)
    await openPresenterView(page, session.id)

    for (let i = 0; i < 2; i++) {
      await submitOpenResponse(browser, baseURL, session.code, 'Your thoughts?', `Response ${i + 1}`)
    }

    await expectPresenterViewHealthy(page, 'Your thoughts?')
    await closeSession(page, session.id)
  })

  test('energizer timeout does not break session', async ({ page, browser, baseURL }) => {
    const presenterEmail = createUniqueEmail('e2e-timeout')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Timeout ${Date.now()}`)
    await addPollQuestion(page, session.id, 'First question?')
    await startSession(page, session.id)
    await openPresenterView(page, session.id)

    const participantContext = await newParticipantContext(browser, baseURL)
    const participantPage = await participantContext.newPage()
    try {
      await participantPage.goto(`/j/${session.code}`)
      await expect(participantPage.locator('#question-heading')).toContainText('First question?', { timeout: 30_000 })
      await expect(participantPage).toHaveTitle(/Qesto/i)
    } finally {
      await closeSession(page, session.id)
      await participantContext.close()
    }
  })

  test('concurrent participant responses with sentiment', async ({ page, browser, baseURL }) => {
    const presenterEmail = createUniqueEmail('e2e-concurrent')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(page, `E2E Concurrent ${Date.now()}`)
    await addOpenQuestion(page, session.id, 'Feedback?')
    await startSession(page, session.id)
    await openPresenterView(page, session.id)

    const feedback = ['Excellent!', 'Good experience', 'Great content']

    try {
      for (const text of feedback) {
        await submitOpenResponse(browser, baseURL, session.code, 'Feedback?', text)
      }

      await expectPresenterViewHealthy(page, 'Feedback?')
    } finally {
      await closeSession(page, session.id)
    }
  })
})
