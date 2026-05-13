# Help Assistant API Specification

**Base URL:** `https://qesto.cc/api`

**Authentication:** Bearer token (JWT) via `Authorization` header

**Response Format:** JSON with envelope structure per SPEC_BACKEND.md

---

## Endpoints

### POST /help/ask
Ask the help assistant a question and get a RAG-enhanced answer.

**Authentication:** Required (user)
**Rate Limit:** 10 requests/minute per user
**Timeout:** 20 seconds

#### Request

```json
{
  "question": "How do I create a session?"
}
```

**Parameters:**
- `question` (string, required): User's question, 1-500 characters
  - Trimmed automatically
  - Max 500 chars enforced

#### Response (200 OK)

```json
{
  "ok": true,
  "data": {
    "answer": "To create a session, go to your dashboard and click 'New Session'. You can choose question types like polls, rankings, or open questions. Set your session name, add questions, and click 'Start' when ready.",
    "sources": [
      {
        "documentId": "doc-getting-started-1",
        "title": "Creating Your First Session",
        "relevance": 0.92
      },
      {
        "documentId": "doc-features-1",
        "title": "Question Types Overview",
        "relevance": 0.87
      }
    ]
  },
  "trace_id": "abc123def456"
}
```

**Fields:**
- `answer` (string): AI-generated answer (2-3 sentences, <512 tokens)
- `sources` (array): Retrieved documents used for RAG
  - `documentId`: Reference to help_documents table
  - `title`: Human-readable document title
  - `relevance`: Similarity score (0-1.0, min 0.70)

#### Response (400 Bad Request)

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Question must be 1-500 characters"
  },
  "trace_id": "abc123def456"
}
```

#### Response (429 Too Many Requests)

```json
{
  "ok": false,
  "error": {
    "code": "rate_limited",
    "message": "Too many questions; please wait before asking again",
    "details": {
      "retry_after_seconds": 45
    }
  },
  "trace_id": "abc123def456"
}
```

**Retry-After:** Header will include `Retry-After: 45` seconds

#### Response (502 Bad Gateway) - AI Output Invalid

```json
{
  "ok": false,
  "error": {
    "code": "ai_output_invalid",
    "message": "AI response failed validation",
    "details": {
      "reason": "response_too_short"
    }
  },
  "trace_id": "abc123def456"
}
```

#### Response (500 Internal Server Error)

```json
{
  "ok": false,
  "error": {
    "code": "ai_failed",
    "message": "AI invocation failed: Mistral request timed out"
  },
  "trace_id": "abc123def456"
}
```

---

### POST /help/feedback
Submit feedback on a help response to improve the system.

**Authentication:** Required (user)
**Rate Limit:** No explicit limit (implicit through general API rate limits)
**Timeout:** 5 seconds

#### Request

```json
{
  "documentId": "doc-getting-started-1",
  "helpful": true,
  "feedbackText": "This was exactly what I needed!"
}
```

**Parameters:**
- `documentId` (string, required): ID of the document used in response
- `helpful` (boolean, required): Was the response helpful?
- `feedbackText` (string, optional): Additional user comment, max 500 chars

#### Response (200 OK)

```json
{
  "ok": true,
  "data": {
    "feedback_id": "feedback-1715609820000-a1b2c3d"
  },
  "trace_id": "abc123def456"
}
```

#### Response (400 Bad Request)

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Missing required fields: documentId, helpful"
  },
  "trace_id": "abc123def456"
}
```

#### Response (500 Internal Server Error)

```json
{
  "ok": false,
  "error": {
    "code": "internal_error",
    "message": "Failed to store feedback"
  },
  "trace_id": "abc123def456"
}
```

---

## Admin Endpoints

**Prefix:** `/api/admin/help`

**Authentication:** Required (admin/owner role)

---

### GET /admin/help/review-queue
List documents flagged for review (3+ downvotes in 7 days).

