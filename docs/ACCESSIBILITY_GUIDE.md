# Accessibility (A11y) Implementation Guide

## Overview

This guide documents accessibility patterns and WCAG AA compliance standards for the Qesto application. All critical flows (Join, Vote, Solutions) follow these patterns to ensure inclusive access for all users, including those using assistive technologies like screen readers.

## WCAG AA Standards

We maintain **WCAG 2.1 Level AA** compliance across the entire application:

- **4.5:1 minimum color contrast** for all text and UI elements
- **Semantic HTML structure** with proper heading hierarchy
- **Keyboard navigation support** (Tab, Enter, Arrow keys)
- **Screen reader announcements** for dynamic content updates
- **ARIA labels and descriptions** for non-obvious interactive elements

## Core Accessibility Components

### 1. SkipLink

Allows users to bypass repetitive navigation and jump to main content.

```tsx
import { SkipLink } from '../components/Accessibility'

export default function Page() {
  return (
    <>
      <SkipLink href="#main-content" label="Skip to main content" />
      <main id="main-content">
        {/* Page content */}
      </main>
    </>
  )
}
```

**Key Points:**
- Always place at the top of the page
- Link should have `href="#main-content"` pointing to a `<main>` element
- Use `id="main-content"` on the main content container
- Appears visually when focused (keyboard navigation)

### 2. LiveRegion

Announces dynamic updates to screen readers using ARIA live regions.

```tsx
import { LiveRegion, useAnnouncement } from '../components/Accessibility'

export default function VotingPage() {
  const announce = useAnnouncement()

  const handleVoteSubmitted = async (answer) => {
    await submitVote(answer)
    announce('Your vote has been submitted', 'status')
  }

  return (
    <>
      <LiveRegion />
      {/* Page content */}
    </>
  )
}
```

**Announcement Types:**
- `'status'` (default): Polite announcements that don't interrupt current reading
- `'alert'`: Assertive announcements for errors or urgent information

### 3. Semantic HTML Structure

Always use semantic HTML elements for better screen reader support:

