#!/usr/bin/env node
/**
 * Qesto devtools MCP server — read-only introspection for agents.
 *
 * Exposes three read-only tools so agents can inspect runtime state without
 * ad-hoc shell commands:
 *   - d1_query        read-only SQL against the local (default) or remote D1.
 *   - kv_inspect      list keys / get a value from a KV namespace (no writes).
 *   - platform_metrics  GET an enumerated authed admin analytics endpoint.
 *
 * Registered for the project via the repo-root `.mcp.json` (server `qesto-devtools`).
 *
 * SAFETY (defense in depth — pre-bash.sh also blocks destructive wrangler):
 *   - D1/KV default to the LOCAL miniflare store; `env:"remote"` is opt-in.
 *   - SQL is allowlisted to SELECT/WITH/PRAGMA table_info/EXPLAIN, with mutating
 *     keywords and shell metacharacters rejected before execution.
 *   - KV is limited to list/get; keys are charset-validated.
 *   - platform_metrics is GET-only against a fixed endpoint allowlist.
 *   qesto-security must review before any remote/prod write path is added.
 *
 * Environment (set in .mcp.json env / your shell):
 *   QESTO_API_BASE_URL     base URL for platform_metrics (default https://qesto.cc)
 *   QESTO_ADMIN_API_TOKEN  admin-scoped Qesto JWT (platform_metrics only)
 */
import { execSync } from 'node:child_process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const D1_BINDING = 'DB'

// KV namespaces from wrangler.toml [[kv_namespaces]] bindings.
const KV_BINDINGS = [
  'USERS_KV',
  'SESSIONS_KV',
  'TEAMS_KV',
  'TEMPLATES_KV',
  'DECISIONS_KV',
  'AUDIT_KV',
  'ACTIONS_KV',
  'METRICS_KV',
  'HELP_CONVERSATIONS_KV',
  'MARKETING_KV',
  'CIRCUIT_BREAKER_KV',
  'INTEGRATIONS_KV',
] as const

// Authed admin GET endpoints platform_metrics is allowed to wrap.
const METRICS_ENDPOINTS = [
  '/api/admin/analytics',
  '/api/admin/kpis',
  '/api/admin/ops/summary',
  '/api/admin/perf/reporting',
  '/api/admin/analytics/activation-funnel',
] as const

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) }
}

/** Reject anything that isn't a read-only statement or that could break shell quoting. */
function validateReadOnlySql(sql: string): string | null {
  const trimmed = sql.trim().replace(/;+\s*$/, '') // tolerate a single trailing semicolon
  if (/[;`"$\\&|<>\n\r]/.test(trimmed)) {
    return 'SQL contains a disallowed character (; ` " $ \\ & | < > or newline). Use a single read-only statement with single-quoted literals.'
  }
  if (!/^(SELECT|WITH|EXPLAIN|PRAGMA\s+table_info)\b/i.test(trimmed)) {
    return 'Only read-only queries are allowed: SELECT, WITH, EXPLAIN, or PRAGMA table_info(...).'
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|REPLACE|TRUNCATE|VACUUM|REINDEX)\b/i.test(trimmed)) {
    return 'A mutating keyword was detected. This tool is read-only.'
  }
  return null
}

