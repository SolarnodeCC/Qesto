---
id: SPEC-REALTIME
type: specification
domain: realtime
category: websocket
status: active
version: 1.5
created: 2026-03-01
updated: 2026-05-11
audience:
  - Backend engineer
  - Frontend engineer
  - Architect
tags:
  - durable-objects
  - websocket
  - realtime
  - session-room
  - protocol
  - streaming
relates_to:
  - SPEC_BACKEND
  - SPEC_FRONTEND
  - SPEC_DATAMODEL
  - ADR-0001-do-per-session
  - ADR-0005-do-protocol-versioning
  - ADR-DO-TIMERS
---

# SPEC_REALTIME — WebSocket, Durable Objects, Live Sessions

_Repository hub: [Documentation map](../README.md)._

## Doc contract
Message `type` strings + roles = **wire contract**; **SessionRoom.ts** wins on extra fields until spec updated.

**LIVE spike (pre-build):** acceptance checklist → [includes/PREBUILD_AND_DELIVERY.md#live-spike-acceptance](includes/PREBUILD_AND_DELIVERY.md#live-spike-acceptance).

## Readers (multi-lens · **Architect** = **Primary** for consistency)

| Role | Use this doc to… |
|------|------------------|
| **Architect** | **Primary** — single-writer **DO**, fan-out, dedup/fraud posture, session **modes** matrix. |
| **Backend Developer** | **Lead** — `SessionRoom` state machine, handlers, DO admin HTTP, debounce/broadcast. |
| **Frontend Developer** | `useSession` ↔ wire `type`s; reconnect backoff; presenter subprotocol JWT. |
| **UI specialist** | Timer + results tick UX; respect `prefers-reduced-motion` on live animations. |
| **Cloudflare specialist** | DO storage + alarms, WS limits/hibernation, regional placement assumptions. |
| **API & middleware specialist** | `GET …/ws` upgrade, close codes, emoji rate limits; no REST mutations in LIVE. |

## Overview
Real-time live sessions powered by **Durable Objects** (SessionRoom). One DO per session in LIVE state. WebSocket protocol defines message contracts. Voter deduplication prevents fraud.

## Wire format (normative)

- Transport: **`GET` WebSocket Upgrade** to `/api/sessions/:id/ws` (see [[SPEC_BACKEND.md]] §2).
- Payload: **JSON text frames**, one object per message.
- `type` values: **lowercase strings** as in examples (`vote`, `advance`, `results_updated`). TypeScript `enum` labels below are a **taxonomy** — wire strings match the **example JSON**, not necessarily the enum *member names*.

---

## WebSocket Protocol

**Connection URL** (replace host with `APP_URL` / deployment): `wss://<host>/api/sessions/:sessionId/ws`

**Handshake**:
```http
GET /api/sessions/:sessionId/ws HTTP/1.1
Upgrade: websocket
Sec-WebSocket-Key: ...
Sec-WebSocket-Protocol: qesto.bearer.${JWT}  // Presenter auth
```

Presenter upgrades are authorized by `/api/sessions/:id/ws` before the request reaches the Durable Object. For team sessions, the route resolves effective permissions from team membership and custom roles, then forwards that server-side list internally to `SessionRoom`. Clients must not be trusted to supply energizer permissions directly.

**Close Codes**:
- `1000`: Normal close (session ended)
- `1008`: Policy violation (dedup check failed)
- `1011`: Server error (DO crashed)

---

## WebSocket Messages

### ClientMessage (voter/presenter → server)

```typescript
interface ClientMessage {
  type: ClientMessageType
  data: Record<string, any>
  timestamp: number  // Client timestamp (for latency tracking)
}

enum ClientMessageType {
  // Voting
  VOTE = 'vote',                    // {questionId, selectedIndex, selectedOption?}
  VOTE_MULTIPLE = 'vote_multiple',  // {questionId, selectedIndices: []}
  VOTE_RANK = 'vote_rank',         // {questionId, rank: [option]}
  VOTE_SCALE = 'vote_scale',       // {questionId, value: 1-10}
  VOTE_ALLOCATION = 'vote_allocation', // {questionId, allocation: {option: points}}
  
  // Feedback
  FEEDBACK = 'feedback',            // {text, anonymous: bool}
  EMOJI = 'emoji',                 // {emoji: '👍'|'💡'|'😂'|'🤔'|'🙋'}
  
  // Presenter Only
  ADVANCE = 'advance',              // {} (next question)
  RETREAT = 'retreat',              // {} (previous question)
  LOCK = 'lock',                   // {locked: bool}
  TIMER_START = 'timer_start',     // {durationSeconds: 30}
  TIMER_CANCEL = 'timer_cancel',   // {}
  SET_NAME = 'set_name',           // {name: string} (presenter only, see voter names)
  
  // Special Modes
  SPEED_ROUND_START = 'speed_round_start',  // {}
  SPEED_ROUND_NEXT = 'speed_round_next',    // {}
  TEAM_MODE_INIT = 'team_mode_init',        // {teams: [], colors: {}}
  
  // Async Voting
  ASYNC_VOTE = 'async_vote',       // {questionId, selectedIndex}

  // LIVE Energizers
  ENERGIZER_ACTIVATE = 'energizer_activate', // {kind: 'quick_finger'|'team_quiz', config?}
  ENERGIZER_ANSWER = 'energizer_answer',     // {answerIndex?}
  ENERGIZER_ADVANCE = 'energizer_advance',   // {}
}
```

**Example Messages**:
```json
// Voter votes on multiple choice
{
  "type": "vote",
  "data": {
    "questionId": "q1",
    "selectedIndex": 2
  },
  "timestamp": 1712000000100
}

// Presenter advances to next question
{
  "type": "advance",
  "data": {},
  "timestamp": 1712000000200
}

// Voter reacts with emoji
{
  "type": "emoji",
  "data": {"emoji": "👍"},
  "timestamp": 1712000000150
}
```

---

### ServerMessage (server → client)

```typescript
interface ServerMessage {
  type: ServerMessageType
  data: Record<string, any>
  timestamp: number  // Server timestamp
}

enum ServerMessageType {
  // Initialization
  INIT = 'init',                    // {session, question, results}
  RECONNECT = 'reconnect',          // {question, results} (after disconnect)
  
  // Live Updates
  QUESTION = 'question',            // {question, index, total}
  RESULTS = 'results',              // {results: {option: count}, total}
  RESULTS_UPDATED = 'results_updated',  // Incremental result update
  
  // State Changes
  LOCKED = 'locked',                // {locked: bool}
  TIMER = 'timer',                 // {endsAt: unix_ms, remaining: seconds}
  TIMER_EXPIRED = 'timer_expired',  // {}
  
  // Participants
  PARTICIPANTS = 'participants',    // {count: 50, voterNames?: []}
  VOTER_JOINED = 'voter_joined',    // {count}
  VOTER_LEFT = 'voter_left',        // {count}
  
  // Feedback
  FEEDBACK_RECEIVED = 'feedback_received',  // {feedback_count: 5}
  EMOJI_PING = 'emoji_ping',        // {emoji: '👍', count: 3}
  
  // Special Modes
  SPEED_ROUND = 'speed_round',      // {scores: {voterId: points}}
  TEAM_UPDATE = 'team_update',      // {teams, colors, scores}
  ENERGIZER_STATE = 'energizer_state', // {kind,status,leaderboard?,badges?,currentIndex?}
  
  // Errors & Control
  ERROR = 'error',                  // {code, message}
  SESSION_CLOSED = 'session_closed', // {} (session ended)
}
```

**Example Messages**:
```json
// Server sends current question & results to newly connected voter
{
  "type": "init",
  "data": {
    "session": {
      "id": "sess_abc123",
      "title": "Q1 Planning",
      "participants": 50
    },
    "question": {
      "id": "q1",
      "type": "multiple_choice",
      "text": "Which option?",
      "options": ["Option A", "Option B", "Option C"]
    },
    "results": {"0": 15, "1": 20, "2": 10},
    "total": 45
  },
  "timestamp": 1712000000100
}

// Server broadcasts result update
{
  "type": "results_updated",
  "data": {
    "results": {"0": 16, "1": 21, "2": 10},
    "total": 47
  },
  "timestamp": 1712000000150
}

// Server sends timer countdown
{
  "type": "timer",
  "data": {
    "endsAt": 1712000030000,
    "remaining": 15
  },
  "timestamp": 1712000000100
}
```

---

## LIVE Energizer v1 Extension

Quick Finger and Team Quiz run through the existing WebSocket channel when `LIVE_ENERGIZERS_ENABLED` is enabled. Presenters send `energizer_activate` and, for multi-step flows, `energizer_advance`; voters send `energizer_answer`. `SessionRoom` broadcasts `energizer_state` snapshots with progress, leaderboard, and badge information suitable for participant and presenter views.

Activation requires presenter role plus `energizer:activate` whenever the socket carries an explicit permission attachment. Owner/admin permissions include activation; built-in members do not receive it by default unless a custom role grants it.

Realtime audit evidence is written to D1 with sanitized labels:

- `ws.energizer_activated`
- `ws.energizer_activation_denied`
- `ws.energizer_answered`
- `ws.energizer_advanced`
- `ws.energizer_completed`

Audit snapshots may include kind, status, counts, current index, and denial reason. They must not include prompt text, participant free text, answer values, emails, bearer tokens, SAML material, Stripe identifiers, or magic links.

---

## SessionRoom Durable Object

**File**: `functions/api/SessionRoom.ts` (800 lines)

### State Structure (Persisted)

```typescript
interface SessionRoomState {
  // Session metadata
  sessionId: string
  ownerId: string
  status: 'lobby' | 'live' | 'speed_round' | 'closed'
  
  // Questions
  questions: Question[]
  currentQuestionIndex: number
  
  // Results
  results: Record<string, number>      // option → vote count
  rawAnswers: Record<string, string>   // voterId → text (wordcloud)
  consentLog: {option: string, objections: string[]}[]
  
  // Participants
  voters: Set<string>                  // voterId set
  voterNames: Map<string, string>      // voterId → name (presenter only)
  
  // Configuration
  timerConfig?: {defaultSeconds: number, autoAdvance: bool}
  currentTimer?: {endsAt: number, totalSeconds: number}
  locked: boolean
  anonymityMode: 'none' | 'partial' | 'full'
  
  // Deduplication
  votedVoters: Set<string>             // Already voted on current Q
  maxVoters: number                    // Plan-based limit
}
```

### In-Memory State (Per Instance)

```typescript
class SessionRoom {
  state: DurableObjectState       // Persisted
  storage: DurableObjectStorage   // KV-like interface
  
  // In-memory maps (reset on restart)
  voterMeta: Map<voterId, {
    ipHash: string
    fingerprint: string
    tag: 'registered' | 'anonymous' | 'bot'?
  }>
  
  emojiRateLimits: Map<voterId, {
    lastEmojiAt: number
    cooldownMs: 5000  // 1 emoji per 5s
  }>
  
  crowdInputBuffer: {
    votes: Map<voterId, answer>
    emojis: Map<emoji, count>
    timestamp: number
  }
  
  debounceTimer?: ReturnType<typeof setTimeout>   // Workers: timer/alarm pattern per implementation
}
```

### HTTP Endpoints (Internal)

**Usage**: Called from Functions to init/close DO. Paths are **relative to the DO routing stub** in your Worker — **search `SessionRoom` + `fetch` in repo** for exact URLs (avoid hard-coding `/api/do-sessions/...` unless code matches).

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| `POST` | `/init` | Initialize session state | `{questions, config}` | `{ok}` |
| `POST` | `/close` | Close session, finalize results | `{}` | `{ok, results}` |
| `POST` | `/speed-round/init` | Start speed round | `{questions, timerMs}` | `{ok}` |
| `POST` | `/timer/start` | Start countdown | `{durationSeconds}` | `{ok}` |
| `POST` | `/timer/cancel` | Cancel timer | `{}` | `{ok}` |
| `DELETE` | `/respondent/:voterId` | Remove voter (disconnect) | `{}` | `{ok}` |
| `GET` | `/` | Get current state snapshot | `{}` | `{state}` |

**Example**:
```bash
# Initialize DO after session starts
POST https://qesto.com/api/do-sessions/sess_abc123
Authorization: Bearer ${INTERNAL_SECRET}
Content-Type: application/json

{
  "action": "init",
  "questions": [...],
  "config": {
    "timerDefault": 30,
    "anonymity": "full",
    "maxVoters": 1000
  }
}

Response:
{
  "ok": true,
  "wsUrl": "wss://..."
}
```

---

### WebSocket Handlers

#### 1. Connection Acceptance
```typescript
async handleWebsocketUpgrade(request, env) {
  // Extract JWT (presenter) or fingerprint (voter)
  const auth = extractAuth(request)
  
  // Determine role
  const role = auth.userId === sessionOwnerId ? 'presenter' : 'voter'
  
  // Check voter capacity (plan-based)
  if (role === 'voter' && voters.size >= maxVoters) {
    return new Response('Max voters reached', {status: 503})
  }
  
  // Check voter dedup (IP hash + fingerprint)
  const voterId = generateVoterId(request, auth)
  if (isBot(voterId)) {
    return new Response('Duplicate detected', {status: 1008})
  }
  
  // Accept upgrade
  return new WebSocketPair()
}
```

#### 2. Message Dispatch
```typescript
async handleMessage(message: ClientMessage, voterId: string, role: 'voter' | 'presenter') {
  const msg = JSON.parse(message)
  
  // Check rate limits
  if (msg.type === 'emoji' && isRateLimited(voterId)) {
    return  // Ignore
  }
  
  // Route by role & message type
  switch (msg.type) {
    case 'vote':
      return await handleVote(msg.data, voterId, role)
    case 'emoji':
      return await handleEmoji(msg.data, voterId)
    case 'advance':
      if (role !== 'presenter') return  // Reject
      return await handleAdvance()
    // ...
  }
}
```

#### 3. Vote Accumulation
```typescript
async handleVote(data: {questionId, selectedIndex}, voterId, role) {
  const {questionId, selectedIndex} = data
  
  // Check if already voted on this question (allow revote on retract)
  if (votedVoters.has(voterId) && !allowMultiple) {
    return  // Reject
  }
  
  // Record vote
  results[selectedIndex] = (results[selectedIndex] || 0) + 1
  votedVoters.add(voterId)
  resultTotal++
  
  // Debounce broadcast (GAM-001)
  crowdInputBuffer.votes.set(voterId, selectedIndex)
  scheduleDebounce(100)  // Wait 100ms before broadcasting
  
  // Return ACK
  broadcastToAll({
    type: 'vote_ack',
    data: {voterId, questionId}
  })
}
```

#### 4. Broadcast Deduplication
```typescript
broadcastToAll(message: ServerMessage) {
  for (const [voterId, ws] of this.webSockets) {
    const role = getRoleForVoter(voterId)
    
    // Sanitize names for non-presenters
    if (role === 'voter' && message.data.voterNames) {
      delete message.data.voterNames
    }
    
    // Send
    ws.send(JSON.stringify(message))
  }
}
```

---

## Session Modes

### Mode 1: Regular Live Session

```
DRAFT → POST /sessions/:id/start → LIVE (DO inits)
  ↓
Voters join via code/link
Presenter advances questions
Each question: timer (optional) → vote → broadcast results
  ↓
Presenter closes session → POST /sessions/:id/close
  ↓
CLOSED (finalize D1 decisions, AI tagging)
```

**Timeline**:
1. **Question shown** → Server broadcasts `QUESTION` message
2. **Timer (optional)** → Server broadcasts `TIMER` (countdown every 5s)
3. **Voting open** → Voters send `VOTE` messages
4. **Results visible** → Server broadcasts `RESULTS` in real-time
5. **Timer expires** → Server broadcasts `TIMER_EXPIRED`
6. **Lock** → Presenter sends `LOCK`, server broadcasts locked state
7. **Advance** → Presenter sends `ADVANCE`, repeat from step 1

---

### Mode 2: Speed Round

```
Mid-session, presenter enables Speed Round
  ↓
POST /sessions/:id/speed-round/init
  ↓
Questions rapid-fire with 10-20s timers
Each correct answer: +1 point
Leaderboard visible to all
  ↓
Speed round ends (auto or manual)
```

**Speed Round Messages**:
```json
// Server: Start speed round
{
  "type": "speed_round",
  "data": {
    "questions": [
      {id: "q1", text: "What is 2+2?", correctIndex: 2},
      {id: "q2", text: "Capital of France?", correctIndex: 0}
    ],
    "scoringMode": "points",
    "scores": {}
  }
}

// Voter votes (immediate feedback)
{
  "type": "vote",
  "data": {questionId: "q1", selectedIndex: 2}
}

// Server: Results + scoring
{
  "type": "speed_round",
  "data": {
    "scores": {
      "voter1": {points: 2, correct: 2},
      "voter2": {points: 1, correct: 1}
    }
  }
}
```

---

### Mode 3: Async Voting

```
Enable async voting: PATCH /sessions/:id/enable-async-poll
  ↓
Question stays open for 24-72 hours
No live presenter needed
Voters vote via public link (no auth)
  ↓
Auto-close after duration
Results available immediately
```

**Async Voting Flow**:
```
1. PATCH /sessions/:id/enable-async-poll {durationHours: 24}   ← align [[SPEC_BACKEND.md]] §2
   → Session transitions to async mode
   → Generate public link
   
2. Voters access link, see question, vote
   → POST /sessions/:id/async-vote {voterId, selectedIndex}
   → Recorded in SESSIONS_KV (async-vote:*) + D1
   
3. Duration expires → Auto-close
   → Finalize results
   → Send email summary to owner
```

---

### Mode 4: Team Mode

```
Teams enabled in session config
  ↓
Voters assigned to teams (by tag or manual)
  ↓
Results aggregated by team
Leaderboard shows team scores
  ↓
Presenter can see team names, individual names
```

**Team Mode Initialization**:
```json
{
  "type": "team_mode_init",
  "data": {
    "teams": ["Team A", "Team B", "Team C"],
    "colors": {
      "Team A": "#14B8A6",
      "Team B": "#8B5CF6",
      "Team C": "#0EA5E9"
    }
  }
}
```

**Team Results**:
```json
{
  "type": "team_update",
  "data": {
    "teams": ["Team A", "Team B", "Team C"],
    "scores": {
      "Team A": 45,
      "Team B": 38,
      "Team C": 42
    },
    "breakdown": {
      "0": {
        "Team A": 10,
        "Team B": 8,
        "Team C": 9
      },
      "1": {
        "Team A": 15,
        "Team B": 12,
        "Team C": 11
      }
    }
  }
}
```

---

## Voter Deduplication (PSM-007)

**Goal**: Prevent duplicate voting from same person using multiple devices/browsers.

**Method**: Browser fingerprinting + IP hash

```typescript
function getFingerprint(request: Request): string {
  // Combine:
  // 1. User-Agent
  // 2. Accept-Language
  // 3. Accept-Encoding
  // 4. ColorDepth (screen.colorDepth)
  // 5. Resolution (window.innerWidth x window.innerHeight)
  // 6. Timezone (Intl.DateTimeFormat().resolvedOptions().timeZone)
  // 7. CPU cores (navigator.hardwareConcurrency)
  
  const components = [
    request.headers.get('User-Agent'),
    request.headers.get('Accept-Language'),
    request.headers.get('Accept-Encoding'),
    // ... more
  ]
  
  return encodeBase36(sha256(components.join('|')).slice(0, 12)) // pseudocode: use project crypto helpers
}

function getVoterId(request: Request, auth?: Auth): string {
  if (auth && auth.userId) {
    // Registered user: use userId
    return auth.userId
  }
  
  // Anonymous: IP hash + fingerprint
  const ipHash = sha256(request.headers.get('CF-Connecting-IP')).substring(0, 8)
  const fp = getFingerprint(request)
  
  return `anon_${ipHash}_${fp}`
}
```

**Handling Collisions**:
- Same voterId votes twice on same question → 2nd vote counted only if `allowMultiple = true`
- Otherwise → Error, no duplicate recorded

---

## Reconnection Logic

```typescript
// Client detects disconnect
ws.addEventListener('close', () => {
  // Try to reconnect (exponential backoff)
  reconnectAttempts = 0
  
  async function reconnect() {
    const newWs = new WebSocket(wsUrl, `qesto.bearer.${token}`)
    
    newWs.addEventListener('open', () => {
      // Request state snapshot
      send({type: 'request_state', data: {}})
      
      // Server responds with current question + results
      // Client updates local state without re-rendering (smooth)
    })
    
    newWs.addEventListener('error', () => {
      reconnectAttempts++
      if (reconnectAttempts < 5) {
        setTimeout(reconnect, Math.pow(2, reconnectAttempts) * 1000)
      }
    })
  }
  
  reconnect()
})
```

---

## Performance & Scaling

**Constraints** (ARCH-005):
- Max voters per session (DO): 1000-10000 (plan-based)
- Max broadcast latency: <100ms
- WebSocket message backpressure: Queue up to 1000 messages per connection

**Optimization**:
- Debounce result broadcasts (GAM-001): 100ms batch window
- Compress large result objects before sending
- Use binary frames for high-frequency updates (future)

---

## AI usage recipe (copy)

1. “New `ClientMessage` type” → add to **WebSocket Messages** + `useSession` reducer in [[SPEC_FRONTEND.md]].  
2. “Dedup bug” → **Voter Deduplication** + SESSIONS_KV keys in [[SPEC_DATAMODEL.md]].  
3. “DO crash” → **Close codes** + **SessionRoom** persisted state.  

**Checklist:** `GET` upgrade stated • async enable = **PATCH** • no `toBase36` without helper • Related links = file + § not fake anchors.

---

## Related References

- [[SPEC_CORE.md#real-time-architecture]] — Architecture overview
- [[SPEC_BACKEND.md]] — **§2 Sessions** lifecycle + `/ws` row
- [[SPEC_FRONTEND.md#hooks-api]] — `useSession` client contract
