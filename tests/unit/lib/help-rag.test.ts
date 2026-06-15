import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../../../functions/api/lib/help-rag'

describe('Help RAG - System Prompt Building', () => {
  const mockDocs = [
    {
      id: 'doc-1',
      title: 'Getting Started with Qesto',
      content: 'Create a new session by going to the dashboard and clicking "New Session"...',
      topic: 'getting-started',
      scope: 'free',
    },
    {
      id: 'doc-2',
      title: 'Understanding Qesto Plans',
      content: 'Qesto offers three plans: Pulse, Signal, and Chorus. Pulse includes basic polling...',
      topic: 'billing',
      scope: 'team',
    },
  ]

  it('should build prompt with default template when no version provided', () => {
    const prompt = buildSystemPrompt('getting-started', 'free', mockDocs)

    expect(prompt).toContain('Qesto Help')
    expect(prompt).toContain('getting-started')
    expect(prompt).toContain('free')
    expect(prompt).toContain('Documentation:')
    expect(prompt).toContain('Getting Started with Qesto')
  })

  it('should use custom prompt version when provided', () => {
    const customPrompt = {
      content: 'Custom system prompt for specialized handling...',
      topic: 'getting-started',
    }

    const prompt = buildSystemPrompt('getting-started', 'free', mockDocs, customPrompt)

    expect(prompt).toContain('Custom system prompt')
    expect(prompt).not.toContain('Qesto Help')
    expect(prompt).toContain('Documentation:')
  })

  it('should truncate document content to 1500 chars', () => {
    const longDoc = {
      id: 'doc-long',
      title: 'Very Long Document',
      content: 'A'.repeat(3000),
      topic: 'test',
      scope: 'free',
    }

    const prompt = buildSystemPrompt('test', 'free', [longDoc])

    // Should contain the doc but truncated
    expect(prompt).toContain('Very Long Document')
    const docsSection = prompt.split('Documentation:')[1]
    const aCount = (docsSection || '').match(/A/g)?.length || 0
    expect(aCount).toBeLessThan(2000)
  })

  it('should handle empty document list', () => {
    const prompt = buildSystemPrompt('test', 'free', [])

    expect(prompt).toContain('No specific documentation available')
    expect(prompt).not.toContain('Documentation:')
  })

  it('should include user plan tier in prompt', () => {
    const plans = ['free', 'starter', 'team'] as const

    for (const plan of plans) {
      const prompt = buildSystemPrompt('test', plan, mockDocs)
      expect(prompt).toContain(`User Plan: ${plan}`)
    }
  })

  it('should format multiple documents with topic labels', () => {
    const prompt = buildSystemPrompt('general', 'free', mockDocs)

    expect(prompt).toContain('[getting-started] Getting Started with Qesto')
    expect(prompt).toContain('[billing] Understanding Qesto Plans')
  })

  it('should instruct not to recommend features outside user tier', () => {
    const prompt = buildSystemPrompt('billing', 'free', mockDocs)

    expect(prompt).toContain("Never recommend features outside the user's plan tier")
  })

  it('should include fallback instruction for missing docs', () => {
    const prompt = buildSystemPrompt('test', 'free', mockDocs)

    expect(prompt).toContain('support@qesto.cc')
  })

  it('should maintain consistent formatting across plans', () => {
    const promptFree = buildSystemPrompt('getting-started', 'free', mockDocs)
    const promptTeam = buildSystemPrompt('getting-started', 'team', mockDocs)

    // Both should have same structure
    expect(promptFree.split('Topic Focus:').length).toBe(promptTeam.split('Topic Focus:').length)
    expect(promptFree.split('Documentation:').length).toBe(promptTeam.split('Documentation:').length)
  })
})

describe('Help RAG - Error Handling', () => {
  it('should handle null/undefined prompt version gracefully', () => {
    const mockDocs = [
      {
        id: 'doc-1',
        title: 'Test Doc',
        content: 'Test content',
        topic: 'test',
        scope: 'free',
      },
    ]

    // Should not throw
    const prompt1 = buildSystemPrompt('test', 'free', mockDocs, undefined)
    const prompt2 = buildSystemPrompt('test', 'free', mockDocs, null)

    expect(prompt1).toContain('Qesto Help')
    expect(prompt2).toContain('Qesto Help')
  })

  it('should escape special characters in document content', () => {
    const specialDoc = {
      id: 'doc-1',
      title: 'Doc with "quotes" and \'apostrophes\'',
      content: 'Content with $special {chars} and <html>',
      topic: 'test',
      scope: 'free',
    }

    const prompt = buildSystemPrompt('test', 'free', [specialDoc])

    // Should preserve special chars without HTML escaping (they're in plain text)
    expect(prompt).toContain('quotes')
    expect(prompt).toContain('apostrophes')
  })
})

describe('Help RAG - Topic and Scope Handling', () => {
  it('should accept topic parameter and include in prompt', () => {
    const topics = ['getting-started', 'billing', 'troubleshooting', 'advanced']

    for (const topic of topics) {
      const prompt = buildSystemPrompt(topic, 'free', [])
      expect(prompt).toContain(`Topic Focus: ${topic}`)
    }
  })

  it('should accept any topic string without modification', () => {
    const prompt = buildSystemPrompt('custom-topic', 'free', [])
    expect(prompt).toContain('Topic Focus: custom-topic')
  })

  it('should handle free tier with document scope enforcement', () => {
    const freeDoc = {
      id: 'free-doc',
      title: 'Free Tier Features',
      content: 'Basic polling and real-time results',
      topic: 'features-overview',
      scope: 'free',
    }

    const prompt = buildSystemPrompt('features-overview', 'free', [freeDoc])
    expect(prompt).toContain('Free Tier Features')
  })

  it('should handle team tier with full access docs', () => {
    const advancedDoc = {
      id: 'advanced-doc',
      title: 'Advanced Team Features',
      content: 'Custom roles, SSO, audit logs',
      topic: 'advanced',
      scope: 'team',
    }

    const prompt = buildSystemPrompt('advanced', 'team', [advancedDoc])
    expect(prompt).toContain('Advanced Team Features')
  })
})
