/**
 * Gallery / marketplace template contracts shared by TemplateGallery + TemplateDetail.
 */

export type GalleryLang = 'nl' | 'en' | 'de' | 'fr'

export type TemplateGalleryQuestion = {
  id: string
  text: Record<GalleryLang, string>
  type: string
}

/** List + detail payload from `/api/gallery` (detail may include optional fields). */
export type TemplateGalleryRecord = {
  id: string
  title: Record<GalleryLang, string>
  purpose: Record<GalleryLang, string>
  bestUsedFor: Record<GalleryLang, string[]>
  estimatedMinutes: number
  questions: TemplateGalleryQuestion[]
  industry: string
  theme: string
  topic: string
  usageCount: number
  createdAt: string
  whatYoullLearn?: Record<GalleryLang, string[]>
  updatedAt?: string
}

export type TemplateGalleryListResponse = {
  templates: TemplateGalleryRecord[]
  total: number
  limit: number
  offset: number
}

export const GALLERY_PIPELINE_LANGS: GalleryLang[] = ['nl', 'en', 'de', 'fr']
