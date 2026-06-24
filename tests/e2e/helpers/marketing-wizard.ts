import { expect, type Page } from '@playwright/test'

import { breathe, settle, typeHuman } from './marketing-pacing'

export type MarketingWizardSession = { sessionId: string; title: string }

/** Marketing wizard: interactive session with poll + optional energizer format. */
export async function createMarketingSessionViaWizard(
  page: Page,
  opts: {
    title: string
    goal: string
    questionPrompt: string
    optionA: string
    optionB: string
    energizerName?: string
  },
): Promise<MarketingWizardSession> {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: /new session/i })).toBeVisible({ timeout: 30_000 })
  await breathe(page)

  await page.getByRole('button', { name: /new session/i }).click()
  const interactiveItem = page.getByRole('menuitem', { name: /interactive session/i })
  if (await interactiveItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await interactiveItem.click()
  }

  const dialog = page.getByRole('dialog', { name: /create new session/i })
  await expect(dialog).toBeVisible({ timeout: 15_000 })

  await typeHuman(page.locator('#wiz-title'), opts.title)
  await typeHuman(page.locator('#wiz-goal'), opts.goal)
  await dialog.getByRole('button', { name: /^next$/i }).click()
  await settle(page)

  await dialog.getByRole('button', { name: /write yourself/i }).click()
  await typeHuman(dialog.getByLabel('Question text'), opts.questionPrompt)
  await typeHuman(dialog.locator('input[aria-label="Option 1"]'), opts.optionA)
  await breathe(page)
  await typeHuman(dialog.locator('input[aria-label="Option 2"]'), opts.optionB)
  await dialog.getByRole('button', { name: /^next$/i }).click()
  await settle(page)

  if (opts.energizerName) {
    await dialog.getByRole('button', { name: new RegExp(opts.energizerName, 'i') }).click()
    await settle(page)
  } else {
    await dialog.getByRole('button', { name: /skip energizer/i }).click()
  }
  await dialog.getByRole('button', { name: /^next$/i }).click()

  await dialog.getByRole('button', { name: /start session/i }).click()
  await page.waitForURL(/\/sessions\/[^/]+\/launchpad(?:\?.*)?$/, { timeout: 30_000 })

  const match = page.url().match(/\/sessions\/([^/]+)\/launchpad/)
  if (!match?.[1]) throw new Error('Expected launchpad URL after wizard launch')
  const sessionId = match[1]

  await expect(page.locator(`#session-title-${sessionId}`)).toHaveValue(opts.title)
  return { sessionId, title: opts.title }
}
