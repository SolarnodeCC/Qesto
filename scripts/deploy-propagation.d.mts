export function isTransientDeployStatus(status: number): boolean

export function resetDeployPropagation(): void

export interface FetchUntilDeployedOptions {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
  budgetMs?: number
  delayMs?: number
  maxAttempts?: number
  now?: () => number
  log?: (message: string) => void
}

export function fetchUntilDeployed(
  url: string,
  init?: RequestInit,
  options?: FetchUntilDeployedOptions,
): Promise<Response>
