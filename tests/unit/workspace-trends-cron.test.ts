import { describe, expect, it } from 'vitest'
import { recomputeStaleWorkspaceTrends } from '../../functions/api/lib/workspace-trends'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { writeKvJson } from '../../functions/api/lib/kv'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'

function seedWorkspace(db: D1Mock, id: string, teamId: string, kind: 'retro' | 'ideate' = 'retro') {
  db.workspaces.set(id, {
    id,
    team_id: teamId,
    kind,
    title: 'WS',
    template_json: '{}',
    cadence: null,
    retention_days: null,
    last_instance_at: null,
    archived_at: null,
    created_by: 'u1',
    created_at: 1,
    updated_at: 1,
  } as never)
}

function seedClosedInstance(db: D1Mock, workspaceId: string, seq: number, closedAt: number) {
  const sessionId = `sess_${workspaceId}_${seq}`
  db.sessions.set(sessionId, {
    id: sessionId,
    owner_id: 'u1',
    code: `C${seq}`,
    title: `Inst ${seq}`,
    status: 'closed',
    anonymity: 'full',
    vote_policy: 'once',
    session_mode: 'retro',
    workspace_id: workspaceId,
    workspace_seq: seq,
    created_at: closedAt - 3_600_000,
    started_at: closedAt - 3_600_000,
    closed_at: closedAt,
    archived_at: null,
  } as never)
  db.insightsDaily.set(`ins_${sessionId}`, {
    id: `ins_${sessionId}`,
    session_id: sessionId,
    team_id: 'team',
    day: new Date(closedAt).toISOString().slice(0, 10),
    themes_json: '[]',
    confidence: 0.8,
    n_votes: 5,
    embedding_ref: 0,
    computed_at: closedAt,
  } as never)
}

async function seedTeamPlan(kv: KVMock, teamId: string, plan: 'team' | 'free') {
  await writeKvJson(kv as unknown as KVNamespace, teamDocumentKey(teamId), { id: teamId, plan })
}

describe('recomputeStaleWorkspaceTrends (ADR-0048 §4 cron)', () => {
  it('recomputes a stale workspace for an entitled team', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const cacheKv = new KVMock()
    seedWorkspace(db, 'ws_a', 'team-pro')
    const now = Date.now()
    for (let i = 1; i <= 3; i++) seedClosedInstance(db, 'ws_a', i, now - i * 86_400_000)
    await seedTeamPlan(teamsKv, 'team-pro', 'team')

    const res = await recomputeStaleWorkspaceTrends(
      db as unknown as D1Database,
      cacheKv as unknown as KVNamespace,
      teamsKv as unknown as KVNamespace,
    )
    expect(res.scanned).toBe(1)
    expect(res.recomputed).toBe(1)
    // A workspace_trend row now exists (materialised, not read-time only).
    expect(db.workspaceTrends.size).toBeGreaterThan(0)
  })

  it('skips workspaces of a non-entitled team (cost control)', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const cacheKv = new KVMock()
    seedWorkspace(db, 'ws_free', 'team-free')
    const now = Date.now()
    for (let i = 1; i <= 3; i++) seedClosedInstance(db, 'ws_free', i, now - i * 86_400_000)
    await seedTeamPlan(teamsKv, 'team-free', 'free')

    const res = await recomputeStaleWorkspaceTrends(
      db as unknown as D1Database,
      cacheKv as unknown as KVNamespace,
      teamsKv as unknown as KVNamespace,
    )
    expect(res.scanned).toBe(1)
    expect(res.recomputed).toBe(0)
    expect(db.workspaceTrends.size).toBe(0)
  })

  it('is idempotent — a workspace with no instance newer than its trend is not rescanned', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const cacheKv = new KVMock()
    seedWorkspace(db, 'ws_b', 'team-pro')
    const now = Date.now()
    for (let i = 1; i <= 3; i++) seedClosedInstance(db, 'ws_b', i, now - i * 86_400_000)
    await seedTeamPlan(teamsKv, 'team-pro', 'team')

    const first = await recomputeStaleWorkspaceTrends(
      db as unknown as D1Database,
      cacheKv as unknown as KVNamespace,
      teamsKv as unknown as KVNamespace,
    )
    expect(first.recomputed).toBe(1)

    // No new closed instance since the trend was materialised → not stale anymore.
    const second = await recomputeStaleWorkspaceTrends(
      db as unknown as D1Database,
      cacheKv as unknown as KVNamespace,
      teamsKv as unknown as KVNamespace,
    )
    expect(second.scanned).toBe(0)
    expect(second.recomputed).toBe(0)
  })
})
