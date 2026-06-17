import { describe, expect, it } from 'vitest'
import { buildSovereignPosture } from '../../functions/api/lib/sovereign-posture'

describe('SOVEREIGN-POSTURE-01', () => {
  it('a sovereign EU tenant shows full GDPR + residency + exclusion', () => {
    const p = buildSovereignPosture({ teamId: 't1', regionId: 'eu-001', isSovereign: true, fedrampModerate: true })
    expect(p.region.id).toBe('eu-001')
    const byClaim = Object.fromEntries(p.cells.map((c) => [c.claim, c.status]))
    expect(byClaim.fedramp).toBe('yes')
    expect(byClaim.gdpr).toBe('yes')
    expect(byClaim.residency_cert).toBe('yes')
    expect(byClaim.federation_excluded).toBe('yes')
  })

  it('a standard tenant is not federation-excluded and has no FedRAMP', () => {
    const p = buildSovereignPosture({ teamId: 't2', regionId: 'eu-001', isSovereign: false })
    const byClaim = Object.fromEntries(p.cells.map((c) => [c.claim, c.status]))
    expect(byClaim.fedramp).toBe('no')
    expect(byClaim.federation_excluded).toBe('no')
    expect(byClaim.residency_cert).toBe('partial')
  })

  it('a Canada region is partial GDPR (outside EU/UK zone)', () => {
    const p = buildSovereignPosture({ teamId: 't3', regionId: 'ca-001', isSovereign: true })
    const gdpr = p.cells.find((c) => c.claim === 'gdpr')!
    expect(gdpr.status).toBe('partial')
  })

  it('unknown region falls back to the default region', () => {
    const p = buildSovereignPosture({ teamId: 't4', regionId: 'xx-999', isSovereign: false })
    expect(p.region.id).toBe('eu-001')
  })

  it('every cell carries audit-friendly evidence text', () => {
    const p = buildSovereignPosture({ teamId: 't5', regionId: 'uk-001', isSovereign: true })
    for (const cell of p.cells) expect(cell.evidence.length).toBeGreaterThan(0)
  })
})
