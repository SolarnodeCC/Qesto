import { nanoid } from 'nanoid'
import type { Env } from '../../functions/api/types'
import { addToIndex, invokeAI, logDiscard } from './helpers'
import type {
  ClassificationResult,
  QuestionMetadata,
  RewrittenQuestion,
  SessionPipelinePayload,
  TemplateRecord,
} from './types'

export async function fetchSessionMetadata(env: Env, sessionId: string): Promise<QuestionMetadata[]> {
  const questionsData = await env.DB.prepare(
    `SELECT id, kind as type FROM questions WHERE session_id = ?1`,
  )
    .bind(sessionId)
    .all<QuestionMetadata>()

  const questions = (questionsData.results as QuestionMetadata[]) || []
  if (questions.length === 0) throw new Error('No questions found in session')
  return questions
}

export async function rewriteQuestions(
  env: Env,
  metadata: QuestionMetadata[],
): Promise<RewrittenQuestion[]> {
  const questionTexts = metadata.map((q, i) => `Q${i + 1}: [${q.type}] Generic question about topic`).join('\n')
  const prompt = `You are a session template generator. Rewrite the following question metadata into generic, reusable forms. Remove all company-specific, location-specific, and person-specific references.

Questions:
${questionTexts}

Output ONLY as JSON array of strings, one rewritten question per line. No markdown, no preamble.`

  const response = await invokeAI(env.AI, [{ role: 'user', content: prompt }])
  let rewrittenTexts: string[] = []
  try {
    const parsed = JSON.parse(response)
    rewrittenTexts = Array.isArray(parsed) ? parsed : [response]
  } catch {
    rewrittenTexts = [response]
  }

  return metadata.map((q, i) => ({
    id: q.id,
    type: q.type,
    topic: '',
    text: {
      en: rewrittenTexts[i] || 'Question',
      nl: rewrittenTexts[i] || 'Vraag',
      de: rewrittenTexts[i] || 'Frage',
      fr: rewrittenTexts[i] || 'Question',
    },
    originalHash: '',
  }))
}

export async function similarityCheck(
  env: Env,
  sessionId: string,
  rewritten: RewrittenQuestion[],
): Promise<RewrittenQuestion[]> {
  const valid: RewrittenQuestion[] = []
  for (const q of rewritten) {
    let attempts = 0
    let currentText = q.text.en
    let score = 100

    while (attempts < 2 && score > 30) {
      if (attempts > 0) {
        const retryPrompt = `Rewrite this question to be even more generic and context-free:
"${currentText}"

Output ONLY the rewritten question. No explanation.`
        currentText = await invokeAI(env.AI, [{ role: 'user', content: retryPrompt }])
      }

      const similarityPrompt = `Rate the contextual similarity between these two questions on a scale of 0-100. 0 = completely different context, 100 = identical context.

Original context: "How did your team handle [specific scenario]?"
Rewritten: "${currentText}"

Output ONLY a JSON object: { "score": number, "reason": string }`
      const similarityResponse = await invokeAI(env.AI, [{ role: 'user', content: similarityPrompt }])
      try {
        const parsed = JSON.parse(similarityResponse)
        score = parsed.score || 0
      } catch {
        score = 0
      }
      attempts++
    }

    if (score > 30) {
      await logDiscard(env.MARKETING_KV, sessionId, `similarity_too_high:${score}`, q.id)
    } else {
      valid.push({ ...q, text: { ...q.text, en: currentText } })
    }
  }
  return valid
}

export async function properNounScan(
  env: Env,
  sessionId: string,
  questions: RewrittenQuestion[],
): Promise<RewrittenQuestion[]> {
  const valid: RewrittenQuestion[] = []
  for (const q of questions) {
    const nerPrompt = `Scan this question for proper nouns (names, locations, company names, product names, brand names). List any found.

Question: "${q.text.en}"

Output ONLY as JSON: { "nouns": ["name1", "name2"], "hasAny": boolean }`
    const nerResponse = await invokeAI(env.AI, [{ role: 'user', content: nerPrompt }])
    try {
      const parsed = JSON.parse(nerResponse)
      if (parsed.hasAny) {
        await logDiscard(env.MARKETING_KV, sessionId, `proper_nouns_found:${parsed.nouns.join(',')}`, q.id)
      } else {
        valid.push(q)
      }
    } catch {
      valid.push(q)
    }
  }
  return valid
}

export async function classifyAndGenerate(env: Env, questions: RewrittenQuestion[]): Promise<ClassificationResult> {
  const defaults: ClassificationResult = {
    industry: 'general',
    theme: 'team-wellbeing',
    topic: 'Session feedback',
    confidence: 50,
    purpose_en: 'Gather feedback on team dynamics.',
    purpose_nl: 'Verzamel feedback over teamdynamiek.',
    purpose_de: 'Erfassen Sie Feedback zur Teamdynamik.',
    purpose_fr: "Collectez des commentaires sur la dynamique de l'équipe.",
    bestUsedFor: ['team', 'feedback', 'improvement'],
    estimatedMinutes: 15,
    whatYoullLearn: ['Team strengths', 'Growth areas', 'Next steps'],
  }

  const questionSummary = questions.map((q, i) => `Q${i + 1} [${q.type}]: ${q.text.en}`).join('\n')
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
  try {
    const parsed = JSON.parse(response)
    return { ...defaults, ...parsed }
  } catch {
    return { ...defaults, confidence: 0, purpose_en: 'Session feedback template' }
  }
}

export async function storeTemplate(
  env: Env,
  payload: SessionPipelinePayload,
  sessionId: string,
  classified: ClassificationResult,
  questions: RewrittenQuestion[],
): Promise<string> {
  const id = `tmpl_${nanoid()}`
  const now = new Date().toISOString()
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
    isPublic: true,
    isDiscarded: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  await env.MARKETING_KV.put(`template:${id}`, JSON.stringify(record))
  await addToIndex(env.MARKETING_KV, 'templates:index', id)
  await addToIndex(env.MARKETING_KV, `templates:by-industry:${finalIndustry}`, id)
  await addToIndex(env.MARKETING_KV, `templates:by-theme:${classified.theme}`, id)
  await addToIndex(env.MARKETING_KV, `templates:by-lang:${payload.language}`, id)
  return id
}

export async function pingIndexNow(env: Env, templateId: string): Promise<void> {
  const indexNowKey = env.INDEXNOW_KEY
  if (!indexNowKey) return

  let keyLocation = 'https://qesto.cc/indexnow.txt'
  if (env.INDEXNOW_KEY_FILE) {
    keyLocation = `https://qesto.cc/${env.INDEXNOW_KEY_FILE}`
  }

  await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: 'qesto.cc',
      key: indexNowKey,
      keyLocation,
      urlList: [`https://qesto.cc/templates/${templateId}`],
    }),
  })
}