**Authentication:** Admin role required
**Timeout:** 5 seconds

#### Response (200 OK)

```json
{
  "ok": true,
  "data": {
    "flagged_documents": [
      {
        "reviewId": "review-1715609820000-a1b2c3d",
        "documentId": "doc-billing-upgrade",
        "title": "How to Upgrade Your Plan",
        "topic": "billing",
        "scope": "team",
        "downvoteCount": 3,
        "recentDownvotes": 2,
        "flaggedAt": 1715609820,
        "reviewedAt": null,
        "reviewedBy": null,
        "action": null
      }
    ]
  },
  "trace_id": "abc123def456"
}
```

**Fields:**
- `downvoteCount`: Total downvotes in 7-day window when flagged
- `recentDownvotes`: Current downvotes (may have changed)
- `reviewedAt`: Unix timestamp when resolved (null = pending)
- `action`: Resolution action (null | "prompt_updated" | "doc_revised" | "dismissed")

---

### GET /admin/help/prompt-versions
List all system prompt versions.

**Authentication:** Admin role required
**Timeout:** 5 seconds

#### Query Parameters
- `limit` (integer, optional): Results per page, default 50, max 100
- `offset` (integer, optional): Pagination offset, default 0

#### Response (200 OK)

```json
{
  "ok": true,
  "data": {
    "versions": [
      {
        "id": "prompt-1715609820000-xyz",
        "version": 2,
        "topic": "billing",
        "triggerEvent": "auto_tune_3_downvotes",
        "triggeredBy": "system",
        "active": true,
        "createdAt": 1715609820
      },
      {
        "id": "prompt-1715609700000-abc",
        "version": 1,
        "topic": "billing",
        "triggerEvent": "manual_admin",
        "triggeredBy": "user-admin-123",
        "active": false,
        "createdAt": 1715609700
      }
    ]
  },
  "trace_id": "abc123def456"
}
```

---

### POST /admin/help/prompt-versions
Create a new system prompt version.

**Authentication:** Admin role required
**Timeout:** 5 seconds

#### Request

```json
{
  "content": "You are Qesto Help...",
  "topic": "billing",
  "trigger_event": "manual_admin"
}
```

**Parameters:**
- `content` (string, required): Full system prompt (1-10,000 chars)
- `topic` (string, optional): Topic scope ("billing", "troubleshooting", null for global)
- `trigger_event` (string, optional): "manual_admin" or "auto_tune_3_downvotes", default "manual_admin"

#### Response (201 Created)

```json
{
  "ok": true,
  "data": {
    "prompt_id": "prompt-1715609900000-xyz",
    "version": 3,
    "content": "You are Qesto Help...",
    "topic": "billing",
    "trigger_event": "manual_admin",
    "active": false,
    "created_at": 1715609900
  },
  "trace_id": "abc123def456"
}
```

**Note:** New versions are created as inactive. Use activation endpoint to promote.

---

### GET /admin/help/prompt-versions/:id
Fetch a specific prompt version.

**Authentication:** Admin role required
**Timeout:** 5 seconds

#### Response (200 OK)

```json
{
  "ok": true,
  "data": {
    "id": "prompt-1715609820000-xyz",
    "version": 2,
    "content": "You are Qesto Help...",
    "topic": "billing",
    "triggerEvent": "auto_tune_3_downvotes",
    "triggeredBy": "system",
    "active": true,
    "createdAt": 1715609820
  },
  "trace_id": "abc123def456"
}
```

#### Response (404 Not Found)

```json
{
  "ok": false,
  "error": {
    "code": "not_found",
    "message": "Prompt version not found"
  },
  "trace_id": "abc123def456"
}
```

---

### POST /admin/help/documents/dismiss-flag
Mark a review as complete with action taken.

**Authentication:** Admin role required
**Timeout:** 5 seconds

#### Request

```json
{
  "documentId": "doc-billing-upgrade",
  "action": "prompt_updated"
}
```

