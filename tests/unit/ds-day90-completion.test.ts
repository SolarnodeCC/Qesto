/**
 * Requirement: knowledge-base/quality/audits/DS_DAY90_COMPLETION_2026-09-16.md — shell completion contracts.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const joinPage = readFileSync('src/pages/JoinPage.tsx', 'utf8')
const display = readFileSync('src/pages/Display.tsx', 'utf8')
const eventStage = readFileSync('src/pages/EventStagePresent.tsx', 'utf8')
const wizardFooter = readFileSync('src/components/session-wizard/SessionWizardFooter.tsx', 'utf8')
const questionList = readFileSync('src/components/launchpad/QuestionList.tsx', 'utf8')
const participantShell = readFileSync('src/layouts/ParticipantShell.tsx', 'utf8')
const bigScreen = readFileSync('src/layouts/BigScreenShell.tsx', 'utf8')
const hostShell = readFileSync('src/layouts/HostConsoleShell.tsx', 'utf8')
const hexScript = readFileSync('scripts/check-hex-tokens.mjs', 'utf8')

describe('DS Day 90 completion contracts', () => {
  it('live voter uses ParticipantShell with headerTrailing', () => {
    expect(joinPage).toContain('ParticipantShell')
    expect(joinPage).toContain('headerTrailing')
    expect(joinPage).toContain('ShieldCheck')
    expect(participantShell).toContain('headerTrailing')
  })

  it('classic Display uses BigScreenShell / Fallback', () => {
    expect(display).toContain('BigScreenShell')
    expect(display).toContain('BigScreenFallback')
    expect(display).not.toContain('bg-[#0f1117]')
    expect(bigScreen).toContain('style?:')
  })

  it('EventStagePresent uses HostConsoleShell at 7xl', () => {
    expect(eventStage).toContain('HostConsoleShell')
    expect(eventStage).toContain('maxWidth="7xl"')
    expect(hostShell).toContain("'7xl'")
  })

  it('wizard footer and QuestionList CTAs use ui/Button', () => {
    expect(wizardFooter).toContain("from '../../ui/components'")
    expect(wizardFooter).toContain('<Button')
    expect(wizardFooter).toContain('Play')
    expect(questionList).toContain("from '../../ui/components'")
    expect(questionList).toContain('<Button')
  })

  it('hex lint scopes Day-90 surfaces', () => {
    expect(hexScript).toContain('src/pages/Display.tsx')
    expect(hexScript).toContain('src/pages/EventStagePresent.tsx')
    expect(hexScript).toContain('src/components/session-wizard/SessionWizardFooter.tsx')
    expect(hexScript).toContain('src/components/launchpad/QuestionList.tsx')
  })
})
