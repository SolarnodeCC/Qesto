import { usePolledApi } from './usePolledApi'

export type GrowthData = {
  templates: {
    total: number
    active: number
    discarded: number
    total_uses: number
    last_created_at: string | null
    by_industry: Record<string, number>
  }
  webhook: {
    last_received_at: string | null
    total_received: number
    total_skipped: number
    total_queued: number
  }
}

export function useAdminGrowth() {
  const { data: growth, loading, error } = usePolledApi<GrowthData>('/api/admin/growth', 60_000)
  return { growth, loading, error }
}
