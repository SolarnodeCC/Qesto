#!/usr/bin/env node
/**
 * Qesto KB semantic-search MCP server.
 *
 * Exposes one tool, `kb_search`, that lets Claude Code agents query the
 * knowledge base by meaning (not just grep) before reading files. It calls the
 * deployed, authenticated `POST /api/knowledge-base/search` endpoint
 * (KbSearchService → bge-m3 + KB_VECTORIZE + D1 re-ranking) and returns the top
 * hits with their repo `file_path`, so the agent can then open the file with
 * Read for full context.
 *
 * Registered for the project via the repo-root `.mcp.json`.
 *
 * Required environment (set in .mcp.json env / your shell):
 *   QESTO_API_BASE_URL  e.g. https://qesto-api.oostelaar.workers.dev
 *   QESTO_KB_API_TOKEN  a valid Qesto JWT (the search route is auth'd). Mint a
 *                       long-lived service token, or add a service-key auth path
 *                       to the route (security review required) — see knowledge.md.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

interface KbHit {
  doc_id?: string
  file_path?: string
  title?: string
  heading_path?: string
  type?: string
  domain?: string
  similarity?: number
  rerank_score?: number
  chunk_preview?: string
}

const SEARCH_PATH = '/api/knowledge-base/search'

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) }
}

function formatHits(query: string, hits: KbHit[]): string {
  if (hits.length === 0) {
    return `No KB matches for "${query}". The index may be empty or stale — run \`npm run kb:health\` (and \`npm run kb:sync\` if needed).`
  }
  const lines = hits.map((h, i) => {
    const score = (h.rerank_score ?? h.similarity ?? 0).toFixed(3)
    const where = [h.domain, h.type].filter(Boolean).join('/')
    const head = h.heading_path ? ` › ${h.heading_path}` : ''
    const preview = (h.chunk_preview ?? '').replace(/\s+/g, ' ').trim()
    return [
      `${i + 1}. [${score}] ${h.title ?? h.doc_id ?? 'untitled'}${where ? ` (${where})` : ''}`,
      h.file_path ? `   file: ${h.file_path}${head}` : '',
      preview ? `   ${preview}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })
  return (
    `Top ${hits.length} KB matches for "${query}":\n\n${lines.join('\n\n')}\n\n` +
    `→ Open the most relevant \`file:\` path with Read for full content.`
  )
}

async function kbSearch(args: {
  query: string
  limit?: number | undefined
  domain?: string | undefined
  type?: string | undefined
}) {
  const baseUrl = process.env.QESTO_API_BASE_URL
  const serviceKey = process.env.QESTO_KB_SERVICE_KEY
  const token = process.env.QESTO_KB_API_TOKEN
  if (!baseUrl || (!serviceKey && !token)) {
    return textResult(
      'KB search is not configured. Set QESTO_API_BASE_URL and either ' +
        'QESTO_KB_SERVICE_KEY (recommended) or QESTO_KB_API_TOKEN (a Qesto JWT) in ' +
        '.mcp.json env. Until then, research the knowledge-base/ files with Grep/Read.',
      true,
    )
  }
  // Prefer the read-only service key; fall back to a JWT bearer.
  const authHeaders: Record<string, string> = serviceKey
    ? { 'x-kb-service-key': serviceKey }
    : { Authorization: `Bearer ${token as string}` }

  // Build body without undefined keys (the route validates strictly).
  const body: Record<string, unknown> = { query: args.query }
  if (typeof args.limit === 'number') body.limit = args.limit
  if (args.domain) body.domain = args.domain
  if (args.type) body.type = args.type

  let res: Response
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}${SEARCH_PATH}`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return textResult(`KB search request failed: ${err instanceof Error ? err.message : String(err)}`, true)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const hint =
      res.status === 401
        ? ' (QESTO_KB_SERVICE_KEY or QESTO_KB_API_TOKEN invalid/expired)'
        : res.status === 503
          ? ' (embedding service unavailable)'
          : ''
    return textResult(`KB search returned HTTP ${res.status}${hint}. ${detail.slice(0, 300)}`, true)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return textResult('KB search returned a non-JSON response.', true)
  }

  // Defensive: accept {data:{items}} | {items} | {data:{results}}.
  const root = (json as { data?: unknown })?.data ?? json
  const items = ((root as { items?: KbHit[]; results?: KbHit[] })?.items ??
    (root as { results?: KbHit[] })?.results ??
    []) as KbHit[]

  return textResult(formatHits(args.query, items))
}

async function main() {
  const server = new McpServer({ name: 'qesto-kb', version: '1.0.0' })

  server.registerTool(
    'kb_search',
    {
      title: 'Search the Qesto knowledge base',
      description:
        'Semantic search over the Qesto knowledge base (business requirements, ADRs, ' +
        'specs, runbooks). Returns the most relevant docs with their repo file_path; ' +
        'open that path with Read for full content. Use this before grep when the ' +
        'question is conceptual ("what are the requirements for X").',
      inputSchema: {
        query: z.string().min(1).describe('Natural-language question or topic'),
        limit: z.number().int().min(1).max(20).optional().describe('Max results (default 5)'),
        domain: z
          .string()
          .optional()
          .describe('Optional domain filter, e.g. security, ai-context, infrastructure'),
        type: z.string().optional().describe('Optional type filter, e.g. adr, spec, guide, runbook'),
      },
    },
    async (args) => kbSearch(args),
  )

  await server.connect(new StdioServerTransport())
}

main().catch((err) => {
  // Never write to stdout — that channel is the MCP transport.
  console.error('qesto-kb MCP server failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
