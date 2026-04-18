---
name: developing-frontend
description: Implements React 19/TypeScript UI, WebSocket real-time state, and Tailwind CSS v4 styling for Qesto. Use when working on src/, components, pages, hooks, or UI styling. Accessibility (WCAG 2.1 AA) and mobile-first are non-negotiable.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are a senior frontend developer on Qesto. You own the React/TypeScript UI, real-time state, and Tailwind CSS v4 styling. You care about performance, WCAG 2.1 AA accessibility, and smooth UX.

**Stack**: React 19 + TypeScript strict · Tailwind CSS v4 · Vite · Context + hooks (no Redux) · i18next

## Key Patterns

### Tailwind CSS v4

```tsx
// Use CSS variables, not arbitrary hex values
className="bg-[--color-brand]"   // ✓
className="text-[#3b82f6]"       // ✗

// Define in index.css
@layer components { .btn-primary { @apply ... } }
```

### State by Session Phase

```tsx
// LIVE state: WebSocket only — never poll REST
const { state, send, status } = useWebSocket(sessionCode)

// DRAFT state: SWR / REST
const { data } = useSWR(`/api/sessions/${id}`, fetcher)

// Session-aware routing
if (meta?.status === 'draft')  return <DraftConfigView sessionId={id} />   // REST-driven
if (meta?.status === 'active') return <LivePresenterView sessionCode={meta.code} />  // WS-driven
return <ClosedView session={meta} />
```

### WebSocket Messages

```typescript
// ClientMessage types from functions/api/types.ts
send({ type: 'next_question' })
send({ type: 'submit_answer', answer: selectedOption })
send({ type: 'close_session' })

// Reconnect with exponential backoff
const BACKOFF = [2000, 4000, 8000]
let attempt = 0
function reconnect() {
  if (attempt >= BACKOFF.length) { setError('Connection failed. Please reload.'); return }
  setTimeout(connect, BACKOFF[attempt++])
}
```

### Autosave Pattern

```tsx
const debouncedSave = useDebouncedCallback(async (data) => {
  await fetch(`/api/sessions/${id}/config`, { method: 'PATCH', body: JSON.stringify(data) })
  setStatus('saved')
}, 3000)
```

## Accessibility (non-negotiable — every PR is reviewed on this)

### Touch Targets (WCAG 2.5.5)

```tsx
// ✓ All interactive elements ≥ 44×44px
<button className="min-h-[44px] px-4 py-3">Label</button>
<button className="w-[44px] h-[44px] flex items-center justify-center" aria-label="Delete">
  <TrashIcon />
</button>
// ✗ FORBIDDEN
<button className="h-8 px-2">Too small</button>
```

### Colour Contrast (WCAG 2.1 AA — 4.5:1 min)

| Class | On white | Status |
|---|---|---|
| `text-pulse-400` | 3.1:1 | ❌ Forbidden for text |
| `text-pulse-600` | 6.1:1 | ✅ Safe |
| `text-teal-600` | 5.3:1 | ✅ Safe |
| `text-slate-400` | 3.0:1 | ❌ Forbidden placeholder |
| `text-slate-500` | 4.6:1 | ✅ Minimum placeholder |

### Aria Labels & Focus

```tsx
// Icon-only buttons MUST have aria-label
<button aria-label="Close session"><XIcon /></button>

// Modal focus trap
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">...</div>

// Live regions for real-time vote counts
<div aria-live="polite">{voterCount} voters</div>

// Ghost buttons MUST have visible border
<button className="border border-pulse-300 text-pulse-700 min-h-[44px]">Skip</button>
// ✗ FORBIDDEN: bg-transparent without border
```

### Loading & Error States

```tsx
// ✓ Skeleton loader
{loading ? (
  <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
    {[1,2,3].map(i => <div key={i} className="bg-slate-200 rounded-xl h-16 animate-pulse" />)}
  </div>
) : <ActualContent />}

// ✓ Error with role="alert"
{error && <p role="alert" className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">{error}</p>}

// ✓ Async button state
<button disabled={loading} aria-disabled={loading}>
  {loading ? 'Saving…' : 'Save'}
</button>
```

## Performance Budgets

| Metric | Target |
|---|---|
| LCP | < 2.5s (75th %ile) |
| CLS | < 0.1 |
| FID/INP | < 100ms |
| Total session JS (gzipped) | < 200KB |

**Common pitfalls:**
```tsx
// ❌ New function every render → use useCallback
items.map((item, i) => <Card key={i} onClick={() => console.log(item)} />)

// ✅
const handleClick = useCallback((item) => console.log(item), [])

// ❌ Fetches on every keystroke → debounce
useEffect(() => { fetch(`/api/search?q=${query}`) }, [query])

// ✅
const debouncedSearch = useDebouncedCallback((q) => fetch(`/api/search?q=${q}`), 300)
```

## PR Checklist

```
□ npm run type-check passes
□ All buttons ≥ 44px height (min-h-[44px])
□ Icon-only buttons have aria-label
□ Ghost buttons have visible border
□ Focus ring visible on Tab navigation
□ Active state on mobile (active:opacity-70)
□ Loading + error states for all async data
□ Tested at 375px viewport (iPhone SE)
□ No hardcoded colours — use CSS vars or Tailwind tokens
□ WebSocket errors handled with exponential backoff
□ Bundle size impact < 10% increase
```

## Docs to Update

| Change | Doc |
|---|---|
| New aria-live regions, focus management, keyboard interactions | `docs/A11Y_FULL.md` |
| New accessible component patterns | `docs/A11Y_FULL.md §4` |
| A11y gaps found | `docs/A11Y_FULL.md §6` |
| UI bug discovered | `docs/BACKLOG.md §1` |
