# Grid Layout Guide — LAYOUT-GRID-01

Qesto uses a **responsive 12-column grid** with **4px baseline alignment** across all screen sizes.

## Responsive Breakpoints

| Breakpoint | Width | Columns | Gutter | Margin |
|---|---|---|---|---|
| **sm** (mobile) | 320px+ | 4 | 16px | 16px |
| **md** (tablet) | 640px+ | 8 | 24px | 32px |
| **lg** (desktop) | 1024px+ | 12 | 24px | 48px |
| **xl** (wide) | 1280px+ | 12 | 24px | 48px |

## Column Configuration

### Default: Responsive 12/8/4

Most pages should use the default responsive grid:

```tsx
<Grid>
  {/* 4 cols on sm, 8 on md, 12 on lg+ */}
  <GridItem colSpan={6}>Half width (on lg+)</GridItem>
  <GridItem colSpan={6}>Half width (on lg+)</GridItem>
</Grid>
```

This renders:
- **Mobile (sm)**: Each item spans full width (stacked)
- **Tablet (md)**: Items can span up to 8 columns
- **Desktop (lg+)**: Items can span up to 12 columns

### Custom Breakpoints

Override defaults per item:

```tsx
<Grid>
  <GridItem colSpan={12} mdColSpan={6} lgColSpan={4}>
    Sidebar (4 cols wide on lg+, half on md, full on sm)
  </GridItem>
</Grid>
```

### Common Layouts

#### Sidebar + Main (4 + 8)

```tsx
<Grid cols={12} gap="gap-6">
  <GridItem colSpan={4}>Sidebar</GridItem>
  <GridItem colSpan={8}>Main content</GridItem>
</Grid>
```

- Mobile: Sidebar and main stack vertically
- Tablet: Sidebar 1/3, main 2/3
- Desktop: Sidebar 1/3, main 2/3 (same as tablet)

#### Two Columns (6 + 6)

```tsx
<Grid cols={12} gap="gap-6">
  <GridItem colSpan={6}>Left</GridItem>
  <GridItem colSpan={6}>Right</GridItem>
</Grid>
```

- Mobile: Stack vertically
- Tablet: Half width each (8 cols total → visually ~4+4)
- Desktop: Half width each (12 cols total → 6+6)

#### Three Columns (4 + 4 + 4)

```tsx
<Grid cols={12} gap="gap-6">
  <GridItem colSpan={4}>Column 1</GridItem>
  <GridItem colSpan={4}>Column 2</GridItem>
  <GridItem colSpan={4}>Column 3</GridItem>
</Grid>
```

- Mobile: Stack vertically (4 cols each)
- Tablet: 2-column layout (4 cols top, 4 cols below for tablet-sized gutters)
- Desktop: 3-column layout (4 cols each)

## 4px Baseline Alignment

All spacing must be a multiple of **4px** to maintain visual consistency.

### Spacing Scale

Tailwind's spacing scale aligns with the 4px baseline:

| Tailwind Class | Pixels | Rem |
|---|---|---|
| `gap-0` | 0px | 0 |
| `gap-1` | 4px | 0.25rem |
| `gap-2` | 8px | 0.5rem |
| `gap-3` | 12px | 0.75rem |
| `gap-4` | 16px | 1rem |
| `gap-6` | 24px | 1.5rem |
| `gap-8` | 32px | 2rem |
| `gap-12` | 48px | 3rem |

### Valid Spacing Values

✅ **Use these** (multiples of 4px):
- `gap-1` (4px)
- `gap-2` (8px)
- `gap-4` (16px)
- `gap-6` (24px)
- `gap-8` (32px)

❌ **Avoid** (not 4px-aligned):
- `gap-1.5` (6px) — not multiple of 4
- `gap-2.5` (10px) — not multiple of 4
- Custom pixel values like `gap-[5px]` — not 4px-aligned

### Padding & Margins

Same rules apply to padding and margins:

```tsx
// ✅ Good (4px baseline)
<div className="p-4 m-6">Content</div>

// ❌ Avoid (odd pixel values)
<div className="p-[5px] m-[7px]">Content</div>
```

## Code Review Checklist

