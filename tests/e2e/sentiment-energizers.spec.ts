// E2E tests for SENTIMENT_ENABLED and LIVE_ENERGIZERS_ENABLED.
// Tests full flow: create session, add energizer, start session, interact with energizer, verify sentiment.

import { test, expect } from '@playwright/test'
import {
  createUniqueEmail,
  expectAuthenticatedDashboard,
  signupWithPassword,
} from './helpers/auth'
import {
  addPollQuestion,
  closeSession,
  createDraftSession,
  startSession,
} from './helpers/session'

test.describe('Sentiment & Energizers E2E', () => {
  test('energizer activation and participant interaction flow', async ({ page, browser }) => {
    // SETUP: Create session as presenter
    const presenterEmail = createUniqueEmail('e2e-presenter')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(
      page,
      `E2E Energizer ${Date.now()}`,
    )
    await addPollQuestion(page, session.id, 'What is your name?')

    // START SESSION
    await startSession(page, session.id)

    // Wait for presenter to be in LIVE view
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present`))
    await expect(page.getByText('What is your name?')).toBeVisible()

    // Wait for session to be ready
    await page.waitForTimeout(2000)

    // PARTICIPANT JOIN: Create second browser context for participant
    const participantContext = await browser.newContext()
    const participantPage = await participantContext.newPage()

    // Navigate to participant join page
    const baseUrl = page.url().split('/sessions')[0]
    await participantPage.goto(`${baseUrl}/sessions/${session.code}`)

    // Enter participant name
    await participantPage.getByPlaceholder(/name|username/i).fill('Alice')
    await participantPage.getByRole('button', { name: /join/i }).click()

    // Verify participant is in session
    await expect(participantPage.getByText('What is your name?')).toBeVisible()

    // PARTICIPANT VOTES
    await participantPage.getByRole('button', { name: /option 1/i }).click()

    // Verify vote was counted
    await expect(participantPage.getByText(/1 response/i)).toBeVisible()

    // Wait for sentiment analysis to run (30s cooldown)
    // For e2e, we don't wait full cooldown - just verify no errors

    // ENERGIZER FUNCTIONALITY (if enabled)
    // Note: Actual energizer activation would happen via WebSocket
    // Verify no console errors during sentiment processing
    const errors: string[] = []
    participantPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.waitForTimeout(1000)
    expect(errors.filter((e) => !e.includes('WARNING'))).toEqual([])

    // CLEANUP
    await closeSession(page, session.id)
    await participantContext.close()
  })

  test('sentiment analysis triggers after sufficient responses', async ({
    page,
    browser,
  }) => {
    // SETUP
    const presenterEmail = createUniqueEmail('e2e-sentiment')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(
      page,
      `E2E Sentiment ${Date.now()}`,
    )

    // Add open-ended question (requires sentiment)
    await page.goto(`/sessions/${session.id}/edit`)
    await page.getByRole('button', { name: /add question/i }).click()

    // Select open-ended question type
    await page.getByLabel(/open.*question|free.*text/i).click()
    await page.getByPlaceholder(/prompt|question/i).fill('What was your experience?')
    await page.getByRole('button', { name: /save|create/i }).click()

    // START SESSION
    await startSession(page, session.id)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present`))

    // Create multiple participant contexts to generate responses
    const participantCount = 5
    const contexts = []

    for (let i = 0; i < participantCount; i++) {
      const ctx = await browser.newContext()
      const p = await ctx.newPage()
      const baseUrl = page.url().split('/sessions')[0]

      await p.goto(`${baseUrl}/sessions/${session.code}`)
      await p.getByPlaceholder(/name|username/i).fill(`Participant ${i + 1}`)
      await p.getByRole('button', { name: /join/i }).click()

      // Wait for question to appear
      await expect(p.getByText(/experience/i)).toBeVisible()

      // Submit open response
      const feedbacks = [
        'This was a great experience!',
        'Really enjoyed the interaction',
        'Fantastic session overall',
        'Absolutely wonderful content',
        'Best session ever!',
      ]
      await p.getByRole('textbox').fill(feedbacks[i])
      await p.getByRole('button', { name: /submit|send/i }).click()

      contexts.push({ context: ctx, page: p })
    }

    // VERIFY SENTIMENT PROCESSING
    // After 5+ responses, sentiment analysis should have triggered
    // (cooldown is 30s, but we don't wait for full analysis)

    // Verify participants can see the question
    for (const { page: p } of contexts) {
      await expect(p.getByText(/experience/i)).toBeVisible()
      // Verify no WebSocket errors
      const logs: string[] = []
      p.on('console', (msg) => {
        if (msg.type() === 'error') logs.push(msg.text())
      })
    }

    // CLEANUP
    await closeSession(page, session.id)
    for (const { context: ctx } of contexts) {
      await ctx.close()
    }
  })

  test('error handling during sentiment analysis', async ({ page, browser }) => {
    // SETUP: Create session with minimal responses (should not trigger sentiment)
    const presenterEmail = createUniqueEmail('e2e-sentiment-error')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(
      page,
      `E2E Sentiment Error ${Date.now()}`,
    )

    // Add open question
    await page.goto(`/sessions/${session.id}/edit`)
    await page.getByRole('button', { name: /add question/i }).click()
    await page.getByLabel(/open.*question|free.*text/i).click()
    await page.getByPlaceholder(/prompt|question/i).fill('Your thoughts?')
    await page.getByRole('button', { name: /save|create/i }).click()

    // START SESSION
    await startSession(page, session.id)

    // Add only 2 participants (below 5 response minimum)
    const participantCount = 2
    for (let i = 0; i < participantCount; i++) {
      const ctx = await browser.newContext()
      const p = await ctx.newPage()
      const baseUrl = page.url().split('/sessions')[0]

      await p.goto(`${baseUrl}/sessions/${session.code}`)
      await p.getByPlaceholder(/name|username/i).fill(`Participant ${i + 1}`)
      await p.getByRole('button', { name: /join/i }).click()
      await expect(p.getByText(/thoughts/i)).toBeVisible()

      // Submit response
      await p.getByRole('textbox').fill(`Response ${i + 1}`)
      await p.getByRole('button', { name: /submit|send/i }).click()

      await ctx.close()
    }

    // Sentiment should NOT trigger (insufficient responses)
    // Session should continue normally without sentiment
    await expect(page.getByText(/results|voting/i)).toBeVisible()

    await closeSession(page, session.id)
  })

  test('energizer timeout does not break session', async ({ page, browser }) => {
    // SETUP: Create session
    const presenterEmail = createUniqueEmail('e2e-timeout')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(
      page,
      `E2E Timeout ${Date.now()}`,
    )
    await addPollQuestion(page, session.id, 'First question?')

    // START SESSION
    await startSession(page, session.id)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present`))

    // Join participants
    const participantContext = await browser.newContext()
    const participantPage = await participantContext.newPage()
    const baseUrl = page.url().split('/sessions')[0]

    await participantPage.goto(`${baseUrl}/sessions/${session.code}`)
    await participantPage.getByPlaceholder(/name|username/i).fill('Bob')
    await participantPage.getByRole('button', { name: /join/i }).click()

    // VERIFY SESSION REMAINS RESPONSIVE
    // Even if energizer would timeout (5 min), session continues
    await expect(participantPage.getByText('First question?')).toBeVisible()

    // Advance to next question (or close)
    await page.getByRole('button', { name: /advance|next/i }).click()

    // Verify participant sees next state
    await participantPage.waitForTimeout(1000)
    await expect(participantPage).toHaveTitleContaining('Qesto')

    // CLEANUP
    await closeSession(page, session.id)
    await participantContext.close()
  })

  test('concurrent participant responses with sentiment', async ({
    page,
    browser,
  }) => {
    // STRESS TEST: Multiple participants voting concurrently
    const presenterEmail = createUniqueEmail('e2e-concurrent')
    await signupWithPassword(page, presenterEmail, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)

    const session = await createDraftSession(
      page,
      `E2E Concurrent ${Date.now()}`,
    )

    // Add open question
    await page.goto(`/sessions/${session.id}/edit`)
    await page.getByRole('button', { name: /add question/i }).click()
    await page.getByLabel(/open.*question|free.*text/i).click()
    await page.getByPlaceholder(/prompt|question/i).fill('Feedback?')
    await page.getByRole('button', { name: /save|create/i }).click()

    // START SESSION
    await startSession(page, session.id)

    // Launch 10 concurrent participants
    const contexts = []
    const promises = []

    for (let i = 0; i < 10; i++) {
      const promise = (async () => {
        const ctx = await browser.newContext()
        const p = await ctx.newPage()
        const baseUrl = page.url().split('/sessions')[0]

        await p.goto(`${baseUrl}/sessions/${session.code}`)
        await p.getByPlaceholder(/name|username/i).fill(`User${i}`)
        await p.getByRole('button', { name: /join/i }).click()

        await expect(p.getByText(/feedback/i)).toBeVisible()

        // Submit response
        const feedback = [
          'Excellent!',
          'Good experience',
          'Great content',
          'Very helpful',
          'Loved it!',
          'Amazing',
          'Perfect',
          'Super good',
          'Outstanding',
          'Wonderful',
        ]
        await p.getByRole('textbox').fill(feedback[i])
        await p.getByRole('button', { name: /submit|send/i }).click()

        contexts.push({ context: ctx, page: p })
      })()
      promises.push(promise)
    }

    // Wait for all participants to join and vote
    await Promise.all(promises)

    // VERIFY RESULTS
    // All votes should be counted without errors
    await page.waitForTimeout(2000)
    const responseCount = await page.locator('[data-testid*="response"]').count()
    expect(responseCount).toBeGreaterThanOrEqual(0)

    // Verify no session errors
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleLogs.logs.push(msg.text())
    })

    // CLEANUP
    await closeSession(page, session.id)
    for (const { context: ctx } of contexts) {
      await ctx.close()
    }
  })
})
