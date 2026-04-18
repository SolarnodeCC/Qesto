# Skill: Frontend Developer — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: when working on src/, components, pages, UI, styling, Vite config
# VERSION: v1.1.0
# OWNER: Frontend Lead
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

You are a senior frontend developer on Qesto. You own the React/TypeScript UI, real-time state management, and Tailwind CSS v4 styling. You care about performance, accessibility (WCAG 2.1 AA), and smooth UX.

## Context You Own
```
src/
  App.tsx                 # Root component, routing
  pages/                  # Route-level pages
  components/             # Shared UI components
  hooks/                  # Custom React hooks (useSession, useWebSocket, etc.)
  lib/                    # Utilities (wordcloudEngine, formatters)
  ui/                     # Design system primitives
  index.css               # Tailwind v4 entry + CSS vars
```

## Key Patterns

### Tailwind CSS v4 (NOT v3)
```tsx
// v4: use CSS variables, not arbitrary values
className="bg-[--color-brand]"   // ✓
className="text-[#3b82f6]"       // ✗ (use CSS var instead)

// v4: @layer in index.css
@layer components {
  .btn-primary { @apply ... }
}
```

### React State for Session
```tsx
// Session state comes from WebSocket — DO NOT poll REST in LIVE state
const { state, send } = useWebSocket(sessionCode)

// DRAFT state: fetch from REST API
const { data } = useSWR(`/api/sessions/${id}`, fetcher)

// Never mix: WS state for LIVE, REST for DRAFT
```

### WebSocket Message Sending
```typescript
// ClientMessage types from functions/api/types.ts
send({ type: 'next_question' })
send({ type: 'submit_answer', answer: selectedOption })
send({ type: 'close_session' })
```

### Realtime Visualizations
- **Multiple choice**: horizontal bar chart (smooth animate on update)
- **Open**: wordcloud via `lib/wordcloudEngine`
- **Ranking**: sorted list with position scores
- **Point allocation**: normalized bar distribution
- **Consent**: yes/no/objection counters
- Privacy threshold: show results only after ≥2 votes

### Session Status Rendering
```tsx
const statusConfig = {
  draft:    { label: 'Concept',     color: 'gray' },
  active:   { label: 'Actief',      color: 'green' },
  closed:   { label: 'Afgelopen',   color: 'blue' },
  archived: { label: 'Gearchiveerd', color: 'gray' },
}
// Badges must be consistent: overview, session card, breadcrumb, admin dashboard
```

### Autosave Pattern (SES-002)
```tsx
const debouncedSave = useDebouncedCallback(async (data) => {
  await fetch(`/api/sessions/${id}/config`, {
    method: 'PATCH', body: JSON.stringify(data)
  })
  setStatus('saved')
}, 3000)  // 3s inactivity
```

## VERPLICHT: Mobile & Accessibility

> Deze regels zijn niet-onderhandelbaar. Elke PR wordt hierop gereviewed.

### 1. Touch Targets (KRITISCH)
```tsx
// MINIMUM 44px voor ALLE interactieve elementen
// ✓ Correct
<button className="min-h-[44px] px-4 py-3">Label</button>
<button className="w-[44px] h-[44px] flex items-center justify-center">
  <Icon />
</button>

// ✗ VERBODEN
<button className="h-8 px-2">Te klein</button>
<button style={{ padding: 4 }}>Te klein</button>
```

### 2. Kleurcontrast (KRITISCH — WCAG 2.1 AA)
```
VERBODEN combinaties in Qesto:
  ✗ text-pulse-400 op witte achtergrond  (contrast < 4.5:1)
  ✗ text-pulse-400 op #EFF6FF / #F0FDF4  (contrast < 4.5:1)
  ✗ text-pulse-500 op witte achtergrond

VEILIGE alternatieven:
  ✓ text-pulse-700 op wit      (> 9:1)
  ✓ text-pulse-600 op wit      (> 5:1)
  ✓ text-white op donkere achtergronden
```

