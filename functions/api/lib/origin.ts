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

