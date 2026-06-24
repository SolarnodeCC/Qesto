import { test as base, expect } from '@playwright/test'

/** Pre-set cookie consent so the banner does not cover CTAs or fail touch-target checks. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      localStorage.setItem('qesto:cookie-consent', 'rejected')
      localStorage.setItem('qesto_lang', 'en')
    })
    await use(context)
  },
})

export { expect }
