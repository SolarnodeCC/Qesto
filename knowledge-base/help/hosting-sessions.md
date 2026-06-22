---
id: hosting-sessions
title: Hosting and Running Sessions
topic: getting-started
scope: free
excerpt: Session lifecycle, host controls, presenter view, duplicating sessions, and vote policies.
updated: 2026-06-21
version: 1.0
---

# Hosting and Running Sessions

## Session States

Every session moves through these states:

```
DRAFT → ENERGIZING (optional) → LIVE → CLOSED → ARCHIVED
```

| State | What it means |
|-------|---------------|
| **DRAFT** | Configure questions, energizers, and settings. Not joinable yet. |
| **ENERGIZING** | Warm-up activities run; participants can join via WebSocket. |
| **LIVE** | Main questions are active; real-time voting. |
| **CLOSED** | Interaction stopped; results and insights available. |
| **ARCHIVED** | Historical record for compliance or reference. |

**Important:** Participants cannot join a DRAFT session. Share the link only after you click **Start**.

## Going Live

### Without energizers

1. Finish setup in DRAFT
2. Click **Start** on the Launchpad
3. Session goes directly to **LIVE**
4. Share the join link or QR code

### With energizers

1. Add energizers in DRAFT
2. Click **Start** → session enters **ENERGIZING**
3. Participants join and complete warm-up activities
4. Click **Start Questions** to move to **LIVE**

## Host Controls During LIVE

From the **Launchpad** or **Present** view:

- **Next / Previous** — move between questions
- **Reveal results** — show aggregated responses to participants (when enabled)
- **Participant count** — see who is connected
- **Close session** — end the session for everyone

Configuration changes during LIVE go through the realtime connection — do not edit via REST while live.

## Presenter vs Participant View

- **Presenter view** — full host console with controls (`/present` or Launchpad)
- **Participant view** — voting UI only; no host controls

Only the session owner or team members with **Launch** permission can present.

## Session Settings (Set in DRAFT)

Configure these in the session wizard before starting:

### Anonymity

- **Not anonymous** — names visible to host
- **Partial** — limited attribution
- **Zero-knowledge** — maximum privacy for sensitive topics

### Vote policy

- **One vote** — single submission per question (default)
- **Multiple votes** — for multi-select and upvote question types
- **Reactions** — participants can update their choice while the question is open

### Session mode

- **Reflection mode** — host-paced; you control timing
- **Quick mode** — automatic question timing for faster sessions

## Adding Questions After Start

- **Existing questions** — locked once LIVE; you cannot edit wording or options
- **New questions** — you can add questions during a live session in some configurations

Plan your question flow in DRAFT when possible.

## Duplicating a Session

Reuse a successful format:

1. Dashboard → find the session
2. Click **Duplicate** (or the duplicate action on the session card)
3. Enter a new title
4. A new DRAFT copy is created with the same questions and settings

Useful for recurring meetings, retros, or all-hands formats.

## Deleting and Archiving

- **Delete** — permanently removes a DRAFT session (cannot undo)
- **Close** — ends a LIVE session; results preserved
- **Archive** — moves closed sessions to historical storage (Chorus plan custom roles may restrict this)

Export CSV before deleting if you need a local backup (Signal+).

## Preflight Checklist

Before **Open lobby**, the Launchpad runs a preflight check:

- At least one question (or energizer-only flow configured)
- Valid question options (e.g. multiple choice needs 2+ options)
- Plan limits respected (participant cap)

Fix any warnings before starting.

## Tips for Smooth Sessions

1. **Test join flow** — open the link in an incognito window before the real audience arrives
2. **Share link early** — during ENERGIZING so people connect before the first question
3. **One network** — ask remote participants to avoid switching WiFi mid-session
4. **Close when done** — triggers insights generation and frees resources

## Questions?

**Q: Can I run two sessions at once?**
A: Yes, on all plans. Each session is independent.

**Q: Can someone else host my session?**
A: Add them to your team with **Launch session** permission, or transfer ownership via team settings.

**Q: What happens if I close my laptop mid-session?**
A: The session stays live on the server. Reopen the presenter link to regain control.
