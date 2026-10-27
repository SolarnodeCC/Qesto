/**
 * Requirement: issue #904 (DD-32) — scheduled jobs are a registry, not a
 * cron-string if/else chain: jobs sharing an expression run in isolated
 * failure domains, and the registry stays inside Cloudflare's 5-trigger limit
 * and in lock-step with wrangler.toml.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  requiredCronExpressions,
  runScheduledJobs,
  type ScheduledJob,
} from '../../functions/api/lib/scheduled-dispatch'
import { SCHEDULED_JOBS } from '../../worker/scheduled-jobs'
import type { Env } from '../../functions/api/types'

const env = {} as Env

describe('runScheduledJobs (DD-32)', () => {
  it('runs only jobs for the fired cron, and a throw does not stop siblings', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ran: string[] = []
    const jobs: ScheduledJob[] = [
      { key: 'a', cron: '0 2 * * *', run: async () => { ran.push('a'); throw new Error('boom') } },
      { key: 'b', cron: '0 2 * * *', run: async () => { ran.push('b'); return 'done' } },
      { key: 'c', cron: '0 4 * * *', run: async () => { ran.push('c') } },
    ]
    const results = await runScheduledJobs('0 2 * * *', env, jobs)
    expect(ran).toEqual(['a', 'b'])
    expect(results).toEqual([
      { key: 'a', ok: false },
      { key: 'b', ok: true, summary: 'done' },
    ])
    vi.restoreAllMocks()
  })
})

describe('SCHEDULED_JOBS registry', () => {
  const toml = readFileSync(resolve(__dirname, '../../wrangler.toml'), 'utf8')
  const match = toml.match(/^crons\s*=\s*\[([^\]]*)\]/m)
  // Quoted entries — a naive split on ',' would break "0 6 * * 3,5,7".
  const configured = [...(match?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]!)

  it('fits the 5-trigger ceiling', () => {
    expect(configured.length).toBeLessThanOrEqual(5)
    expect(requiredCronExpressions(SCHEDULED_JOBS).length).toBeLessThanOrEqual(5)
  })

  it('every job cron is a configured trigger, and every trigger has a job', () => {
    const needed = requiredCronExpressions(SCHEDULED_JOBS)
    expect([...needed].sort()).toEqual([...configured].sort())
  })

  it('job keys are unique', () => {
    const keys = SCHEDULED_JOBS.map((j) => j.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
