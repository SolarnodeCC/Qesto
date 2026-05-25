import { describe, expect, it } from 'vitest'
import { isTeamInEuWriteCohort } from '../../functions/api/lib/db-router'

describe('tenant quota / EU cohort', () => {
  it('matches explicit team ids', () => {
    expect(isTeamInEuWriteCohort({ MR_WRITE_EU_COHORT: 'team-a,team-b' }, 'team-b')).toBe(true)
    expect(isTeamInEuWriteCohort({ MR_WRITE_EU_COHORT: 'team-a' }, 'team-x')).toBe(false)
  })

  it('wildcard enables all teams', () => {
    expect(isTeamInEuWriteCohort({ MR_WRITE_EU_COHORT: '*' }, 'any')).toBe(true)
  })
})
