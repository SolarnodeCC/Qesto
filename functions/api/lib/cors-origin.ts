import type { Env } from '../types'
import { resolveExpectedOrigin } from './origin'

export type CorsOriginDecision =
  | { kind: 'deny' }
  | { kind: 'allow'; origin: string }

/** Resolve whether a browser origin is allowed for credentialed CORS. */
export function resolveCorsOrigin(origin: string | null | undefined, env: Env, requestUrl: string): CorsOriginDecision {
  if (!origin) return { kind: 'deny' }
  const allowed = resolveExpectedOrigin(env, requestUrl)
  if (origin === allowed) return { kind: 'allow', origin }
  if (/^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$/.test(origin)) return { kind: 'allow', origin }
  if (env.ENV === 'dev' && origin.startsWith('http://localhost:')) return { kind: 'allow', origin }
  return { kind: 'deny' }
}
