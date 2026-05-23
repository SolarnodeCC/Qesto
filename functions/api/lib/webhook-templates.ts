/**
 * INT-WEBHOOK-02 — HRIS webhook payload templates (Workday, BambooHR).
 */
export type WebhookTemplateId = 'workday_session_closed' | 'bamboohr_session_closed'

export type WebhookTemplate = {
  id: WebhookTemplateId
  label: string
  description: string
  samplePayload: Record<string, unknown>
}

export const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: 'workday_session_closed',
    label: 'Workday — session closed',
    description: 'Posts aggregate session results to a Workday custom object webhook.',
    samplePayload: {
      event: 'qesto.session.closed',
      session_id: 'sess_01H…',
      title: 'Q4 Planning',
      closed_at: 1710000000000,
      total_votes: 42,
      questions: [{ prompt: 'Top priority?', total_votes: 42 }],
    },
  },
  {
    id: 'bamboohr_session_closed',
    label: 'BambooHR — session closed',
    description: 'Employee engagement pulse closure notification.',
    samplePayload: {
      event: 'session_closed',
      external_id: 'sess_01H…',
      participation_count: 42,
      summary_url: 'https://qesto.cc/results/…',
    },
  },
]

export function getWebhookTemplate(id: string): WebhookTemplate | undefined {
  return WEBHOOK_TEMPLATES.find((t) => t.id === id)
}
