/**
 * Help system prompt versioning and retrieval.
 * Supports multiple prompt versions with topic-specific overrides.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { safeLogContext } from './log'

export interface PromptVersion {
  id: string
  version: number
  content: string
  topic: string | null
  active: boolean
  createdAt: number
}

/**
 * Get the active system prompt for a given topic.
 * Falls back to global prompt if no topic-specific prompt exists.
 */
export async function getActivePrompt(db: D1Database, topic?: string): Promise<PromptVersion | null> {
  try {
    // First try topic-specific active prompt
    if (topic) {
      const topicPrompt = await db
        .prepare(
          `SELECT id, version, content, topic, 1 as active, created_at
           FROM help_prompt_versions
           WHERE active = 1 AND topic = ?
           ORDER BY version DESC
           LIMIT 1`,
        )
        .bind(topic)
        .first<{
          id: string
          version: number
          content: string
          topic: string | null
          active: number
          created_at: number
        }>()

      if (topicPrompt) {
        return {
          id: topicPrompt.id,
          version: topicPrompt.version,
          content: topicPrompt.content,
          topic: topicPrompt.topic,
          active: true,
          createdAt: topicPrompt.created_at,
        }
      }
    }

    // Fall back to global active prompt (topic = NULL)
    const globalPrompt = await db
      .prepare(
        `SELECT id, version, content, topic, 1 as active, created_at
         FROM help_prompt_versions
         WHERE active = 1 AND topic IS NULL
         ORDER BY version DESC
         LIMIT 1`,
      )
      .first<{
        id: string
        version: number
        content: string
        topic: string | null
        active: number
        created_at: number
      }>()

    if (globalPrompt) {
      return {
        id: globalPrompt.id,
        version: globalPrompt.version,
        content: globalPrompt.content,
        topic: globalPrompt.topic,
        active: true,
        createdAt: globalPrompt.created_at,
      }
    }

    return null
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'lib/help-prompts/get-active', errorClass: err instanceof Error ? err.name : 'UnknownError' })
    return null
  }
}

/**
 * List all prompt versions (active and inactive).
 */
export async function listPromptVersions(
  db: D1Database,
  limit = 50,
  offset = 0,
): Promise<{ versions: PromptVersion[]; total: number }> {
  try {
    const result = await db
      .prepare(
        `SELECT id, version, content, topic, active, created_at
         FROM help_prompt_versions
         ORDER BY version DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all<{
        id: string
        version: number
        content: string
        topic: string | null
        active: number
        created_at: number
      }>()

    const countResult = await db
      .prepare('SELECT COUNT(*) as count FROM help_prompt_versions')
      .first<{ count: number }>()

    const versions = (result.results || []).map((v) => ({
      id: v.id,
      version: v.version,
      content: v.content,
      topic: v.topic,
      active: v.active === 1,
      createdAt: v.created_at,
    }))

    return {
      versions,
      total: countResult?.count ?? 0,
    }
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'lib/help-prompts/list-versions', errorClass: err instanceof Error ? err.name : 'UnknownError' })
    return { versions: [], total: 0 }
  }
}

/**
 * Activate a specific prompt version (deactivate others in same topic scope).
 */
export async function activatePromptVersion(db: D1Database, promptId: string): Promise<boolean> {
  try {
    // Get the prompt to determine its topic
    const prompt = await db
      .prepare('SELECT id, topic FROM help_prompt_versions WHERE id = ?')
      .bind(promptId)
      .first<{ id: string; topic: string | null }>()

    if (!prompt) {
      console.warn(`Prompt ${promptId} not found`)
      return false
    }

    // Deactivate all prompts in the same scope (topic or global)
    const deactivateWhere = prompt.topic ? 'topic = ?' : 'topic IS NULL'
    await db
      .prepare(`UPDATE help_prompt_versions SET active = 0 WHERE ${deactivateWhere}`)
      .bind(prompt.topic || null)
      .run()

    // Activate this one
    await db
      .prepare('UPDATE help_prompt_versions SET active = 1 WHERE id = ?')
      .bind(promptId)
      .run()

    console.log(
      JSON.stringify({
        event: 'help.prompt.activated',
        prompt_id: promptId,
        topic: prompt.topic,
      }),
    )

    return true
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'lib/help-prompts/activate-version', errorClass: err instanceof Error ? err.name : 'UnknownError' })
    return false
  }
}
