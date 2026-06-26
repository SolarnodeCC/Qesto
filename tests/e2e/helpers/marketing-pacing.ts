import { type Locator, type Page } from '@playwright/test'

/** Cursor delay between actions (also set via Playwright `launchOptions.slowMo`). */
export const MARKETING_SLOW_MO = 350
/** Hold after UI has updated so motion reads on screen. */
export const MARKETING_SETTLE_MS = 1_500
/** Gap between incremental votes / questions so counts climb visibly. */
export const MARKETING_STAGGER_MS = 750
/** Hold on a finished state before navigating away (editor cut point). */
export const MARKETING_TRANSITION_MS = 1_000
/** Payoff shot — live results, approved question, etc. */
export const MARKETING_PAYOFF_MS = 2_000
/** Per-keystroke delay when typing marketing copy in forms. */
export const MARKETING_TYPE_DELAY_MS = 48

export async function settle(page: Page, ms = MARKETING_SETTLE_MS): Promise<void> {
  await page.waitForTimeout(ms)
}

export async function stagger(page: Page, ms = MARKETING_STAGGER_MS): Promise<void> {
  await page.waitForTimeout(ms)
}

export async function breathe(page: Page, ms = MARKETING_TRANSITION_MS): Promise<void> {
  await page.waitForTimeout(ms)
}

export async function typeHuman(locator: Locator, text: string, delayMs = MARKETING_TYPE_DELAY_MS): Promise<void> {
  await locator.click()
  await locator.fill('')
  await locator.pressSequentially(text, { delay: delayMs })
}
