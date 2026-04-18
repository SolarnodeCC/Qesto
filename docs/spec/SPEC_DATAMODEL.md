# SPEC_DATAMODEL — Database Schema, KV Patterns, Types

## Overview
Qesto uses **D1 (SQLite)** for persistent data and **7 KV namespaces** for caching, session state, and rate limiting. All types are TypeScript-first with runtime validation via Zod.

---

## D1 Database Schema

**Database**: `qesto-prod` (Cloudflare D1)

### Table: `sessions`
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,              -- 4-digit join code
  team_id TEXT NOT NULL,                  -- FK → implied team table
  owner_id TEXT NOT NULL,                 -- User who created session
  status TEXT NOT NULL,                   -- ENUM: draft, lobby, live, closed, archived
  title TEXT,                             -- Session name
  objective TEXT,                         -- Description/goal
  created_at INTEGER NOT NULL,            -- Unix ms
  started_at INTEGER,                     -- When transitioned to LIVE
  closed_at INTEGER,                      -- When transitioned to CLOSED
  archived_at INTEGER,                    -- When transitioned to ARCHIVED
  
  -- Configuration
  anonymity_mode TEXT,                    -- ENUM: none, partial, full
  timer_default_seconds INTEGER,          -- Default per question
  allow_multiple_votes INTEGER,           -- boolean (0/1)
  show_results_live INTEGER,              -- boolean (0/1)
  
  -- AI & Insights
  ai_summary TEXT,                        -- Generated recap
  ai_summary_generated_at INTEGER,        -- Timestamp
  tags TEXT,                              -- JSON array of auto-tags
  
  -- Session mode
  session_mode TEXT,                      -- ENUM: reflection, fun, null
  presentation_language TEXT,             -- ENUM: en, nl, de, fr, es
  
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  
  INDEX idx_sessions_team (team_id),
  INDEX idx_sessions_owner (owner_id),
  INDEX idx_sessions_status (status),
  INDEX idx_sessions_created (created_at DESC)
);
```

**Row Example**:
```json
{
  "id": "sess_abc123",
  "code": "1234",
  "team_id": "team_xyz",
  "owner_id": "user_john",
  "status": "closed",
  "title": "Q1 Planning",
  "created_at": 1712000000000,
  "started_at": 1712000100000,
  "closed_at": 1712000600000,
  "ai_summary": "Team aligned on 3 priorities...",
  "tags": ["finance", "strategic"]
}
```

---

### Table: `decisions`
```sql
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,               -- FK → sessions
  question_id TEXT,                       -- Question that triggered decision
  selected_option TEXT,                   -- Selected answer/option
  motivation TEXT,                        -- Why this choice
  consent_mode TEXT,                      -- ENUM: yes, objections, blocks, null
  objections TEXT,                        -- JSON array of objections
  decided_by TEXT,                        -- userId of decider (if applicable)
  participant_count INTEGER,              -- # participants who voted
  locked_at INTEGER,                      -- When marked as final
  created_at INTEGER NOT NULL,            -- Unix ms
  updated_at INTEGER,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  
  INDEX idx_decisions_session (session_id),
  INDEX idx_decisions_created (created_at DESC),
  INDEX idx_decisions_team (session_id)   -- Via session join
);
```

**Row Example**:
```json
{
  "id": "dec_abc123",
  "session_id": "sess_abc123",
  "question_id": "q1",
  "selected_option": "Option A",
  "consent_mode": "objections",
  "objections": ["Bob: concerned about timeline"],
  "participant_count": 12,
  "locked_at": 1712000500000,
  "created_at": 1712000300000
}
```

---

### Table: `actions`
```sql
CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,               -- FK → sessions
  decision_id TEXT NOT NULL,              -- FK → decisions
  title TEXT NOT NULL,                    -- Action item title
  owner_email TEXT,                       -- Who owns it
  deadline INTEGER,                       -- Unix ms due date
  status TEXT NOT NULL,                   -- ENUM: open, in_progress, done
  created_at INTEGER NOT NULL,            -- Unix ms
  completed_at INTEGER,
  notes TEXT,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (decision_id) REFERENCES decisions(id),
  
  INDEX idx_actions_session (session_id),
  INDEX idx_actions_decision (decision_id),
  INDEX idx_actions_deadline (deadline),
  INDEX idx_actions_status (status)
);
```

---

### Table: `decision_tags`
```sql
CREATE TABLE decision_tags (
  decision_id TEXT NOT NULL,              -- FK → decisions
  tag TEXT NOT NULL,                      -- Tag value (e.g., "finance", "urgent")
  
  PRIMARY KEY (decision_id, tag),
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id),
  
  INDEX idx_tags_tag (tag)
);
```

---

### Table: `audit_log`
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,                  -- Which team
  user_id TEXT,                           -- Who did it (null = system)
  event_type TEXT NOT NULL,               -- ENUM: session.created, session.started, vote.recorded, etc.
  entity_type TEXT,                       -- e.g., "session", "decision", "user"
  entity_id TEXT,                         -- ID of affected entity
  payload TEXT,                           -- JSON: changes, metadata
  created_at INTEGER NOT NULL,            -- Unix ms
  
  FOREIGN KEY (team_id) REFERENCES teams(id),
  
  INDEX idx_audit_team (team_id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_created (created_at DESC)
);
```

