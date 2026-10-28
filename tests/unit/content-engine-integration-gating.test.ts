import { afterEach, describe, expect, it, vi } from 'vitest'
import { SqliteD1 } from '../helpers/d1-sqlite'
import { KVMock } from '../helpers/kv-mock'
import { runContentEngine } from '../../functions/api/lib/marketing/content-engine'
import { runAI } from '../../functions/api/lib/ai/ai-gateway'

vi.mock('../../functions/api/lib/ai/ai-gateway', () => ({
  envWithAI: (ai: Ai) => ({ AI: ai }),
  runAI: vi.fn(),
}))

const runAIMock = vi.mocked(runAI)

function insertCalendarRow(db: SqliteD1, row: { id: string; platform: 'linkedin' | 'youtube'; topic: string; now: number }) {
  db.db
    .prepare(
      `INSERT INTO content_calendar
       (id, platform, topic, scheduled_for, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'planned', ?, ?)`,
    )
    .run(row.id, row.platform, row.topic, row.now - 60_000, row.now, row.now)
}

describe('runContentEngine integration policy gates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    runAIMock.mockReset()
  })

  it('leaves disabled YouTube slots planned while still generating LinkedIn drafts', async () => {
    const db = SqliteD1.migrated()
    const kv = new KVMock()
    const now = Date.UTC(2026, 9, 14, 6, 0, 0)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    runAIMock.mockResolvedValue({ response: 'A practical Qesto update for collaborative teams.' })

    insertCalendarRow(db, {
      id: 'cal_linkedin',
      platform: 'linkedin',
      topic: 'facilitation rituals',
      now,
    })
    insertCalendarRow(db, {
      id: 'cal_youtube',
      platform: 'youtube',
      topic: 'weekly product demo',
      now,
    })

    const result = await runContentEngine(db.asD1(), {} as Ai, kv as unknown as KVNamespace, now)

    expect(result).toEqual({ generated: 1, skipped: 1, failed: 0 })
    expect(runAIMock).toHaveBeenCalledTimes(1)
    expect(runAIMock.mock.calls[0]?.[1]).toBe('@cf/meta/llama-3.1-8b-instruct')

    const calendarRows = db.db
      .prepare('SELECT id, status FROM content_calendar ORDER BY id')
      .all() as Array<{ id: string; status: string }>
    expect(calendarRows).toEqual([
      { id: 'cal_linkedin', status: 'generated' },
      { id: 'cal_youtube', status: 'planned' },
    ])

    const items = db.db
      .prepare('SELECT content_calendar_id, platform, body FROM content_items')
      .all() as Array<{ content_calendar_id: string; platform: string; body: string | null }>
    expect(items).toEqual([
      {
        content_calendar_id: 'cal_linkedin',
        platform: 'linkedin',
        body: 'A practical Qesto update for collaborative teams.',
      },
    ])

    const skipEvents = logSpy.mock.calls
      .map(([line]) => {
        try {
          return JSON.parse(String(line)) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((event): event is Record<string, unknown> => event?.event === 'content_engine.skipped')
    expect(skipEvents).toEqual([
      {
        event: 'content_engine.skipped',
        platform: 'youtube',
        reason: 'integration_disabled',
        calendar_id: 'cal_youtube',
      },
    ])
  })
})
