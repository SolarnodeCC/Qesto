/**
 * Which commit is this API build? Answered by /api/version, /api/admin/health,
 * /api/platform/version and the x-qesto-api-commit header, and compared against
 * the pushed SHA by the post-deploy verification in .github/workflows/ci.yml.
 *
 * The answer used to be `env.COMMIT_SHA ?? env.CF_PAGES_COMMIT_SHA`. qesto.cc/api
 * is served by the Pages Functions bundle, not the qesto-api Worker, and the
 * Pages project carries a dashboard var COMMIT_SHA="dev" — so production always
 * reported "dev", and commit parity could never pass.
 *
 * Sources, first real value wins:
 *   1. env.COMMIT_SHA        — the Worker deploy passes --var COMMIT_SHA:<sha>
 *   2. BUILD_COMMIT          — stamped into this file by scripts/stamp-build-commit.mjs
 *                              in CI before `wrangler pages deploy` (direct uploads)
 *   3. env.CF_PAGES_COMMIT_SHA — set by Pages on Git-integration builds
 * Placeholders ("", "dev", "unknown") are skipped, so a stale dashboard var cannot
 * shadow a real SHA.
 */
import type { Env } from '../types/env'

// Rewritten in CI by scripts/stamp-build-commit.mjs. Keep it a single-quoted
// string literal on one line; the stamp script refuses to run otherwise.
export const BUILD_COMMIT: string = 'dev'

const PLACEHOLDERS = new Set(['', 'dev', 'unknown'])

export function resolveCommit(
  env: Pick<Env, 'COMMIT_SHA' | 'CF_PAGES_COMMIT_SHA'>,
  buildCommit: string = BUILD_COMMIT,
): string {
  for (const candidate of [env.COMMIT_SHA, buildCommit, env.CF_PAGES_COMMIT_SHA]) {
    const value = candidate?.trim()
    if (value && !PLACEHOLDERS.has(value)) return value
  }
  return 'unknown'
}
