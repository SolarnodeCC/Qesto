import { z } from 'zod'

export const Lang = z.enum(['nl', 'en', 'de', 'fr'])
export type Lang = z.infer<typeof Lang>

export const Industry = z.enum([
  'hr-people',
  'agile-software',
  'education-training',
  'leadership-management',
  'sales-customer-success',
  'healthcare',
  'general',
])
export type Industry = z.infer<typeof Industry>

export const Theme = z.enum([
  'team-wellbeing',
  'retrospective-reflection',
  'change-transformation',
  'learning-development',
  'engagement-motivation',
  'strategy-alignment',
  'innovation-ideation',
])
export type Theme = z.infer<typeof Theme>

export const QuestionKind = z.enum(['open', 'scale', 'multiple_choice'])
export type QuestionKind = z.infer<typeof QuestionKind>

export const TemplateQuestion = z.object({
  id: z.string(),
  text: z.record(Lang, z.string()),
  originalHash: z.string(),
  topic: z.string(),
  type: QuestionKind,
})
export type TemplateQuestion = z.infer<typeof TemplateQuestion>

export const TemplateRecord = z.object({
  id: z.string(),
  sourceSessionId: z.string(),

  title: z.record(Lang, z.string()),
  purpose: z.record(Lang, z.string()),
  bestUsedFor: z.record(Lang, z.array(z.string())),
  estimatedMinutes: z.number(),
  whatYoullLearn: z.record(Lang, z.array(z.string())),

  questions: z.array(TemplateQuestion),

  industry: Industry,
  theme: Theme,
  topic: z.string(),
  confidence: z.number().min(0).max(100),

  isPublic: z.boolean(),
  isDiscarded: z.boolean(),
  discardReason: z.string().optional(),

  usageCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type TemplateRecord = z.infer<typeof TemplateRecord>

export const SessionWebhookPayload = z.object({
  sessionId: z.string(),
  isPublic: z.boolean(),
  language: Lang,
  sessionMode: z.enum(['fun', 'reflection', 'townhall']),
  questionCount: z.number(),
  participantCount: z.number(),
  responseRate: z.number().min(0).max(1),
  durationMinutes: z.number(),
  templateUsed: z.string().nullable().optional(),
  energizerUsed: z.boolean(),
})
export type SessionWebhookPayload = z.infer<typeof SessionWebhookPayload>

export const ClassificationOutput = z.object({
  industry: Industry,
  theme: Theme,
  topic: z.string(),
  confidence: z.number().min(0).max(100),
  purpose_nl: z.string(),
  purpose_en: z.string(),
  purpose_de: z.string(),
  purpose_fr: z.string(),
  bestUsedFor: z.array(z.string()),
  estimatedMinutes: z.number(),
  whatYoullLearn: z.array(z.string()),
})
export type ClassificationOutput = z.infer<typeof ClassificationOutput>
