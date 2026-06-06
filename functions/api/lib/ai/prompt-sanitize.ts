/**
 * Sanitize user-supplied text before inclusion in Workers AI prompts or embeddings.
 * Applied at the AI gateway choke point and all direct env.AI.run() bypass paths.
 */

export type SanitizableAIRequest = {
  model: string
  messages?: Array<{ role: string; content: string }>
  text?: string
  [key: string]: unknown
}

/** Max length for chat / instruction prompts. */
export const PROMPT_MAX_LEN = 8000
/** Max length for embedding model inputs. */
export const EMBED_TEXT_MAX_LEN = 2048
/** Max length for sentiment classification samples. */
export const SENTIMENT_TEXT_MAX_LEN = 512

const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const ZERO_WIDTH_RE = /\u200B|\uFEFF|\u200C|\u200D/g

export class PromptSanitizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromptSanitizationError'
  }
}

/**
 * Strip control/zero-width characters and bound length before AI inference.
 */
export function sanitizePromptText(input: string, maxLen = PROMPT_MAX_LEN): string {
  return input
    .replace(CONTROL_CHAR_RE, '')
    .replace(ZERO_WIDTH_RE, '')
    .slice(0, maxLen)
    .trim()
}

/** Sanitize embed text; returns null when nothing usable remains. */
export function sanitizeEmbedText(text: string, maxLen = EMBED_TEXT_MAX_LEN): string | null {
  const sanitized = sanitizePromptText(text, maxLen)
  return sanitized.length > 0 ? sanitized : null
}

/** Sanitize all string fields in a Workers AI request payload. */
export function sanitizeAIGatewayRequest(input: SanitizableAIRequest): SanitizableAIRequest {
  const sanitized: SanitizableAIRequest = { ...input, model: input.model }
  if (typeof input.text === 'string') {
    sanitized.text = sanitizePromptText(input.text, EMBED_TEXT_MAX_LEN)
  }
  if (Array.isArray(input.messages)) {
    sanitized.messages = input.messages.map((message) => ({
      ...message,
      content:
        typeof message.content === 'string' ? sanitizePromptText(message.content) : message.content,
    }))
  }
  return sanitized
}

/** Throw when a sanitized gateway request has no usable prompt content. */
export function assertSanitizedAIGatewayRequest(input: SanitizableAIRequest): void {
  if (typeof input.text === 'string') {
    if (!input.text) throw new PromptSanitizationError('Prompt text is empty after sanitization')
    return
  }
  if (Array.isArray(input.messages)) {
    const hasContent = input.messages.some(
      (m) => typeof m.content === 'string' && m.content.length > 0,
    )
    if (!hasContent) {
      throw new PromptSanitizationError('All message contents are empty after sanitization')
    }
    return
  }
  throw new PromptSanitizationError('AI request has no sanitizable text or messages')
}
