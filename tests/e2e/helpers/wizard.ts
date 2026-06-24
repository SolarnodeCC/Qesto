import { expect, type Page } from '@playwright/test'

export type WizardSession = { sessionId: string; title: string }

/** Drive the dashboard Session Wizard UI through launchpad (no API shortcuts). */
export async function createSessionViaWizard(
  page: Page,
  opts: { title: string; goal: string; questionPrompt: string },
): Promise<WizardSession> {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: /new session/i })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /new session/i }).click()
  await page.getByRole('menuitem', { name: /interactive session/i }).click()
  const dialog = page.getByRole('dialog', { name: /create new session/i })
  await expect(dialog).toBeVisible({ timeout: 15_000 })

  await page.locator('#wiz-title').fill(opts.title)
  await page.locator('#wiz-goal').fill(opts.goal)
  await dialog.getByRole('button', { name: /^next$/i }).click()

  await dialog.getByRole('button', { name: /write yourself/i }).click()
  await dialog.getByLabel('Question text').fill(opts.questionPrompt)
  await dialog.locator('input[aria-label="Option 1"]').fill('Option A')
  await dialog.locator('input[aria-label="Option 2"]').fill('Option B')
  await dialog.getByRole('button', { name: /^next$/i }).click()

  await dialog.getByRole('button', { name: /skip energizer/i }).click()
  await dialog.getByRole('button', { name: /^next$/i }).click()

  await dialog.getByRole('button', { name: /start session/i }).click()
  await page.waitForURL(/\/sessions\/[^/]+\/launchpad(?:\?.*)?$/, { timeout: 30_000 })

  const match = page.url().match(/\/sessions\/([^/]+)\/launchpad/)
  if (!match?.[1]) throw new Error('Expected launchpad URL after wizard launch')
  const sessionId = match[1]

  await expect(page.locator(`#session-title-${sessionId}`)).toHaveValue(opts.title)
  return { sessionId, title: opts.title }
}