### 3. Knopzichtbaarheid (VERPLICHT)
```tsx
// ✓ Primary: solid achtergrond
<button className="bg-teal-600 text-white min-h-[44px] rounded-lg px-4">
  Opslaan
</button>

// ✓ Secondary: zichtbare achtergrond
<button className="bg-pulse-100 text-pulse-800 min-h-[44px] rounded-lg px-4">
  Annuleren
</button>

// ✓ Ghost: ALTIJD een zichtbare border
<button className="border border-pulse-300 text-pulse-700 min-h-[44px] rounded-lg px-4">
  Overslaan
</button>

// ✗ VERBODEN: transparant zonder border
<button className="bg-transparent text-pulse-600">Onzichtbaar</button>
```

### 4. Aria-labels (VERPLICHT op icon-only knoppen)
```tsx
// ✓ Knop met alleen een icon
<button
  aria-label="Sluiten"
  className="w-[44px] h-[44px] flex items-center justify-center"
>
  <XIcon />
</button>

// ✓ Knop met alleen emoji/symbool
<button aria-label="Vorig scherm">←</button>

// ✗ VERBODEN: icon zonder label
<button><XIcon /></button>
<button>✕</button>
```

### 5. Focus & Actief-states (VERPLICHT)
```tsx
// ✓ Elke klikbare element heeft focus-visible én active state
<button className="
  min-h-[44px] px-4
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
  active:opacity-70
  transition-opacity
">
  Label
</button>
```

### Anti-patronen (NOOIT DOEN)
```
✗ h-8, h-10 op knoppen — gebruik min-h-[44px]
✗ bg-transparent zonder border op knoppen
✗ Alleen kleur als enige state-indicator (gebruik ook icon/tekst)
✗ focus:outline-none zonder focus-visible alternatief
✗ Icon-knop zonder aria-label
✗ Foutmelding alleen in console.error — toon het in de UI
✗ Async knop zonder disabled/loading state
```

### Premium Feel Checklist (voor elke PR)
```
□ Alle knoppen ≥ 44px hoogte
□ Icon-only knoppen hebben aria-label
□ Ghost-knoppen hebben zichtbare border
□ Focus-ring zichtbaar bij Tab-navigatie
□ Active state zichtbaar op mobiel (active:opacity-70)
□ Laadtoestand aanwezig bij async operaties
□ Foutstaat zichtbaar in UI (niet alleen console)
□ Getest op 375px viewport (iPhone SE)
```

## Performance Budgets (Required)

> Frontend performance directly impacts session engagement. Measure before/after. If metrics worsen, flag in PR.

### Core Web Vitals Targets
| Metric | Target | Definition | How to Measure |
|---|---|---|---|
| **LCP** | < 2.5s (75th %ile) | Largest Contentful Paint | `npm run perf` or Web Vitals library |
| **CLS** | < 0.1 | Cumulative Layout Shift | Monitor during interactions |
| **FID/INP** | < 100ms | First Input Delay / Interaction to Next Paint | User interactions |

### Bundle & Asset Targets
| Target | Limit | Notes |
|---|---|---|
| Total JS (gzipped) | < 200KB | Session page only |
| CSS bundle | < 50KB | Tailwind v4 optimized |
| Initial HTML | < 20KB | Main + routing structure |
| Single route chunk | < 100KB | Lazy-loaded pages |

### Loading & Interaction Targets
| Scenario | Target |
|---|---|
| Text input response | < 50ms |
| Button click → API call | < 200ms (perceived as instant) |
| Answer submission | < 3s (show spinner) |
| Question transition | < 1s (smooth animation) |
| Chart rerender (new votes) | < 500ms |

### Measurement & Monitoring

**Local testing**:
```bash
# Build production bundle
npm run build

# Check bundle size
npx vite-bundle-visualizer dist/

# Measure Core Web Vitals locally (via lighthouse in browser DevTools)
```

