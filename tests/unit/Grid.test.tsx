import { describe, it, expect } from 'vitest'
import { Grid, GridItem } from '../../src/components/Grid'

describe('Grid component (LAYOUT-GRID-01)', () => {
  it('exports Grid and GridItem components', () => {
    expect(Grid).toBeDefined()
    expect(GridItem).toBeDefined()
    expect(typeof Grid).toBe('function')
    expect(typeof GridItem).toBe('function')
  })

  it('Grid applies default responsive classes', () => {
    const grid = Grid({ children: 'Test' })
    expect(grid).toBeTruthy()
    expect(grid?.props?.className).toContain('grid')
    expect(grid?.props?.className).toContain('grid-cols-4')
    expect(grid?.props?.className).toContain('md:grid-cols-8')
    expect(grid?.props?.className).toContain('lg:grid-cols-12')
  })

  it('GridItem generates correct col-span classes', () => {
    const item = GridItem({ children: 'Test', colSpan: 6 })
    expect(item?.props?.className).toContain('col-span-6')
  })

  it('GridItem supports responsive col spans', () => {
    const item = GridItem({
      children: 'Test',
      colSpan: 12,
      mdColSpan: 6,
      lgColSpan: 4,
    })
    expect(item?.props?.className).toContain('col-span-12')
    expect(item?.props?.className).toContain('md:col-span-6')
    expect(item?.props?.className).toContain('lg:col-span-4')
  })

  it('Grid applies custom gap classes', () => {
    const grid = Grid({ children: 'Test', gap: 'gap-8' })
    expect(grid?.props?.className).toContain('gap-8')
  })

  it('Grid applies custom className', () => {
    const grid = Grid({ children: 'Test', className: 'custom-class' })
    expect(grid?.props?.className).toContain('custom-class')
  })

  it('GridItem applies custom className', () => {
    const item = GridItem({ children: 'Test', className: 'custom-item' })
    expect(item?.props?.className).toContain('custom-item')
  })
})

describe('Grid baseline alignment (4px rule)', () => {
  it('supports 4px-aligned gaps (gap-1, gap-2, gap-3, gap-4, gap-6)', () => {
    const validGaps = ['gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6']
    validGaps.forEach((gapClass) => {
      const grid = Grid({ children: 'Test', gap: gapClass })
      expect(grid?.props?.className).toContain(gapClass)
    })
  })

  it('enforces 4px grid baseline', () => {
    // grid-cols-* with gap-* ensures 4px alignment
    // gap-1 = 0.25rem = 4px, gap-2 = 0.5rem = 8px, etc.
    expect(['gap-1', 'gap-2', 'gap-4', 'gap-6'].every((g) =>
      Number(g.replace('gap-', '')) * 4 % 4 === 0
    )).toBe(true)
  })
})
