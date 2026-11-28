// @vitest-environment jsdom
/**
 * Requirement: CANVAS-ADAPTIVE-VIZ-01 — word_cloud / open answers render on the presenter + display canvas.
 */
// Regression: text kinds have no `options`, and the "no options → waiting"
// branch ran first, so the canvas said "Waiting for responses" forever.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdaptiveVizResults } from '../../src/components/AdaptiveVizResults'

describe('AdaptiveVizResults — text question kinds', () => {
  it('renders word-cloud answers from text-keyed counts when options are empty', () => {
    render(
      <AdaptiveVizResults options={[]} total={5} questionKind="word_cloud" textCounts={{ focus: 3, clarity: 2 }} />,
    )
    expect(screen.getByLabelText('Word cloud results')).toBeTruthy()
    expect(screen.getByText('focus')).toBeTruthy()
    expect(screen.getByText('clarity')).toBeTruthy()
  })

  it('renders open-text answers the same way', () => {
    render(<AdaptiveVizResults options={[]} total={1} questionKind="open" textCounts={{ 'more breaks': 1 }} />)
    expect(screen.getByText('more breaks')).toBeTruthy()
  })

  it('still shows the waiting state for a poll with no options', () => {
    render(<AdaptiveVizResults options={[]} total={0} questionKind="poll" />)
    expect(screen.queryByLabelText('Word cloud results')).toBeNull()
  })
})
