# Market Research Repository

Central hub for Qesto's competitive intelligence, customer insights, and market analysis. All research is conducted by the `/market-research` agent and updated regularly to inform product prioritization and positioning decisions.

## Contents

- **COMPETITOR_PROFILES.md** — Deep-dive analysis of Mentimeter, Slido, Kahoot!, Poll Everywhere (features, pricing, positioning, strengths/weaknesses)
- **CUSTOMER_PAIN_POINTS.md** — Aggregated customer insights from Reddit, ProductHunt, G2, Capterra, LinkedIn (organized by segment)
- **MARKET_TRENDS.md** — Industry trends, TAM/SAM analysis, market growth, customer acquisition patterns
- **WIN_LOSS_ANALYSIS.md** — Why customers choose Qesto vs. alternatives, churn reasons, competitive vulnerabilities
- **WEEKLY_MARKET_PULSE.md** — Recurring digest (published ~weekly) with top competitor moves, customer sentiment, backlog recommendations

## How to Use

### For Product Owner
- **Before finalizing roadmap**: Read CUSTOMER_PAIN_POINTS.md and COMPETITOR_PROFILES.md to understand what matters most
- **When prioritizing features**: Check WEEKLY_MARKET_PULSE.md for latest customer demand and competitive activity
- **For backlog contextualization**: Link stories to relevant sections (e.g., "Story #AUTH-015 addresses pain point identified in CUSTOMER_PAIN_POINTS.md")

### For Marketing
- **Positioning and messaging**: Read COMPETITOR_PROFILES.md to understand how competitors position vs. Qesto
- **Content strategy**: Use CUSTOMER_PAIN_POINTS.md to identify messaging angles (what pain points should we address?)
- **Competitive pages**: COMPETITOR_PROFILES.md feeds into `/vs/[competitor]` page content

### For Design/Engineering
- **Understanding customer context**: CUSTOMER_PAIN_POINTS.md explains why certain features matter to specific segments
- **Competitive feature review**: COMPETITOR_PROFILES.md shows what features competitors offer (feature parity analysis)

## Research Methodology

All research is conducted using public sources only:
- **Competitor websites** — Product pages, pricing, blog releases, case studies
- **Reddit & communities** — r/facilitation, r/events, r/training, r/HR, HackerNews
- **Review platforms** — ProductHunt, G2, Capterra
- **LinkedIn** — Posts from facilitators, trainers, event organizers, HR professionals
- **Web search** — Industry trends, analyst reports, announcements

See `/claude/skills/market-research.md` for detailed methodology and data source guidelines.

## Quality Standards

- **Every finding is cited** — sources (URLs, publication dates) provided
- **Sample transparency** — reports note sample size (e.g., "based on 25 Reddit posts, not comprehensive")
- **No speculation** — only factual analysis of public information
- **Regular updates** — competitor profiles quarterly, customer insights monthly, weekly pulse every Monday

## Accessing Market Research

### Quick Start
1. Invoke `/market-research` skill
2. Ask a specific question ("What are competitors doing with AI?") or request a weekly update
3. Agent responds with findings, sources, and backlog implications

### Scheduling Research
- **Weekly**: Market pulse digest published Monday
- **On-demand**: PO can request competitive analysis (2–3 hour turnaround)
- **Monthly**: Deep-dive customer pain point synthesis
- **Quarterly**: Competitor profile updates

## Contributing

When you discover competitive intelligence or customer insights:
1. Note the source (URL, publication date, community)
2. Summarize the finding
3. Flag for market research agent to integrate into relevant document
4. Tag with segment affected (Facilitators / HR / Event hosts / Trainers / Educators)

Example:
```
Source: r/facilitation (May 18, 2026)
Finding: Multiple trainers asking for "anonymous feedback that's GDPR-safe"
Segment: Trainers, HR professionals
Document: CUSTOMER_PAIN_POINTS.md → "Anonymity + GDPR compliance"
```

---

**Owner**: Product Team (via `/market-research` agent)  
**Last updated**: May 2026  
**Next review**: June 2026
