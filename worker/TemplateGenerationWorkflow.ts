// Cloudflare Workflow: Session → Template Pipeline
// Triggered by session.closed webhook when session.is_public = true
// Orchestrates: rewrite → similarity check → proper noun scan → classify →
//               translate → store (draft or auto-publish) → IndexNow on publish
//
// Safety posture (pipeline audit MKTP-008): the similarity and proper-noun
// steps are privacy gates over real customer question text. They fail CLOSED —
// an unparseable AI verdict discards the question, and a step-level error
// aborts the run — because the alternative is publishing customer-identifying
// content to public, search-indexed pages.

import { WorkflowEntrypoint, WorkflowEvent } from 'cloudflare:workers'
import type { Env } from '../functions/api/types'
import { runAI, type AIGatewayEnv } from '../functions/api/lib/ai/ai-gateway'
import {
  ClassificationOutput,
  TemplateRecord,
  type Lang,
  type TemplateQuestion,
} from '../functions/api/lib/template-schemas'
import { createTemplateId, storeTemplate } from '../functions/api/lib/templates-kv'
import { pingIndexNowForTemplate } from '../functions/api/lib/indexnow'
import {
  SIMILARITY_REJECT_THRESHOLD,
  parseJsonLoose,
  parseSimilarityScore,
  properNounGateAdmits,
} from '../functions/api/lib/template-gates'

export interface SessionPipelinePayload {
  sessionId: string
  language: 'nl' | 'en' | 'de' | 'fr'
  questionCount: number
  participantCount: number
  durationMinutes: number
}

interface SourceQuestion {
  id: string
  type: 'open' | 'scale' | 'multiple_choice'
  prompt: string
  options: Array<{ id: string; label: string }>
}

interface GatedQuestion extends SourceQuestion {
  rewritten: string
  originalHash: string
}

const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = [150, 300, 600] // exponential backoff: 150ms, 300ms, 600ms
/** Classification confidence required to auto-publish; below this the template parks as draft. */
const AUTO_PUBLISH_CONFIDENCE = 70

