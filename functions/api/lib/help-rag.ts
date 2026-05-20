/**
 * Help assistant RAG orchestration (Week 2).
 * Retrieves documents, builds system prompt, invokes Mistral with retry logic.
 */

import type { D1Database, Ai } from '@cloudflare/workers-types'
import type { Env } from '../types'
import { embedAndFindSimilarDocuments } from './help-vectorize'
import { getActivePrompt } from './help-prompts'
import { safeLogContext } from './log'

export class HelpAIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HelpAIError'
  }
}

export class HelpValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HelpValidationError'
  }
}

// Constants
const HELP_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8' as const
const AI_TIMEOUT_MS = 20_000
const RETRY_DELAYS_MS = [200, 400] as const
const MAX_TOKENS = 512

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface HelpDocument {
  id: string
  title: string
  content: string
  topic: string
  scope: string
}

export interface HelpRetrievalResult {
  documents: HelpDocument[]
  sources: Array<{ documentId: string; title: string; relevance: number }>
}

/** Retrieve help documents from Vectorize + D1, filtered by user plan scope. */
export async function retrieveDocuments(
  ai: Ai,
  vectorize: Env['HELP_VECTORIZE'],
  db: D1Database,
  question: string,
  userScope: 'free' | 'starter' | 'team',
): Promise<HelpRetrievalResult> {
  // Step 1: Query Vectorize for similar documents
  const { similarDocuments } = await embedAndFindSimilarDocuments(
    { AI: ai as any, HELP_VECTORIZE: vectorize },
    {
      question,
      userScope,
    },
  )

  if (similarDocuments.length === 0) {
    return { documents: [], sources: [] }
  }

  // Step 2: Fetch full content from D1
  const documents: HelpDocument[] = []
  const sources = similarDocuments.map((doc) => ({
    documentId: doc.documentId,
    title: doc.title,
    relevance: doc.relevance,
  }))

  for (const match of similarDocuments) {
    try {
      const doc = await db
        .prepare('SELECT id, title, content, topic, scope FROM help_documents WHERE id = ?')
        .bind(match.documentId)
        .first<HelpDocument>()

      if (doc) {
        documents.push(doc)
      }
    } catch (err) {
      safeLogContext(err, { traceId: 'system', route: 'lib/help-rag/fetch-document', errorClass: err instanceof Error ? err.name : 'UnknownError' })
    }
  }

  return { documents, sources }
}

/** Build Mistral system prompt with RAG context. */
export function buildSystemPrompt(
  topic: string,
  userScope: 'free' | 'starter' | 'team',
  documents: HelpDocument[],
  promptVersion?: { content: string; topic?: string | null } | null,
): string {
  const basePrompt = promptVersion?.content ||
    `You are Qesto Help, a friendly assistant helping users with live team session software.
Your responses are concise (2-3 sentences) and actionable.

Topic Focus: ${topic}
User Plan: ${userScope}

Instructions:
- Use ONLY the documentation provided below
- Never invent features or pricing
- Never recommend features outside the user's plan tier
- If the answer is not in the docs, say: "I don't have documentation for this. Please contact support@qesto.cc"
- Be helpful and encouraging`

  if (documents.length === 0) {
    return basePrompt + '\n\n(No specific documentation available for this query)'
  }

  const docsStr = documents
    .map((doc) => `[${doc.topic}] ${doc.title}\n${doc.content.substring(0, 1500)}`)
    .join('\n\n---\n\n')

  return `${basePrompt}

Documentation:
${docsStr}`
}

/** Call Mistral 7B with retry logic and timeout handling. */
async function runHelpAI(
  ai: Ai,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
): Promise<string> {
  const maxAttempts = RETRY_DELAYS_MS.length + 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const t0 = Date.now()
    try {
      const res = (await withTimeout(
        ai.run(HELP_MODEL, {
          messages,
          max_tokens: MAX_TOKENS,
        }) as Promise<{ response?: string } | string>,
        AI_TIMEOUT_MS,
        'Help AI response',
      )) as { response?: string } | string

      const latencyMs = Date.now() - t0
      const raw = typeof res === 'string' ? res : typeof res?.response === 'string' ? res.response : ''

      if (!raw || raw.trim() === '') {
        throw new HelpAIError('AI returned empty response')
      }

      console.log(
        JSON.stringify({
          event: 'help.ai.ok',
          model: HELP_MODEL,
          attempt,
          latencyMs,
          outputChars: raw.length,
        }),
      )
      return raw
    } catch (err) {
      lastError = err
      const latencyMs = Date.now() - t0
      const error = err instanceof Error ? err.message : String(err)
      const event = attempt < maxAttempts ? 'help.ai.retry' : 'help.ai.error'
      console.log(JSON.stringify({ event, model: HELP_MODEL, attempt, latencyMs, error }))
      if (attempt < maxAttempts) {
        await sleep(RETRY_DELAYS_MS[attempt - 1])
      }
    }
  }

  throw new HelpAIError(
    `AI invocation failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

/** Complete RAG pipeline: embed question, retrieve docs, build prompt, invoke Mistral. */
export async function askHelpAI(
  ai: Ai,
  vectorize: Env['HELP_VECTORIZE'],
  db: D1Database,
  question: string,
  userScope: 'free' | 'starter' | 'team',
  topic?: string,
): Promise<{ answer: string; sources: Array<{ documentId: string; title: string; relevance: number }> }> {
  // Retrieve documents
  const retrieval = await retrieveDocuments(ai, vectorize, db, question, userScope)

  // Get active prompt version (topic-specific or global fallback)
  const promptVersion = await getActivePrompt(db, topic)

  // Build system prompt
  const systemPrompt = buildSystemPrompt(topic || 'general', userScope, retrieval.documents, promptVersion)

  // Call Mistral
  const answer = await runHelpAI(ai, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ])

  return {
    answer,
    sources: retrieval.sources,
  }
}

export const __internal = { withTimeout, sleep, buildSystemPrompt, runHelpAI }
