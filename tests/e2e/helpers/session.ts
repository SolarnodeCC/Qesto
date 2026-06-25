import { expect, type Page } from '@playwright/test'

export type QuestionKind =
  | 'poll'
  | 'ranking'
  | 'open'
  | 'consent'
  | 'multi_select'
  | 'likert'
  | 'upvote'
  | 'word_cloud'
  | 'slider'
  | 'reaction'

type QuestionOption = { id?: string; label: string }
type CreatedSession = { id: string; code: string; title: string }
type SessionResults = {
  session: { id: string; status: string; code: string; title: string }
  question: { id: string; kind: string; prompt: string; options: Array<{ id: string; label: string }> } | null
  results: { counts: Record<string, number>; total: number; source: 'live' | 'persisted' }
}
type ApiResponse<T> = {
  ok?: boolean
  data?: T
  error?: { message?: string }
}

export async function createDraftSession(page: Page, title: string): Promise<CreatedSession> {
  const result = await page.evaluate(async ({ sessionTitle }) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch('/api/sessions', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title: sessionTitle }),
    })
    const json = await res.json() as ApiResponse<{ session: CreatedSession }>
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
    if (!json.data?.session) throw new Error('Missing session in response')
    return json.data.session
  }, { sessionTitle: title })
  return result
}

export async function addPollQuestion(page: Page, sessionId: string, prompt: string): Promise<void> {
  await addQuestion(page, sessionId, 'poll', prompt, [
    { id: 'opt_a', label: 'Option A' },
    { id: 'opt_b', label: 'Option B' },
  ])
}

export async function addQuestion(
  page: Page,
  sessionId: string,
  kind: QuestionKind,
  prompt: string,
  options?: QuestionOption[],
): Promise<void> {
  await page.evaluate(async ({ id, body }) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/questions`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    const json = await res.json() as ApiResponse<unknown>
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, {
    id: sessionId,
    body: {
      kind,
      prompt,
      ...(options && options.length > 0 ? { options } : {}),
    },
  })
}

export async function openPresenterView(page: Page, sessionId: string): Promise<void> {
  await page.goto(`/sessions/${sessionId}/present`)
  await page.waitForURL(new RegExp(`/sessions/${sessionId}/present(?:\\?.*)?$`))
}

/** Presenter canvas has no `<main>`; assert the live controls toolbar instead. */
export async function expectPresenterViewHealthy(page: Page, prompt?: string): Promise<void> {
  await expect(page.getByRole('toolbar', { name: 'Presenter controls' })).toBeVisible()
  if (prompt) {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(prompt)
  }
}

export async function startSession(page: Page, sessionId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/start`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json() as ApiResponse<unknown>
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, sessionId)
}

export async function closeSession(page: Page, sessionId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/close`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json() as ApiResponse<unknown>
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, sessionId)
}

export async function getSessionResults(page: Page, sessionId: string): Promise<SessionResults> {
  const result = await page.evaluate(async (id) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/results`, {
      method: 'GET',
      credentials: 'include',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json() as ApiResponse<SessionResults>
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
    if (!json.data) throw new Error('Missing results in response')
    return json.data
  }, sessionId)
  return result
}
