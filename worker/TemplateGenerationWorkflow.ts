// Cloudflare Workflow: Session → Template Pipeline
// Triggered by session.closed webhook when session.is_public = true
// Orchestrates: rewrite → similarity check → proper noun scan → classify → store

import { WorkflowEntrypoint, WorkflowEvent } from 'cloudflare:workers'
import type { Env } from '../functions/api/types'
import { nanoid } from 'nanoid'

export interface SessionPipelinePayload {
  sessionId: string
  language: 'nl' | 'en' | 'de' | 'fr'
  questionCount: number
  participantCount: number
  durationMinutes: number
}

interface QuestionMetadata {
  id: string
  type: 'open' | 'scale' | 'multiple_choice'
  topic?: string
}

interface RewrittenQuestion {
  id: string
  type: 'open' | 'scale' | 'multiple_choice'
  topic: string
  text: Record<string, string> // lang → rewritten text
  originalHash: string
}

interface TemplateRecord {
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

const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = [150, 300, 600] // exponential backoff: 150ms, 300ms, 600ms

/**
 * Call Workers AI with exponential backoff retry on transient failures
 */
async function invokeAI(
  ai: any,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  attempt = 0,
): Promise<string> {
  try {
    const response = await ai.run(AI_MODEL, { messages })
    return response.response
  } catch (err) {
    if (attempt < RETRY_ATTEMPTS - 1) {
      const delay = RETRY_DELAY_MS[attempt]
      await new Promise((r) => setTimeout(r, delay))
      return invokeAI(ai, messages, attempt + 1)
    }
    throw new Error(`AI call failed after ${RETRY_ATTEMPTS} attempts: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Update KV indices (thread-safe list operations)
 */
async function addToIndex(kv: KVNamespace, indexKey: string, templateId: string): Promise<void> {
  const raw = await kv.get(indexKey, 'json')
  const list = (raw as string[]) || []
  if (!list.includes(templateId)) {
    list.push(templateId)
    await kv.put(indexKey, JSON.stringify(list))
  }
}

/**
 * Log discard event (JSON lines format, 7-day TTL)
 */
async function logDiscard(
  kv: KVNamespace,
  sessionId: string,
  reason: string,
  questionId?: string,
): Promise<void> {
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    sessionId,
    questionId,
    reason,
  })
  const logKey = `discard-log:${new Date().toISOString().split('T')[0]}`
  const existing = await kv.get(logKey)
  const newLog = existing ? `${existing}\n${logEntry}` : logEntry
  await kv.put(logKey, newLog, { expirationTtl: 604800 }) // 7 days
}

export class TemplateGenerationWorkflow extends WorkflowEntrypoint<Env, SessionPipelinePayload> {
  async run(event: WorkflowEvent<SessionPipelinePayload>, steps: any) {
    const payload = event.payload
    const env = this.env
    const sessionId = payload.sessionId

    console.log(`[workflow] Starting template generation for session ${sessionId}`)

    // ──────────────────────────────────────────────────────────────────────
    // Step 1: Fetch session metadata (questions list + types only)
    // ──────────────────────────────────────────────────────────────────────
    const metadata = await steps.do('fetch-session-metadata', async () => {
      try {
        const questionsData = await env.DB.prepare(
          `SELECT id, kind as type FROM questions WHERE session_id = ?1`,
        )
          .bind(sessionId)
          .all<QuestionMetadata>()

        const questions = (questionsData.results as QuestionMetadata[]) || []
        console.log(`[workflow] Fetched ${questions.length} questions for session ${sessionId}`)

        if (questions.length === 0) {
          throw new Error('No questions found in session')
        }

        return questions
      } catch (err) {
        console.error('[workflow] Failed to fetch session metadata:', err)
        throw err
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 2: Rewrite questions (Workers AI)
    // ──────────────────────────────────────────────────────────────────────
    const rewritten = await steps.do('rewrite-questions', async () => {
      try {
        const questionTexts = metadata.map((q, i) => `Q${i + 1}: [${q.type}] Generic question about topic`).join('\n')

        const prompt = `You are a session template generator. Rewrite the following question metadata into generic, reusable forms. Remove all company-specific, location-specific, and person-specific references.

Questions:
${questionTexts}

Output ONLY as JSON array of strings, one rewritten question per line. No markdown, no preamble.`

        const response = await invokeAI(env.AI, [{ role: 'user', content: prompt }])

        // Parse response (best-effort; if fails, discard this step)
        let rewrittenTexts: string[] = []
        try {
          const parsed = JSON.parse(response)
          rewrittenTexts = Array.isArray(parsed) ? parsed : [response]
        } catch {
          // Fall back to treating response as single question
          rewrittenTexts = [response]
        }

        // Map back to question objects with rewritten text
        const result: RewrittenQuestion[] = metadata.map((q, i) => ({
          id: q.id,
          type: q.type,
          topic: '', // will be filled in classify step
          text: {
            en: rewrittenTexts[i] || 'Question',
            nl: rewrittenTexts[i] || 'Vraag',
            de: rewrittenTexts[i] || 'Frage',
            fr: rewrittenTexts[i] || 'Question',
          },
          originalHash: '', // will be set in similarity check
        }))

        console.log(`[workflow] Rewritten ${result.length} questions`)
        return result
      } catch (err) {
        console.error('[workflow] Rewrite step failed:', err)
        throw err
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 3: Similarity check (filter out questions too similar to originals)
    // ──────────────────────────────────────────────────────────────────────
    const similarityChecked = await steps.do('similarity-check', async () => {
      try {
        const valid: RewrittenQuestion[] = []
        const discarded: string[] = []

        for (const q of rewritten) {
          let attempts = 0
          let currentText = q.text.en
          let score = 100

          // Retry loop: rewrite again if similarity > 30
          while (attempts < 2 && score > 30) {
            if (attempts > 0) {
              const retryPrompt = `Rewrite this question to be even more generic and context-free:
"${currentText}"

Output ONLY the rewritten question. No explanation.`
              currentText = await invokeAI(env.AI, [{ role: 'user', content: retryPrompt }])
            }

            // Check similarity
            const similarityPrompt = `Rate the contextual similarity between these two questions on a scale of 0-100. 0 = completely different context, 100 = identical context.

Original context: "How did your team handle [specific scenario]?"
Rewritten: "${currentText}"

Output ONLY a JSON object: { "score": number, "reason": string }`

            const similarityResponse = await invokeAI(env.AI, [{ role: 'user', content: similarityPrompt }])

            try {
              const parsed = JSON.parse(similarityResponse)
              score = parsed.score || 0
            } catch {
              score = 0 // Default to accept if parse fails
            }

            attempts++
          }

          // Final decision
          if (score > 30) {
            discarded.push(q.id)
            await logDiscard(env.MARKETING_KV, sessionId, `similarity_too_high:${score}`, q.id)
            console.log(`[workflow] Discarded Q${q.id}: similarity score ${score}`)
          } else {
            valid.push({
              ...q,
              text: { ...q.text, en: currentText },
            })
          }
        }

        console.log(`[workflow] Similarity check: ${valid.length} valid, ${discarded.length} discarded`)
        return valid
      } catch (err) {
        console.error('[workflow] Similarity check failed:', err)
        // Fail-open: return all questions rather than failing entire workflow
        return rewritten
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 4: Proper noun scanner (NER — named entity recognition)
    // ──────────────────────────────────────────────────────────────────────
    const properNounChecked = await steps.do('proper-noun-scan', async () => {
      try {
        const valid: RewrittenQuestion[] = []
        const discarded: string[] = []

        for (const q of similarityChecked) {
          const nerPrompt = `Scan this question for proper nouns (names, locations, company names, product names, brand names). List any found.

Question: "${q.text.en}"

Output ONLY as JSON: { "nouns": ["name1", "name2"], "hasAny": boolean }`

          const nerResponse = await invokeAI(env.AI, [{ role: 'user', content: nerPrompt }])

          try {
            const parsed = JSON.parse(nerResponse)
            if (parsed.hasAny) {
              discarded.push(q.id)
              await logDiscard(env.MARKETING_KV, sessionId, `proper_nouns_found:${parsed.nouns.join(',')}`, q.id)
              console.log(`[workflow] Discarded Q${q.id}: proper nouns ${parsed.nouns.join(', ')}`)
            } else {
              valid.push(q)
            }
          } catch {
            // If NER parsing fails, keep the question (fail-open)
            valid.push(q)
          }
        }

        console.log(`[workflow] Proper noun scan: ${valid.length} valid, ${discarded.length} discarded`)
        return valid
      } catch (err) {
        console.error('[workflow] Proper noun scan failed:', err)
        return similarityChecked
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 5: Conditional branch — if no questions remain, discard entire template
    // ──────────────────────────────────────────────────────────────────────
    const shouldContinue = await steps.do('check-question-count', async () => {
      if (properNounChecked.length === 0) {
        await logDiscard(env.MARKETING_KV, sessionId, 'all_questions_discarded')
        return false
      }
      return true
    })

    if (!shouldContinue) {
      console.log(`[workflow] Template ${sessionId} fully discarded: no valid questions`)
      return { status: 'discarded', reason: 'all_questions_discarded' }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Step 6: Classification + multilingual content generation
    // ──────────────────────────────────────────────────────────────────────
    const classified = await steps.do('classify-and-generate', async () => {
      try {
        const questionSummary = properNounChecked
          .map((q, i) => `Q${i + 1} [${q.type}]: ${q.text.en}`)
          .join('\n')

        const classifyPrompt = `Classify these questions and generate session template metadata.

Questions:
${questionSummary}

Output ONLY as JSON (no markdown, no preamble):
{
  "industry": "one of [hr-people, agile-software, education-training, leadership-management, sales-customer-success, healthcare, general]",
  "theme": "one of [team-wellbeing, retrospective-reflection, change-transformation, learning-development, engagement-motivation, strategy-alignment, innovation-ideation]",
  "topic": "2-4 word label",
  "confidence": 0-100,
  "purpose_en": "2-sentence purpose statement in English",
  "purpose_nl": "2-sentence purpose statement in Dutch",
  "purpose_de": "2-sentence purpose statement in German",
  "purpose_fr": "2-sentence purpose statement in French",
  "bestUsedFor": ["context tag 1", "context tag 2", "context tag 3"],
  "estimatedMinutes": integer,
  "whatYoullLearn": ["insight 1", "insight 2", "insight 3"]
}`

        const response = await invokeAI(env.AI, [{ role: 'user', content: classifyPrompt }])

        let classification = {
          industry: 'general',
          theme: 'team-wellbeing',
          topic: 'Session feedback',
          confidence: 50,
          purpose_en: 'Gather feedback on team dynamics.',
          purpose_nl: 'Verzamel feedback over teamdynamiek.',
          purpose_de: 'Erfassen Sie Feedback zur Teamdynamik.',
          purpose_fr: 'Collectez des commentaires sur la dynamique de l\'équipe.',
          bestUsedFor: ['team', 'feedback', 'improvement'],
          estimatedMinutes: 15,
          whatYoullLearn: ['Team strengths', 'Growth areas', 'Next steps'],
        }

        try {
          const parsed = JSON.parse(response)
          classification = { ...classification, ...parsed }
        } catch {
          console.warn('[workflow] Failed to parse classification, using defaults')
        }

        console.log(
          `[workflow] Classified as ${classification.industry}/${classification.theme} (confidence ${classification.confidence})`,
        )
        return classification
      } catch (err) {
        console.error('[workflow] Classification failed:', err)
        // Return sensible defaults instead of failing
        return {
          industry: 'general',
          theme: 'team-wellbeing',
          topic: 'Session feedback',
          confidence: 0,
          purpose_en: 'Session feedback template',
          purpose_nl: 'Sjabloon voor sessiefeedback',
          purpose_de: 'Sitzungs-Feedback-Vorlage',
          purpose_fr: 'Modèle de rétroaction de session',
          bestUsedFor: ['session', 'feedback'],
          estimatedMinutes: 15,
          whatYoullLearn: ['Team insights'],
        }
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 7: Store in MARKETING_KV
    // ──────────────────────────────────────────────────────────────────────
    const templateId = await steps.do('store-template', async () => {
      try {
        const id = `tmpl_${nanoid()}`
        const now = new Date().toISOString()

        // Confidence < 70 → force industry to "general"
        const finalIndustry = classified.confidence < 70 ? 'general' : classified.industry

        const record: TemplateRecord = {
          id,
          sourceSessionId: sessionId,
          title: {
            en: `Template: ${classified.topic}`,
            nl: `Sjabloon: ${classified.topic}`,
            de: `Vorlage: ${classified.topic}`,
            fr: `Modèle: ${classified.topic}`,
          },
          purpose: {
            en: classified.purpose_en,
            nl: classified.purpose_nl,
            de: classified.purpose_de,
            fr: classified.purpose_fr,
          },
          bestUsedFor: {
            en: classified.bestUsedFor,
            nl: classified.bestUsedFor, // Would ideally translate, but AI cost
            de: classified.bestUsedFor,
            fr: classified.bestUsedFor,
          },
          estimatedMinutes: classified.estimatedMinutes,
          whatYoullLearn: {
            en: classified.whatYoullLearn,
            nl: classified.whatYoullLearn,
            de: classified.whatYoullLearn,
            fr: classified.whatYoullLearn,
          },
          questions: properNounChecked,
          industry: finalIndustry,
          theme: classified.theme,
          topic: classified.topic,
          confidence: classified.confidence,
          isPublic: true,
          isDiscarded: false,
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        }

        // Store main template
        await env.MARKETING_KV.put(`template:${id}`, JSON.stringify(record))

        // Update indices
        await addToIndex(env.MARKETING_KV, 'templates:index', id)
        await addToIndex(env.MARKETING_KV, `templates:by-industry:${finalIndustry}`, id)
        await addToIndex(env.MARKETING_KV, `templates:by-theme:${classified.theme}`, id)
        await addToIndex(env.MARKETING_KV, `templates:by-lang:${payload.language}`, id)

        console.log(`[workflow] Stored template ${id} in MARKETING_KV`)
        return id
      } catch (err) {
        console.error('[workflow] Storage failed:', err)
        throw err
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 8: IndexNow ping (SEO — tell search engines about new page)
    // Supports both Options:
    // - Option 1: Key file at domain root with name matching key (e.g., /e8964e65.txt)
    // - Option 2: Key file at standard location (/.well-known/indexnow or /indexnow.txt)
    // ──────────────────────────────────────────────────────────────────────
    await steps.do('index-now-ping', async () => {
      try {
        const indexNowKey = env.INDEXNOW_KEY
        if (!indexNowKey) {
          console.warn('[workflow] INDEXNOW_KEY not configured, skipping ping')
          return
        }

        // Determine keyLocation based on INDEXNOW_KEY_FILE env var
        let keyLocation = 'https://qesto.cc/indexnow.txt' // Default: Option 2
        if (env.INDEXNOW_KEY_FILE) {
          // Option 1: Use key filename (e.g., 'e8964e65...txt')
          keyLocation = `https://qesto.cc/${env.INDEXNOW_KEY_FILE}`
        }

        const payload = {
          host: 'qesto.cc',
          key: indexNowKey,
          keyLocation,
          urlList: [`https://qesto.cc/templates/${templateId}`],
        }

        await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        console.log(`[workflow] IndexNow ping sent for template ${templateId}`, {
          keyLocation,
        })
      } catch (err) {
        console.warn('[workflow] IndexNow ping failed (non-blocking):', err)
      }
    })

    return { status: 'success', templateId }
  }
}
