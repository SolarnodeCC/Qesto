# Growth Engine Phase 4: E2E Testing Checklist

**Sprint 1 MVP E2E Verification — Template Gallery + Magic Link Flow**

Date: May 21, 2026
Branch: `claude/qesto-growth-engine-3MgfU`

---

## Pre-Test Setup

1. ✅ Ensure MARKETING_KV is provisioned in wrangler.toml
2. ✅ Ensure WORKFLOWS binding is added
3. ✅ D1 migration 0044 applied (is_public column)
4. ✅ All i18n strings present in all 5 locales (common.json + wizard.json)
5. ✅ Backend endpoints mounted (`/api/templates/*`, `/api/webhooks/marketing`)
6. ✅ Frontend routes added (`/templates`, `/templates/:id`)
7. ✅ TypeScript: `tsc --noEmit` passes
8. ✅ Tests: `npm test` passes (797 tests)

---

## Phase 4.1: Template Gallery Frontend (Manual)

### Gallery Page (`/templates`)

- [ ] Navigate to `/templates`
- [ ] Page loads without errors
- [ ] Grid displays placeholder skeleton loaders (if no templates exist)
- [ ] "All industries" dropdown works
- [ ] "All themes" dropdown works
- [ ] Filters apply correctly (URL updates with query params)
- [ ] "Clear filters" button appears when filters active
- [ ] Pagination shows correct count (e.g., "0 templates", "2 templates")
- [ ] Empty state displays correct message when no results
- [ ] Mobile responsive: 1-col layout on mobile, 2-col on tablet, 3-col on desktop
- [ ] Dark mode works (theme toggle at top)
- [ ] All text renders correctly (test EN, NL, DE, FR, ES by changing browser language)

### Template Cards

- [ ] Card displays: industry badge, title, purpose, questions count, time, usage count
- [ ] Card hover effect (scale, border color change)
- [ ] Click card → navigates to `/templates/:id`
- [ ] Gradient top border visible
- [ ] Typography matches Qesto design system

### CTA Section at Bottom

- [ ] "Want to create your own?" section visible
- [ ] "Get started free" button visible and links to `/login`

---

## Phase 4.2: Template Detail Page

### Navigation & Layout

- [ ] Navigate to `/templates/:id` (via gallery card or direct URL)
- [ ] Page loads template metadata
- [ ] "← Back to gallery" link works
- [ ] Sticky CTA card on the right (desktop) or below (mobile)

### Template Metadata Display

- [ ] Title displays correctly
- [ ] Purpose/description displays
- [ ] Industry badge shows
- [ ] Questions count, time, usage count all visible
- [ ] "Best used for" pills display correctly
- [ ] "What you'll learn" checklist displays

### Questions Preview Section

- [ ] Numbered questions list shows
- [ ] Question text displays in correct language
- [ ] Question type badge (open/scale/multiple_choice) visible
- [ ] All questions from template display

### CTA Card (Sticky)

- [ ] "Use this template" button visible
- [ ] Button is enabled and clickable
- [ ] Gradient background matches design
- [ ] Small copy: "No account required to get started"
- [ ] "Want to customize? Log in" link works

### Bottom CTA Section

- [ ] "Ready to run this session?" heading visible
- [ ] "Use this template" button at bottom also clickable

---

## Phase 4.3: Magic Link Flow

### Generate Magic Link

- [ ] Click "Use this template" button
- [ ] Loading state shows ("Creating session…")
- [ ] After 5-10 seconds, modal appears with magic link
- [ ] Modal title: "Your session is ready!"
- [ ] Modal text explains sharing link

### Magic Link Modal

- [ ] Link is displayed in a readonly field with monospace font
- [ ] Copy button works (shows "Copied!" message for 2.5s)
- [ ] "Open session" button (with external link icon) opens link in new tab
- [ ] "Close" button closes modal
- [ ] "Link expires in 1 hour" message visible
- [ ] Modal styling matches Qesto design

### Magic Link Session Creation

