/**
 * session-room-energizer-handler.ts
 * EnergizerHandler collaborator for SessionRoom.
 * Owns energizer activate/answer/advance WebSocket handlers, plus
 * metric emission and audit writing for energizer events.
 * Previously inlined in SessionRoom.ts — extracted as part of TD-01 refactor.
 * See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import type { Env } from '../types'
import type { LiveEnergizerState } from '../realtime'
import { writeEvent } from './observability'
import { mirrorEnergizerToKv } from './session-room-cross-region'
import { flagOff } from './flags'
import {
  maybeAdvanceBattleRoyale,
  recordBracketPick,
  bracketReadyToAdvance,
} from './tournament-live'
import {
  isValidLiveEnergizer,
  initialiseLiveEnergizer,
  withScoreArtifacts,
  rankQuickFingerAnswers,
  redactEnergizerForViewer,
} from './session-room-energizer'
import { BROADCAST_DEBOUNCE_MS } from './session-room-types'

const K_ACTIVE_ENERGIZER = 'active_energizer'
const K_ENERGIZER_ACTIVATED_AT = 'energizer:activated_at'
const ENERGIZER_TIMEOUT_MS = 5 * 60_000

type Meta = {
  sessionId: string
  teamId?: string
  plan?: string
  leaderboardDisplay?: 'names' | 'aliases' | 'hidden'
}

type Attachment = {
  role: 'presenter' | 'voter'
  voterId: string
  ipHash: string
  permissions?: string[]
}

/** Minimal surface of DurableObjectState used by this handler. */
interface StorageContext {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
  }
  getWebSockets(tag?: string): WebSocket[]
}

function errorMessage(code: string, message: string): string {
  return JSON.stringify({ type: 'error', data: { code, message }, timestamp: Date.now() })
}

function serverMsg(msg: object): string {
  return JSON.stringify({ v: 1, ...msg })
}

export class EnergizerHandler {
  constructor(
    private readonly ctx: StorageContext,
    private readonly env: Env,
    private readonly scheduleAlarm: (targetMs: number) => Promise<void>,
  ) {}

  private async getMeta(): Promise<Meta | null> {
    return (await this.ctx.storage.get<Meta>('meta')) ?? null
  }

  // Answer bursts mark the broadcast dirty and let the debounced alarm fan the
  // state out (mirrors the vote flow's resultsDirty pattern) instead of
  // re-broadcasting the full room state once per answer.
  private broadcastDirty = false

  private async broadcastEnergizer(energizer: LiveEnergizerState | null): Promise<void> {
    const timestamp = Date.now()
    for (const ws of this.ctx.getWebSockets()) {
      let view = energizer
      if (energizer) {
        const att = ws.deserializeAttachment() as Attachment | null
        view = redactEnergizerForViewer(energizer, {
          role: att?.role === 'presenter' ? 'presenter' : 'voter',
          voterId: att?.voterId ?? '',
        })
      }
      const msg = serverMsg({ type: 'energizer_state', data: { energizer: view }, timestamp })
      try { ws.send(msg) } catch { /* ignore */ }
    }
  }

  private async scheduleAnswerBroadcast(): Promise<void> {
    this.broadcastDirty = true
    await this.scheduleAlarm(Date.now() + BROADCAST_DEBOUNCE_MS)
  }

