---
name: market-research-templates
description: Output templates for the market-research skill — competitor, community, review, LinkedIn, web-search, on-demand query, weekly pulse, backlog annotation, and win/loss formats. Load alongside market-research.md when producing a research deliverable.
---
# Skill: Market Research Output Templates
# VERSION: v1.0.0
# OWNER: Product Owner

Companion to `.claude/skills/market-research.md`. That file holds the ICP, competitors,
methodology, and governance; this file holds the fill-in templates. Keep methodology
there and templates here so neither file bloats.

---

## Source 1 — Competitor Website
```
COMPETITOR: [Name]

Recent Activity (last 3 months):
- [Release]: [What it solves]
- [Pricing change]: [Direction and rationale]

Feature Comparison vs. Qesto:
| Feature | Competitor | Qesto |
|---------|------------|-------|
| [Feature] | [capability] | [capability] |

Positioning Statement: [Their positioning in 1–2 sentences]

Qesto Differentiation:
- [Edge]: [Why it matters to customers]
```

## Source 2 — Reddit & Communities
```
REDDIT RESEARCH: [Topic/Community]

Top Pain Points:
1. [Pain]: [Quote/evidence] (r/[community], [date])
   Frequency: [High/Med/Low] | Mentions: [N] | Personas: [...]

Feature Requests (ranked by frequency):
1. [Request]: [Quote] ([N] mentions) | Why it matters: [value] | Qesto has it? [Y/N/Partial]

Competitor Mentions:
- [Competitor] pain points / switching triggers: [...]

Segment-specific Insights: [Trainers / HR / Event hosts care about ...]

Sample quotes: "[Quote]" (r/[community])
```

## Source 3 — Review Platforms (G2, Capterra, ProductHunt)
```
REVIEW PLATFORM RESEARCH: [Competitor]

Overall Sentiment: G2 [X]/5 ([N], [timeframe]) | Capterra [X]/5 | ProductHunt [summary]

Top Pros (customer-mentioned): 1. [Pro] — [N] mentions — "[quote]"
Top Cons (customer-mentioned): 1. [Con] — [N] mentions — "[quote]" | Qesto position: [...]

Feature Ratings (G2):
| Feature | Rating | Sentiment |
|---------|--------|-----------|

Pricing Sentiment: + "[great value]" / − "[too expensive]"
Switching Reasons: [Quote] | Qesto advantage: [...]
Segment Breakdown: SMB [themes, X/5] | Enterprise [themes, X/5]
Qesto Positioning Opportunity: [map review pains to Qesto solutions]
```

## Source 4 — LinkedIn & Community Listening
```
LINKEDIN RESEARCH: [Topic/Audience]

Top Discussion Themes: 1. [Theme] — [frequency] — [insight] — examples "[post]"
Facilitator/Trainer Sentiment: pains [...] | requests [...]
Event Host Sentiment: pains [...] | requests [...]
HR/Engagement Sentiment: pains [...] | requests [...]
Competitor Mentions: [sentiment] — "[quote]"
Influencer Voices: [Name] on [topic]: [insight]
Qesto-specific Mentions: [any? sentiment?]
Content Opportunity: [topics to engage this audience]
```

## Source 5 — Web Search & Industry Intelligence
```
MARKET RESEARCH: [Search Topic]

Key Findings: - [Finding]: [source]
Competitor News: - [Announcement]: [implication for Qesto]
Market Trends: - [Trend]: [direction] | [impact on positioning]
Market Sizing: TAM [...] | SAM (Qesto) [...] | Growth [YoY]
Technical Differentiation: [competitors use] vs [Qesto uses] | [advantage]
Sources: - [Source]: [URL]
```

## On-Demand Query Response
```
COMPETITIVE RESEARCH: [Topic]

Findings: - [Finding]: [source] | "[quote]"
Customer Demand: - [signal]: [frequency] | [segment]
Competitive Positioning: [Competitor] emphasizes [approach]; valued for [reasons]
Qesto Positioning Opportunity: - [Option]: [advantage] | [trade-off]
Backlog Context: validates [STORY-ID] | suggests [new story] | priority [rec]
Sources: - [Source]: [URL]
```

## Weekly Market Pulse
```
# WEEKLY MARKET PULSE (Week of [Date])

## Competitor Activity (This Week)
- [Competitor] launched/priced: [detail] — implications: [...]

## Customer Sentiment (This Week)
- Top community question: "[Q]" — [N] mentions | [segment]
- G2 review highlight: "[con × N]" — [Qesto position]

## Market Trends
- [Trend]: [direction] | [action for Qesto?]

## Top Customer Pain Points (Aggregated)
1. [Pain]: [frequency] | validates [STORY-ID]

## Backlog Recommendations
- Prioritize [STORY-ID] based on [finding]

## Qesto Positioning Opportunity
[gap we can exploit]
```

## Backlog Annotation
```
MARKET-RESEARCH: [Finding]
- Source: [Platform] | Frequency: [High/Med/Low], [N] mentions
- Customer segment: [Facilitators/HR/Event hosts/Trainers]
- Competitive signal: [competitor behavior + impact]
- Validation: addresses [pain] that [N]% of [segment] struggle with
```

## Win/Loss Analysis
```
WIN/LOSS ANALYSIS: [Segment]

Why Customers Choose Qesto: 1. [reason]: [frequency] — "[quote]"
Why Customers Switch Away: 1. [reason]: [frequency] — "[quote]" | Mitigation: [...]
Competitive Vulnerability: [Competitor] wins on [capability] — counter via [strategy]
Feature Prioritization Implication: high-ROI (prevent churn) [...] | differentiation [...]
```

## Change Log
- 2026-06-04: v1.0.0 — extracted all output templates from market-research.md (was 524
  lines) to keep methodology and templates separately maintainable.