/** Map D1 question kinds onto the template pipeline's coarse type set. */
function mapKindToTemplateType(kind: string): SourceQuestion['type'] {
  if (kind === 'likert' || kind === 'slider') return 'scale'
  if (kind === 'open' || kind === 'word_cloud' || kind === 'upvote') return 'open'
  return 'multiple_choice' // poll, multi_select, ranking, consent
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Call Workers AI with exponential backoff retry on transient failures
 */
async function invokeAI(
  env: AIGatewayEnv,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  attempt = 0,
): Promise<string> {
  try {
    const response = (await runAI(env, AI_MODEL, { messages })) as { response?: string }
    return response.response ?? ''
  } catch (err) {
    if (attempt < RETRY_ATTEMPTS - 1) {
      const delay = RETRY_DELAY_MS[attempt]
      await new Promise((r) => setTimeout(r, delay))
      return invokeAI(env, messages, attempt + 1)
    }
    throw new Error(`AI call failed after ${RETRY_ATTEMPTS} attempts: ${err instanceof Error ? err.message : String(err)}`)
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
    // Step 1: Fetch source questions — id, kind, REAL prompt text, options.
    // (MKTP-001: the previous query omitted `prompt`, so the whole pipeline
    // operated on placeholder text and published AI-invented questions.)
    // ──────────────────────────────────────────────────────────────────────
    const sourceQuestions: SourceQuestion[] = await steps.do('fetch-session-metadata', async () => {
      const { results } = await env.DB.prepare(
        `SELECT id, kind, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position ASC`,
      )
        .bind(sessionId)
        .all<{ id: string; kind: string; prompt: string; options_json: string | null }>()

      const rows = results ?? []
      console.log(`[workflow] Fetched ${rows.length} questions for session ${sessionId}`)
      if (rows.length === 0) {
        throw new Error('No questions found in session')
      }

      return rows.map((row): SourceQuestion => {
        let options: Array<{ id: string; label: string }> = []
        try {
          const parsed = JSON.parse(row.options_json ?? '[]')
          if (Array.isArray(parsed)) {
            options = parsed.filter(
              (o): o is { id: string; label: string } =>
                !!o && typeof o.id === 'string' && typeof o.label === 'string',
            )
          }
        } catch {
          options = []
        }
        return { id: row.id, type: mapKindToTemplateType(row.kind), prompt: row.prompt, options }
      })
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 2: Rewrite the real questions into generic, reusable forms.
    // An unparseable response is a hard step failure (Workflows retries the
    // step) — never fabricate question text.
    // ──────────────────────────────────────────────────────────────────────
    const rewritten: GatedQuestion[] = await steps.do('rewrite-questions', async () => {
      const questionTexts = sourceQuestions
        .map((q, i) => `Q${i + 1}: [${q.type}] ${q.prompt}`)
        .join('\n')

      const prompt = `You are a session template generator. Rewrite the following questions into generic, reusable forms. Preserve each question's intent, but remove all company-specific, location-specific, and person-specific references.

Questions:
${questionTexts}

Output ONLY a JSON array of ${sourceQuestions.length} rewritten question strings, in the same order. No markdown, no preamble.`

      const response = await invokeAI(env, [{ role: 'user', content: prompt }])
      const parsed = parseJsonLoose(response)
      if (!Array.isArray(parsed) || parsed.length !== sourceQuestions.length || !parsed.every((t) => typeof t === 'string')) {
        throw new Error(`Rewrite step returned unusable output (expected ${sourceQuestions.length} strings)`)
      }

      const result: GatedQuestion[] = []
      for (let i = 0; i < sourceQuestions.length; i++) {
        result.push({
          ...sourceQuestions[i],
          rewritten: (parsed[i] as string).trim(),
          originalHash: await sha256Hex(sourceQuestions[i].prompt),
        })
      }
      console.log(`[workflow] Rewrote ${result.length} questions`)
      return result
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 3: Similarity check — compare each rewrite against ITS OWN
    // original prompt. Unparseable verdict = reject (fail-closed).
    // ──────────────────────────────────────────────────────────────────────
    const similarityChecked: GatedQuestion[] = await steps.do('similarity-check', async () => {
      const valid: GatedQuestion[] = []

      for (const q of rewritten) {
        let attempts = 0
        let currentText = q.rewritten
        let score = 100

        while (attempts < 2 && score > SIMILARITY_REJECT_THRESHOLD) {
          if (attempts > 0) {
            const retryPrompt = `Rewrite this question to be even more generic and context-free:
"${currentText}"

Output ONLY the rewritten question. No explanation.`
            currentText = (await invokeAI(env, [{ role: 'user', content: retryPrompt }])).trim()
          }

          const similarityPrompt = `Rate the contextual similarity between these two questions on a scale of 0-100. 0 = completely different context, 100 = identical context.

Original: "${q.prompt}"
Rewritten: "${currentText}"

Output ONLY a JSON object: { "score": number, "reason": string }`

          const similarityResponse = await invokeAI(env, [{ role: 'user', content: similarityPrompt }])
          // Fail-closed: an unparseable verdict scores 100 (rejected).
          score = parseSimilarityScore(similarityResponse)
          attempts++
        }

        if (score > SIMILARITY_REJECT_THRESHOLD) {
          await logDiscard(env.MARKETING_KV, sessionId, `similarity_too_high:${score}`, q.id)
          console.log(`[workflow] Discarded Q${q.id}: similarity score ${score}`)
        } else {
          valid.push({ ...q, rewritten: currentText })
        }
      }

      console.log(`[workflow] Similarity check: ${valid.length} valid, ${rewritten.length - valid.length} discarded`)
      return valid
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 4: Proper noun scan over the rewritten prompt AND its option
    // labels. Unparseable verdict = discard (fail-closed).
    // ──────────────────────────────────────────────────────────────────────
    const properNounChecked: GatedQuestion[] = await steps.do('proper-noun-scan', async () => {
      const valid: GatedQuestion[] = []

      for (const q of similarityChecked) {
        const scanText = [q.rewritten, ...q.options.map((o) => o.label)].join('\n')
        const nerPrompt = `Scan this text for proper nouns (names, locations, company names, product names, brand names). List any found.

Text:
"""
${scanText}
"""

Output ONLY as JSON: { "nouns": ["name1", "name2"], "hasAny": boolean }`

        const nerResponse = await invokeAI(env, [{ role: 'user', content: nerPrompt }])

        // Fail-closed: only an explicit "no proper nouns" verdict admits.
        if (properNounGateAdmits(nerResponse)) {
          valid.push(q)
        } else {
          const verdict = parseJsonLoose(nerResponse) as { nouns?: unknown } | null
          const nouns = Array.isArray(verdict?.nouns) ? (verdict.nouns as string[]).join(',') : 'unparseable_verdict'
          await logDiscard(env.MARKETING_KV, sessionId, `proper_nouns_found:${nouns}`, q.id)
          console.log(`[workflow] Discarded Q${q.id}: proper noun scan (${nouns})`)
        }
      }

      console.log(`[workflow] Proper noun scan: ${valid.length} valid, ${similarityChecked.length - valid.length} discarded`)
      return valid
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
    const classified: ClassificationOutput = await steps.do('classify-and-generate', async () => {
      const defaults: ClassificationOutput = {
        industry: 'general',
        theme: 'team-wellbeing',
        topic: 'Session feedback',
        confidence: 0,
        purpose_en: 'Gather feedback on team dynamics.',
        purpose_nl: 'Verzamel feedback over teamdynamiek.',
        purpose_de: 'Erfassen Sie Feedback zur Teamdynamik.',
        purpose_fr: "Collectez des commentaires sur la dynamique de l'équipe.",
        bestUsedFor: ['team', 'feedback', 'improvement'],
        estimatedMinutes: 15,
        whatYoullLearn: ['Team strengths', 'Growth areas', 'Next steps'],
      }

      try {
        const questionSummary = properNounChecked
          .map((q, i) => `Q${i + 1} [${q.type}]: ${q.rewritten}`)
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

        const response = await invokeAI(env, [{ role: 'user', content: classifyPrompt }])
        // MKTP-005: validate against the shared schema instead of spreading raw
        // model output — a hallucinated enum would store an unreadable record.
        const parsed = ClassificationOutput.safeParse(parseJsonLoose(response))
        if (!parsed.success) {
          console.warn('[workflow] Classification failed validation, using defaults')
          return defaults
        }
        console.log(
          `[workflow] Classified as ${parsed.data.industry}/${parsed.data.theme} (confidence ${parsed.data.confidence})`,
        )
        return parsed.data
      } catch (err) {
        console.error('[workflow] Classification failed:', err)
        return defaults
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 7: Translate accepted question texts (MKTP-013 — the old pipeline
    // copied English into nl/de/fr and labeled it localized). One batched
    // call; on failure fall back to English content under every key, which
    // the schema requires and the frontend already renders.
    // ──────────────────────────────────────────────────────────────────────
    const translations: Record<'nl' | 'de' | 'fr', string[]> = await steps.do('translate-questions', async () => {
      const enTexts = properNounChecked.map((q) => q.rewritten)
      const fallback = { nl: enTexts, de: enTexts, fr: enTexts }
      try {
        const translatePrompt = `Translate each of these session questions from English into Dutch (nl), German (de), and French (fr). Keep the tone neutral and professional.

Questions:
${enTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Output ONLY as JSON (no markdown, no preamble):
{ "nl": ["...", ...], "de": ["...", ...], "fr": ["...", ...] }
Each array must contain exactly ${enTexts.length} strings, in the same order.`

        const response = await invokeAI(env, [{ role: 'user', content: translatePrompt }])
        const parsed = parseJsonLoose(response) as Record<string, unknown> | null
        const valid = (['nl', 'de', 'fr'] as const).every(
          (lang) =>
            Array.isArray(parsed?.[lang]) &&
            (parsed![lang] as unknown[]).length === enTexts.length &&
            (parsed![lang] as unknown[]).every((t) => typeof t === 'string'),
        )
        if (!parsed || !valid) {
          console.warn('[workflow] Translation output unusable, falling back to English')
          return fallback
        }
        return { nl: parsed.nl as string[], de: parsed.de as string[], fr: parsed.fr as string[] }
      } catch (err) {
        console.warn('[workflow] Translation failed, falling back to English:', err)
        return fallback
      }
    })

    // ──────────────────────────────────────────────────────────────────────
    // Step 8: Store. Registry insert is the atomic dedup gate; templates land
    // as DRAFTS unless they clear the auto-publish confidence bar (MKTP-009).
    // ──────────────────────────────────────────────────────────────────────
    const stored: { templateId: string; published: boolean } | { duplicate: true } = await steps.do(
      'store-template',
      async () => {
        const id = createTemplateId()
        const now = new Date().toISOString()

        // Confidence < 70 → force industry to "general"
        const finalIndustry = classified.confidence < AUTO_PUBLISH_CONFIDENCE ? 'general' : classified.industry
        const autoPublish = classified.confidence >= AUTO_PUBLISH_CONFIDENCE

        const questions: TemplateQuestion[] = properNounChecked.map((q, i) => ({
          id: q.id,
          type: q.type,
          topic: classified.topic,
          text: {
            en: q.rewritten,
            nl: translations.nl[i],
            de: translations.de[i],
            fr: translations.fr[i],
          },
          originalHash: q.originalHash,
          // Option labels passed the proper-noun gate; they are kept verbatim
          // (English) under every key rather than machine-translated.
          options: q.options.map((opt) => ({
            id: opt.id,
            label: { en: opt.label, nl: opt.label, de: opt.label, fr: opt.label },
          })),
        }))

        const record: TemplateRecord = TemplateRecord.parse({
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
            nl: classified.bestUsedFor,
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
          questions,
          industry: finalIndustry,
          theme: classified.theme,
          topic: classified.topic,
          confidence: classified.confidence,
          isPublic: autoPublish,
          isDiscarded: false,
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        })

        const result = await storeTemplate(env.DB, env.MARKETING_KV, record)
        if (!result.stored) {
          await logDiscard(env.MARKETING_KV, sessionId, 'duplicate_template')
          console.log(`[workflow] Discarded template for session ${sessionId}: duplicate content hash`)
          return { duplicate: true as const }
        }

        console.log(
          `[workflow] Stored template ${id} (${autoPublish ? 'auto-published' : 'draft, pending review'})`,
        )
        return { templateId: id, published: autoPublish }
      },
    )

    if ('duplicate' in stored) {
      return { status: 'discarded', reason: 'duplicate_template' }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Step 9: IndexNow ping — ONLY for auto-published templates. Drafts must
    // not be announced to search engines (their URLs would 404).
    // ──────────────────────────────────────────────────────────────────────
    if (stored.published) {
      await steps.do('index-now-ping', async () => {
        try {
          const pinged = await pingIndexNowForTemplate(env, stored.templateId)
          if (pinged) {
            console.log(`[workflow] IndexNow ping sent for template ${stored.templateId}`)
          } else {
            console.warn('[workflow] IndexNow ping skipped or rejected (non-blocking)')
          }
        } catch (err) {
          console.warn('[workflow] IndexNow ping failed (non-blocking):', err)
        }
      })
    }

    console.log(`[workflow] Template generation completed for session ${sessionId} → ${stored.templateId}`)
    return { status: 'success', templateId: stored.templateId, published: stored.published }
  }
}
