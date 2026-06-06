export const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = [150, 300, 600]

export async function invokeAI(
  ai: { run: (model: string, opts: { messages: Array<{ role: 'user' | 'assistant'; content: string }> }) => Promise<{ response: string }> },
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  attempt = 0,
): Promise<string> {
  try {
    const response = await ai.run(AI_MODEL, { messages })
    return response.response
  } catch (err) {
    if (attempt < RETRY_ATTEMPTS - 1) {
      const delay = RETRY_DELAY_MS[attempt]
      await new Promise((r) => setTimeout(r, delay))
      return invokeAI(ai, messages, attempt + 1)
    }
    throw new Error(`AI call failed after ${RETRY_ATTEMPTS} attempts: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function addToIndex(kv: KVNamespace, indexKey: string, templateId: string): Promise<void> {
  const raw = await kv.get(indexKey, 'json')
  const list = (raw as string[]) || []
  if (!list.includes(templateId)) {
    list.push(templateId)
    await kv.put(indexKey, JSON.stringify(list))
  }
}

export async function logDiscard(
  kv: KVNamespace,
  sessionId: string,
  reason: string,
  questionId?: string,
): Promise<void> {
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    sessionId,
    questionId,
    reason,
  })
  const logKey = `discard-log:${new Date().toISOString().split('T')[0]}`
  const existing = await kv.get(logKey)
  const newLog = existing ? `${existing}\n${logEntry}` : logEntry
  await kv.put(logKey, newLog, { expirationTtl: 604800 })
}
