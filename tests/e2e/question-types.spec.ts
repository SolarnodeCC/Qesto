import { test, expect } from './fixtures'
import type { Browser, Page } from '@playwright/test'
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { setLocalUserPlan } from './helpers/plan'
import { newParticipantContext } from './helpers/context'
import {
  addQuestion,
  closeSession,
  createDraftSession,
  expectPresenterViewHealthy,
  openPresenterView,
  startSession,
  type QuestionKind,
} from './helpers/session'

type KindCase = {
  kind: QuestionKind
  prompt: string
  options?: Array<{ id?: string; label: string }>
  interact: (page: Page) => Promise<void>
  skipRecordedCheck?: boolean
  /** Free plan blocks ranking, consent, and reaction — upgrade via local D1 in E2E. */
  requiresPlan?: 'starter' | 'team'
}

const STANDARD_OPTIONS = [
  { id: 'opt_a', label: 'Option A' },
  { id: 'opt_b', label: 'Option B' },
]

const UPVOTE_OPTIONS = [
  { id: 'idea_a', label: 'Idea A' },
  { id: 'idea_b', label: 'Idea B' },
]

const CONSENT_OPTIONS = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
]

const KIND_CASES: KindCase[] = [
  {
    kind: 'poll',
    prompt: 'E2E poll question?',
    options: STANDARD_OPTIONS,
    interact: async (p) => { await p.getByRole('button', { name: /option a/i }).click() },
  },
  {
    kind: 'ranking',
    prompt: 'E2E ranking question?',
    options: STANDARD_OPTIONS,
    requiresPlan: 'starter',
    interact: async (p) => { await p.getByRole('button', { name: /option a/i }).click() },
  },
  {
    kind: 'consent',
    prompt: 'E2E consent question?',
    options: CONSENT_OPTIONS,
    requiresPlan: 'starter',
    interact: async (p) => { await p.getByRole('button', { name: /^yes$/i }).click() },
  },
  {
    kind: 'multi_select',
    prompt: 'E2E multi-select question?',
    options: STANDARD_OPTIONS,
    skipRecordedCheck: true,
    interact: async (p) => {
      const optionA = p.getByRole('button', { name: /option a/i })
      await optionA.click()
      await expect(optionA).toHaveAttribute('aria-pressed', 'true')
    },
  },
  {
    kind: 'likert',
    prompt: 'E2E likert question?',
    interact: async (p) => { await p.getByRole('button', { name: 'Agree', exact: true }).click() },
  },
  {
    kind: 'upvote',
    prompt: 'E2E upvote question?',
    options: UPVOTE_OPTIONS,
    skipRecordedCheck: true,
    interact: async (p) => {
      const btn = p.getByRole('button', { name: /upvote.*idea a/i })
      await btn.click()
      await expect(btn).toBeDisabled({ timeout: 10_000 })
    },
  },
  {
    kind: 'open',
    prompt: 'E2E open question?',
    interact: async (p) => {
      await p.locator('input[name="resp"]').fill('Open response text')
      await p.getByRole('button', { name: /^submit$/i }).click()
    },
  },
  {
    kind: 'word_cloud',
    prompt: 'E2E word cloud question?',
    interact: async (p) => {
      await p.locator('input[name="resp"]').fill('Innovation')
      await p.getByRole('button', { name: /^submit$/i }).click()
    },
  },
  {
    kind: 'slider',
    prompt: 'E2E slider question?',
    skipRecordedCheck: true,
    interact: async (p) => {
      await p.getByRole('button', { name: /^submit$/i }).click()
      await expect(p.getByRole('status')).toContainText(/response/i, { timeout: 10_000 })
    },
  },
  {
    kind: 'reaction',
    prompt: 'E2E reaction question?',
    requiresPlan: 'starter',
    skipRecordedCheck: true,
    interact: async (p) => {
      const btn = p.getByRole('button', { name: /thumbs up/i })
      await expect(btn).toBeEnabled()
      await btn.click()
      // Ephemeral reaction channel — buttons stay enabled; sending is the assertion.
    },
  },
]

async function expectParticipantResponded(participantPage: Page): Promise<void> {
  await expect(
    participantPage.getByText(/vote recorded|response recorded|thanks/i).first(),
  ).toBeVisible({ timeout: 10_000 })
}

async function runKindCase(
  page: Page,
  browser: Browser,
  baseURL: string | undefined,
  kindCase: KindCase,
): Promise<void> {
  const email = createUniqueEmail(`qt-${kindCase.kind}`)
  await signupWithPassword(page, email, 'PlaywrightPass123!')
  await expectAuthenticatedDashboard(page)
  if (kindCase.requiresPlan) {
    setLocalUserPlan(email, kindCase.requiresPlan)
  }

  const session = await createDraftSession(page, `E2E ${kindCase.kind} ${Date.now()}`)
  await addQuestion(page, session.id, kindCase.kind, kindCase.prompt, kindCase.options)
  await startSession(page, session.id)
  await openPresenterView(page, session.id)

  const ctx = await newParticipantContext(browser, baseURL)
  try {
    const participantPage = await ctx.newPage()
    await participantPage.goto(`/j/${session.code}`)
    await expect(participantPage.locator('#question-heading')).toContainText(kindCase.prompt, { timeout: 30_000 })
    await kindCase.interact(participantPage)
    if (!kindCase.skipRecordedCheck) {
      await expectParticipantResponded(participantPage)
    }
    await expectPresenterViewHealthy(page, kindCase.prompt)
  } finally {
    await closeSession(page, session.id)
    await ctx.close()
  }
}

test.describe('Question type participant flows', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(90_000)

  for (const kindCase of KIND_CASES) {
    test(`participant can answer ${kindCase.kind} questions`, async ({ page, browser, baseURL }) => {
      await runKindCase(page, browser, baseURL, kindCase)
    })
  }
})