function runWrangler(args: string): string {
  // shell:true for cross-platform npx resolution; all interpolated values are
  // validated/quoted by callers before reaching here.
  return execSync(`npx wrangler ${args}`, {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function d1Query(args: { sql: string; env?: 'local' | 'remote' }) {
  const err = validateReadOnlySql(args.sql)
  if (err) return textResult(err, true)

  const remote = args.env === 'remote'
  const scope = remote ? '--remote' : '--local'
  try {
    const out = runWrangler(`d1 execute ${D1_BINDING} ${scope} --json --command "${args.sql.trim().replace(/;+\s*$/, '')}"`)
    return textResult(`D1 (${remote ? 'remote' : 'local'}) result:\n\n${out.trim()}`)
  } catch (e) {
    const msg = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e)
    return textResult(`d1_query failed (${remote ? 'remote' : 'local'}): ${String(msg).slice(0, 600)}`, true)
  }
}

function kvInspect(args: { binding: string; op: 'list' | 'get'; key?: string; env?: 'local' | 'remote' }) {
  if (!(KV_BINDINGS as readonly string[]).includes(args.binding)) {
    return textResult(`Unknown KV binding "${args.binding}". Known: ${KV_BINDINGS.join(', ')}.`, true)
  }
  const scope = args.env === 'remote' ? '--remote' : '--local'
  try {
    if (args.op === 'list') {
      const out = runWrangler(`kv key list --binding ${args.binding} ${scope}`)
      return textResult(`KV ${args.binding} keys (${scope}):\n\n${out.trim() || '[]'}`)
    }
    // op === 'get'
    if (!args.key) return textResult('kv_inspect op="get" requires a key.', true)
    if (!/^[A-Za-z0-9:_\-./]+$/.test(args.key)) {
      return textResult('Key contains disallowed characters. Allowed: letters, digits, : _ - . /', true)
    }
    const out = runWrangler(`kv key get "${args.key}" --binding ${args.binding} ${scope}`)
    return textResult(`KV ${args.binding}["${args.key}"] (${scope}):\n\n${out.trim()}`)
  } catch (e) {
    const msg = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e)
    return textResult(`kv_inspect failed: ${String(msg).slice(0, 600)}`, true)
  }
}

async function platformMetrics(args: { endpoint: string }) {
  if (!(METRICS_ENDPOINTS as readonly string[]).includes(args.endpoint)) {
    return textResult(`Endpoint not allowed. Choose one of: ${METRICS_ENDPOINTS.join(', ')}.`, true)
  }
  const baseUrl = (process.env.QESTO_API_BASE_URL || '').trim() || 'https://qesto.cc'
  const token = process.env.QESTO_ADMIN_API_TOKEN
  if (!token) {
    return textResult(
      'platform_metrics needs an admin-scoped JWT in QESTO_ADMIN_API_TOKEN. ' +
        'These admin endpoints require the admin role.',
      true,
    )
  }
  let res: Response
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}${args.endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    return textResult(`platform_metrics request failed: ${e instanceof Error ? e.message : String(e)}`, true)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const hint = res.status === 401 || res.status === 403 ? ' (QESTO_ADMIN_API_TOKEN invalid or not admin-scoped)' : ''
    return textResult(`platform_metrics returned HTTP ${res.status}${hint}. ${detail.slice(0, 300)}`, true)
  }
  const body = await res.text()
  return textResult(`GET ${args.endpoint}:\n\n${body.slice(0, 4000)}`)
}

async function main() {
  const server = new McpServer({ name: 'qesto-devtools', version: '1.0.0' })

  server.registerTool(
    'd1_query',
    {
      title: 'Run a read-only D1 SQL query',
      description:
        'Execute a READ-ONLY SQL query (SELECT/WITH/EXPLAIN/PRAGMA table_info) against the ' +
        'Qesto D1 database. Defaults to the local miniflare DB; pass env:"remote" to hit ' +
        'production (use sparingly). Mutating statements are rejected.',
      inputSchema: {
        sql: z.string().min(1).describe('A single read-only SQL statement; use single-quoted literals'),
        env: z.enum(['local', 'remote']).optional().describe('local (default) or remote'),
      },
    },
    async (args) => d1Query(args),
  )

  server.registerTool(
    'kv_inspect',
    {
      title: 'List or read a KV namespace value',
      description:
        'Read-only KV introspection: op="list" lists keys, op="get" reads one value. ' +
        'Defaults to the local store; env:"remote" hits production. No writes/deletes.',
      inputSchema: {
        binding: z.enum(KV_BINDINGS).describe('KV namespace binding name'),
        op: z.enum(['list', 'get']).describe('list keys or get a single value'),
        key: z.string().optional().describe('Required when op="get"'),
        env: z.enum(['local', 'remote']).optional().describe('local (default) or remote'),
      },
    },
    async (args) => kvInspect(args),
  )

  server.registerTool(
    'platform_metrics',
    {
      title: 'Fetch a platform analytics endpoint',
      description:
        'GET an authed admin analytics/metrics endpoint (read-only) and return the JSON. ' +
        'Requires an admin-scoped JWT in QESTO_ADMIN_API_TOKEN. Endpoint must be one of the ' +
        'allowlisted admin routes.',
      inputSchema: {
        endpoint: z.enum(METRICS_ENDPOINTS).describe('Which admin analytics endpoint to fetch'),
      },
    },
    async (args) => platformMetrics(args),
  )

  await server.connect(new StdioServerTransport())
}

main().catch((err) => {
  // Never write to stdout — that channel is the MCP transport.
  console.error('qesto-devtools MCP server failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
