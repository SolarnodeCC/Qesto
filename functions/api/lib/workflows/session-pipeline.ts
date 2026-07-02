// Cloudflare Workflow: Process session.closed events into public templates.
// Orchestrates: rewrite → similarity check → proper noun scan → classification → storage

import { z } from 'zod'
import type { Env } from '../../types'
import { runAI } from '../ai/ai-gateway'
import { logEvent } from '../log'
import { SessionWebhookPayload, TemplateRecord, ClassificationOutput, Lang } from '../template-schemas'
import { createTemplateId } from '../templates-kv'

/** Minimal structural contract for workflow AI steps — delegates to runAI(). */
type WorkflowAi = Pick<Env, 'AI' | 'CLOUDFLARE_AI_GATEWAY_ID' | 'CLOUDFLARE_AI_GATEWAY_TOKEN' | 'CLOUDFLARE_ACCOUNT_ID'>

export interface WorkflowInput extends SessionWebhookPayload {
  // Original question text (from session metadata, not answers)
  originalQuestions?: Array<{ text: string; kind: string }>
}

/**
 * Main workflow handler. Called by Cloudflare Workflows trigger.
 */
export async function sessionPipelineWorkflow(input: WorkflowInput, env: Env): Promise<void> {
  // Early exit if session is private
  if (!input.isPublic) {
    logEvent({ event: 'workflow.skipped.private_session', sessionId: input.sessionId })
    return
  }

  // Step 1: Fetch original questions from session (if not provided in webhook)
  // For MVP, we assume question metadata is provided; full implementation would fetch from D1
  if (!input.originalQuestions || input.originalQuestions.length === 0) {
    logEvent({ event: 'workflow.skipped.no_questions', sessionId: input.sessionId })
    return
  }

  // Step 2: Rewrite questions
  const rewriteResults = await rewriteQuestions(input.originalQuestions, env)

  // Step 3: Similarity check
  const checkedQuestions = await similarityCheck(input.originalQuestions, rewriteResults, env)

  // Step 4: Proper noun scan
  const scannedQuestions = await properNounScan(checkedQuestions, env)

  // Early exit if no questions remain
  if (scannedQuestions.length === 0) {
    logEvent({
      event: 'workflow.discarded.no_questions_remaining',
      sessionId: input.sessionId,
    })
    return
  }

  // Step 5: Classification
  const classification = await classify(scannedQuestions, input.language as Lang, env)

  // Step 6: Generate template
  const template = buildTemplateRecord(input, scannedQuestions, classification, input.language as Lang)

  // Step 7: Store in MARKETING_KV
  await storeTemplate(template, env.MARKETING_KV)

  logEvent({
    event: 'workflow.complete',
    sessionId: input.sessionId,
    templateId: template.id,
    questions: template.questions.length,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker AI calls (mock for MVP; integrate with c.env.AI in real implementation)
// ─────────────────────────────────────────────────────────────────────────────

async function workflowAI(
  env: WorkflowAi,
  model: string,
  input: Record<string, unknown>,
): Promise<{ response: string }> {
  const raw = await runAI(env as Env, model, input)
  if (typeof raw === 'string') return { response: raw }
  if (raw && typeof raw === 'object' && 'response' in raw) {
    return { response: String((raw as { response?: string }).response ?? '') }
  }
  return { response: JSON.stringify(raw) }
}

async function rewriteQuestions(
  originalQuestions: Array<{ text: string; kind: string }>,
  ai: WorkflowAi
): Promise<Array<{ original: string; rewritten: string }>> {
  const prompt = buildRewritePrompt(originalQuestions)

  try {
    const result = await workflowAI(ai, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        {
          role: 'system',
          content: 'You are a template generator. Rewrite questions into generic, reusable forms. Remove all company-specific, location-specific, person-specific references.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      stream: false,
    })

    // Parse result and extract rewritten questions
    const parsed = parseJsonResponse(result.response)
    const rewritten = Array.isArray(parsed)
      ? parsed.map((text, idx) => ({ original: originalQuestions[idx].text, rewritten: text }))
      : originalQuestions.map((q) => ({ original: q.text, rewritten: q.text }))
    return rewritten
  } catch (err) {
    logEvent({
      event: 'workflow.rewrite.error',
      error: err instanceof Error ? err.message : String(err),
    })
    return originalQuestions.map((q) => ({ original: q.text, rewritten: q.text }))
  }
}

async function similarityCheck(
  _originalQuestions: Array<{ text: string; kind: string }>,
  rewriteResults: Array<{ original: string; rewritten: string }>,
  ai: WorkflowAi
): Promise<Array<{ text: string; kind: string; passed: boolean; score?: number }>> {
  const checked = []

  for (const result of rewriteResults) {
    const prompt = `Original: "${result.original}"\nRewritten: "${result.rewritten}"\n\nRate similarity 0-100 (0=completely different, 100=identical).`

    try {
      const response = await workflowAI(ai, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          {
            role: 'system',
            content: 'Rate contextual similarity between two questions on a scale of 0-100.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 100,
        stream: false,
      })

      const parsed = SimilarityScoreSchema.safeParse(parseJsonResponse(response.response))
      const score = parsed.success ? (parsed.data.score ?? 0) : 0

      checked.push({
        text: result.rewritten,
        kind: 'open', // Default; actual kind should come from original
        passed: score <= 30,
        score,
      })
    } catch (err) {
      logEvent({
        event: 'workflow.similarity_check.error',
        error: err instanceof Error ? err.message : String(err),
      })
      // Default to passing on error (fail-open)
      checked.push({
        text: result.rewritten,
        kind: 'open',
        passed: true,
      })
    }
  }

  return checked.filter((q) => q.passed)
}

async function properNounScan(
  questions: Array<{ text: string; kind: string }>,
  ai: WorkflowAi
): Promise<Array<{ text: string; kind: string }>> {
  const prompt = `List any proper nouns (names, places, companies, brands) in these questions:\n${questions.map((q) => `- "${q.text}"`).join('\n')}`

  try {
    const result = await workflowAI(ai, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        {
          role: 'system',
          content: 'Identify proper nouns in text. List them as JSON: {"found": [...], "questionIndices": [...]}',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      stream: false,
    })

    const parsed = ProperNounScanSchema.safeParse(parseJsonResponse(result.response))
    const flaggedIndices = new Set(parsed.success ? (parsed.data.questionIndices ?? []) : [])

    return questions.filter((_, idx) => !flaggedIndices.has(idx))
  } catch (err) {
    logEvent({
      event: 'workflow.proper_noun_scan.error',
      error: err instanceof Error ? err.message : String(err),
    })
    // Default to all questions on error (fail-open)
    return questions
  }
}

async function classify(
  questions: Array<{ text: string; kind: string }>,
  _language: Lang | string,
  ai: WorkflowAi
): Promise<ClassificationOutput> {
  const prompt = `Classify these session questions:
${questions.map((q) => `- ${q.text}`).join('\n')}

Return JSON with: industry, theme, topic, confidence (0-100), purpose_nl, purpose_en, purpose_de, purpose_fr, bestUsedFor (array), estimatedMinutes (number), whatYoullLearn (array)`

  try {
    const result = await workflowAI(ai, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        {
          role: 'system',
          content: `Classify Qesto session questions. Return ONLY valid JSON (no markdown, no preamble).`,
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      stream: false,
    })

    const classification = parseClassificationOutput(parseJsonResponse(result.response))

    // Normalize confidence
    if (classification.confidence < 70) {
      classification.industry = 'general'
    }

    return classification
  } catch (err) {
    logEvent({
      event: 'workflow.classify.error',
      error: err instanceof Error ? err.message : String(err),
    })

    return {
      industry: 'general',
      theme: 'strategy-alignment',
      topic: 'General Questions',
      confidence: 0,
      purpose_nl: 'Algemene vragen voor teamfeedback',
      purpose_en: 'General questions for team feedback',
      purpose_de: 'Allgemeine Fragen für Team-Feedback',
      purpose_fr: 'Questions générales pour les retours d\'équipe',
      bestUsedFor: ['feedback', 'discovery', 'retrospective'],
      estimatedMinutes: 15,
      whatYoullLearn: ['Team perspectives', 'Feedback themes', 'Key insights'],
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildRewritePrompt(questions: Array<{ text: string }>): string {
  return `Rewrite these questions into generic, reusable forms:
${questions.map((q) => `- "${q.text}"`).join('\n')}

Return ONLY a JSON array of rewritten questions: ["rewritten 1", "rewritten 2", ...]`
}

const SimilarityScoreSchema = z.object({
  score: z.number().optional(),
})

const ProperNounScanSchema = z.object({
  questionIndices: z.array(z.number()).optional(),
})

function parseJsonResponse(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

function parseClassificationOutput(value: unknown): ClassificationOutput {
  const result = ClassificationOutput.safeParse(value)
  if (result.success) return result.data
  return {
    industry: 'general',
    theme: 'engagement-motivation',
    topic: 'session',
    confidence: 50,
    purpose_nl: '',
    purpose_en: '',
    purpose_de: '',
    purpose_fr: '',
    bestUsedFor: [],
    estimatedMinutes: 15,
    whatYoullLearn: [],
  }
}

function buildTemplateRecord(
  input: SessionWebhookPayload,
  questions: Array<{ text: string; kind: string }>,
  classification: ClassificationOutput,
  _language: Lang | string
): TemplateRecord {
  const templateId = createTemplateId()

  return {
    id: templateId,
    sourceSessionId: input.sessionId,
    title: {
      nl: `${classification.topic} - Template`,
      en: `${classification.topic} - Template`,
      de: `${classification.topic} - Template`,
      fr: `${classification.topic} - Template`,
    },
    purpose: {
      nl: classification.purpose_nl || 'Session template',
      en: classification.purpose_en || 'Session template',
      de: classification.purpose_de || 'Session template',
      fr: classification.purpose_fr || 'Session template',
    },
    bestUsedFor: {
      nl: classification.bestUsedFor || [],
      en: classification.bestUsedFor || [],
      de: classification.bestUsedFor || [],
      fr: classification.bestUsedFor || [],
    },
    estimatedMinutes: classification.estimatedMinutes || 15,
    whatYoullLearn: {
      nl: classification.whatYoullLearn || [],
      en: classification.whatYoullLearn || [],
      de: classification.whatYoullLearn || [],
      fr: classification.whatYoullLearn || [],
    },
    questions: questions.map((q, idx) => ({
      id: `q_${templateId}_${idx}`,
      text: {
        nl: q.text,
        en: q.text,
        de: q.text,
        fr: q.text,
      },
      originalHash: '', // Compute SHA-256 in real implementation
      topic: classification.topic,
      type: q.kind === 'open' ? 'open' : q.kind === 'likert' ? 'scale' : 'multiple_choice',
    })),
    industry: classification.industry as TemplateRecord["industry"],
    theme: classification.theme as TemplateRecord["theme"],
    topic: classification.topic,
    confidence: classification.confidence,
    isPublic: true,
    isDiscarded: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

async function storeTemplate(template: TemplateRecord, kv: KVNamespace | undefined): Promise<void> {
  if (!kv) {
    logEvent({ event: 'workflow.store.kv_unavailable' })
    return
  }

  try {
    await kv.put(`template:${template.id}`, JSON.stringify(template))

    // Update indices
    const indexRaw = await kv.get('templates:index', 'json')
    const index = (indexRaw as string[]) || []
    if (!index.includes(template.id)) {
      index.push(template.id)
      await kv.put('templates:index', JSON.stringify(index))
    }

    logEvent({
      event: 'workflow.store.success',
      templateId: template.id,
    })
  } catch (err) {
    logEvent({
      event: 'workflow.store.error',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
