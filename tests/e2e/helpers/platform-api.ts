import type { Page } from '@playwright/test'

type ApiResponse<T> = {
  ok?: boolean
  data?: T
  error?: { code?: string; message?: string; details?: { feature?: string } }
  status?: number
}

/** Browser-serialisable subset of RequestInit (avoids CF Workers/DOM RequestInit clashes). */
type BrowserRequestInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export async function apiFetch<T>(
  page: Page,
  path: string,
  init?: BrowserRequestInit,
): Promise<{ ok: boolean; status: number; data?: T | undefined; error?: ApiResponse<T>['error'] }> {
  return page.evaluate(async ({ url, requestInit }) => {
    const token = sessionStorage.getItem('qesto_token')
    const res = await fetch(url, {
      credentials: 'include',
      ...requestInit,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(requestInit?.headers ?? {}),
      },
    })
    const json = await res.json().catch(() => ({})) as ApiResponse<T>
    const out: { ok: boolean; status: number; data?: T; error?: ApiResponse<T>['error'] } = {
      ok: res.ok && json.ok !== false,
      status: res.status,
    }
    if (json.data !== undefined) out.data = json.data
    if (json.error !== undefined) out.error = json.error
    return out
  }, { url: path, requestInit: init ?? {} })
}

export async function createTeam(page: Page, name: string): Promise<string> {
  const res = await apiFetch<{ team: { id: string } }>(page, '/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  if (!res.ok || !res.data?.team?.id) {
    throw new Error(res.error?.message ?? `Failed to create team (HTTP ${res.status})`)
  }
  return res.data.team.id
}
