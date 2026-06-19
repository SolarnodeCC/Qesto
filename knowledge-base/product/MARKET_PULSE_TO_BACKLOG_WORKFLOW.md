# Weekly Market Pulse → Backlog Integration Workflow

How the Product Owner translates weekly market research into backlog prioritization and story context.

---

## The Weekly Workflow (Recommended: Monday Morning)

### Step 1: Read the Weekly Market Pulse (5 minutes)

**When**: Every Monday morning (or on schedule)  
**What**: Open `/knowledge-base/product/research/WEEKLY_MARKET_PULSE.md`  
**Scan for**:
- Competitor activity (new features, pricing changes)
- Customer sentiment (pain points, feature requests, sentiment shifts)
- Market trends (emerging themes)
- Backlog recommendations (agent suggests stories to prioritize)

**Example**:
```
# WEEKLY MARKET PULSE (Week of May 19, 2026)

## Competitor Activity
- Mentimeter launched "AI-powered facilitator coaching" 
  → Implies they're investing in facilitator support tools

## Customer Sentiment  
- Reddit r/facilitation: 12 posts about "anonymity concerns with Mentimeter"
  → High-signal: customers don't trust Mentimeter's anonymity claims
- G2 review: "Slido doesn't support anonymous feedback loops"
  → Customers asking for this feature

## Top Backlog Recommendations
1. **PRIVACY-XXX** (Transparent anonymity guarantee)
   - Customer demand: HIGH | 23 mentions this week
   - Competitive signal: Both Mentimeter and Slido weak here
   - Action: Prioritize if not already in the active train

2. **FEAT-YYY** (Real-time facilitator insights)
   - Competitor signal: Mentimeter launching similar feature
   - Action: Accelerate if in roadmap; consider pulling forward
```

### Step 2: Assess Impact on Current Backlog (10 minutes)

**Decision 1: Do any findings change prioritization?**

```
Loop through findings:

For each finding:
  IF competitive threat (competitor shipped feature we don't have):
    → Consider pulling story forward in roadmap
    → Mark as P1 or P0 (priority boost)
    
  IF customer demand signal (high mentions across communities):
    → Validate with customer interviews (if possible)
    → Link story to evidence (add MARKET-RESEARCH tag)
    
  IF market opportunity (customers asking for unmet need):
    → Check if story exists in backlog
    → If not, create new story with research context
    → Rank for prioritization
```

**Example decision tree**:

```
Finding: "Facilitators struggling with real-time engagement metrics"
  → Frequency: 45 mentions (high)
  → Competitive gap: Mentimeter weak here
  → Check: Is FEAT-XXX "Real-time engagement metrics" in backlog?
    → YES: Move from P2 → P1 (prioritize higher)
    → NO: Create new story with this research context

Finding: "Mentimeter launched AI-powered session coaching"
  → Competitive threat: Medium (feature exists, not differentiation)
  → Check: Do we have AI coaching roadmapped?
    → YES: Accelerate timeline if possible
    → NO: Add to AI roadmap (future wave)
```

### Step 3: Annotate Stories with Research Context (ongoing)

**When**: As you review/groom stories this week  
**What**: Add `MARKET-RESEARCH:` tags to stories that are validated by market research

**Format**:
```
Story: FEAT-XXX - Real-time engagement metrics for facilitators

## Market Research Context
MARKET-RESEARCH: Facilitator pain point (45 mentions)
- Source: Reddit r/facilitation, LinkedIn posts
- Frequency: HIGH | 23 mentions (last month)
- Customer quote: "I wish I could see if people are engaged without asking"
- Competitive gap: Mentimeter/Slido don't offer this
- Customer segment: Facilitators, trainers
- Validation: This story addresses pain point that 45% of facilitators struggle with

## Why Prioritize
1. High-frequency customer ask (45 mentions across communities)
2. Competitive gap (Mentimeter weak here)
3. Aligns with Qesto's "real-time insights" positioning
```

**Example annotations** (from CUSTOMER_PAIN_POINTS.md):

| Story | Pain it addresses | Frequency | Segment | Market Research Tag |
|-------|------------------|-----------|---------|-------------------|
| **FEAT-XXX**: Real-time engagement metrics | "Passive participants" | 45 mentions | Facilitators | MARKET-RESEARCH:ENGAGEMENT |
| **FEAT-YYY**: AI-powered session recap | "Time-consuming synthesis" | 25 mentions | Trainers | MARKET-RESEARCH:AI-RECAP |
| **AUTH-015**: Transparent anonymity guarantee | "Anonymity + trust" | 35 mentions | Facilitators, HR | MARKET-RESEARCH:PRIVACY |
| **PRIVACY-ZZZ**: GDPR audit log | "GDPR-compliant feedback" | 40 mentions | HR | MARKET-RESEARCH:COMPLIANCE |

