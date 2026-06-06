import { usePolledApi } from './usePolledApi'

export type KbSyncStatus = {
  last_sync_at: number | null
  vectors_upserted?: number
  documents_upserted?: number
  chunks_upserted?: number
  last_operation?: 'upsert' | 'delete'
}

export function useKbSyncStatus() {
  const { data, loading, error, refresh } = usePolledApi<KbSyncStatus>('/api/admin/kb-sync/status', 60_000)
  return { status: data, loading, error, refresh }
}