- Use `<main>` for primary content (not `<div>`)
- Use `<nav>` for navigation sections
- Use `<form>` for form elements (not `<div>`)
- Use `<header>`, `<footer>`, `<section>`, `<article>` appropriately
- Use proper heading hierarchy: `<h1>` → `<h2>` → `<h3>` (don't skip levels)

### 4. Form Inputs with Proper Labels

Always associate labels with inputs using `htmlFor`:

```tsx
<label htmlFor="join-code-input" className="text-sm font-bold">
  Enter code
</label>
<input
  id="join-code-input"
  type="tel"
  inputMode="numeric"
  placeholder="12 34"
  aria-invalid={!!error}
  aria-describedby={error ? 'error-message' : 'helper-text'}
  aria-label="Session code"
/>

{error && (
  <p id="error-message" role="alert" className="text-red-600">
    {error}
  </p>
)}

{!error && (
  <p id="helper-text" className="text-sm text-gray-600">
    4-digit code shown on screen
  </p>
)}
```

**Key Attributes:**
- `htmlFor` on label matches input `id`
- `aria-invalid="true"` when input has error
- `aria-describedby` points to helper/error text ID
- `aria-label` provides accessible name for non-obvious inputs
- `role="alert"` on error messages

### 5. Buttons with Clear Labels

Always provide clear, accessible button labels:

```tsx
<button
  type="submit"
  disabled={loading}
  aria-busy={loading}
  aria-label={loading ? 'Connecting to session' : 'Join session'}
  className="... focus:ring-2 focus:ring-teal-500 ..."
>
  {loading ? 'Connecting…' : 'Join →'}
</button>
```

**Key Attributes:**
- `aria-label` describes button action for screen readers
- `aria-busy="true"` during loading states
- `focus:ring-2` and `focus:ring-{color}` for visible focus indicators
- `aria-current="page"` for current navigation item

### 6. Color Contrast

All text must meet WCAG AA standards:

```
Contrast Ratios (WCAG AA minimum: 4.5:1)

✅ Black on white: 21:1
✅ Dark gray (#4B5563) on white: 8.2:1
✅ Red (#DC2626) on white: 5.0:1
✅ Teal (#14B8A6) on white: 4.5:1

❌ Light gray on white: 3.2:1 (too low)
❌ Blue (#3B82F6) on teal: 4.1:1 (too low)
```

Use tools like:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Polypane Color Contrast](https://polypane.app/color-contrast/)

### 7. Keyboard Navigation

All interactive elements must be keyboard accessible:

```tsx
// Tab navigation
<button>Submit</button>  // Automatically focusable

// Focus styles (required)
className="focus:outline-none focus:ring-2 focus:ring-teal-500"

// Arrow keys (for custom components)
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowUp') { /* move up */ }
  if (e.key === 'ArrowDown') { /* move down */ }
  if (e.key === 'Enter') { /* select */ }
  if (e.key === ' ') { /* select */ }
}
```

### 8. Image Alt Text

Always provide descriptive alt text:

```tsx
{/* Simple image */}
<img src="scenario.jpg" alt="Team retrospective workshop" />

{/* Data visualization */}
<img 
  src="chart.svg" 
  alt="Pie chart showing vote distribution: 40% Yes, 60% No" 
/>

{/* Decorative (rare) */}
<img src="gradient.svg" alt="" aria-hidden="true" />
```

## Critical Flow Implementation Patterns

### Join Flow (JoinPage.tsx)

✅ Semantic HTML:
- `<main id="main-content">` wrapper
- `<form>` for input + submit
- `<label htmlFor="join-code-input">` associated input

✅ ARIA:
- `aria-invalid` and `aria-describedby` on input
- `aria-label` on input for screen readers
- `aria-busy` on submit button during loading
- `role="alert"` on error messages

✅ Keyboard:
- Enter key submits form
- Tab navigation through inputs
- Focus visible on all interactive elements

✅ Announcements:
- "Connecting to session…" status announcement
- "Session found. Redirecting…" on success
- Error messages announced to screen readers

### Vote Flow (Vote.tsx)

✅ Semantic HTML:
- `<main id="main-content">` wrapper
- `<nav>` for segment navigation
- `<form>` for voting input

✅ ARIA:
- `aria-label` on voting buttons (e.g., "Vote for Option A")
- `aria-current="page"` on active navigation segment
- `role="alert"` on error messages
- `aria-describedby` for helper text on inputs
- `aria-label` on emoji reaction buttons

✅ Keyboard:
- Tab through voting options
- Enter/Space to select
- Arrow keys for scale/ranking votes

✅ Announcements:
- "Your vote has been submitted" on success
- "Duplicate vote detected" on error
- Vote count updates announced

### Solutions Flow (SolutionsPage.tsx)

✅ Semantic HTML:
- `<main id="main-content">` wrapper
- `<nav>` for segment navigation
- `<h1>`, `<h2>`, `<h3>` proper hierarchy
- `<article>` for scenario cards
- `<img>` with descriptive alt text

✅ ARIA:
- `aria-label` on navigation buttons
- `aria-current="page"` for active segment
- `aria-label` on scenario read links

✅ Keyboard:
- Tab through all buttons and links
- Focus visible on all interactive elements

## Testing Accessibility

### Unit Tests (tests/a11y/critical-flows.test.ts)

Tests verify:
- Form labels associated with inputs
- Error messages with `role="alert"`
- Keyboard navigation support
- ARIA attributes present and valid
- Color contrast ratios ≥ 4.5:1
- No critical axe-core violations

Run tests:
```bash
npm test -- tests/a11y/critical-flows.test.ts
```

### Manual Testing

1. **Screen Reader Testing** (NVDA, JAWS, VoiceOver)
   - Enable screen reader
   - Navigate using Tab key
   - Verify announcements are clear and timely
   - Check form labels are read correctly

2. **Keyboard Navigation**
   - Disable mouse
   - Navigate entire page with Tab/Arrow keys
   - Verify all interactive elements are reachable
   - Confirm focus is visible at all times

3. **Color Contrast**
   - Use WCAG contrast checker
   - Test all text, buttons, links
   - Verify 4.5:1 ratio for normal text
   - Verify 3:1 ratio for large text (18pt+)

4. **Zoom Testing**
   - Test at 200% zoom
   - Verify content still readable
   - Check no horizontal scrolling required

### CI/CD Gate

The `.github/workflows/a11y-checks.yml` workflow runs on every PR:
- Runs `npm test -- tests/a11y/` for unit tests
- Runs axe-core audit (when configured)
- Fails PR if critical violations found

## Common Pitfalls to Avoid

❌ **Don't:**
- Use `<div onClick>` without proper ARIA roles and keyboard handlers
- Rely on color alone to convey information
- Create focus traps without proper escape handling
- Forget alt text on images (including data visualizations)
- Use `aria-label` instead of semantic HTML when possible

✅ **Do:**
- Use semantic HTML elements (`<button>`, `<form>`, `<main>`)
- Provide visible focus indicators
- Use ARIA as enhancement, not replacement
- Test with actual screen readers
- Include both visual and auditory feedback

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WebAIM Blog](https://webaim.org/blog/)

## Questions?

For accessibility questions or issues:
1. Check this guide first
2. Review critical flow implementations (Join, Vote, Solutions)
3. Run tests: `npm test -- tests/a11y/`
4. Open a GitHub issue with `a11y` label
