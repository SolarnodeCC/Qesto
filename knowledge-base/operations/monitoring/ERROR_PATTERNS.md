---
id: RUNBOOK-ERROR_PATTERNS
type: runbook
category: incident
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - incident-response
  - operations
  - procedures
relates_to:
  - OBSERVABILITY
---

# Error Patterns & UX Treatment (Sprint 18 - ID 20)

_Hub: [Documentation map](./README.md)._

## Overview

All API errors follow a standardized format that maps error codes to user-friendly messages, icons, and suggested actions. This ensures consistent error communication across the platform and reduces support tickets.

**KPI: -20% support tickets** (measure via "unclear error" category in support logs)

---

## Error Taxonomy

### System Errors (500s)

#### SYSTEM_INTERNAL_ERROR
- **HTTP Status:** 500
- **Message:** "Something went wrong"
- **Icon:** ⚠️ (error)
- **Actions:** Retry + Contact Support
- **Retryable:** Yes
- **When:** Unexpected exceptions, uncaught errors
- **Example:** Database query throws, async operation fails

#### SYSTEM_DATABASE_ERROR
- **HTTP Status:** 500
- **Message:** "We're having trouble accessing our database"
- **Icon:** ⚠️ (error)
- **Actions:** Retry
- **Retryable:** Yes
- **When:** D1 connection fails, transaction rollback

#### SYSTEM_EXTERNAL_SERVICE_ERROR
- **HTTP Status:** 502
- **Message:** "A service we depend on is temporarily unavailable"
- **Icon:** ⚡ (warning)
- **Actions:** Retry
- **Retryable:** Yes
- **When:** Stripe API down, Workers AI timeout, Email service failure

#### SYSTEM_TIMEOUT
- **HTTP Status:** 504
- **Message:** "The server took too long to respond"
- **Icon:** ⚡ (warning)
- **Actions:** Retry
- **Retryable:** Yes
- **When:** Query exceeds 30s limit, DO call times out
- **Trigger:** Error message contains "timeout" (case-insensitive)

#### SYSTEM_UNAVAILABLE
- **HTTP Status:** 503
- **Message:** "We're performing maintenance. Please check back shortly"
- **Icon:** ℹ️ (info)
- **Retryable:** Yes
- **When:** Planned maintenance, scale-down events

---

### User Errors (4xx)

#### USER_ERR_INVALID_INPUT
- **HTTP Status:** 400
- **Message:** "Please check your input and try again"
- **Icon:** ⚡ (warning)
- **Retryable:** No
- **When:** Missing required fields, invalid email format
- **Example:** `{ name: "" }`

#### USER_ERR_OPERATION_FAILED
- **HTTP Status:** 400
- **Message:** "The requested operation could not be completed"
- **Icon:** ⚡ (warning)
- **Actions:** Retry
- **Retryable:** Yes
- **When:** Business logic constraint violated (non-specific)

#### USER_ERR_RESOURCE_NOT_FOUND
- **HTTP Status:** 404
- **Message:** "The resource you're looking for doesn't exist"
- **Icon:** ⚡ (warning)
- **Retryable:** No
- **When:** Session ID doesn't exist, team not found
- **Example:** `GET /sessions/invalid-id`

#### USER_ERR_ALREADY_EXISTS
- **HTTP Status:** 409
- **Message:** "This item already exists. Please choose a different name"
- **Icon:** ⚡ (warning)
- **Retryable:** No
- **When:** Unique constraint violation (email, team name)

#### USER_ERR_PERMISSION_DENIED
- **HTTP Status:** 403
- **Message:** "You don't have permission to perform this action"
- **Icon:** ⚡ (warning)
- **Actions:** Request Access
- **Retryable:** No
- **When:** Team member tries viewer-only action

#### USER_ERR_RATE_LIMIT_EXCEEDED
- **HTTP Status:** 429
- **Message:** "You've made too many requests. Please slow down"
- **Icon:** ⚡ (warning)
- **Actions:** Retry in 30 seconds
- **Retryable:** Yes
- **When:** Per-IP, per-user request quota exceeded

#### USER_ERR_PLAN_LIMIT_REACHED
- **HTTP Status:** 402
- **Message:** "You've reached your plan limit. Upgrade to continue"
- **Icon:** ⚡ (warning)
- **Actions:** Upgrade Plan → `/settings/billing`
- **Retryable:** No
- **When:** Feature gated by plan (max sessions, participants)

