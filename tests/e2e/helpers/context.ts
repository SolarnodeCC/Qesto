import type { Browser, BrowserContext } from '@playwright/test'

export async function newParticipantContext(
  browser: Browser,
  baseURL?: string,
): Promise<BrowserContext> {
  const context = await browser.newContext(baseURL ? { baseURL } : {})
  await context.addInitScript(() => {
    localStorage.setItem('qesto:cookie-consent', 'rejected')
    localStorage.setItem('qesto_lang', 'en')
  })
  return context
}
