import { describe, expect, it } from 'vitest'
import {
  PromptSanitizationError,
  assertSanitizedAIGatewayRequest,
  sanitizeAIGatewayRequest,
  sanitizeEmbedText,
  sanitizePromptText,
} from '../../functions/api/lib/ai/prompt-sanitize'

describe('sanitizePromptText', () => {
  it('strips control characters and zero-width marks', () => {
    const input = 'hello\u0000world\u200B'
    expect(sanitizePromptText(input)).toBe('helloworld')
  })

  it('trims whitespace and enforces max length', () => {
    expect(sanitizePromptText('  hi  ')).toBe('hi')
    expect(sanitizePromptText('abcdef', 4)).toBe('abcd')
  })

  it('returns empty string when only control characters remain', () => {
    expect(sanitizePromptText('\x00\x1F')).toBe('')
  })

  it('strips bidirectional override characters (SEC-STUDIO-PROMPT-01)', () => {
    // RLO/LRO/PDF and the isolate set can visually reorder injected text.
    const input = 'safe‮reversed‬ plan⁦iso⁩'
    const out = sanitizePromptText(input)
    expect(out).toBe('safereversed planiso')
    expect(out).not.toMatch(/[‪-‮⁦-⁩]/)
  })

  it('strips the word-joiner zero-width char', () => {
    expect(sanitizePromptText('a⁠b')).toBe('ab')
  })
})

describe('sanitizeEmbedText', () => {
  it('returns null for empty post-sanitize input', () => {
    expect(sanitizeEmbedText('\x00')).toBeNull()
  })

  it('returns sanitized text when usable', () => {
    expect(sanitizeEmbedText('  embed me  ')).toBe('embed me')
  })
})

describe('sanitizeAIGatewayRequest', () => {
  it('sanitizes text and message contents', () => {
    const result = sanitizeAIGatewayRequest({
      model: '@cf/test',
      text: 'query\x00',
      messages: [
        { role: 'system', content: 'safe' },
        { role: 'user', content: 'ignore\x1F prior' },
      ],
    })
    expect(result.text).toBe('query')
    expect(result.messages?.[1]?.content).toBe('ignore prior')
  })

  it('throws when all message contents sanitize to empty', () => {
    const sanitized = sanitizeAIGatewayRequest({
      model: '@cf/test',
      messages: [{ role: 'user', content: '\x00' }],
    })
    expect(() => assertSanitizedAIGatewayRequest(sanitized)).toThrow(PromptSanitizationError)
  })

  it('passes when at least one message has content', () => {
    const sanitized = sanitizeAIGatewayRequest({
      model: '@cf/test',
      messages: [
        { role: 'user', content: '\x00' },
        { role: 'user', content: 'valid' },
      ],
    })
    expect(() => assertSanitizedAIGatewayRequest(sanitized)).not.toThrow()
  })
})
