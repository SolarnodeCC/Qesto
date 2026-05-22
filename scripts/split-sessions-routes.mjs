/**
 * CODE-SPLIT-01 — extract sessions.ts into subrouters (no behavior change).
 * Run: node scripts/split-sessions-routes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const srcPath = path.join(root, 'functions/api/routes/sessions.ts')
const outDir = path.join(root, 'functions/api/routes/sessions')
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/)

const slice = (start, end) => lines.slice(start - 1, end).join('\n')

function deepImports(block) {
  return block.replaceAll("from '../", "from '../../")
}

function exportSharedFunctions(body) {
  return body
    .replace(/^async function /gm, 'export async function ')
    .replace(/^function rowToQuestion/gm, 'export function rowToQuestion')
    .replace(/^function deniedQuestionFeature/gm, 'export function deniedQuestionFeature')
    .replace(/^function questionToLive/gm, 'export function questionToLive')
}

const sharedImports = `import { ulid } from '../../lib/ulid'
import { writeEvent } from '../../lib/observability'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import { denyFeature, featureAllowed, questionKindFeature } from '../../lib/entitlements'
import { validateKvJson, PollOptionArraySchema } from '../../lib/validators'
import { extractThemes } from '../../lib/ai-insights'
import {
  toInsightsInput,
  type SessionBundle,
  type QuestionBreakdown,
} from '../../lib/session-bundle'
import type { LiveQuestion } from '../../realtime'
import type { Env, PlanQuotas, PlanTier, Question, Session } from '../../types'
import type { Team } from '../teams'
import { effectiveTeamPermissionsForUser, type Permission } from '../../lib/authz'
import { readKvJson } from '../../lib/kv'
import { teamDocumentKey } from '../../lib/kv-keys'
`

const sharedTypes = `export type SessionVars = AuthVariables & PlanVariables
export type SessionRow = Session & { team_id: string | null }
`

const sharedBody = exportSharedFunctions(slice(77, 405) + '\n\n' + exportSharedFunctions(slice(2268, lines.length)))

fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(
  path.join(outDir, 'shared.ts'),
  `// CODE-SPLIT-01 — shared session route helpers.\n${sharedImports}\n${sharedTypes}\n${sharedBody}\n`,
)

const mountHeader = `import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'
`

fs.writeFileSync(
  path.join(outDir, 'public.ts'),
  `import { Hono } from 'hono'
import { SESSION_COOKIE } from '../../middleware/auth'
import { verifyJwt } from '../../lib/jwt'
import { deriveVoterIdentity } from '../../lib/voter'
import {
  fetchSessionByCode,
  doStub,
  presenterPermissionsForSession,
  requireLiveForWebSocket,
  type SessionRow,
  type SessionVars,
} from './shared'
import type { Env } from '../../types'
import type { Permission } from '../../lib/authz'

export function mountPublicSessionRoutes(pub: Hono<{ Bindings: Env; Variables: SessionVars }>) {
${deepImports(slice(412, 545))}
}
`,
)

fs.writeFileSync(
  path.join(outDir, 'lifecycle.ts'),
  `${mountHeader}
import { ulid } from '../../lib/ulid'
import { requireFound, requireDraft, requireLiveForClose } from '../../lib/session-lifecycle'
import {
  fetchSession,
  fetchQuestions,
  questionToLive,
  postDO,
  doStub,
  recordSprint19JourneyEvent,
  precomputeInsights,
} from './shared'
import { writeEvent } from '../../lib/observability'
import { notifySlackSessionClosed, notifyTeamsSessionClosed } from '../integrations'
import { deliverTeamWebhooks } from '../../lib/webhooks'
import { deliverMarketingWebhook } from '../webhooks-marketing'

export function mountLifecycleRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
${deepImports(slice(856, 1326))}
}
`,
)

fs.writeFileSync(
  path.join(outDir, 'results.ts'),
  `${mountHeader}
import {
  fetchSession,
  fetchQuestions,
  requireFound,
  rejectDraftForResults,
  doStub,
} from './shared'

export function mountResultsRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
${deepImports(slice(1334, 1392))}
}
`,
)

fs.writeFileSync(
  path.join(outDir, 'crud.ts'),
  `${mountHeader}
import { ulid } from '../../lib/ulid'
import { generateJoinCode } from '../../lib/code'
import { IdempotencyInFlightError, withIdempotency } from '../../lib/idempotency'
import { incrementSessionQuota } from '../../lib/quota'
import { validateBody } from '../../lib/validate'
import {
  CreateSessionSchema,
  JourneyEventSchema,
  PatchSessionSchema,
  isPatchBodyTitleOnly,
} from '../../lib/validation'
import { validateKvJson, StringArraySchema } from '../../lib/validators'
import {
  fetchSession,
  fetchQuestions,
  patchSchemaIfNeeded,
  recordSprint19JourneyEvent,
  requireFound,
  requireDraft,
  requireEditableTitle,
  upsertPollQuestion,
  rowToQuestion,
  deniedQuestionFeature,
  type SessionRow,
} from './shared'
import type { Session, Question } from '../../types'
import type { PollQuestionInput } from '../../lib/validation'

export function mountSessionCrudRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
${deepImports(slice(552, 855))}
}
`,
)

fs.writeFileSync(
  path.join(outDir, 'wizard.ts'),
  `${mountHeader}
import { rateLimit } from '../../lib/rate-limit'
import { validateBody } from '../../lib/validate'
import {
  GenerateQuestionsSchema,
  DuplicateSessionSchema,
  RefineQuestionsSchema,
  ReorderQuestionsSchema,
  AddQuestionSchema,
  autoPopulateOptions,
} from '../../lib/validation'
import { WizardAIError, WizardValidationError, generateQuestions } from '../../lib/ai-wizard'
import { sanitizeError } from '../../lib/error-handler'
import { requireFeature } from '../../middleware/feature-gate'
import { validateKvJson, CachedQuestionsSchema } from '../../lib/validators'
import { hardDeleteSession } from '../../lib/session-delete'
import { suggestDuplicateTitle } from '../../lib/session-title'
import {
  fetchOwnerSessionTitles,
  fetchSession,
  fetchQuestions,
  requireFound,
  requireDraft,
  requireClosedOrArchivedForInsights,
  hashGrounding,
  rowToQuestion,
  deniedQuestionFeature,
} from './shared'
import type { PollQuestionInput } from '../../lib/validation'

export function mountSessionWizardRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
${deepImports(slice(1394, 2263))}
}
`,
)

fs.writeFileSync(
  path.join(outDir, 'index.ts'),
  `// CODE-SPLIT-01 — session routes composed from subrouters (no behavior change).
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import type { Env } from '../../types'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import type { SessionVars } from './shared'
import { fetchSession } from './shared'
import { mountPublicSessionRoutes } from './public'
import { mountSessionCrudRoutes } from './crud'
import { mountLifecycleRoutes } from './lifecycle'
import { mountExportRoutes } from './exports'
import { mountResultsRoutes } from './results'
import { mountSessionWizardRoutes } from './wizard'

type Vars = AuthVariables & PlanVariables

export function mountSessionRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: SessionVars }>()
  const pub = new Hono<{ Bindings: Env; Variables: SessionVars }>()

  mountPublicSessionRoutes(pub)
  parent.route('/api/sessions', pub)

  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  mountSessionCrudRoutes(app)
  mountLifecycleRoutes(app)
  mountExportRoutes(app, fetchSession)
  mountResultsRoutes(app)
  mountSessionWizardRoutes(app)

  parent.route('/api/sessions', app)
}
`,
)

fs.writeFileSync(
  path.join(root, 'functions/api/routes/sessions.ts'),
  `// CODE-SPLIT-01: implementation lives under ./sessions/\nexport { mountSessionRoutes } from './sessions/index'\n`,
)

console.log('Split complete:', outDir)
