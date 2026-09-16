/**
 * Requirement: knowledge-base/quality/audits/DS_DAY60_ADOPTION_2026-09-16.md — adoption contracts.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const joinLanding = readFileSync('src/pages/join/JoinLanding.tsx', 'utf8')
const waiting = readFileSync('src/pages/join/WaitingScreen.tsx', 'utf8')
const joinPage = readFileSync('src/pages/JoinPage.tsx', 'utf8')
const hero = readFileSync('src/pages/dashboard/HeroSection.tsx', 'utf8')
const joinCode = readFileSync('src/components/launchpad/JoinCodePanel.tsx', 'utf8')
const present = readFileSync('src/pages/Present.tsx', 'utf8')
const wizard = readFileSync('src/components/SessionWizard.tsx', 'utf8')
const recent = readFileSync('src/pages/dashboard/RecentSessionsSection.tsx', 'utf8')

describe('DS Day 60 adoption contracts', () => {
  it('Join landing/waiting/loading/error use ParticipantShell', () => {
    expect(joinLanding).toContain('ParticipantShell')
    expect(waiting).toContain('ParticipantShell')
    expect(joinPage).toContain('ParticipantShell')
    expect(joinLanding).toContain('from \'../../ui/components\'')
    expect(joinLanding).toContain('FormField')
  })

  it('Dashboard hero and launchpad CTAs use ui/Button', () => {
    expect(hero).toContain("from '../../ui/components'")
    expect(hero).toContain('variant="inverse"')
    expect(joinCode).toContain("from '../../ui/components'")
    expect(joinCode).toContain('btn-motion')
  })

  it('Present stage uses --surface-stage token', () => {
    expect(present).toContain('bg-[var(--surface-stage)]')
    expect(present).not.toMatch(/bg-pulse-950 animate-page-enter/)
  })

  it('SessionWizard uses wizardReducer', () => {
    expect(wizard).toContain('useReducer(wizardReducer')
    expect(wizard).toContain("type: 'RESET'")
  })

  it('Recent sessions empty/skeleton use shared primitives', () => {
    expect(recent).toContain('EmptyState')
    expect(recent).toContain('SkeletonLine')
  })
})
