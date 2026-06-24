import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Browser, type Page } from '@playwright/test'
import type { TestInfo } from '@playwright/test'

import { setLocalUserPlan } from './plan'
import { newParticipantContext } from './context'
import {
  settle,
  stagger,
  typeHuman,
} from './marketing-pacing'

const MARKETING_VIDEO_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../artifacts/marketing-videos',
)


/** @deprecated Use `settle()` from marketing fixtures. */
export async function pauseForVideo(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms)
}

/** Seed poll votes one participant at a time so presenter bars climb visibly. */
export async function seedPollVotesStaggered(
  browser: Browser,
  baseURL: string,
  hostPage: Page,
  code: string,
  question: string,
  optionLabels: string[],
): Promise<void> {
  for (let i = 0; i < optionLabels.length; i++) {
    const label = optionLabels[i]!
    const participantCtx = await newParticipantContext(browser, baseURL)
    const participantPage = await participantCtx.newPage()
    try {
      await participantPage.goto(`/j/${code}`)
      await expect(participantPage.locator('#question-heading')).toContainText(question, { timeout: 45_000 })
      await participantPage.getByRole('button', { name: new RegExp(label, 'i') }).click()
      await expect(
        participantPage.getByRole('status').or(participantPage.getByText(/vote recorded|thanks/i)),
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await participantCtx.close()
    }
    if (i < optionLabels.length - 1) await stagger(hostPage)
  }
}

/** Submit a town hall question with human-paced typing. */
export async function submitTownhallQuestion(page: Page, body: string): Promise<void> {
  await typeHuman(page.locator('#th-body'), body)
  await page.getByRole('button', { name: /submit anonymously/i }).click()
  await expect(page.getByText(/submitted/i)).toBeVisible({ timeout: 15_000 })
}

/** Copy Playwright recording to a stable marketing assets folder. */
export async function saveMarketingVideo(page: Page, testInfo: TestInfo, filename: string): Promise<string> {
  const video = page.video()
  if (!video) {
    throw new Error('No video recording — run with the marketing-demo Playwright project')
  }
  fs.mkdirSync(MARKETING_VIDEO_DIR, { recursive: true })
  const dest = path.join(MARKETING_VIDEO_DIR, filename)
  await video.saveAs(dest)
  await testInfo.attach('marketing-video', { path: dest, contentType: 'video/webm' })
  return dest
}

export async function ensureMarketingHostPlan(page: Page, email: string): Promise<void> {
  setLocalUserPlan(email, 'team')
  await page.evaluate(() => {
    localStorage.setItem('qesto_lang', 'en')
    localStorage.setItem('qesto:cookie-consent', 'rejected')
  })
  await page.reload()
  await page.waitForURL(/\/dashboard(?:\?.*)?$/)
  await expect(page.getByRole('button', { name: /^Account:/i })).toBeVisible({ timeout: 15_000 })
}

export async function startLiveSessionReliably(page: Page, sessionId: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.evaluate(async (id) => {
        const token = sessionStorage.getItem('qesto_token')
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/start`, {
          method: 'POST',
          credentials: 'include',
          headers: token ? { authorization: `Bearer ${token}` } : {},
        })
        const json = await res.json() as { ok?: boolean; error?: { message?: string } }
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      }, sessionId)
      return
    } catch (err) {
      lastError = err
      await page.waitForTimeout(1_500)
    }
  }
  throw lastError
}

export async function renameSessionTitle(page: Page, sessionId: string, title: string): Promise<void> {
  await page.evaluate(async ({ id, sessionTitle }) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title: sessionTitle }),
    })
    if (!res.ok) throw new Error(`Failed to rename session (HTTP ${res.status})`)
  }, { id: sessionId, sessionTitle: title })
}

export async function readSessionCode(page: Page, sessionId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
      credentials: 'include',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json() as { ok?: boolean; data?: { session?: { code?: string } } }
    const code = json?.data?.session?.code
    if (!code) throw new Error('Missing session code')
    return code
  }, sessionId)
}

/** Host console is live and the presenter WebSocket is settled (no reconnect banner). */
export async function waitForTownhallConsoleReady(page: Page): Promise<void> {
  await expect(page.getByText(/participants join at/i)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('tab', { name: /pending/i })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/reconnecting/i)).toHaveCount(0, { timeout: 45_000 })
  await page.waitForTimeout(750)
}

/** Approve a pending question and wait until the Approved tab reflects it. */
export async function approveTownhallQuestion(page: Page, questionBody: string): Promise<void> {
  await waitForTownhallConsoleReady(page)
  await page.getByRole('tab', { name: /pending/i }).click()
  const card = page.locator('.rounded-xl.border').filter({ hasText: questionBody })
  await expect(card).toBeVisible({ timeout: 60_000 })
  const approveBtn = card.getByRole('button', { name: /^approve$/i })

  let lastError: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await approveBtn.click()
      await expect(page.getByRole('tab', { name: /approved \(1\)/i })).toBeVisible({ timeout: 12_000 })
      await settle(page)
      return
    } catch (err) {
      lastError = err
      await page.waitForTimeout(1_000)
      await waitForTownhallConsoleReady(page)
      await page.getByRole('tab', { name: /pending/i }).click()
    }
  }
  throw lastError ?? new Error('Town hall approve did not update the moderation queue')
}

/** Dashboard → Town hall Q&A (Team plan). Returns session id on the moderation console. */
export async function createTownhallFromDashboard(page: Page): Promise<string> {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: /new session/i })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /new session/i }).click()
  await settle(page, 800)
  await page.getByRole('menuitem', { name: /town hall q&a/i }).click()
  await page.waitForURL(/\/sessions\/[^/]+\/townhall(?:\?.*)?$/, { timeout: 30_000 })
  const match = page.url().match(/\/sessions\/([^/]+)\/townhall/)
  if (!match?.[1]) throw new Error('Expected townhall console URL')
  return match[1]
}
