// Cloudflare Workflow: Session → Template Pipeline
import { WorkflowEntrypoint, WorkflowEvent } from 'cloudflare:workers'
import type { Env } from '../functions/api/types'
import { logDiscard } from './template-generation/helpers'
import {
  classifyAndGenerate,
  fetchSessionMetadata,
  pingIndexNow,
  properNounScan,
  rewriteQuestions,
  similarityCheck,
  storeTemplate,
} from './template-generation/pipeline'
import type { SessionPipelinePayload } from './template-generation/types'

export type { SessionPipelinePayload } from './template-generation/types'

export class TemplateGenerationWorkflow extends WorkflowEntrypoint<Env, SessionPipelinePayload> {
  async run(event: WorkflowEvent<SessionPipelinePayload>, steps: { do: (name: string, fn: () => Promise<unknown>) => Promise<unknown> }) {
    const payload = event.payload
    const env = this.env
    const sessionId = payload.sessionId

    const metadata = await steps.do('fetch-session-metadata', () => fetchSessionMetadata(env, sessionId))
    const rewritten = await steps.do('rewrite-questions', () => rewriteQuestions(env, metadata as Awaited<ReturnType<typeof fetchSessionMetadata>>))
    const similarityChecked = await steps.do('similarity-check', () =>
      similarityCheck(env, sessionId, rewritten as Awaited<ReturnType<typeof rewriteQuestions>>).catch(() => rewritten),
    )
    const properNounChecked = await steps.do('proper-noun-scan', () =>
      properNounScan(env, sessionId, similarityChecked as Awaited<ReturnType<typeof similarityCheck>>).catch(() => similarityChecked),
    )

    const validQuestions = properNounChecked as Awaited<ReturnType<typeof properNounScan>>
    const shouldContinue = await steps.do('check-question-count', async () => {
      if (validQuestions.length === 0) {
        await logDiscard(env.MARKETING_KV, sessionId, 'all_questions_discarded')
        return false
      }
      return true
    })

    if (!shouldContinue) {
      return { status: 'discarded', reason: 'all_questions_discarded' }
    }

    const classified = await steps.do('classify-and-generate', () =>
      classifyAndGenerate(env, validQuestions).catch(() => ({
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
      })),
    )

    const templateId = await steps.do('store-template', () =>
      storeTemplate(env, payload, sessionId, classified as Awaited<ReturnType<typeof classifyAndGenerate>>, validQuestions),
    )

    await steps.do('index-now-ping', () => pingIndexNow(env, templateId as string).catch(() => undefined))

    return { status: 'success', templateId }
  }
}
