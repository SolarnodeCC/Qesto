import { readKvJson, writeKvJson } from './kv'
import { namespacedKey } from './tenant-namespace'
import type { WorkspaceActionItem, WorkspaceActionsBlob } from './workspace-types'
import { ulid } from './ulid'

function actionsKey(teamId: string, workspaceId: string): string {
  return namespacedKey(teamId, `ws:${workspaceId}:actions`)
}

export async function readWorkspaceActions(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
): Promise<WorkspaceActionsBlob> {
  const blob = await readKvJson<WorkspaceActionsBlob>(kv, actionsKey(teamId, workspaceId))
  return blob ?? { items: [] }
}

export async function writeWorkspaceActions(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  blob: WorkspaceActionsBlob,
): Promise<void> {
  await writeKvJson(kv, actionsKey(teamId, workspaceId), blob)
}

export function openActionItems(blob: WorkspaceActionsBlob): WorkspaceActionItem[] {
  return blob.items.filter((i) => i.status === 'open')
}

export async function carryOpenActionsToNewInstance(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  sessionId: string,
): Promise<WorkspaceActionItem[]> {
  const blob = await readWorkspaceActions(kv, teamId, workspaceId)
  const open = openActionItems(blob)
  if (open.length === 0) return []

  // Deduplicate by normalised text so repeated carries don't accumulate copies.
  const seen = new Set<string>()
  const unique = open.filter((item) => {
    const key = item.text.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const now = Date.now()
  const carried = unique.map((item) => ({
    ...item,
    id: ulid(),
    sourceSessionId: sessionId,
    createdAt: now,
  }))
  await writeWorkspaceActions(kv, teamId, workspaceId, {
    items: [...blob.items, ...carried],
  })
  return carried
}

export async function purgeWorkspaceActions(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
): Promise<void> {
  await kv.delete(actionsKey(teamId, workspaceId))
}

/** RETRO-ACTIONS-01: persist new action items from a closed retro session. */
export async function mergeRetroActionsOnClose(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  sessionId: string,
  actionTexts: string[],
): Promise<number> {
  const blob = await readWorkspaceActions(kv, teamId, workspaceId)
  const existing = new Set(blob.items.map((i) => i.text.trim().toLowerCase()))
  const newItems: WorkspaceActionItem[] = []
  for (const text of actionTexts) {
    const trimmed = text.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (existing.has(key)) continue
    existing.add(key)
    newItems.push({
      id: ulid(),
      text: trimmed,
      status: 'open',
      sourceSessionId: sessionId,
      createdAt: Date.now(),
    })
  }
  if (newItems.length === 0) return 0
  await writeWorkspaceActions(kv, teamId, workspaceId, {
    items: [...blob.items, ...newItems],
  })
  return newItems.length
}