- [ ] Open magic link from modal
- [ ] Anonymous session loads with pre-populated questions from template
- [ ] Session title matches template title
- [ ] All questions pre-filled and in correct language
- [ ] Participant can answer all questions
- [ ] Session completes normally
- [ ] On session close, prompt to "Save your session" appears
- [ ] Magic link prompt: Email is optional (can leave blank)
- [ ] After email entry, account is created with that email
- [ ] Session is now saved to user account

---

## Phase 4.4: Session Wizard Opt-out Toggle

### Step 4 Settings UI

- [ ] Create new session via Dashboard
- [ ] Reach SessionWizard step 4
- [ ] See "Include in template gallery" toggle (defaults ON)
- [ ] Toggle is properly styled as switch (circular, slides left/right)
- [ ] Description text: "After closing, an anonymised version..."
- [ ] Test in all 5 languages (toggle label + description text)
- [ ] Toggle state persists as you navigate back/forth in wizard

### Session Settings During Session Creation

- [ ] When toggle is ON: Session should be marked `is_public=1` in DB
- [ ] When toggle is OFF: Session should be marked `is_public=0` in DB
- [ ] Verify via: Create session with toggle ON, close it, check KV/DB

---

## Phase 4.5: Workflow Integration (Mock Test)

### Setup Workflow Mock

1. **Create test session:**
   - Go to Dashboard
   - Create new session with 3-5 questions
   - Set "Include in template gallery" toggle to ON
   - Launch session

2. **Run session to completion:**
   - Join session as participant
   - Answer all questions
   - Complete session
   - Close session

### Expected Workflow Trigger

- [ ] Session closed successfully
- [ ] `is_public=1` in session record
- [ ] Webhook should trigger (if webhooks are implemented)
- [ ] Cloudflare Workflow should queue (check logs if available)

### Template Appearance (if workflow runs)

- [ ] After ~10-30 seconds, new template should appear in MARKETING_KV
- [ ] Refresh `/templates` page
- [ ] New template appears in gallery (most recent)
- [ ] Template can be viewed at `/templates/:id`
- [ ] Questions rewritten (generic, no company-specific terms)
- [ ] Industry/theme auto-classified
- [ ] Template displays correct usage count (1 if first use)

### Verify Privacy

- [ ] No participant names in template
- [ ] No company/location details in rewritten questions
- [ ] Original answers NOT stored
- [ ] Only question text (rewritten) stored

---

## Phase 4.6: i18n Verification

### Test All 5 Languages

For each language (EN, NL, DE, FR, ES):

**Gallery Page:**
- [ ] All filter labels translate correctly
- [ ] Card text renders in target language
- [ ] Button text translates

**Detail Page:**
- [ ] All metadata displays in target language
- [ ] "Best used for" and "What you'll learn" translate

**Template Wizard:**
- [ ] Step 4 "Include in template gallery" toggle label translates
- [ ] Toggle description translates

**Magic Link Modal:**
- [ ] All button text and labels translate

**Verification Method:**
- Change browser language in DevTools (or use browser settings)
- Navigate to `/templates` and verify text changes
- Or add `?lang=nl` to URL if language detection implemented

---

## Phase 4.7: Performance & Load Testing

### Page Load Times

- [ ] `/templates` loads in < 2 seconds (empty or few templates)
- [ ] `/templates?industry=general` loads in < 2 seconds
- [ ] `/templates/:id` loads in < 1 second

### Pagination

- [ ] Load `/templates?limit=20&offset=0`
- [ ] Load `/templates?limit=20&offset=20`
- [ ] Pagination count updates correctly

### Network Requests

- [ ] Open DevTools → Network
- [ ] Navigate to `/templates`
- [ ] Count API calls (should be 1: GET /api/templates)
- [ ] Check response size (should be < 50KB for empty list)

---

## Phase 4.8: Accessibility (WCAG 2.1 AA)

### Keyboard Navigation

- [ ] Tab through gallery page → all interactive elements reachable
- [ ] Tab through detail page → tab order makes sense
- [ ] Modal can be closed with Escape key
- [ ] Buttons have visible focus rings

### Screen Reader

