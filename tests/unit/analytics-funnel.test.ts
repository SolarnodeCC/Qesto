import { describe, it, expect } from 'vitest'
import { computeFunnel, csvField, toCsv, resolveWindow } from '../../functions/api/lib/analytics-funnel'

describe('computeFunnel', () => {
  it('computes drop-off and conversion across steps', () => {
    const f = computeFunnel([
      ['signup', 'Signed up', 100],
      ['first_session', 'Created session', 40],
      ['first_paid', 'Paid', 10],
    ])
    expect(f[0]).toMatchObject({ conversion_from_prev_pct: 100, drop_off_pct: 0, conversion_from_top_pct: 100 })
    expect(f[1]).toMatchObject({ count: 40, conversion_from_prev_pct: 40, drop_off_pct: 60, conversion_from_top_pct: 40 })
    expect(f[2]).toMatchObject({ count: 10, conversion_from_prev_pct: 25, drop_off_pct: 75, conversion_from_top_pct: 10 })
  })

  it('handles a zero top-of-funnel without dividing by zero', () => {
    const f = computeFunnel([
      ['a', 'A', 0],
      ['b', 'B', 0],
    ])
    expect(f[1].conversion_from_prev_pct).toBe(0)
    expect(f[1].conversion_from_top_pct).toBe(0)
  })

  it('clamps percentages when a later step exceeds the previous', () => {
    const f = computeFunnel([
      ['a', 'A', 10],
      ['b', 'B', 20],
    ])
    expect(f[1].conversion_from_prev_pct).toBe(100)
    expect(f[1].drop_off_pct).toBe(0)
  })
})

describe('csvField / toCsv', () => {
  it('quotes fields containing comma, quote, or newline', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
    expect(csvField(null)).toBe('')
    expect(csvField(42)).toBe('42')
  })

  it('serialises rows with a header line and CRLF separators', () => {
    const csv = toCsv(['key', 'count'], [{ key: 'signup', count: 100 }, { key: 'paid', count: 5 }])
    expect(csv).toBe('key,count\r\nsignup,100\r\npaid,5')
  })
})

describe('resolveWindow', () => {
  const now = 1_000_000_000_000
  it('maps named windows to day ranges', () => {
    const w7 = resolveWindow('7d', null, now)
    expect(w7.end).toBe(now)
    expect(w7.start).toBe(now - 7 * 24 * 60 * 60 * 1000)
    expect(resolveWindow('90d', null, now).start).toBe(now - 90 * 24 * 60 * 60 * 1000)
  })
  it('defaults to 30d for unknown window', () => {
    expect(resolveWindow('bogus', null, now).start).toBe(now - 30 * 24 * 60 * 60 * 1000)
  })
  it('honours explicit from/to (custom range)', () => {
    const r = resolveWindow(undefined, 500, 1500)
    expect(r).toEqual({ start: 500, end: 1500 })
  })
})
