const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()


export const API_BASE_URL = rawBase && rawBase.length > 0 ? rawBase.replace(/\/+$/, '') : ''

export function apiUrl(path: string): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalisedPath}`
}