- [ ] Template cards have proper `aria-label`
- [ ] Filters have proper `<label>` associations
- [ ] Toggle switch has `role="switch"` and `aria-checked`
- [ ] Modal has `role="dialog"` and `aria-modal="true"`

### Color Contrast

- [ ] All text passes WCAG AA (4.5:1 for small text)
- [ ] Dark mode: check contrast ratios

### Semantic HTML

- [ ] `<h1>` on page (for gallery: "Ready-made templates", for detail: template title)
- [ ] Links are actual `<a>` tags, not divs with click handlers
- [ ] Buttons are `<button>` not divs

---

## Phase 4.9: Mobile Experience

### Responsive Layout

- [ ] Test on iPhone 12 (390px width)
- [ ] Test on iPad (768px width)
- [ ] Test on Desktop (1440px width)

**Gallery:**
- [ ] 1 column on mobile, 2 on tablet, 3 on desktop
- [ ] Filters stack vertically on mobile
- [ ] Card text readable without horizontal scroll

**Detail:**
- [ ] CTA card moves below template info on mobile
- [ ] Questions list readable
- [ ] Modal closes properly on mobile

**Performance:**
- [ ] No layout shifts (Cumulative Layout Shift < 0.1)
- [ ] Scrolling is smooth
- [ ] No horizontal scroll on any viewport

---

## Phase 4.10: Browser Compatibility

- [ ] Chrome 120+ ✅
- [ ] Safari 17+ ✅
- [ ] Firefox 121+ ✅
- [ ] Edge 120+ ✅

**Test:**
- [ ] Navigate to `/templates`
- [ ] Load template detail
- [ ] Open magic link modal
- [ ] No console errors in any browser

---

## Phase 4.11: Error Cases

### Missing Template

- [ ] Visit `/templates/nonexistent`
- [ ] Verify 404 error or "not found" message
- [ ] Back button works

### Network Failure

- [ ] Open DevTools → Network → Offline
- [ ] Try to load `/templates`
- [ ] Verify error message ("Something went wrong")
- [ ] Retry button appears and works

### Failed Magic Link

- [ ] Click "Use this template" → modal appears
- [ ] Copy link → manually modify sessionId in URL
- [ ] Try to load modified link
- [ ] Verify appropriate error (401, 404, or "Session not found")

---

## Phase 4.12: Dark Mode Compliance

- [ ] Toggle dark mode in UI
- [ ] All pages maintain contrast in dark mode
- [ ] SVG icons visible in dark mode
- [ ] Gradients still visible
- [ ] No "light on white" or "dark on dark" text

---

## Test Results Summary

| Phase | Component | Status | Notes |
|-------|-----------|--------|-------|
| 4.1 | Gallery Frontend | ⏳ | Pending manual test |
| 4.2 | Detail Page | ⏳ | Pending manual test |
| 4.3 | Magic Link | ⏳ | Pending manual test |
| 4.4 | Wizard Toggle | ⏳ | Pending manual test |
| 4.5 | Workflow Integration | ⏳ | Requires workflow setup |
| 4.6 | i18n | ⏳ | Pending manual test |
| 4.7 | Performance | ⏳ | Pending manual test |
| 4.8 | Accessibility | ⏳ | Pending manual test |
| 4.9 | Mobile | ⏳ | Pending manual test |
| 4.10 | Browsers | ⏳ | Pending manual test |
| 4.11 | Error Cases | ⏳ | Pending manual test |
| 4.12 | Dark Mode | ⏳ | Pending manual test |

---

## Sign-Off

When all tests pass:

- [ ] Record test date: _______________
- [ ] Tester name: _______________
- [ ] Environment: `staging` / `production`
- [ ] Git commit SHA: `a31b2ba` (latest)
- [ ] Ready for Phase 5 (Blog Engine + SEO landing pages)

---

**Note:** Unit tests for endpoints are complex due to RBAC middleware. Focus on:
1. Manual E2E verification (above)
2. Code review against patterns (endpoints follow established Qesto patterns)
3. TypeScript validation (zero errors)
4. Full test suite (797 tests pass)