**Parameters:**
- `documentId` (string, required): Document being reviewed
- `action` (string, required): One of "prompt_updated", "doc_revised", "dismissed"

#### Response (200 OK)

```json
{
  "ok": true,
  "data": {
    "resolved_at": 1715609850
  },
  "trace_id": "abc123def456"
}
```

**Note:** Removes entry from help_documents_review_queue.

---

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `bad_request` | 400 | Malformed JSON or missing required fields |
| `validation_error` | 400 | Invalid field values (e.g., question too long) |
| `rate_limited` | 429 | User exceeded rate limit (10 req/min) |
| `ai_output_invalid` | 502 | AI response failed validation |
| `ai_failed` | 500 | AI service error (embedding, Mistral) |
| `internal_error` | 500 | Database or unexpected error |
| `not_found` | 404 | Resource not found |
| `unauthenticated` | 401 | Missing or invalid bearer token |
| `forbidden` | 403 | User lacks required permissions (admin role) |

---

## Latency Targets

### P50 (Median)
- **POST /help/ask:** <2 seconds
  - Embedding: 500-800ms
  - Vectorize query: 200-400ms
  - Mistral inference: 1-1.5s
  - Overhead: 100-200ms

### P95 (95th Percentile)
- **POST /help/ask:** <5 seconds
  - Includes slow embedding or Mistral inference
  - May include 1 retry attempt

### P99 (99th Percentile)
- **POST /help/ask:** <10 seconds
  - Worst case: multiple retries, slow model inference

---

## Rate Limiting

**Endpoint:** POST /help/ask

**Limit:** 10 requests per minute per user

**Tracking:** Via ACTIONS_KV with key format `help-ask:{user_id}`

**Response When Limited:**
```
HTTP 429 Too Many Requests
Retry-After: 45

{
  "ok": false,
  "error": {
    "code": "rate_limited",
    "details": { "retry_after_seconds": 45 }
  }
}
```

---

## Examples

### Example 1: Ask a Question

```bash
curl -X POST https://qesto.cc/api/help/ask \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I add team members?"}' \
  | jq .
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "answer": "Go to your team settings and click 'Invite Members'. Enter their email addresses and select their role (member or viewer). They'll receive an invitation link.",
    "sources": [
      {
        "documentId": "doc-team-management-1",
        "title": "Managing Team Members",
        "relevance": 0.95
      }
    ]
  },
  "trace_id": "req-123abc"
}
```

### Example 2: Submit Feedback

```bash
curl -X POST https://qesto.cc/api/help/feedback \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "doc-team-management-1",
    "helpful": true,
    "feedbackText": "Clear and helpful instructions"
  }' \
  | jq .
```

### Example 3: Admin - Review Flagged Documents

```bash
curl https://qesto.cc/api/admin/help/review-queue \
  -H "Authorization: Bearer eyJ..." \
  | jq .
```

### Example 4: Admin - Create New Prompt Version

```bash
curl -X POST https://qesto.cc/api/admin/help/prompt-versions \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated system prompt...",
    "topic": "billing",
    "trigger_event": "manual_admin"
  }' \
  | jq .
```

---

## Changelog

### Week 5 (MVP)
- ✅ POST /help/ask - Question answering
- ✅ POST /help/feedback - User feedback submission
- ✅ GET /admin/help/review-queue - Review flagged documents
- ✅ GET /admin/help/prompt-versions - List versions
- ✅ POST /admin/help/prompt-versions - Create version
- ✅ GET /admin/help/prompt-versions/:id - Get version
- ✅ POST /admin/help/documents/dismiss-flag - Resolve review

### Future
- [ ] PATCH /admin/help/prompt-versions/:id/activate - Activate version
- [ ] POST /help/conversations/:id/close - End conversation
- [ ] GET /help/history - Retrieve conversation history
- [ ] Streaming responses for POST /help/ask