**Row Example**:
```json
{
  "id": "audit_abc123",
  "team_id": "team_xyz",
  "user_id": "user_john",
  "event_type": "decision.locked",
  "entity_type": "decision",
  "entity_id": "dec_abc123",
  "payload": {"old_status": "draft", "new_status": "locked"},
  "created_at": 1712000500000
}
```

---

### Table: `one_time_tokens`
```sql
CREATE TABLE one_time_tokens (
  token TEXT PRIMARY KEY,                 -- Random 32-char string
  user_id TEXT NOT NULL,                  -- FK → users
  kind TEXT NOT NULL,                     -- ENUM: magic_link, password_reset
  expires_at INTEGER NOT NULL,            -- Unix ms
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  
  INDEX idx_ott_expires (expires_at),
  INDEX idx_ott_user (user_id)
);
```

---

### Table: `stripe_webhook_events`
```sql
CREATE TABLE stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,       -- e.g., "evt_1A2B3C..."
  processed_at INTEGER NOT NULL,          -- Unix ms
  event_type TEXT,                        -- e.g., "customer.subscription.created"
  
  INDEX idx_webhook_type (event_type)
);
```

---

## KV Namespaces

### 1. SESSIONS_KV
**Purpose**: Session state, questions, codes, votes, guest invites, admin streams

| Key Pattern | Value Type | TTL | Purpose |
|---|---|---|---|
| `meta:${sessionId}` | JSON SessionState | 30d | Session metadata & config |
| `questions:${sessionId}` | JSON Question[] | 30d | Questions list (draft + live) |
| `code:${code}` | string sessionId | 30d | Lookup session by 4-digit code |
| `async-vote:${sessionId}:${questionId}:${voterId}` | string answer | 8d | Async voting responses |
| `guest_invite:${code}` | JSON {sessionId, email} | 7d | Guest invite details |
| `voted_voters:${sessionId}` | JSON voterId[] | 1d | Dedup map (voted) |
| `admin_stream_ticket:${ticket}` | JSON ticket data | 5m | Live monitoring stream |

**Example**:
```json
// meta:sess_abc123
{
  "id": "sess_abc123",
  "code": "1234",
  "status": "live",
  "questions": 5,
  "currentIndex": 2,
  "timerSeconds": 30,
  "anonymity": "full"
}
```

---

### 2. USERS_KV
**Purpose**: User profiles, plans, rate limits, tokens

| Key Pattern | Value Type | TTL | Purpose |
|---|---|---|---|
| `user:${userId}` | JSON User | 7d | User profile |
| `plan:${userId}` | JSON UserPlan | 1h | User's plan tier & Stripe info |
| `rl_magic:${email}` | int count | 15m | Rate limit: magic link requests |
| `rl_login:${email}` | int count | 15m | Rate limit: password login attempts |
| `session_token:${token}` | JSON {userId, exp} | 30d | JWT validation cache |
| `mcp_token:${token}` | JSON {userId, scope, exp} | 365d | MCP API token metadata |
| `email:${email}` | string userId | 7d | Email → userId reverse index |

