import type { Env } from '../types'

function normaliseOrigin(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function resolveExpectedOrigin(env: Pick<Env, 'PAGES_URL' | 'API_URL'>, requestUrl: string): string | null {
  return normaliseOrigin(env.PAGES_URL) ?? normaliseOrigin(env.API_URL) ?? normaliseOrigin(requestUrl)
}

/**
 * Loopback hosts used by `wrangler dev --local` and Playwright.
 *
 * Route middleware already skips rate limits here. In-route auth IP gates
 * must do the same: wrangler stamps every request with
 * `cf-connecting-ip: 127.0.0.1`, so a full E2E suite otherwise shares one
 * 20/15min signup bucket and later tests 429.
 */
export function isLocalDevHost(requestUrl: string): boolean {
  try {
    const host = new URL(requestUrl).hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