---

## Integration with Release-Train Planning

### Before Release-Train Planning

1. **Review last week's market pulse** (5 min)
2. **Check for new competitive threats** (3 min)
3. **Note any high-frequency customer pain points** (2 min)
4. **Flag stories that should be prioritized based on market data** (5 min)

### During Release-Train Planning

When prioritizing stories, reference market research:

```
Story A: FEAT-XXX "Real-time engagement metrics"
- Capacity: 5 points
- Priority: P1 (before planning) → now consider P0 based on market data
- Decision: "Market research shows 45 mentions of this pain point from facilitators.
  High-frequency ask. Competitor gap (Mentimeter weak here). Prioritize."
- Action: Pull into the active train (BACKLOG_ACTIVE.md) if capacity allows

Story B: FEAT-ABC "Export to PDF"
- Capacity: 3 points
- Priority: P2 (low customer ask, mostly nice-to-have)
- Market signal: Only 5 mentions in reviews (low)
- Decision: "Low-frequency ask in market research. Defer to next train.
  Focus on high-ROI items this train."
- Action: Keep in backlog, re-prioritize next train
```

---

## Real-World Example: How Market Pulse Informs a Release Train

### Scenario: Release-train planning for RT-2026-06 (Week of May 19)

**Before market pulse**:
```
Train scope (draft):
1. FEAT-ABC - Export to PDF (3pt, P2)
2. FEAT-XXX - Real-time engagement metrics (5pt, P1)
3. PERF-001 - Optimize WebSocket latency (5pt, P1)
4. AUTH-015 - Transparent anonymity guarantee (8pt, P1)
5. INTEGRATE-001 - Slack integration (8pt, P2)
Total: 29 points (fits a 2–3 week train; target 40–60 pts)
```

**Weekly market pulse arrives Monday morning**:
```
## Competitor Activity
- Mentimeter: No new features this week

## Customer Sentiment
- Reddit: 12 posts about anonymity concerns with Mentimeter
- G2: HR professionals asking for "GDPR audit trail"
- LinkedIn: Trainers frustrated with "no real-time feedback during sessions"

## Backlog Recommendations
1. Prioritize AUTH-015 (Transparent anonymity guarantee)
   - Customer demand: 35 mentions across communities
   - Competitive gap: Both Mentimeter and Slido weak here
   
2. Consider adding FEAT-XXX (Real-time engagement metrics)  
   - Customer demand: 45 mentions
   - Competitive gap: Mentimeter/Slido gap
```

**PO updates the train scope based on market data**:

```
**DECISION 1**: Move AUTH-015 (Transparent anonymity guarantee) from P1 to P0
Reasoning: 35+ customer mentions + GDPR requirement + competitive gap

**DECISION 2**: Pull FEAT-XXX (Real-time engagement metrics) into the train
Reasoning: 45 mentions from facilitators (high signal) + competitive gap

**DECISION 3**: Defer FEAT-ABC (Export to PDF) to next train
Reasoning: Only 3 mentions in customer research (low signal)

**NEW TRAIN SCOPE** (re-prioritized in BACKLOG_ACTIVE.md):
1. AUTH-015 - Transparent anonymity guarantee (8pt, P0) ← moved up
2. FEAT-XXX - Real-time engagement metrics (5pt, P1) ← added
3. PERF-001 - Optimize WebSocket latency (5pt, P1) ← keep
4. INTEGRATE-001 - Slack integration (5pt, P2) ← lower priority
Total: 23 points (within the 40–60 pt train cap)

DEFERRED TO NEXT TRAIN:
- FEAT-ABC - Export to PDF (low customer demand)
```

---

## Key Decision Points (When to Use Market Research)

| Decision | Market Research Input | Example |
|----------|----------------------|---------|
| **Backlog prioritization** | Customer frequency + competitive gap | "45 mentions of X in communities → P1" |
| **Go/no-go on feature** | Market demand signal | "Only 3 mentions → defer; 45 mentions → prioritize" |
| **Competitive response** | Competitor activity + customer reaction | "Mentimeter launched X, customers want it → accelerate our Y" |
| **Segment focus** | Which customers ask most | "HR teams ask for GDPR → prioritize compliance stories" |
| **Roadmap sequencing** | Market trends + TAM | "GDPR demand growing → build compliance features Q2-Q3" |
| **Story acceptance criteria** | Customer pain specifics | "Acceptance criteria: anonymity must be verifiable by audit log" |

---

## Workflows by Cadence

### Weekly (Every Monday)

1. Read `/knowledge-base/product/research/WEEKLY_MARKET_PULSE.md` (5 min)
2. Assess if any findings change the active train's priorities (10 min)
3. Annotate stories with MARKET-RESEARCH tags (10 min)
4. Flag new stories to create (5 min)