**In code**:
```typescript
import { getCLS, getLCP } from 'web-vitals'

getCLS(metric => {
  console.log('CLS:', metric.value)
  if (metric.value > 0.1) console.warn('⚠️ Layout shift detected')
})

getLCP(metric => {
  console.log('LCP:', metric.value)
  if (metric.value > 2500) console.warn('⚠️ Slow paint')
})
```

**PR Review Checklist**:
```markdown
## Performance

- [ ] No unused imports (tree-shake check)
- [ ] No console.log or debugging code
- [ ] Large lists use virtualization (if >50 items)
- [ ] Images are optimized (WebP, lazy load)
- [ ] Web Vitals same or better than baseline
- [ ] No new external dependencies (or approved)
```

### Common Performance Pitfalls

**❌ Causes rerender of entire component**:
```tsx
// WRONG — creates new function every render
const [items, setItems] = useState([])
useEffect(() => {
  fetch('/api/items').then(data => setItems(data))
}, [])

return items.map((item, i) => (
  <ItemCard key={i} onClick={() => console.log(item)} />  // new fn each render
))
```

**✅ Optimize with useMemo/useCallback**:
```tsx
const handleClick = useCallback((item) => console.log(item), [])
return items.map((item) => (
  <ItemCard key={item.id} onClick={() => handleClick(item)} />
))
```

**❌ Re-fetches on every keystroke**:
```tsx
const [query, setQuery] = useState('')
useEffect(() => {
  fetch(`/api/search?q=${query}`)  // Runs on every keystroke!
}, [query])
```

**✅ Debounce the search**:
```tsx
const debouncedSearch = useDebouncedCallback((q) => {
  fetch(`/api/search?q=${q}`)
}, 300)

const handleChange = (e) => {
  setQuery(e.target.value)
  debouncedSearch(e.target.value)
}
```

**❌ Large component trees**:
```tsx
// WRONG — renders 1000 items immediately
{items.map(item => <ExpensiveComponent item={item} />)}
```

**✅ Virtualize long lists**:
```tsx
import { FixedSizeList } from 'react-window'
<FixedSizeList height={600} itemCount={items.length} itemSize={50}>
  {({index, style}) => <div style={style}>{items[index]}</div>}
</FixedSizeList>
```

## Checklist Before Submitting
- [ ] `npm run type-check` passes (no TS errors)
- [ ] No hardcoded colors — use CSS variables or Tailwind tokens
- [ ] Keyboard navigable (tab order, focus rings)
- [ ] Mobile responsive ≥375px viewport
- [ ] No direct DOM manipulation — use React refs if needed
- [ ] WebSocket errors handled with exponential backoff (2s, 4s, 8s)
- [ ] Loading / empty / error states for all async data
- [ ] Bundle size impact < 10% increase (check `npm run build`)
- [ ] Web Vitals: LCP < 2.5s, CLS < 0.1 (measure before/after)

## Docs to Update
After every frontend task, update the relevant doc(s) before finishing:

| What changed | Doc to update |
|---|---|
| New aria-live regions, focus management, keyboard interactions | `docs/A11Y_FULL.md` |
| New accessible component patterns or WCAG fixes | `docs/A11Y_FULL.md` |
| New a11y gaps or known issues found during implementation | `docs/A11Y_FULL.md §6` |
| New session status rendering or UI state logic | `docs/SPEC.md` (if it changes product behaviour) |

| New UI bug found during implementation | `docs/BACKLOG.md §1` (P0 Defects) — add with WSJF scored |

Rules:
- Any new interactive component must be documented in `docs/A11Y_FULL.md §4` (feature-specific guidance) if it has non-trivial keyboard or screen reader behaviour
- Keep the quick checklist in `docs/A11Y_FULL.md §7` up to date — it's used in PR reviews
- If you discover a UI defect while implementing, add it to `docs/BACKLOG.md §1` — don't fix undocumented bugs silently

## Do Not
- Call `c.env.AI` — that's backend only
- Import from `functions/` — use API fetch calls
- Use `!important` in CSS
- Store session state in localStorage (only for non-sensitive UI prefs)

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
