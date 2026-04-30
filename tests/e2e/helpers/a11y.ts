import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import axe from 'axe-core'

declare global {
  interface Window {
    axe: typeof axe
  }
}

type AxeViolation = {
  id: string
  impact?: string | null
  description: string
  nodes: Array<{ target: string[]; failureSummary?: string }>
}

export async function expectNoSeriousA11yViolations(page: Page, context: string): Promise<void> {
  await page.addScriptTag({ content: axe.source })
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      },
    })
    return result.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))
  }) as AxeViolation[]

  if (violations.length > 0) {
    const summary = violations
      .map((violation) => {
        const targets = violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join(', ')
        return `[${violation.impact}] ${violation.id}: ${violation.description} (${targets})`
      })
      .join('\n')
    throw new Error(`${context} has ${violations.length} serious accessibility violation(s):\n${summary}`)
  }

  expect(violations).toHaveLength(0)
}
