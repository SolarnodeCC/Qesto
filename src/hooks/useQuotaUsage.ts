import { useEffect, useState } from 'react'
import { api } from '../api/client'

export interface QuotaUsage {
  plan: string
  quotas: {
    max_sessions_per_month: number
    max_participants_per_session: number
    features_unlocked: {
      resultsExport: boolean
      semanticSearch: boolean
      insightsAI: boolean
      customBranding: boolean
      consentMode: boolean
      rankingQuestions: boolean
      samlSso: boolean
    }
  }
  usage: {
    sessions_created: number
    remaining: number
    insights_generated: number
  }
  reset_date: string
}

interface UsageResponse {
  user_id: string
  plan: string
  quotas: QuotaUsage['quotas']
  usage: QuotaUsage['usage']
  reset_date: string
}

export function useQuotaUsage(userId: string | undefined) {
  const [data, setData] = useState<QuotaUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    api<UsageResponse>(`/api/plans/${encodeURIComponent(userId)}/usage`)
      .then((res) => { if (res.ok) setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  return { data, loading }
}
