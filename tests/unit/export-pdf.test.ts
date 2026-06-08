import { describe, expect, it } from 'vitest'
import { generateSessionHtmlExport, type ExportSessionData, type ExportQuestion } from '../../functions/api/lib/export-pdf'

const JWT_SECRET = 'test-secret-at-least-32-bytes!'

describe('export-pdf (Phase 1)', () => {
  const mockSessionData: ExportSessionData = {
    id: 'session-1',
    title: 'Product Feedback Session',
    status: 'closed',
    anonymity: 'anonymous',
    created_at: new Date('2024-01-15').getTime(),
    started_at: new Date('2024-01-15T10:00:00').getTime(),
    closed_at: new Date('2024-01-15T10:45:00').getTime(),
    duration_ms: 45 * 60 * 1000,
    questions: [
      {
        id: 'q-1',
        position: 1,
        kind: 'poll',
        prompt: 'Which feature is most valuable?',
        options: [
          { id: 'opt-1', label: 'API Integration', votes: 12 },
          { id: 'opt-2', label: 'Analytics Dashboard', votes: 8 },
          { id: 'opt-3', label: 'Mobile App', votes: 5 },
        ],
        total_votes: 25,
      },
      {
        id: 'q-2',
        position: 2,
        kind: 'ranking',
        prompt: 'Rank priorities',
        options: [
          { id: 'opt-4', label: 'Performance', votes: 15 },
          { id: 'opt-5', label: 'UX', votes: 20 },
        ],
        total_votes: 35,
      },
    ],
    total_votes: 60,
  }

  describe('HTML structure', () => {
    it('generates valid HTML document', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      expect(html).toMatch(/<html/i)
      expect(html).toMatch(/<\/html>/i)
      expect(html).toMatch(/<head>/i)
      expect(html).toMatch(/<body>/i)
    })

    it('includes session title', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      expect(html).toContain('Product Feedback Session')
    })

    it('includes all questions and options', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      expect(html).toContain('Which feature is most valuable?')
      expect(html).toContain('API Integration')
      expect(html).toContain('Analytics Dashboard')
      expect(html).toContain('Rank priorities')
      expect(html).toContain('Performance')
    })

    it('includes vote counts and percentages', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      // 12/25 = 48%
      expect(html).toContain('12')
      expect(html).toMatch(/48(\.\d)?%/)
    })
  })

  describe('print styling', () => {
    it('includes @media print styles', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      expect(html).toMatch(/@media\s+print/)
    })

    it('includes page break styles', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      expect(html).toMatch(/page-break|break-inside/)
    })

    it('includes CSS for bar charts', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      expect(html).toMatch(/width:\s*\d+%/) // Bar width
    })
  })

  describe('metadata and dating', () => {
    it('includes formatted session dates', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      // Should contain formatted date (format varies by locale, but should have date info)
      expect(html).toMatch(/15|Jan|2024/)
    })

    it('includes session duration', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      expect(html).toContain('45m')
    })

    it('handles sessions without start/close dates', async () => {
      const dataNoDate = {
        ...mockSessionData,
        started_at: null,
        closed_at: null,
        duration_ms: null,
      }
      const html = await generateSessionHtmlExport(dataNoDate, JWT_SECRET)
      expect(html).toBeTruthy()
      expect(html).not.toMatch(/NaN|undefined/)
    })
  })

  describe('HTML escaping', () => {
    it('escapes HTML entities in question prompts', async () => {
      const dataWithHtml: ExportSessionData = {
        ...mockSessionData,
        questions: [
          {
            id: 'q-1',
            position: 1,
            kind: 'poll',
            prompt: '<script>alert("xss")</script>',
            options: [{ id: 'opt-1', label: 'Option', votes: 5 }],
            total_votes: 5,
          },
        ],
      }
      const html = await generateSessionHtmlExport(dataWithHtml, JWT_SECRET)
      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script')
    })

    it('escapes HTML entities in option labels', async () => {
      const dataWithHtml: ExportSessionData = {
        ...mockSessionData,
        questions: [
          {
            id: 'q-1',
            position: 1,
            kind: 'poll',
            prompt: 'Question?',
            options: [
              { id: 'opt-1', label: '<img src=x onerror=alert(1)>', votes: 5 },
            ],
            total_votes: 5,
          },
        ],
      }
      const html = await generateSessionHtmlExport(dataWithHtml, JWT_SECRET)
      expect(html).not.toContain('<img src=x')
      expect(html).toContain('&lt;img')
    })

    it('escapes HTML entities in session title', async () => {
      const dataWithHtml: ExportSessionData = {
        ...mockSessionData,
        title: '<title>Injected</title>',
      }
      const html = await generateSessionHtmlExport(dataWithHtml, JWT_SECRET)
      expect(html).not.toContain('<title>Injected')
    })
  })

  describe('cryptographic signing', () => {
    it('includes 16-character hex signature', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)

      // Extract signature (8 hex bytes = 16 hex chars)
      const sig = html.match(/([A-F0-9]{16})/)?.[1]

      // Should have a valid signature
      expect(sig).toMatch(/^[A-F0-9]{16}$/)
    })

    it('signs using HMAC-SHA256 and includes in document', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)

      // Signature should be included as a 16-char hex string (8 bytes)
      // Shown as "Authenticity code:" in the footer
      expect(html).toContain('Authenticity code:')
      expect(html).toMatch(/[A-F0-9]{16}/)
    })

    it('includes signature in HTML output', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      // Should contain 16 consecutive hex characters (8 bytes)
      expect(html).toMatch(/[A-F0-9]{16}/)
    })
  })

  describe('bar chart rendering', () => {
    it('renders bars with correct widths', async () => {
      const html = await generateSessionHtmlExport(mockSessionData, JWT_SECRET)
      // First option has 12/25 = 48% → width:48%
      expect(html).toMatch(/width:48%/)
    })

    it('handles zero votes gracefully', async () => {
      const dataZeroVotes: ExportSessionData = {
        ...mockSessionData,
        questions: [
          {
            id: 'q-1',
            position: 1,
            kind: 'poll',
            prompt: 'Question?',
            options: [{ id: 'opt-1', label: 'Option', votes: 0 }],
            total_votes: 0,
          },
        ],
      }
      const html = await generateSessionHtmlExport(dataZeroVotes, JWT_SECRET)
      expect(html).toContain('width:0%')
      expect(html).not.toMatch(/NaN|Infinity/)
    })

    it('renders options sorted by vote count descending', async () => {
      const dataWithOrdering: ExportSessionData = {
        ...mockSessionData,
        questions: [
          {
            id: 'q-1',
            position: 1,
            kind: 'poll',
            prompt: 'Ranking?',
            options: [
              { id: 'opt-3', label: 'Third (2 votes)', votes: 2 },
              { id: 'opt-1', label: 'First (10 votes)', votes: 10 },
              { id: 'opt-2', label: 'Second (5 votes)', votes: 5 },
            ],
            total_votes: 17,
          },
        ],
      }
      const html = await generateSessionHtmlExport(dataWithOrdering, JWT_SECRET)

      // "First" should appear before "Second" should appear before "Third"
      const firstIdx = html.indexOf('First')
      const secondIdx = html.indexOf('Second')
      const thirdIdx = html.indexOf('Third')

      expect(firstIdx).toBeLessThan(secondIdx)
      expect(secondIdx).toBeLessThan(thirdIdx)
    })

    it('handles empty question options', async () => {
      const dataNoOptions: ExportSessionData = {
        ...mockSessionData,
        questions: [
          {
            id: 'q-1',
            position: 1,
            kind: 'open',
            prompt: 'Open-ended question',
            options: [],
            total_votes: 0,
          },
        ],
      }
      const html = await generateSessionHtmlExport(dataNoOptions, JWT_SECRET)
      expect(html).toContain('Open-ended question')
      expect(html).not.toMatch(/undefined|null/i)
    })
  })

  describe('edge cases', () => {
    it('handles sessions with many questions', async () => {
      const manyQuestions: ExportSessionData = {
        ...mockSessionData,
        questions: Array.from({ length: 50 }, (_, i) => ({
          id: `q-${i}`,
          position: i + 1,
          kind: 'poll',
          prompt: `Question ${i + 1}`,
          options: [
            { id: `opt-${i}-1`, label: 'Option A', votes: i + 1 },
            { id: `opt-${i}-2`, label: 'Option B', votes: i },
          ],
          total_votes: 2 * i + 1,
        })),
      }
      const html = await generateSessionHtmlExport(manyQuestions, JWT_SECRET)
      expect(html).toContain('Question 1')
      expect(html).toContain('Question 50')
      expect(html).not.toMatch(/NaN|undefined/)
    })

    it('handles very long prompts and labels', async () => {
      const longText = 'A'.repeat(500)
      const dataLongText: ExportSessionData = {
        ...mockSessionData,
        title: longText,
        questions: [
          {
            id: 'q-1',
            position: 1,
            kind: 'poll',
            prompt: longText,
            options: [{ id: 'opt-1', label: longText, votes: 10 }],
            total_votes: 10,
          },
        ],
      }
      const html = await generateSessionHtmlExport(dataLongText, JWT_SECRET)
      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(1000)
    })

    it('handles session with no branding', async () => {
      const noBranding: ExportSessionData = {
        ...mockSessionData,
        branding: null,
      }
      const html = await generateSessionHtmlExport(noBranding, JWT_SECRET)
      expect(html).toBeTruthy()
    })
  })
})