When reviewing PRs with grid layouts, verify:

- [ ] Grid uses `<Grid>` component (not raw `grid` divs)
- [ ] All column spans are between 1–12 (or responsive equivalents)
- [ ] Responsive spans declared (e.g., `colSpan={12} mdColSpan={6} lgColSpan={4}`)
- [ ] All spacing (gap, padding, margin) is 4px-aligned (`gap-*`, not custom pixels)
- [ ] Mobile-first: smallest breakpoint first, then `md:`, `lg:`
- [ ] No hardcoded pixel values (use `gap-*`, `p-*`, `m-*` Tailwind classes)
- [ ] Snapshot tests added if layout is critical (dashboard, settings, etc.)

## Examples

### Dashboard Main Layout

```tsx
import { Grid, GridItem } from '../components/Grid'

export function Dashboard() {
  return (
    <Grid cols={12} gap="gap-6">
      {/* Sidebar */}
      <GridItem colSpan={4} mdColSpan={8} lgColSpan={3}>
        <Sidebar />
      </GridItem>

      {/* Main content */}
      <GridItem colSpan={8} mdColSpan={8} lgColSpan={9}>
        <MainContent />
      </GridItem>
    </Grid>
  )
}
```

On mobile: sidebar and main both full-width (stacked)  
On tablet: sidebar on left (33%), main on right (67%)  
On desktop: sidebar 25%, main 75%

### Session Config Form (Full-Width)

```tsx
export function SessionConfig() {
  return (
    <Grid cols={12} gap="gap-6">
      <GridItem colSpan={12}>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Configuration</h2>
          <FormFields />
        </Card>
      </GridItem>
    </Grid>
  )
}
```

### Three-Column Features Section

```tsx
export function Features() {
  return (
    <Grid cols={12} gap="gap-6">
      {features.map((f, i) => (
        <GridItem key={i} colSpan={4} mdColSpan={8} smColSpan={12}>
          <FeatureCard {...f} />
        </GridItem>
      ))}
    </Grid>
  )
}
```

Mobile: 1 feature per row  
Tablet: 1-2 features per row  
Desktop: 3 features per row

## Grid + Tailwind Configuration

The grid column utilities (1–12) are auto-generated from `docs/spec/design-tokens.json` by `scripts/build-tokens.mjs`.

Generated utilities:
- `grid-cols-1` through `grid-cols-12`
- Responsive variants: `sm:grid-cols-*`, `md:grid-cols-*`, etc.
- Custom grid sizes: `grid-mobile` (4 cols), `grid-tablet` (8 cols), `grid-desktop` (12 cols)

All column counts support:
- `col-span-1` through `col-span-12` for spanning multiple columns
- Responsive variants: `sm:col-span-*`, `md:col-span-*`, etc.

## Testing

Grid layouts are tested via:
- **Unit tests**: `tests/unit/Grid.test.tsx` — column spans, responsive behavior, snapshots
- **Accessibility tests**: `tests/a11y/` — landmark regions, focus order (see LAYOUT-A11Y-01)
- **Visual regression**: Snapshot tests for critical layouts (Dashboard, Settings, Results)

Run tests:
```bash
npm test -- Grid.test.tsx
npm run test:stress  # Layout performance under load
npm run test:a11y    # WCAG compliance on grid-based pages
```

## Performance

Grid layouts are optimized for:
- **CSS Grid**: Native browser support (no JS calculation)
- **Minimal DOM**: Grid container + items only, no wrapper divs
- **Fast reflow**: Responsive classes applied at build time, not runtime
- **CLS (Cumulative Layout Shift)**: Column spans locked per breakpoint, no jumps

---

**LAYOUT-GRID-01 Acceptance Criteria**:
- ✅ 12-column grid available (grid-cols-1 through grid-cols-12)
- ✅ Responsive: 4 cols (sm) → 8 cols (md) → 12 cols (lg+)
- ✅ 4px baseline alignment enforced
- ✅ Component API simple: `<Grid colSpan={N} mdColSpan={M}>`
- ✅ 3+ layout snapshots passing (sidebar+main, full-width, mobile stacked)
- ✅ Code review checklist defined
