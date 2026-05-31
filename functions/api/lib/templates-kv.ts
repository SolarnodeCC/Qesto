import { TemplateRecord } from './template-schemas'
import type { Industry, Theme, Lang } from './template-schemas'
import { nanoid } from 'nanoid'

// Re-export types for convenience
export type { Industry, Theme, Lang } from './template-schemas'

export function templateKey(templateId: string): string {
  return `template:${templateId}`
}

export function byIndustryKey(industry: Industry): string {
  return `templates:by-industry:${industry}`
}

export function byThemeKey(theme: Theme): string {
  return `templates:by-theme:${theme}`
}

export function byLangKey(lang: Lang): string {
  return `templates:by-lang:${lang}`
}

// ENTERPRISE-POLISH s6a: org-scope index key
export function byTeamKey(teamId: string): string {
  return `templates:by-team:${teamId}`
}

export function byOrgKey(orgId: string): string {
  return `templates:by-org:${orgId}`
}

export async function getTemplate(
  kv: KVNamespace,
  templateId: string
): Promise<TemplateRecord | null> {
  const raw = await kv.get(templateKey(templateId), 'json')
  if (!raw) return null
  const parsed = TemplateRecord.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export async function listTemplates(
  kv: KVNamespace,
  filters?: { industry?: Industry; theme?: Theme; lang?: Lang; scope?: string; teamId?: string }
): Promise<TemplateRecord[]> {
  // Fetch the main index to get all template IDs
  const indexRaw = await kv.get('templates:index', 'json')
  const allIds = Array.isArray(indexRaw) ? indexRaw.filter((v): v is string => typeof v === 'string') : []

  const templates: TemplateRecord[] = []

  for (const id of allIds) {
    const template = await getTemplate(kv, id)
    if (!template) continue
    if (template.isDiscarded) continue

    // Apply filters
    if (filters?.industry && template.industry !== filters.industry) continue
    if (filters?.theme && template.theme !== filters.theme) continue
    // For lang filter, check if template has content in that language
    if (filters?.lang && !template.title[filters.lang]) continue
    // Org-scope filter: only return templates accessible to this team/org
    if (filters?.scope && template.scope !== filters.scope) continue
    if (filters?.teamId && template.ownedByTeamId && template.ownedByTeamId !== filters.teamId) continue

    templates.push(template)
  }

  return templates
}

export async function storeTemplate(
  kv: KVNamespace,
  template: TemplateRecord
): Promise<void> {
  const id = template.id
  const now = new Date().toISOString()

  template.createdAt = template.createdAt || now
  template.updatedAt = now

  // Store template
  await kv.put(templateKey(id), JSON.stringify(template))

  // Update indices
  await addToIndex('templates:index', id, kv)
  await addToIndex(byIndustryKey(template.industry), id, kv)
  await addToIndex(byThemeKey(template.theme), id, kv)

  // Add to all language indices
  ;(['nl', 'en', 'de', 'fr'] as const).forEach(async (lang) => {
    if (template.title[lang]) {
      await addToIndex(byLangKey(lang), id, kv)
    }
  })
}

export async function incrementUsageCount(
  kv: KVNamespace,
  templateId: string
): Promise<void> {
  const template = await getTemplate(kv, templateId)
  if (!template) return

  template.usageCount = (template.usageCount || 0) + 1
  template.updatedAt = new Date().toISOString()

  await kv.put(templateKey(templateId), JSON.stringify(template))
}

async function addToIndex(
  indexKey: string,
  templateId: string,
  kv: KVNamespace
): Promise<void> {
  const raw = await kv.get(indexKey, 'json')
  const list = (raw as string[]) || []

  if (!list.includes(templateId)) {
    list.push(templateId)
    await kv.put(indexKey, JSON.stringify(list))
  }
}

export function createTemplateId(): string {
  return `tmpl_${nanoid()}`
}
