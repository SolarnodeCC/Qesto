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

  // ENTERPRISE-POLISH s6a: org-level sharing scope.
  // personal = only creator; team = all team members; organization = all teams in org.
  scope: z.enum(['personal', 'team', 'organization']).optional(),
  // The team/org that owns this template (required for team/org scope).
  ownedByTeamId: z.string().optional(),

  // ENTERPRISE-POLISH s6b: versioning.
  // Starts at 1; incremented on each update; parentId links to the prior version.
  version: z.number().optional(),
  parentId: z.string().optional(),
})
export type TemplateRecord = z.infer<typeof TemplateRecord>

export const SessionWebhookPayload = z.object({
  sessionId: z.string(),
  isPublic: z.boolean(),
  language: Lang,
  sessionMode: z.enum(['fun', 'reflection', 'townhall', 'stage']),
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