#### USER_ERR_QUOTA_EXCEEDED
- **HTTP Status:** 402
- **Message:** "You've exceeded your quota for this feature"
- **Icon:** ⚡ (warning)
- **Actions:** Upgrade Plan
- **Retryable:** No
- **When:** Monthly API calls, storage quota exceeded

---

### Authentication Errors (401/403)

#### AUTH_UNAUTHORIZED
- **HTTP Status:** 401
- **Message:** "Please log in to continue"
- **Icon:** ⚡ (warning)
- **Actions:** Log In → `/login`
- **Retryable:** No
- **When:** No JWT token, expired token
- **Trigger:** Error message contains "unauthorized" or "not authenticated"

#### AUTH_INVALID_CREDENTIALS
- **HTTP Status:** 401
- **Message:** "The email or password you entered is incorrect"
- **Icon:** ⚡ (warning)
- **Actions:** Try Again, Forgot Password?
- **Retryable:** No
- **When:** Login endpoint with wrong password

#### AUTH_SESSION_EXPIRED
- **HTTP Status:** 401
- **Message:** "Your session has expired. Please log in again"
- **Icon:** ⚡ (warning)
- **Actions:** Log In
- **Retryable:** No
- **When:** JWT refresh fails, session revoked

#### AUTH_FORBIDDEN
- **HTTP Status:** 403
- **Message:** "You don't have permission to access this resource"
- **Icon:** ⚡ (warning)
- **Actions:** Request Access
- **Retryable:** No
- **When:** Team access revoked, SAML group mismatch

#### AUTH_INSUFFICIENT_PERMISSIONS
- **HTTP Status:** 403
- **Message:** "Your account doesn't have the required permissions"
- **Icon:** ⚡ (warning)
- **Actions:** Request Upgrade
- **Retryable:** No
- **When:** Feature requires admin, custom roles not available

---

### Validation Errors (422)

All validation errors map to HTTP 422 (Unprocessable Entity).

#### VALIDATION_REQUIRED_FIELD
- **Message:** "Please fill in all required fields"
- **When:** Missing name, email, or title

#### VALIDATION_INVALID_FORMAT
- **Message:** "Please enter data in the correct format"
- **When:** Email format invalid, date parsing fails
- **Example:** `"invalid-email"` for email field

#### VALIDATION_INVALID_VALUE
- **Message:** "One or more fields contain invalid values"
- **When:** Generic validation failure
- **Trigger:** Error name === "ValidationError"

#### VALIDATION_CONSTRAINT_VIOLATION
- **Message:** "The data you entered violates a constraint"
- **When:** Business rule violated (e.g., negative numbers where only positive allowed)

---

### Business Logic Errors (409/400)

#### BUSINESS_INVALID_STATE_TRANSITION
- **HTTP Status:** 409
- **Message:** "This action cannot be performed in the current state"
- **Icon:** ⚡ (warning)
- **Retryable:** No
- **When:** Try to close already-closed session, start ARCHIVED session
- **Example:** POST `/sessions/{id}/start` when status != DRAFT

#### BUSINESS_CONFLICT
- **HTTP Status:** 409
- **Message:** "This action conflicts with the current state"
- **Icon:** ⚡ (warning)
- **Retryable:** No
- **When:** Concurrent update, race condition on state machine

#### BUSINESS_PRECONDITION_FAILED
- **HTTP Status:** 400
- **Message:** "Some prerequisites for this action are not met"
- **Icon:** ⚡ (warning)
- **Retryable:** No
- **When:** Can't add decisions to session with no questions

---

## Using ErrorAlert Component

### Basic Usage

```tsx
import { useEffect, useState } from 'react'
import { ErrorAlert } from '@/components/ErrorAlert'
import type { ErrorResponse } from '@/api/types/errors'

export function MyPage() {
  const [error, setError] = useState<ErrorResponse | null>(null)

  const handleSubmit = async (data: FormData) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json() as ErrorResponse
        setError(errorData)
        return
      }
      
      // Success
    } catch (err) {
      setError({
        type: 'error',
        code: 'SYSTEM_INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: crypto.randomUUID(),
      })
    }
  }

  return (
    <>
      <ErrorAlert
        error={error}
        onDismiss={() => setError(null)}
        autoClose={true}
        autoCloseDuration={5000}
      />
      {/* Rest of form */}
    </>
  )
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `ErrorResponse \| null` | required | Error object to display, or null to hide |
| `onDismiss` | `() => void` | undefined | Callback when user clicks dismiss or auto-close fires |
| `autoClose` | `boolean` | `true` | Automatically dismiss after duration |
| `autoCloseDuration` | `number` | `5000` | Milliseconds before auto-close |

### Features

- **Smart Icons:** Error (⚠️), Warning (⚡), Info (ℹ️)
- **Color Coding:** Red for errors, amber for warnings, blue for info
- **Suggested Actions:** Clickable buttons for common actions (Retry, Log In, Upgrade)
- **Request ID:** Visible in small text for debugging/support reference
- **Technical Details:** Dev-only error details shown in production mode
- **Accessibility:** Semantic HTML, ARIA labels, keyboard dismissible

---

## Integrating with API Client

### Example: Fetch Wrapper

```typescript
import type { ErrorResponse } from '@/api/types/errors'

