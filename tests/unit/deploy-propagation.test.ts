/**
 * Post-deploy checks target the deployment's own *.pages.dev URL. Wrangler
 * prints "Deployment complete" before that alias is routed, and the first
 * GET /api/version then 404s. These tests pin the wait: retry that window,
 * and do not retry a 403 (that is a block, not propagation).
 */
import { execFile } from 'node:child_process'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import {
  fetchUntilDeployed,
  isTransientDeployStatus,
  resetDeployPropagation,
} from '../../scripts/deploy-propagation.mjs'

function jsonResponse(status: number, body = ''): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': status === 200 ? 'application/json' : 'text/plain' },
  })
}

describe('deploy propagation retry', () => {
  beforeEach(() => {
    resetDeployPropagation()
  })

  it('treats a fresh Pages 404 as transient and a 403 as final', () => {
    expect(isTransientDeployStatus(404)).toBe(true)
    expect(isTransientDeployStatus(502)).toBe(true)
    expect(isTransientDeployStatus(503)).toBe(true)
    expect(isTransientDeployStatus(403)).toBe(false)
    expect(isTransientDeployStatus(401)).toBe(false)
  })

  it('retries HTTP 404 until the alias answers', async () => {
    const statuses = [404, 404, 200]
    const fetchImpl = vi.fn(async () => {
      const status = statuses.shift() ?? 500
      return jsonResponse(status, status === 200 ? '{"ok":true}' : 'not found')
    })
    const sleeps: number[] = []
    let t = 0
    const res = await fetchUntilDeployed(
      'https://3d0aa358.qesto.pages.dev/api/version',
      { headers: { accept: 'application/json' } },
      {
        fetchImpl,
        sleep: async (ms) => {
          sleeps.push(ms)
          t += ms
        },
        now: () => t,
        budgetMs: 90_000,
        delayMs: 2_000,
        log: () => {},
      },
    )
    expect(res.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleeps).toEqual([2_000, 2_000])
    expect(await res.json()).toEqual({ ok: true })
  })

  it('does not retry a 403', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403, 'blocked'))
    const sleep = vi.fn(async () => {})
    const res = await fetchUntilDeployed('https://example.test/api/version', {}, {
      fetchImpl,
      sleep,
      budgetMs: 90_000,
      log: () => {},
    })
    expect(res.status).toBe(403)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('returns the 404 once the wait budget is spent', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404, 'missing'))
    let t = 0
    const res = await fetchUntilDeployed('https://example.test/api/version', {}, {
      fetchImpl,
      sleep: async (ms) => {
        t += ms
      },
      now: () => t,
      budgetMs: 5_000,
      delayMs: 2_000,
      log: () => {},
    })
    expect(res.status).toBe(404)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('retries a network error until the deployment answers', async () => {
    const fetchImpl = vi.fn(async () => {
      if (fetchImpl.mock.calls.length === 1) throw new Error('connect ECONNREFUSED')
      return jsonResponse(200, '{"ok":true}')
    })
    const res = await fetchUntilDeployed('https://example.test/api/version', {}, {
      fetchImpl,
      sleep: async () => {},
      now: () => 0,
      budgetMs: 90_000,
      delayMs: 1,
      log: () => {},
    })
    expect(res.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('fails later requests immediately once one request has been served', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, 'ok'))
    await fetchUntilDeployed('https://example.test/api/version', {}, {
      fetchImpl,
      budgetMs: 1_000,
      log: () => {},
    })
    fetchImpl.mockImplementation(async () => jsonResponse(404, 'missing'))
    const sleep = vi.fn(async () => {
      throw new Error('should not retry after the alias is routed')
    })
    const res = await fetchUntilDeployed('https://example.test/assets/app.js', { method: 'HEAD' }, {
      fetchImpl,
      sleep,
      budgetMs: 90_000,
      log: () => {},
    })
    expect(res.status).toBe(404)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).not.toHaveBeenCalled()
  })
})

const execFileAsync = promisify(execFile)

describe('deploy-propagation CLI', () => {
  const script = resolve(__dirname, '../../scripts/deploy-propagation.mjs')

  async function listen(handler: (res: ServerResponse, hits: number) => void): Promise<{ server: Server; url: string }> {
    const hits = { n: 0 }
    const server = createServer((_req, res) => {
      hits.n += 1
      handler(res, hits.n)
    })
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('expected a TCP port')
    return { server, url: `http://127.0.0.1:${address.port}/api/admin/health` }
  }

  it('prints only the body after a propagating 404', async () => {
    const { server, url } = await listen((res, n) => {
      if (n < 2) {
        res.writeHead(404)
        res.end('nope')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
    try {
      const { stdout } = await execFileAsync(process.execPath, [script, url], {
        encoding: 'utf8',
        env: { ...process.env, DEPLOY_READY_DELAY_MS: '20', DEPLOY_READY_BUDGET_MS: '5000' },
      })
      expect(stdout).toBe('{"ok":true}')
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose))
    }
  })

  it('exits non-zero when the 404 outlasts the budget', async () => {
    const { server, url } = await listen((res) => {
      res.writeHead(404)
      res.end('missing')
    })
    try {
      await expect(
        execFileAsync(process.execPath, [script, url], {
          encoding: 'utf8',
          env: { ...process.env, DEPLOY_READY_BUDGET_MS: '0' },
        }),
      ).rejects.toThrow()
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose))
    }
  })
})
