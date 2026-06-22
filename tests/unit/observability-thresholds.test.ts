import { describe, it, expect } from 'vitest'
import {
  DEFAULT_THRESHOLDS,
  evaluateState,
  mergeThresholds,
  worstState,
  classifyCrawler,
  isLegitCrawlerBlock,
  windowToMs,
} from '../../functions/api/lib/observability-thresholds'

describe('evaluateState', () => {
  const t = { warn: 0.02, crit: 0.05 }
  it('returns ok below warn', () => expect(evaluateState(0.01, t)).toBe('ok'))
  it('returns warn at/above warn but below crit', () => {
    expect(evaluateState(0.02, t)).toBe('warn')
    expect(evaluateState(0.04, t)).toBe('warn')
  })
  it('returns crit at/above crit', () => expect(evaluateState(0.05, t)).toBe('crit'))
  it('treats null/NaN as ok (no data is not an alert)', () => {
    expect(evaluateState(null, t)).toBe('ok')
    expect(evaluateState(Number.NaN, t)).toBe('ok')
  })
})

describe('worstState', () => {
  it('crit beats warn beats ok', () => {
    expect(worstState(['ok', 'warn', 'crit'])).toBe('crit')
    expect(worstState(['ok', 'warn'])).toBe('warn')
    expect(worstState(['ok', 'ok'])).toBe('ok')
    expect(worstState([])).toBe('ok')
  })
})

describe('mergeThresholds', () => {
  it('returns defaults for null/garbage input', () => {
    expect(mergeThresholds(null)).toEqual(DEFAULT_THRESHOLDS)
    expect(mergeThresholds('nope')).toEqual(DEFAULT_THRESHOLDS)
    expect(mergeThresholds(42)).toEqual(DEFAULT_THRESHOLDS)
  })
  it('merges a partial override without dropping unspecified metrics', () => {
    const merged = mergeThresholds({ error_rate: { warn: 0.1 } })
    expect(merged.error_rate.warn).toBe(0.1)
    expect(merged.error_rate.crit).toBe(DEFAULT_THRESHOLDS.error_rate.crit)
    expect(merged.p95_ms).toEqual(DEFAULT_THRESHOLDS.p95_ms)
  })
  it('ignores non-numeric/NaN values', () => {
    const merged = mergeThresholds({ p95_ms: { warn: 'high', crit: Number.NaN } })
    expect(merged.p95_ms).toEqual(DEFAULT_THRESHOLDS.p95_ms)
  })
})

describe('classifyCrawler', () => {
  it('detects Googlebot', () => {
    expect(classifyCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('googlebot')
  })
  it('detects Bingbot', () => {
    expect(classifyCrawler('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe('bingbot')
  })
  it('detects other known crawlers', () => {
    expect(classifyCrawler('DuckDuckBot/1.0')).toBe('other_known')
    expect(classifyCrawler('Mozilla/5.0 (compatible; YandexBot/3.0)')).toBe('other_known')
  })
  it('returns unknown for a normal browser or empty UA', () => {
    expect(classifyCrawler('Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe('unknown')
    expect(classifyCrawler(null)).toBe('unknown')
    expect(classifyCrawler('')).toBe('unknown')
  })
})

describe('isLegitCrawlerBlock', () => {
  it('flags any known crawler class', () => {
    expect(isLegitCrawlerBlock('googlebot')).toBe(true)
    expect(isLegitCrawlerBlock('bingbot')).toBe(true)
    expect(isLegitCrawlerBlock('other_known')).toBe(true)
  })
  it('does not flag unknown UAs', () => {
    expect(isLegitCrawlerBlock('unknown')).toBe(false)
  })
})

describe('windowToMs', () => {
  it('maps known windows', () => {
    expect(windowToMs('1h')).toBe(60 * 60 * 1000)
    expect(windowToMs('24h')).toBe(24 * 60 * 60 * 1000)
    expect(windowToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000)
  })
  it('defaults to 24h for unknown/undefined', () => {
    expect(windowToMs(undefined)).toBe(24 * 60 * 60 * 1000)
    expect(windowToMs('90d')).toBe(24 * 60 * 60 * 1000)
  })
})
