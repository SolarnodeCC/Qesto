---
id: templates-and-ai
title: Templates and AI Features
topic: getting-started
scope: free
excerpt: Use session templates, generate questions with AI, and understand AI insights after sessions close.
updated: 2026-06-21
version: 1.0
---

# Templates and AI Features

## Session Templates

Templates save time by pre-loading questions, settings, and structure.

### Qesto templates (curated)

1. Dashboard → **Templates** tab
2. Browse by topic (retrospectives, planning, feedback, etc.)
3. Open a template card → review title, description, and preview
4. Click **Use template** → confirm → session wizard opens with questions pre-filled
5. Edit anything you need, then launch

Each topic includes several starter templates so you can pick the best fit.

### Your team templates

- **Create from session** — save a successful session as a template from the dashboard
- **Create blank** — Templates → **New template**
- Team templates are shared with members who have template read/write permissions

Templates always create a new **DRAFT** session — nothing goes live until you start.

## AI Question Generation

During session setup, use **Generate with AI** to draft questions:

1. Describe your goal (e.g. "30-minute retro for a remote product team")
2. AI suggests question types and wording
3. Review, edit, or remove any suggestion before saving
4. Consent to AI processing when prompted — required for generation

AI runs on Cloudflare Workers AI only; your prompts are not sent to third-party APIs.

### Refining AI output

- Regenerate individual questions or the full set
- Switch question types (poll → open, etc.)
- Add manual questions alongside AI ones

Always review AI content before going live — you are responsible for what participants see.

## AI Insights (Chorus)

After a session **closes**, Qesto can extract themes from open-ended responses:

1. Open the closed session → **Insights** tab
2. Click **Analyze** (if not auto-started)
3. Wait 10 seconds–3 minutes depending on response volume
4. Review theme clusters with exemplar quotes

### What insights need

- Session must be **closed**
- At least one **open** (free-text) question with meaningful answers
- **Chorus plan** — not available on Pulse or Signal

Poll-only sessions show tallies but not AI theme extraction.

### Improving insight quality

- Ask specific open questions ("What blocked you this sprint?" not "Any feedback?")
- Aim for 10+ varied responses per open question
- Use one language per session when possible

See Troubleshooting → AI Insights if generation stalls or looks wrong.

## AI and Privacy

- AI insights process aggregated response text, not participant identities (in anonymous modes)
- AI-generated session metadata (`ai_generated`, consent timestamp) is stored for audit
- Hosts review insights before sharing externally
- No participant PII is sent to external AI providers

## Questions?

**Q: Does AI cost extra?**
A: Included in the Chorus plan for insights; question generation is available on Pulse and above with consent.

**Q: Can I turn off AI for my team?**
A: Simply don't use Generate or Analyze. No AI runs unless you trigger it.

**Q: Will AI replace my question wording exactly in insights?**
A: Themes summarize patterns; exemplar quotes are verbatim from responses, not paraphrased by default.

**Q: Can I save a template from an AI-generated session?**
A: Yes — duplicate or save as template like any other session.