**Example**:
```json
// user:user_abc123
{
  "id": "user_abc123",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:00:00Z",
  "lang": "en",
  "avatar": "https://..."
}

// plan:user_abc123
{
  "planId": "team",
  "stripeCustomerId": "cus_123",
  "stripeSubId": "sub_123",
  "billingInterval": "month",
  "currentPeriodEnd": 1712000000000,
  "cancelAtPeriodEnd": false,
  "updatedAt": 1712000000000
}
```

---

### 3. TEAMS_KV
**Purpose**: Team info, members, invites

| Key Pattern | Value Type | TTL | Purpose |
|---|---|---|---|
| `team:${teamId}` | JSON Team | 7d | Team metadata |
| `user_teams:${userId}` | JSON teamId[] | 7d | User's team membership |
| `invite:${token}` | JSON {teamId, email, role, exp} | 30d | Team invitation |

**Example**:
```json
// team:team_xyz
{
  "id": "team_xyz",
  "name": "Acme Corp",
  "ownerId": "user_john",
  "members": [
    {"userId": "user_john", "role": "owner", "email": "john@acme.com"},
    {"userId": "user_jane", "role": "member", "email": "jane@acme.com"}
  ],
  "createdAt": 1712000000000
}
```

---

### 4. TEMPLATES_KV
**Purpose**: User & team templates

| Key Pattern | Value Type | TTL | Purpose |
|---|---|---|---|
| `template:${templateId}` | JSON Template | 30d | Template questions + config |

**Example**:
```json
// template:tmpl_abc123
{
  "id": "tmpl_abc123",
  "createdBy": "user_john",
  "teamId": "team_xyz",
  "name": "Weekly Planning",
  "questions": [...],
  "config": {...},
  "createdAt": 1712000000000
}
```

---

### 5. DECISIONS_KV
**Purpose**: Decision cache (legacy, mostly in D1 now)

| Key Pattern | Value Type | TTL | Purpose |
|---|---|---|---|
| `decisions:${teamId}:${page}` | JSON Decision[] | 1d | Paginated decisions list |

---

### 6. AUDIT_KV
**Purpose**: Audit log cache

| Key Pattern | Value Type | TTL | Purpose |
|---|---|---|---|
| `audit:${teamId}:${month}` | JSON AuditEntry[] | 90d | Monthly audit cache |

---

### 7. ACTIONS_KV
**Purpose**: Action items cache

| Key Pattern | Value Type | TTL | Purpose |
|---|---|---|---|
| `actions:${teamId}` | JSON Action[] | 7d | Team action items |
| `actions:${decisionId}` | JSON Action[] | 7d | Decision's actions |

---

## Core TypeScript Types

### User
```typescript
interface User {
  id: string
  email: string
  name: string
  createdAt: string
  lang?: 'en' | 'nl' | 'de' | 'fr' | 'es'
  avatar?: string
  hasPassword: boolean
  adminRole?: 'super_admin' | 'admin' | 'viewer'
}
```

### UserPlan
```typescript
interface UserPlan {
  planId: 'free' | 'starter' | 'team' | 'enterprise'
  stripeCustomerId?: string
  stripeSubId?: string
  billingInterval?: 'month' | 'year'
  currentPeriodEnd?: number  // Unix ms
  cancelAtPeriodEnd?: boolean
  updatedAt: number
}
```

### Team
```typescript
interface Team {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  createdAt: number
  ssoEnabled?: boolean
}

interface TeamMember {
  userId: string
  role: 'owner' | 'member' | 'viewer'
  email?: string
  name?: string
  addedAt?: number
}
```

