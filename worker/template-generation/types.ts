export interface SessionPipelinePayload {
  sessionId: string
  language: 'nl' | 'en' | 'de' | 'fr'
  questionCount: number
  participantCount: number
  durationMinutes: number
}

export interface QuestionMetadata {
  id: string
  type: 'open' | 'scale' | 'multiple_choice'
  topic?: string
}

export interface RewrittenQuestion {
  id: string
  type: 'open' | 'scale' | 'multiple_choice'
  topic: string
  text: Record<string, string>
  originalHash: string
}

export interface TemplateRecord {
  id: string
  sourceSessionId: string
  title: Record<string, string>
  purpose: Record<string, string>
  bestUsedFor: Record<string, string[]>
  estimatedMinutes: number
  whatYoullLearn: Record<string, string[]>
  questions: RewrittenQuestion[]
  industry: string
  theme: string
  topic: string
  confidence: number
  isPublic: boolean
  isDiscarded: boolean
  discardReason?: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface ClassificationResult {
  industry: string
  theme: string
  topic: string
  confidence: number
  purpose_en: string
  purpose_nl: string
  purpose_de: string
  purpose_fr: string
  bestUsedFor: string[]
  estimatedMinutes: number
  whatYoullLearn: string[]
}