export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options)

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse
    throw error
  }

  return response.json() as Promise<T>
}

// Usage
try {
  const session = await apiCall('/api/sessions/123')
} catch (error) {
  setError(error as ErrorResponse)
}
```

---

## Reducing Support Tickets

### Measurement

**Baseline:** Count support tickets in "unclear error" category weekly

**Target:** -20% reduction within 8 weeks

**Tracking:**
- Error code distribution (which errors most common?)
- User searches for error codes in docs
- Session replay of error scenarios
- Support ticket categorization by error type

### Common High-Value Fixes

1. **AUTH_UNAUTHORIZED** → Add login link in error message
   - Before: "401 Unauthorized"
   - After: "Please log in to continue" + Log In button

2. **USER_ERR_PLAN_LIMIT_REACHED** → Add upgrade link
   - Before: "Plan limit exceeded"
   - After: "Plan limit reached" + Upgrade Plan button → `/settings/billing`

3. **BUSINESS_INVALID_STATE_TRANSITION** → Explain what happened
   - Before: "Invalid state transition"
   - After: "This session is already started. Close it first to restart."

4. **VALIDATION_INVALID_VALUE** → Show which field failed
   - Delegate to form-level validation to show field-specific errors

---

## Error Code Reference

| Code | Status | User Action | Retryable |
|------|--------|-------------|-----------|
| SYSTEM_INTERNAL_ERROR | 500 | Retry + Support | ✅ |
| SYSTEM_TIMEOUT | 504 | Retry | ✅ |
| SYSTEM_UNAVAILABLE | 503 | Wait + Retry | ✅ |
| USER_ERR_INVALID_INPUT | 400 | Fix input | ❌ |
| USER_ERR_RESOURCE_NOT_FOUND | 404 | Navigate away | ❌ |
| USER_ERR_RATE_LIMIT_EXCEEDED | 429 | Wait + Retry | ✅ |
| USER_ERR_PLAN_LIMIT_REACHED | 402 | Upgrade | ❌ |
| AUTH_UNAUTHORIZED | 401 | Log in | ❌ |
| AUTH_SESSION_EXPIRED | 401 | Log in | ❌ |
| AUTH_FORBIDDEN | 403 | Request access | ❌ |
| VALIDATION_INVALID_VALUE | 422 | Fix input | ❌ |
| BUSINESS_CONFLICT | 409 | Refresh + Retry | ✅ |
| BUSINESS_INVALID_STATE_TRANSITION | 409 | Verify state | ❌ |

---

## Testing Error States

### Unit Test Example

```typescript
import { render, screen } from '@testing-library/react'
import { ErrorAlert } from '@/components/ErrorAlert'

it('displays auth error with login action', () => {
  const error = {
    type: 'error',
    code: 'AUTH_UNAUTHORIZED',
    message: 'Please log in to continue',
    requestId: 'test-id',
  }

  render(<ErrorAlert error={error} />)

  expect(screen.getByText('Authentication required')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login')
})
```

### E2E Test Example

```typescript
it('shows error when session not found', async () => {
  await page.goto('/sessions/invalid-id')
  
  await expect(page.locator('text=Not found')).toBeVisible()
  await expect(page.locator('text=The resource you\'re looking for doesn\'t exist')).toBeVisible()
})
```

---

## References

- **Error Types:** `functions/api/types/errors.ts`
- **Error Patterns:** `src/lib/errorPatterns.ts`
- **Error Middleware:** `functions/api/middleware/errorHandler.ts`
- **ErrorAlert Component:** `src/components/ErrorAlert.tsx`
- **Tests:** `tests/unit/middleware/errorHandler.test.ts`
