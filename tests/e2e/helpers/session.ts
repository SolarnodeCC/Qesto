import type { Page } from '@playwright/test'

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
  await page.evaluate(async ({ id, questionPrompt }) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/questions`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        kind: 'poll',
        prompt: questionPrompt,
        options: [
          { id: 'opt_a', label: 'Option A' },
          { id: 'opt_b', label: 'Option B' },
        ],
      }),
    })
    const json = await res.json() as ApiResponse<unknown>
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, { id: sessionId, questionPrompt: prompt })
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
