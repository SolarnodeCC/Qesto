/**
 * Grid layout primitive
 * Implements responsive 12/8/4-column grid with 4px baseline alignment
 *
 * Usage:
 *   <Grid cols={12} md={8} sm={4} gap="gap-8">
 *     <GridItem colSpan={6}>Half width</GridItem>
 *     <GridItem colSpan={6}>Half width</GridItem>
 *   </Grid>
 *
 * Responsive defaults: 12 cols at lg+, 8 at md, 4 at sm
 * All spacing is 4px baseline (gap-1 = 4px, gap-2 = 8px, etc.)
 */

import type { ReactNode } from 'react'

interface GridProps {
  children: ReactNode
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
  sm?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  md?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12
  lg?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12
  xl?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12
  gap?: string
  className?: string
}

/**
 * Grid container
 * Default: 12 columns at lg+, 8 at md, 4 at sm
 */
export function Grid({
  children,
  sm = 4,
  md = 8,
  lg = 12,
  xl = 12,
  gap = 'gap-8',
  className = '',
}: GridProps) {
  const gridClasses = [
    `grid`,
    `grid-cols-${sm}`,
    `md:grid-cols-${md}`,
    `lg:grid-cols-${lg}`,
    `xl:grid-cols-${xl}`,
    gap,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={gridClasses}>{children}</div>
}

interface GridItemProps {
  children: ReactNode
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
  smColSpan?: 1 | 2 | 3 | 4
  mdColSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  lgColSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12
  className?: string
}

/**
 * Grid item (child)
 * Spans specified columns at each breakpoint
 */
export function GridItem({
  children,
  colSpan = 1,
  smColSpan,
  mdColSpan,
  lgColSpan,
  className = '',
}: GridItemProps) {
  const itemClasses = [
    `col-span-${colSpan}`,
    smColSpan && `sm:col-span-${smColSpan}`,
    mdColSpan && `md:col-span-${mdColSpan}`,
    lgColSpan && `lg:col-span-${lgColSpan}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={itemClasses}>{children}</div>
}

/**
 * Grid showcase for design system
 * Demonstrates responsive behavior across breakpoints
 */
export function GridShowcase() {
  return (
    <div className="space-y-12 p-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">12-column grid (lg+)</h2>
        <Grid cols={12} gap="gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <GridItem key={i} colSpan={1}>
              <div className="bg-teal-100 p-4 text-center text-sm font-medium">
                Col {i + 1}
              </div>
            </GridItem>
          ))}
        </Grid>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Sidebar + main (6/6 split)</h2>
        <Grid cols={12} gap="gap-8">
          <GridItem colSpan={4}>
            <div className="bg-violet-100 p-8 rounded-lg">
              <h3 className="font-semibold mb-2">Sidebar</h3>
              <p className="text-sm text-pulse-600">4 column sidebar</p>
            </div>
          </GridItem>
          <GridItem colSpan={8}>
            <div className="bg-teal-100 p-8 rounded-lg">
              <h3 className="font-semibold mb-2">Main Content</h3>
              <p className="text-sm text-pulse-600">8 column main area</p>
            </div>
          </GridItem>
        </Grid>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Full-width (12)</h2>
        <Grid cols={12} gap="gap-4">
          <GridItem colSpan={12}>
            <div className="bg-pulse-100 p-8 rounded-lg">
              <h3 className="font-semibold">Full-width banner</h3>
            </div>
          </GridItem>
        </Grid>
      </section>
    </div>
  )
}
