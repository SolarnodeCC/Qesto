---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Internal Comms Templates
# OWNER: Marketing + Product Owner
# Version: v1.0.0
# Date: 2026-04-24

_Standardized templates for team communications: third-party updates, incident updates, release summaries._

---

## Template 1: Third-Party Update (Slack/Email)

**Use**: Weekly check-in with partners, investors, or stakeholders

**Format**:
```
[Week X, YYYY] Qesto Progress Update

🎯 Shipped This Week
- [Feature/Fix 1]: Brief benefit (closed S-XXX)
- [Feature/Fix 2]: Brief benefit (closed S-YYY)

📊 Key Metrics
- [Metric 1]: [Number] (trend: ↑/→/↓)
- [Metric 2]: [Number] (trend: ↑/→/↓)

🚧 Blockers & Next Steps
- [Blocker]: Owner, due date for resolution
- Next week: [High-level focus]

❓ Questions for [Party]
- [Question 1]
```

**Time target**: 10 min to draft  
**Tone**: Peer, data-driven, specific over vague  
**Max length**: 200 words

---

## Template 2: Incident Update (Slack)

**Use**: During/after production incidents

**Format**:
```
🚨 INCIDENT: [Brief title] — Started [HH:MM UTC]

**Status**: [Investigating / Mitigating / Resolved]
**Impact**: [Affected service, user count, duration]
**Current action**: [What we're doing right now]

**Timeline**:
- [HH:MM] Detected by [monitoring / customer report]
- [HH:MM] Root cause identified: [brief explanation]
- [HH:MM] Fix deployed
- [HH:MM] Monitoring stable — all clear

**Next**: Postmortem scheduled [Date] — join us to prevent recurrence.

Updates every 15 min until resolved.
```

**Time target**: 5 min to draft  
**Tone**: Transparent, action-oriented, empathetic  
**Cadence**: Every 15 min until resolved

---

## Template 3: Release Summary (Email/Blog)

**Use**: Ship day announcement to customers & team

**Format**:
```
Subject: Qesto v[X.Y.Z] — [Headline Benefit]

Hi [Customers/Team],

We shipped Qesto v[X.Y.Z] today! Here's what's new:

### 🚀 Features
- **[Feature 1]**: [One-sentence benefit] (Pro+)
- **[Feature 2]**: [One-sentence benefit] (All plans)

### ✨ Improvements
- [Improvement 1]: [Specific what changed]
- [Improvement 2]: [Specific what changed]

### 🐛 Fixes
- Fixed [issue] affecting [users]
- Fixed [issue] in [context]

### ⚠️ Breaking Changes
- [If any] Migration guide: [link or brief steps]

### 📚 Learn More
- Docs: [link]
- Pricing (new features): [link]
- Blog post: [link]

Questions? Reply to this email or hit up support@qesto.com.

Cheers,  
The Qesto Team
```

**Time target**: 20 min to draft  
**Tone**: Friendly, benefit-focused, specific  
**Distribution**: Email + blog + Slack

---

## Wave 1 Examples (Proof of Concept)

### Example 1: Third-Party Update

```
[Week 16, 2026] Qesto Progress Update

🎯 Shipped This Week
- Wave 1 Skill Framework: Standardized 6 priority skills with canonical headers (closed ARCH-001)
- Agent Role Clarity: Aligned all 11 agents with explicit boundaries (closed ARCH-002)
- Smoke Test Suite: Integration tests for auth → session → billing flow (closed QA-001)

📊 Key Metrics
- Skill quality alignment: 100% of priority skills (↑ from 60% baseline)
- Agent boundary clarity: 11/11 agents documented (↑ new metric)
- Test coverage: 14 smoke tests, 0% flake rate (↑ new)

🚧 Blockers & Next Steps
- Wave 1 execution ongoing: 4/6 skills have pilot deliverables
- Next week: MCP server scaffold + decision-doc template publication

❓ Questions for Partners
- MCP server readiness: On track for May 1 production?
```

### Example 2: Incident Update

```
🚨 INCIDENT: WebSocket reconnection timeout — Started 14:23 UTC

**Status**: Resolved  
**Impact**: LIVE sessions — users had to refresh (duration: 8 min, ~50 users affected)  
**Current action**: Monitoring for recurrence

**Timeline**:
- 14:23 Alerts fire: WS connection pool at max
- 14:28 Root cause: DO garbage collection paused event handler
- 14:31 Fix deployed: Increased GC pause tolerance
- 14:35 All WS connections stable — users can join without refresh

**Next**: Postmortem scheduled Fri Apr 26, 3pm UTC. We'll review DO memory tuning and add synthetic WS tests.
```

### Example 3: Release Summary

```
Subject: Qesto v0.2.0 — Wave 1 Foundations Released

Hi Team,

We shipped Qesto v0.2.0 today! Here's what's in this release:

### 🚀 Features
- **Wave 1 Skill Framework**: Standardized agent + skill library for consistent AI-assisted workflows (Pro+)
- **Internal MCP Server**: Query sessions, team audits, and decisions programmatically (Admin tools)

### ✨ Improvements
- Authentication: Improved magic link token entropy + TTL validation
- Session state machine: Explicit DRAFT/LIVE/CLOSED guards prevent race conditions
- Flaky test quarantine: Automated process to isolate + track test stability

### 🐛 Fixes
- Fixed: WebSocket reconnect timeout on long-running LIVE sessions
- Fixed: Race condition in session state transitions
- Fixed: Billing limit enforcement on free tier (was allowing 55 participants)

### 📚 Learn More
- Docs: https://docs.qesto.ai/v0.2.0
- Pricing update: New "Pro" tier with AI insights — see pricing page

Questions? Reply here or support@qesto.com.

Cheers,  
The Qesto Team
```

---

## Quality Gate Checklist

Before sending **any** internal comms:
- [ ] Numbers are verified (no typos in metrics)
- [ ] Tone matches audience (peer for stakeholders, transparent for incidents)
- [ ] Max 20 words per sentence (readability)
- [ ] No jargon (architecture/implementation detail invisible to reader)
- [ ] Links work (docs, pricing, blog)
- [ ] Proofread for typos

---

## Metrics

- **Time to draft**: Target < 15 min average (was 45 min ad-hoc)
- **Update accuracy**: Zero factual errors post-send
- **Reader clarity**: Internal feedback (clarity scale 1–5, target ≥ 4.5)

---

## Change Log
- 2026-04-24: v1.0.0 created — 3 templates (3P update, incident, release) with examples and quality gates.