### Per release train (before train planning)

1. Review the pulses since the last train
2. Identify trends (not just one-off mentions)
3. Decide go/no-go on contested stories
4. Brief on market context for the train

### Monthly (End of month)

1. Read `/knowledge-base/product/research/CUSTOMER_PAIN_POINTS.md` (deep dive)
2. Compare to current backlog: are we addressing top pain points?
3. Identify gaps (high-demand pain points with no story)
4. Create new stories or reprioritize existing ones

### Quarterly (Planning cycle)

1. Review `/knowledge-base/product/research/COMPETITOR_PROFILES.md`
2. Review `/knowledge-base/product/research/MARKET_TRENDS.md`
3. Inform roadmap for next quarter
4. Adjust positioning based on competitive landscape changes

---

## Best Practices

### ✅ DO

- **Read the pulse every Monday** — consistency builds signal detection
- **Link stories to sources** — "45 mentions on r/facilitation" is more credible than "customers want this"
- **Track trends, not one-offs** — one mention = data point; 10+ mentions = signal
- **Debate with evidence** — "Market research shows customers want X" > "I think customers want X"
- **Update backlog tags** — annotate stories so team knows why they're prioritized
- **Create new stories from research** — if customers ask for unmet need, create a story
- **Brief team on market context** — "This train prioritizes GDPR because HR teams asked for it"

### ❌ DON'T

- **Ignore market research** — just because it's not urgent doesn't mean it's not valuable
- **Prioritize based on gut feel alone** — use market data to validate gut instincts
- **Dismiss low-frequency asks** — some niche needs are high-value (e.g., enterprise SSO)
- **Assume one platform = market reality** — triangulate (Reddit + G2 + LinkedIn = stronger signal)
- **Forget competitive context** — feature X matters more if competitors also offer it
- **Lose research context over time** — archive tagged stories for trend analysis later

---

## Example: From Pulse to Backlog to Release Train

### Week 1: Market Pulse Published

```
WEEKLY_MARKET_PULSE.md:
"HR professionals asking for GDPR audit logs (12 mentions on r/HR, 8 on G2)"
```

### Week 2: PO Action

```
BACKLOG_MASTER.md:
Add story:
  ID: PRIVACY-ZZZ
  Title: GDPR audit log for compliance
  Tags: [P1, MARKET-RESEARCH:COMPLIANCE]
  Research context: "12 HR professionals asking for this across communities"
```

### Week 3: Release-Train Planning

```
During prioritization:
  PO: "PRIVACY-ZZZ has strong market signal (12 mentions). Should prioritize."
  Team: "How big is it?" 
  PO: "8 points. But it unlocks EU enterprise segment (high-value)."
  Decision: Promote into the active train (BACKLOG_ACTIVE.md), deprioritize lower-ROI item
```

### Week 4-5: Implementation

```
PRIVACY-ZZZ story:
  AC: "Admin can download audit log showing consent, deletions, data access"
  Testing: Validated against GDPR requirements in market research
  Outcome: Story ships; unlocks EU compliance for enterprise customers
```

### Week 6: Validation

```
Marketing uses audit log feature in EU sales materials
(Informed by market research showing GDPR as key differentiator)
```

---

## Questions PO Should Ask When Reading Market Pulse

1. **"Do any findings change the active train's priorities?"**
   - If YES → adjust backlog
   - If NO → keep the train scope

2. **"Is this a one-off mention or a trend?"**
   - 1 mention → note for next month
   - 10+ mentions → strong signal, prioritize

3. **"Are competitors responding to this need?"**
   - If YES → competitive threat, accelerate
   - If NO → market gap, opportunity

4. **"What customer segment is asking for this?"**
   - Facilitators? HR? Event hosts? → tailor messaging
   - Use segment to decide if story matters for our TAM

5. **"Do we have a story for this need?"**
   - If YES → link story to research, prioritize higher
   - If NO → create story with research context

6. **"Should this inform our messaging/positioning?"**
   - High-frequency pain point → potential positioning pillar
   - Share with marketing for copy/content strategy

---

## Measuring Impact

Track over time:

- **Stories with market research tags**: Target 50%+ of new/modified stories
- **Time from pulse to prioritization**: 1–2 weeks (research → train)
- **Win rate on market-informed prioritization**: Are market-signal stories delivering value?
- **Backlog freshness**: Monthly review to ensure backlog reflects latest market data

---

**Owner**: Product Owner  
**Cadence**: Weekly pulse → release-train planning → monthly strategy  
**Integration logs**: [`research/MARKET_PULSE_INTEGRATION_*.md`](./research/) (one per integrated pulse week)

**Latest run**: 2026-05-25 — [Week of May 19, 2026](./research/MARKET_PULSE_INTEGRATION_2026-05-19.md)
