/**
 * OPS-DR-GAP-01 — export KV-only namespaces (AUDIT_KV, ACTIONS_KV) to R2.
 * These blobs have no D1 counterpart; periodic export bounds RPO for audit/action data.
 */

export type KvBackupNamespace = 'audit' | 'actions'

export interface KvBackupResult {
  namespace: KvBackupNamespace
  keysExported: number
  r2Key: string
  truncated: boolean
  nextCursor?: string | null
}

const DEFAULT_LIMIT = 500

function backupDatePrefix(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Export one KV namespace page to R2 under `kv-backups/{ns}/{date}/`. */
export async function exportKvNamespaceToR2(
  kv: KVNamespace,
  r2: R2Bucket,
  namespace: KvBackupNamespace,
  opts?: { limit?: number; cursor?: string },
): Promise<KvBackupResult | null> {
  const limit = opts?.limit ?? DEFAULT_LIMIT
  const listOpts: KVNamespaceListOptions = { limit }
  if (opts?.cursor) listOpts.cursor = opts.cursor
  const list = await kv.list(listOpts)
  if (list.keys.length === 0) return null

  const entries: Record<string, string> = {}
  for (const { name } of list.keys) {
    const value = await kv.get(name)
    if (value !== null) entries[name] = value
  }

  const batchId = opts?.cursor ?? '0'
  const date = backupDatePrefix()
  const r2Key = `kv-backups/${namespace}/${date}/batch-${batchId}.json`
  const payload = {
    namespace,
    exportedAt: Date.now(),
    keys: entries,
    listComplete: list.list_complete,
    nextCursor: list.list_complete ? null : list.cursor ?? null,
  }

  await r2.put(r2Key, JSON.stringify(payload), {
    customMetadata: {
      namespace,
      keysExported: String(Object.keys(entries).length),
      listComplete: String(list.list_complete),
    },
  })

  return {
    namespace,
    keysExported: Object.keys(entries).length,
    r2Key,
    truncated: !list.list_complete,
    nextCursor: list.list_complete ? null : list.cursor ?? null,
  }
}

/** Run AUDIT + ACTIONS export when R2 is bound. Non-fatal on partial failure. */
export async function runKvBackup(env: {
  AUDIT_KV?: KVNamespace
  ACTIONS_KV?: KVNamespace
  R2_SESSIONS?: R2Bucket
}): Promise<KvBackupResult[]> {
  const r2 = env.R2_SESSIONS
  if (!r2) return []

  const results: KvBackupResult[] = []
  const pairs: Array<[KvBackupNamespace, KVNamespace | undefined]> = [
    ['audit', env.AUDIT_KV],
    ['actions', env.ACTIONS_KV],
  ]

  for (const [namespace, kv] of pairs) {
    if (!kv) continue
    let cursor: string | undefined
    for (;;) {
      const result = await exportKvNamespaceToR2(
        kv,
        r2,
        namespace,
        cursor ? { cursor } : undefined,
      )
      if (!result) break
      results.push(result)
      if (!result.truncated || !result.nextCursor) break
      cursor = result.nextCursor
    }
  }

  return results
}