### SessionState (Live, in DO)
```typescript
interface SessionState {
  id: string
  code: string
  questions: Question[]
  currentQuestionIndex: number
  status: 'draft' | 'lobby' | 'live' | 'closed' | 'archived'
  
  // Results
  answers: Record<string, string | number>  // voterId → answer
  results: Record<string, number>            // option → vote count
  resultTotal: number
  voterNames: Record<string, string>         // voterId → name (presenter only)
  
  // Config
  anonymityMode: 'none' | 'partial' | 'full'
  timerDefault?: number  // seconds
  allowMultipleVotes?: boolean
  presentationLanguage?: string
  
  // Metadata
  title?: string
  objective?: string
  createdAt: number
  startedAt?: number
  closedAt?: number
}
```

### Question
```typescript
interface Question {
  id: string
  type: 'multiple_choice' | 'open' | 'scale' | 'ranking' 
       | 'point_allocation' | 'consent' | 'wordcloud'
  text: string
  options?: string[]        // For multiple_choice
  min?: number              // For scale
  max?: number
  timerSeconds?: number
  correctIndex?: number     // For quiz mode
  totalPoints?: number      // For point allocation
}
```

### Decision
```typescript
interface Decision {
  id: string
  sessionId: string
  questionId: string
  selectedOption: string
  motivation?: string
  consentMode?: 'yes' | 'objections' | 'blocks'
  objections?: string[]
  lockedAt?: number
  createdAt: number
}
```

### Action
```typescript
interface Action {
  id: string
  sessionId: string
  decisionId: string
  title: string
  ownerEmail?: string
  deadline?: number
  status: 'open' | 'in_progress' | 'done'
  notes?: string
  createdAt: number
  completedAt?: number
}
```

### UserPlan (billing)
```typescript
interface UserPlan {
  planId: 'free' | 'starter' | 'team' | 'enterprise'
  sessionsPerMonth: number
  maxParticipants: number
  features: string[]  // ['integrations', 'ai', 'sso']
  stripeSubId?: string
  currentPeriodEnd?: number
}
```

**Plan Limits**:
| Plan | Sessions/mo | Max Participants | Features |
|---|---|---|---|
| **Free** | 5 | 50 | Basic polling |
| **Starter** | 50 | 500 | Slack, basic AI |
| **Team** | Unlimited | 5000 | All integrations |
| **Enterprise** | Unlimited | 10000 | SSO, audit, SLA |

---

## Indices & Performance

**D1 Query Optimization**:
```sql
-- Fast session lookup
CREATE INDEX idx_sessions_team ON sessions(team_id);
CREATE INDEX idx_sessions_owner ON sessions(owner_id);
CREATE INDEX idx_sessions_created ON sessions(created_at DESC);

-- Fast decision queries
CREATE INDEX idx_decisions_session ON decisions(session_id);
CREATE INDEX idx_decisions_created ON decisions(created_at DESC);

-- Fast audit queries
CREATE INDEX idx_audit_team ON audit_log(team_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Token cleanup
CREATE INDEX idx_ott_expires ON one_time_tokens(expires_at);
```

---

## Validation & Constraints

All user input validated via **Zod** schemas before DB writes:

```typescript
// Example: Create session schema
const CreateSessionSchema = z.object({
  title: z.string().min(3).max(200),
  teamId: z.string().uuid(),
  anonymityMode: z.enum(['none', 'partial', 'full']).optional(),
  timerDefault: z.number().min(10).max(300).optional(),
})
```

See [[SPEC_BACKEND.md#validation]] for all schemas.

---

## Migration Pattern

New columns added via migration files in `/migrations/`:

```sql
-- migrations/006_add_session_tags.sql
ALTER TABLE sessions ADD COLUMN tags TEXT DEFAULT '[]';
CREATE INDEX idx_sessions_tags ON sessions(tags);
```

Applied on deploy: `wrangler d1 migrations apply qesto-prod --remote`

---

## Related References

- [[SPEC_CORE.md#session-state-machine]] — Session lifecycle
- [[SPEC_REALTIME.md#session-room-do]] — DO state structure
- [[SPEC_BACKEND.md#database-operations]] — Query patterns
