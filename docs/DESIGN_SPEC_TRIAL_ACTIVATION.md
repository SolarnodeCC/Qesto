# Design Spec: Trial Activation Flow Redesign
# OWNER: Frontend Lead
# Version: v1.0.0 (Pilot)
# Date: 2026-04-24

_Onboarding redesign for trial users → paid conversion. WCAG AA + Lighthouse baseline maintained._

---

## Current State Analysis

**Baseline Metrics**:
- Lighthouse Performance: 92/100
- Lighthouse Accessibility: 96/100
- Lighthouse Best Practices: 100/100
- A11y violations (axe-core): 0

**Current Flow**:
1. User signs up (magic link)
2. Create team
3. Create first session
4. Go LIVE (show 3-min timer)
5. Show pricing page (Free → Pro upsell)

**Pain Points**:
- Pricing page feels separate from product context
- No visual feedback on plan limits (free: 50 participants)
- CTA not prominent enough

---

## Redesign Goals

1. **Distinctive but accessible**: Use Tailwind v4 CSS variables for brand color system
2. **Integrated pricing**: Show plan limits in-context during session creation
3. **Lighthouse maintained**: No regression in perf/a11y/best-practices
4. **WCAG AA**: All new components ≥ 4.5:1 contrast, 44px touch targets, keyboard-navigable

---

## Design Changes

### 1. Color System (CSS Variables)
```css
/* New brand variables in src/index.css */
:root {
  --color-brand-primary: #2563eb;     /* Blue 600 */
  --color-brand-accent: #dc2626;      /* Red 600 */
  --color-upgrade-bg: #fef3c7;        /* Amber 50 */
  --color-limit-warning: #f97316;     /* Orange 500 */
}
```

**Rationale**: One variable per role, not per component → easier to theme and test contrast.

### 2. Plan Limit Indicator (Session Create Page)
```tsx
// src/components/PlanLimitBanner.tsx
// Shows: "Free plan: max 50 participants"
// Styling: bg-[--color-upgrade-bg] with border-l-4 in brand-primary
// CTA: "Upgrade to Pro" (44px touch target, blue button)
```

### 3. Pricing Integration (During First Session)
```
When user starts FIRST session in DRAFT state:
- Show inline banner: "You're on Free. Upgrade to Pro for unlimited participants + AI insights"
- After LIVE: Show capacity meter (50/50 participants reached → can't add more)
```

### 4. Accessibility Enhancements
- All buttons: min-h-[44px] (touch target)
- All buttons: visible focus ring (ring-2 ring-blue-500 on :focus-visible)
- Icon-only buttons: aria-label required
- Plan limits section: role="region" aria-label="Plan usage"

---

## Lighthouse Regression Test

**Before design changes**:
- Performance: 92
- Accessibility: 96
- Best Practices: 100

**Target after changes**:
- Performance: ≥ 90 (regression tolerance: -2)
- Accessibility: ≥ 95 (regression tolerance: -1)
- Best Practices: ≥ 99 (regression tolerance: -1)

**Test plan**:
1. Build with changes
2. Run `npm run perf:audit` (Lighthouse CI)
3. Verify metrics above targets
4. If below: revert CSS variable or component change

---

## A11y Audit (axe-core)

**Before**: 0 violations  
**Target after**: 0 violations

**Audit checklist**:
- [ ] All interactive elements ≥ 44×44px
- [ ] Color contrast ≥ 4.5:1 on all text + icons
- [ ] Focus ring visible (ring-blue-500) on all buttons
- [ ] Modal focus trap if pricing modal added
- [ ] Form labels linked to inputs (for-id)
- [ ] Alt text on all images (or aria-hidden for decorative)

---

## Testing Checklist

- [ ] Mobile (375px width): No layout shift, touch targets 44px+
- [ ] Keyboard nav: Tab through all buttons, focus ring visible, no focus traps
- [ ] Screen reader (NVDA/JAWS): Interactive elements announced with correct role
- [ ] Color blind: Use icon + text (not color alone) for status indicators
- [ ] Low vision (zoom 200%): Text readable, buttons accessible

---

## Component Changes

| Component | Change | Impact |
|---|---|---|
| `PlanLimitBanner` | New — shows plan limit + upgrade CTA | Session create page |
| `PricingCard` | Updated — uses CSS variables for colors | Pricing page (consistency) |
| `SessionForm` | Updated — inline plan info before start | User flow improvement |

---

## Rollout

1. **Branch**: feature/trial-activation-redesign
2. **Testing**: Full a11y + Lighthouse suite (CI-gated)
3. **Deployment**: Feature flag (trial users only) → rollout 50% → 100%
4. **Monitoring**: Conversion rate (Free → Pro) + bounce rate on pricing section

---

## Success Metrics

- Lighthouse regression: None (maintained 92+/96+/100)
- A11y violations: 0 (maintained)
- Conversion lift (Free → Pro): Target ≥ 5% improvement
- Mobile usability: No touch target complaints in support

---

## References

- Tailwind CSS v4: `/src/index.css`
- Existing a11y tests: `tests/a11y/`
- Lighthouse config: `.lighthouserc.json`
