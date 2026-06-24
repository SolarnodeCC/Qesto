import { test as base, expect } from '@playwright/test'

export {
  MARKETING_SLOW_MO,
  MARKETING_SETTLE_MS,
  MARKETING_STAGGER_MS,
  MARKETING_TRANSITION_MS,
  MARKETING_PAYOFF_MS,
  settle,
  stagger,
  breathe,
  typeHuman,
} from '../helpers/marketing-pacing'

/** Marketing demos: EN locale, no cookie banner, human-paced interactions. */
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