  /** Called from the DO alarm: fan out the latest state if an answer marked it dirty. */
  async flushPendingBroadcast(): Promise<void> {
    if (!this.broadcastDirty) return
    this.broadcastDirty = false
    const active = (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
    if (active) await this.broadcastEnergizer(active)
  }

  canActivateEnergizer(att: Attachment): boolean {
    if (att.role !== 'presenter') return false
    return att.permissions === undefined || att.permissions.includes('energizer:activate')
  }

  async emitMetric(
    name: string,
    energizerId: string | undefined,
    count: number,
  ): Promise<void> {
    const meta = await this.getMeta()
    writeEvent(this.env.METRICS_AE, {
      name: name as Parameters<typeof writeEvent>[1]['name'],
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      plan: (meta?.plan ?? 'free') as 'free' | 'starter' | 'team',
      count,
      traceId: energizerId,
    })
  }

  async recordAudit(
    action: string,
    att: Attachment,
    energizer: Pick<LiveEnergizerState, 'id' | 'kind' | 'status'> | { id?: string; kind?: string; status?: string } | null | undefined,
    extra: Record<string, number | string | boolean | null> = {},
  ): Promise<void> {
    if (!this.env.DB || !energizer?.id) return
    try {
      await this.env.DB.prepare(
        `INSERT INTO audit_events
         (id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT DO NOTHING`,
      )
        .bind(
          crypto.randomUUID(), Date.now(), att.voterId, att.ipHash, action,
          'energizer', energizer.id, '{}',
          JSON.stringify({ kind: energizer.kind ?? null, status: energizer.status ?? null, ...extra }),
          `${action}:${energizer.id}:${Date.now()}`, null,
        )
        .run()
    } catch {
      // Best-effort audit from realtime path; never break LIVE traffic.
    }
  }

  // ── handleEnergizerActivate ───────────────────────────────────────────────

  async handleActivate(ws: WebSocket, att: Attachment, energizer: LiveEnergizerState): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can activate energizers'))
      await this.emitMetric('ws.energizer_activation_denied', energizer?.id, 0)
      await this.recordAudit('ws.energizer_activation_denied', att, energizer, { reason: 'role' })
      return
    }
    if (!this.canActivateEnergizer(att)) {
      ws.send(errorMessage('forbidden', 'Presenter role cannot activate energizers'))
      await this.emitMetric('ws.energizer_activation_denied', energizer?.id, 0)
      await this.recordAudit('ws.energizer_activation_denied', att, energizer, { reason: 'permission' })
      return
    }
    if (flagOff(this.env, 'LIVE_ENERGIZERS_ENABLED')) {
      ws.send(errorMessage('feature_disabled', 'LIVE energizers are not enabled'))
      await this.emitMetric('ws.energizer_activation_denied', energizer?.id, 0)
      await this.recordAudit('ws.energizer_activation_denied', att, energizer, { reason: 'feature_disabled' })
      return
    }
    if (!isValidLiveEnergizer(energizer)) {
      ws.send(errorMessage('bad_energizer', 'Invalid energizer payload'))
      return
    }
    const meta = await this.getMeta()
    const active = withScoreArtifacts(
      initialiseLiveEnergizer(energizer),
      meta?.leaderboardDisplay ?? 'names',
      meta?.sessionId ?? '',
    )
    const nowMs = Date.now()
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, active)
    await this.ctx.storage.put(K_ENERGIZER_ACTIVATED_AT, nowMs)
    await this.scheduleAlarm(nowMs + ENERGIZER_TIMEOUT_MS)
    await this.emitMetric('ws.energizer_activated', active.id, active.leaderboard?.length ?? 0)
    await this.recordAudit('ws.energizer_activated', att, active)
    await this.broadcastEnergizer(active)
  }

  // ── handleEnergizerAnswer ─────────────────────────────────────────────────

  async handleAnswer(ws: WebSocket, att: Attachment, data: { energizerId?: string; value?: string }): Promise<void> {
    if (flagOff(this.env, 'LIVE_ENERGIZERS_ENABLED')) {
      ws.send(errorMessage('feature_disabled', 'LIVE energizers are not enabled'))
      return
    }
    if (att.role !== 'voter') {
      ws.send(errorMessage('forbidden', 'Only participants can answer energizers'))
      return
    }
    const active = (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
    if (!active || active.status !== 'active') {
      ws.send(errorMessage('no_energizer', 'No energizer is active'))
      return
    }
    if (!data?.energizerId || data.energizerId !== active.id) {
      ws.send(errorMessage('stale_energizer', 'Answer for a different energizer'))
      return
    }
    if (active.kind === 'team_quiz') {
      await this.handleTeamQuizAnswer(ws, att, active, data.value)
      return
    }
    if (active.kind === 'bracket' || active.kind === 'battle_royale') {
      await this.handleTournamentAnswer(ws, att, active, data.value)
      return
    }
    if (active.kind !== 'quick_finger') {
      ws.send(errorMessage('unsupported_energizer', 'This energizer does not accept live answers yet'))
      return
    }
    await this.handleQuickFingerAnswer(ws, att, active, data.value)
  }

  private async handleTournamentAnswer(
    ws: WebSocket,
    att: Attachment,
    active: LiveEnergizerState,
    rawValue: string | undefined,
  ): Promise<void> {
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!value) {
      ws.send(errorMessage('bad_energizer_answer', 'Missing bracket pick'))
      return
    }
    const existing = active.answers ?? []
    if (existing.some((a) => a.voterId === att.voterId)) {
      ws.send(errorMessage('duplicate_energizer_answer', 'You already answered this energizer'))
      return
    }
    let answered =
      active.kind === 'bracket'
        ? recordBracketPick(active, att.voterId, value)
        : {
            ...active,
            answers: [...existing, { voterId: att.voterId, value, correct: true, speedMs: 0, rank: existing.length + 1 }],
          }
    const meta = await this.getMeta()
    if (active.kind === 'battle_royale') {
      const advance = maybeAdvanceBattleRoyale(answered)
      if (advance) {
        answered = advance.state
        if (advance.type === 'completed') {
          writeEvent(this.env.METRICS_AE, { name: 'tournament.completed' as any, sessionId: meta?.sessionId, detail: advance.winnerId })
        }
      }
    } else if (bracketReadyToAdvance(answered)) {
      writeEvent(this.env.METRICS_AE, { name: 'tournament.completed' as any, sessionId: meta?.sessionId, detail: 'bracket_match' })
    }
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, answered)
    if (meta?.sessionId) await mirrorEnergizerToKv(this.env.MULTI_REGION_STATE_KV, meta.sessionId, answered)
    await this.scheduleAnswerBroadcast()
    await this.emitMetric('ws.energizer_answered', answered.id, answered.answers?.length ?? 0)
  }

  private async handleQuickFingerAnswer(
    ws: WebSocket,
    att: Attachment,
    active: LiveEnergizerState,
    rawValue: string | undefined,
  ): Promise<void> {
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    const options = active.options ?? []
    if (!value || (options.length > 0 && !options.includes(value))) {
      ws.send(errorMessage('bad_energizer_answer', 'Unknown answer option'))
      return
    }
    const existing = active.answers ?? []
    if (existing.some((a) => a.voterId === att.voterId)) {
      ws.send(errorMessage('duplicate_energizer_answer', 'You already answered this energizer'))
      return
    }
    const startedAt = active.startedAt ?? Date.now()
    const correctValue = typeof active.correctIndex === 'number' ? options[active.correctIndex] : undefined
    const meta = await this.getMeta()
    const answered: LiveEnergizerState = withScoreArtifacts({
      ...active,
      startedAt,
      answers: rankQuickFingerAnswers([
        ...existing,
        {
          voterId: att.voterId,
          value,
          correct: correctValue === undefined ? true : value === correctValue,
          speedMs: Math.max(0, Date.now() - startedAt),
          rank: 0,
        },
      ]),
    }, meta?.leaderboardDisplay ?? 'names', meta?.sessionId ?? '')
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, answered)
    await this.emitMetric('ws.energizer_answered', answered.id, answered.answers?.length ?? 0)
    await this.recordAudit('ws.energizer_answered', att, answered, { answer_count: answered.answers?.length ?? 0 })
    await this.scheduleAnswerBroadcast()
  }

  private async handleTeamQuizAnswer(
    ws: WebSocket,
    att: Attachment,
    active: LiveEnergizerState,
    rawValue: unknown,
  ): Promise<void> {
    const currentIndex = active.currentIndex ?? 0
    const question = active.questions?.[currentIndex]
    if (!question) {
      ws.send(errorMessage('no_quiz_question', 'No quiz question is active'))
      return
    }
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!value || !question.options.includes(value)) {
      ws.send(errorMessage('bad_energizer_answer', 'Unknown answer option'))
      return
    }
    const submissions = active.submissions ?? []
    if (submissions.some((s) => s.voterId === att.voterId && s.questionIndex === currentIndex)) {
      ws.send(errorMessage('duplicate_energizer_answer', 'You already answered this quiz question'))
      return
    }
    const meta = await this.getMeta()
    const answered: LiveEnergizerState = withScoreArtifacts({
      ...active,
      submissions: [
        ...submissions,
        { voterId: att.voterId, questionIndex: currentIndex, value, correct: value === question.options[question.correctIndex] },
      ],
    }, meta?.leaderboardDisplay ?? 'names', meta?.sessionId ?? '')
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, answered)
    await this.emitMetric('ws.energizer_answered', answered.id, answered.submissions?.length ?? 0)
    await this.recordAudit('ws.energizer_answered', att, answered, { answer_count: answered.submissions?.length ?? 0 })
    await this.scheduleAnswerBroadcast()
  }

  // ── handleEnergizerAdvance ────────────────────────────────────────────────

  async handleAdvance(ws: WebSocket, att: Attachment, data: { energizerId?: string }): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can advance energizers'))
      await this.emitMetric('ws.energizer_advance_denied', data?.energizerId, 0)
      return
    }
    if (!this.canActivateEnergizer(att)) {
      ws.send(errorMessage('forbidden', 'Presenter role cannot advance energizers'))
      await this.emitMetric('ws.energizer_advance_denied', data?.energizerId, 0)
      await this.recordAudit('ws.energizer_advance_denied', att, data?.energizerId ? { id: data.energizerId } : {}, { reason: 'permission' })
      return
    }
    if (flagOff(this.env, 'LIVE_ENERGIZERS_ENABLED')) {
      ws.send(errorMessage('feature_disabled', 'LIVE energizers are not enabled'))
      await this.emitMetric('ws.energizer_advance_denied', data?.energizerId, 0)
      await this.recordAudit('ws.energizer_advance_denied', att, data?.energizerId ? { id: data.energizerId } : {}, { reason: 'feature_disabled' })
      return
    }
    const active = (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
    if (!active || active.status !== 'active') {
      ws.send(errorMessage('no_energizer', 'No energizer is active'))
      return
    }
    if (active.kind !== 'team_quiz') {
      ws.send(errorMessage('unsupported_energizer', 'Only Team Quiz supports energizer advance'))
      return
    }
    if (!data?.energizerId || data.energizerId !== active.id) {
      ws.send(errorMessage('stale_energizer', 'Advance for a different energizer'))
      return
    }
    const currentIndex = active.currentIndex ?? 0
    const total = active.questions?.length ?? 0
    const meta = await this.getMeta()
    const display = meta?.leaderboardDisplay ?? 'names'
    const sessionId = meta?.sessionId ?? ''
    const next: LiveEnergizerState =
      currentIndex + 1 >= total
        ? withScoreArtifacts({ ...active, status: 'completed', currentIndex }, display, sessionId)
        : withScoreArtifacts({ ...active, currentIndex: currentIndex + 1 }, display, sessionId)
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, next)
    if (next.status === 'completed') await this.ctx.storage.delete(K_ENERGIZER_ACTIVATED_AT)
    const eventName = next.status === 'completed' ? 'ws.energizer_completed' : 'ws.energizer_advanced'
    await this.emitMetric(eventName, next.id, next.leaderboard?.length ?? 0)
    await this.recordAudit(eventName, att, next, { current_index: next.currentIndex ?? 0 })
    await this.broadcastEnergizer(next)
  }

  // ── Alarm: timeout check ──────────────────────────────────────────────────

  async handleAlarmTimeout(nowMs: number): Promise<void> {
    const energizer = await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)
    const activatedAt = await this.ctx.storage.get<number>(K_ENERGIZER_ACTIVATED_AT)
    if (!energizer || !activatedAt || activatedAt + ENERGIZER_TIMEOUT_MS > nowMs) return

    const meta = await this.getMeta()
    energizer.status = 'completed'
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, energizer)
    await this.ctx.storage.delete(K_ENERGIZER_ACTIVATED_AT)
    await this.broadcastEnergizer(energizer)
    writeEvent(this.env.METRICS_AE, {
      name: 'ws.energizer_timeout',
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      detail: `auto_completed_after_${Math.round((nowMs - activatedAt) / 1000)}s`,
    })
  }
}
