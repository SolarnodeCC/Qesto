/**
 * CUSTOM-ACTION-PLUGIN-SDK-01 — registered team action plugins (KV).
 */
import { z } from 'zod'
import { readKvJson, writeKvJson } from './kv'
import { ulid } from './ulid'

export const CustomActionPluginSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  hook: z.enum(['session.closed', 'vote.submitted', 'energizer.completed']),
  handlerUrl: z.string().url(),
  enabled: z.boolean(),
  createdAt: z.number(),
})

export type CustomActionPlugin = z.infer<typeof CustomActionPluginSchema>

export function teamPluginsIndexKey(teamId: string): string {
  return `custom-action:index:${teamId}`
}

export function customActionPluginKey(id: string): string {
  return `custom-action:plugin:${id}`
}

export async function listTeamPlugins(kv: KVNamespace, teamId: string): Promise<CustomActionPlugin[]> {
  const index = (await readKvJson<string[]>(kv, teamPluginsIndexKey(teamId))) ?? []
  const out: CustomActionPlugin[] = []
  for (const id of index) {
    const raw = await readKvJson<unknown>(kv, customActionPluginKey(id))
    const parsed = raw ? CustomActionPluginSchema.safeParse(raw) : null
    if (parsed?.success) out.push(parsed.data)
  }
  return out
}

export async function registerTeamPlugin(
  kv: KVNamespace,
  params: Omit<CustomActionPlugin, 'id' | 'createdAt'>,
): Promise<CustomActionPlugin> {
  const plugin: CustomActionPlugin = { ...params, id: ulid(), createdAt: Date.now() }
  await writeKvJson(kv, customActionPluginKey(plugin.id), plugin)
  const index = (await readKvJson<string[]>(kv, teamPluginsIndexKey(params.teamId))) ?? []
  if (!index.includes(plugin.id)) {
    index.push(plugin.id)
    await writeKvJson(kv, teamPluginsIndexKey(params.teamId), index)
  }
  return plugin
}
